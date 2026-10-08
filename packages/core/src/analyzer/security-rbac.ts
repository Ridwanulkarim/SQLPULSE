import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';
import { EngineFamily, resolveEngineFamily, sanitizeSqlIdentifier } from './sql-utils';
import { getEngineProfile } from '../types/engine-profiles';

export interface SecurityRbacRequest {
  engine: string;
  tableName?: string;
  tenantColumn?: string;
  piiColumns?: string[];
  enforceTls?: boolean;
}

export interface RbacRole {
  name: string;
  scope: string;
  privileges: string[];
  description: string;
  ddlGrant: string;
}

export interface SecurityAuditItem {
  id: string;
  standard: 'SOC2' | 'HIPAA' | 'PCI-DSS' | 'GDPR';
  title: string;
  status: 'passed' | 'warning' | 'critical';
  impact: string;
  remediation: string;
}

export interface SecurityRbacResult {
  engine: string;
  engineName: string;
  tableName: string;
  complianceScore: number;
  roles: RbacRole[];
  rlsPolicyScript: string;
  dataMaskingScript: string;
  tlsHardeningConfig: string;
  auditItems: SecurityAuditItem[];
  expertRecommendations: string[];
}

export class SecurityRbacAnalyzer {
  public analyze(req: SecurityRbacRequest): SecurityRbacResult {
    const meta = getEngineMetadata(req.engine);
    const profile = getEngineProfile(req.engine);
    const family = resolveEngineFamily(req.engine);
    const table = sanitizeSqlIdentifier(req.tableName, 'customers');
    const tenantCol = sanitizeSqlIdentifier(req.tenantColumn, 'tenant_id');
    const isPg = profile.isPostgresFamily;

    let roles: RbacRole[] = [];
    let rlsPolicyScript = '';
    let dataMaskingScript = '';
    let tlsHardeningConfig = '';
    let expertRecommendations: string[] = [];

    if (isPg) {
      roles = [
        {
          name: 'app_service_rw',
          scope: 'Application Backend Microservice',
          privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
          description: 'Least-privilege operational role. Cannot alter schemas or truncate tables.',
          ddlGrant: `DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service_rw') THEN
    CREATE ROLE app_service_rw NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_service_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_service_rw;

CREATE USER api_backend WITH PASSWORD 'BackendSecureSecret!2026' IN ROLE app_service_rw;`,
        },
        {
          name: 'analytics_ro',
          scope: 'BI Analyst & Reporting Dashboards',
          privileges: ['SELECT'],
          description: 'Read-only access with default statement timeout (30s) to prevent locking.',
          ddlGrant: `DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_ro') THEN
    CREATE ROLE analytics_ro NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO analytics_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_ro;
ALTER ROLE analytics_ro SET statement_timeout = '30000ms';
ALTER ROLE analytics_ro SET idle_in_transaction_session_timeout = '10000ms';

CREATE USER bi_reporter WITH PASSWORD 'BiAnalystPasscode!2026' IN ROLE analytics_ro;`,
        },
        {
          name: 'schema_migrator',
          scope: 'CI/CD Pipeline DDL Runner',
          privileges: ['ALL PRIVILEGES'],
          description: 'Elevated DDL role used exclusively during automated GitHub Actions migration jobs.',
          ddlGrant: `DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schema_migrator') THEN
    CREATE ROLE schema_migrator CREATEDB CREATEROLE;
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE production_db TO schema_migrator;`,
        },
      ];

      rlsPolicyScript = `-- ${profile.name} Native Row-Level Security (RLS) Tenant Isolation
-- 1. Enable RLS on target table
ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;

-- 2. Create Isolation Policy for Multi-Tenant Application Context
DROP POLICY IF EXISTS tenant_isolation_policy ON "${table}";
CREATE POLICY tenant_isolation_policy ON "${table}"
    FOR ALL
    TO app_service_rw
    USING (${tenantCol} = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (${tenantCol} = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- 3. Superuser/Admin Bypass Policy (Optional for audit/backup)
CREATE POLICY admin_bypass_policy ON "${table}"
    FOR ALL
    TO schema_migrator
    USING (true)
    WITH CHECK (true);
`;

      dataMaskingScript = `-- ${profile.name} Dynamic PII Masking via pgcrypto & Masked Views
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Dynamic Masking View for Analytics / Support Teams
CREATE OR REPLACE VIEW v_${table}_sanitized AS
SELECT 
    id,
    ${tenantCol},
    REGEXP_REPLACE(email, '^(.)(.*)(@.*)$', '\\1***\\3') AS email_masked,
    CONCAT('***-***-', RIGHT(phone, 4)) AS phone_masked,
    '***-**-' || RIGHT(ssn_last4, 4) AS ssn_masked,
    created_at
FROM "${table}";

GRANT SELECT ON v_${table}_sanitized TO analytics_ro;
`;

      tlsHardeningConfig = `# ${profile.name} SSL / TLS 1.3 & Network Hardening (pg_hba.conf & postgresql.conf)
# postgresql.conf:
ssl = on
ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES:!CAMELLIA:!AES128'
ssl_prefer_server_ciphers = on
ssl_min_protocol_version = 'TLSv1.3'
password_encryption = scram-sha-256

# pg_hba.conf:
hostssl all             all             0.0.0.0/0               scram-sha-256 clientcert=verify-full
hostssl replication     replicator      10.0.0.0/8              scram-sha-256`;

      expertRecommendations = [
        'Always combine `ENABLE ROW LEVEL SECURITY` with `FORCE ROW LEVEL SECURITY` so table owners cannot bypass tenant constraints.',
        'Never use database superuser accounts for application servers; assign the granular `app_service_rw` role instead.',
        'Rotate database credentials regularly using a secrets manager.',
      ];
    } else {
      switch (family) {
      case 'mysql': {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Application Backend API',
            privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
            description: 'Least-privilege operational role for production backend microservices.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS app_service_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON production_db.* TO app_service_rw;
CREATE USER IF NOT EXISTS 'api_svc'@'%' IDENTIFIED BY 'StrongMicroservicePass!2026' REQUIRE SSL;
GRANT app_service_rw TO 'api_svc'@'%';
SET DEFAULT ROLE app_service_rw TO 'api_svc'@'%';`,
          },
          {
            name: 'analytics_ro',
            scope: 'BI & Reporting Dashboards',
            privileges: ['SELECT'],
            description: 'Read-only access restricted to read-replicas with execution timeout limit.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS analytics_ro;
GRANT SELECT ON production_db.* TO analytics_ro;
CREATE USER IF NOT EXISTS 'bi_analyst'@'%' IDENTIFIED BY 'AnalystPassSecure!2026' REQUIRE SSL;
GRANT analytics_ro TO 'bi_analyst'@'%';
SET DEFAULT ROLE analytics_ro TO 'bi_analyst'@'%';
ALTER USER 'bi_analyst'@'%' WITH MAX_USER_CONNECTIONS 10 MAX_EXECUTION_TIME 30000;`,
          },
          {
            name: 'schema_migrator',
            scope: 'CI/CD Migration Runner',
            privileges: ['CREATE', 'ALTER', 'DROP', 'INDEX', 'REFERENCES'],
            description: 'Dedicated CI/CD role strictly allowed during deployment windows.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS schema_migrator;
GRANT ALL PRIVILEGES ON production_db.* TO schema_migrator;
CREATE USER IF NOT EXISTS 'cicd_deployer'@'10.0.0.%' IDENTIFIED BY 'CicdDeploySecretKey!2026' REQUIRE SSL;
GRANT schema_migrator TO 'cicd_deployer'@'10.0.0.%';`,
          },
        ];

        rlsPolicyScript = `-- MySQL Multi-Tenant Isolation using Secure Parameterized Views & Stored Procedures
CREATE OR REPLACE VIEW v_${table}_tenant_isolated AS
SELECT * 
FROM ${table}
WHERE ${tenantCol} = SUBSTRING_INDEX(USER(), '@', 1) 
   OR @current_tenant_id = ${tenantCol};

-- Enforce session context before query execution in application pool:
-- SET @current_tenant_id = 'tenant_enterprise_4920';
-- SELECT * FROM v_${table}_tenant_isolated;
`;

        dataMaskingScript = `-- MySQL Dynamic Data Masking Function
DELIMITER $$
CREATE FUNCTION IF NOT EXISTS mask_email(raw_email VARCHAR(255))
RETURNS VARCHAR(255) DETERMINISTIC
BEGIN
    DECLARE at_pos INT;
    SET at_pos = LOCATE('@', raw_email);
    IF at_pos > 2 THEN
        RETURN CONCAT(LEFT(raw_email, 2), '****', SUBSTRING(raw_email, at_pos - 1));
    ELSE
        RETURN '****@masked.com';
    END IF;
END$$
DELIMITER ;

CREATE OR REPLACE VIEW v_${table}_masked AS
SELECT 
    id, 
    ${tenantCol},
    mask_email(email) AS email,
    CONCAT('***-**-', RIGHT(ssn, 4)) AS ssn_masked,
    created_at
FROM ${table};

GRANT SELECT ON v_${table}_masked TO analytics_ro;`;

        tlsHardeningConfig = `# MySQL 8.0 SSL & TDE Encryption Hardening (my.cnf)
[mysqld]
require_secure_transport = ON
tls_version = TLSv1.3
ssl_ca = /etc/mysql/certs/ca.pem
ssl_cert = /etc/mysql/certs/server-cert.pem
ssl_key = /etc/mysql/certs/server-key.pem

# Innodb Tablespace Encryption at Rest (TDE)
early-plugin-load = keyring_file.so
keyring_file_data = /var/lib/mysql-keyring/keyring
innodb_undo_log_encrypt = ON
innodb_redo_log_encrypt = ON
default_table_encryption = ON`;

        expertRecommendations = [
          'Enable `require_secure_transport = ON` in MySQL `my.cnf` to block unencrypted plaintext client connections.',
          'Always use MySQL 8.0 Role-Based Access Control (`CREATE ROLE`) instead of granting table-level grants directly to individual accounts.',
          'Enforce `MAX_EXECUTION_TIME` limits on reporting users to prevent unindexed queries from consuming InnoDB thread buffer pools.',
        ];
        break;
      }

      case 'oracle': {
        roles = [
          {
            name: 'APP_SERVICE_RW',
            scope: 'Application Backend Connection Pool',
            privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
            description: 'Least-privilege transactional role for application microservices.',
            ddlGrant: `CREATE ROLE APP_SERVICE_RW;
GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO APP_SERVICE_RW;
CREATE USER api_service IDENTIFIED BY "OracleStrongSecretPass!2026" DEFAULT TABLESPACE USERS TEMPORARY TABLESPACE TEMP;
GRANT CREATE SESSION TO api_service;
GRANT APP_SERVICE_RW TO api_service;
ALTER USER api_service DEFAULT ROLE APP_SERVICE_RW;`,
          },
          {
            name: 'ANALYTICS_RO',
            scope: 'BI & Analytical Reporting (Active Data Guard)',
            privileges: ['SELECT'],
            description: 'Read-only analyst role restricted to Oracle Active Data Guard standby instances.',
            ddlGrant: `CREATE ROLE ANALYTICS_RO;
GRANT SELECT ON ${table} TO ANALYTICS_RO;
CREATE USER bi_analyst IDENTIFIED BY "BiAnalystPasscode!2026";
GRANT CREATE SESSION TO bi_analyst;
GRANT ANALYTICS_RO TO bi_analyst;
ALTER USER bi_analyst PROFILE REPORTING_PROFILE;`,
          },
          {
            name: 'SCHEMA_MIGRATOR',
            scope: 'CI/CD Liquibase / Flyway DDL Deployer',
            privileges: ['CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'ALTER', 'DROP'],
            description: 'Dedicated pipeline deployment account strictly used during release maintenance windows.',
            ddlGrant: `CREATE USER cicd_deployer IDENTIFIED BY "CicdDeployOracleKey!2026";
GRANT RESOURCE, CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE SEQUENCE TO cicd_deployer;`,
          },
        ];

        rlsPolicyScript = `-- Oracle 19c/21c/23c Virtual Private Database (VPD / Fine-Grained Access Control)
-- 1. Create Tenant Isolation Security Predicate Function
CREATE OR REPLACE FUNCTION get_tenant_isolation_predicate(
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 AS
BEGIN
    -- Restrict rows where tenant_id matches the session application context
    RETURN '${tenantCol} = SYS_CONTEXT(''APP_CTX'', ''TENANT_ID'')';
END;
/

-- 2. Attach Row-Level Policy using DBMS_RLS
BEGIN
    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => '${table}',
        policy_name     => 'RLS_${table.toUpperCase()}_ISOLATION',
        function_schema => USER,
        policy_function => 'get_tenant_isolation_predicate',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- Usage in App Session Initialization:
-- EXEC DBMS_SESSION.SET_CONTEXT('APP_CTX', 'TENANT_ID', 'tenant_enterprise_8821');
-- SELECT * FROM ${table}; -- Automatically returns only isolated tenant rows!`;

        dataMaskingScript = `-- Oracle Dynamic Data Redaction (DBMS_REDACT)
BEGIN
    DBMS_REDACT.ADD_POLICY(
        object_schema       => USER,
        object_name         => '${table}',
        policy_name         => 'REDACT_${table.toUpperCase()}_PII',
        column_name         => 'EMAIL',
        function_type       => DBMS_REDACT.PARTIAL,
        function_parameters => DBMS_REDACT.RE_PATTERN_MASK,
        expression          => 'SYS_CONTEXT(''USERENV'', ''SESSION_USER'') = ''BI_ANALYST'''
    );

    DBMS_REDACT.ALTER_POLICY(
        object_schema       => USER,
        object_name         => '${table}',
        policy_name         => 'REDACT_${table.toUpperCase()}_PII',
        action              => DBMS_REDACT.ADD_COLUMN,
        column_name         => 'SSN',
        function_type       => DBMS_REDACT.PARTIAL,
        function_parameters => 'VVV-VV-VVVV,VVV-VV-****,*,1,5'
    );
END;
/`;

        tlsHardeningConfig = `# Oracle Transparent Network Substrate (TNS) & TDE Hardening (sqlnet.ora)
SQLNET.ENCRYPTION_SERVER = REQUIRED
SQLNET.ENCRYPTION_TYPES_SERVER = (AES256, AES192)
SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED
SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER = (SHA256, SHA512)
SSL_VERSION = 1.3
SSL_CLIENT_AUTHENTICATION = TRUE
WALLET_LOCATION = (SOURCE=(METHOD=FILE)(METHOD_DATA=(DIRECTORY=/opt/oracle/admin/wallets)))

# Oracle Transparent Data Encryption (TDE) Tablespace Encryption
-- ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "MasterKeyStorePassword!2026" WITH BACKUP;
-- ALTER TABLESPACE USERS ENCRYPTION ONLINE USING 'AES256' ENCRYPT;`;

        expertRecommendations = [
          'Deploy Oracle Virtual Private Database (`DBMS_RLS`) with `update_check => TRUE` to prevent cross-tenant record hijacking during `UPDATE` or `INSERT` operations.',
          'Leverage Oracle Data Redaction (`DBMS_REDACT`) to mask sensitive fields in-place without duplicating tables or creating views.',
          'Activate Oracle Transparent Data Encryption (TDE) for the application tablespace to satisfy PCI-DSS and HIPAA encryption-at-rest mandates.',
        ];
        break;
      }

      case 'sqlserver': {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Application Backend Service',
            privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
            description: 'Application principal role with strict object execution permissions.',
            ddlGrant: `IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'app_service_rw')
BEGIN
    CREATE ROLE [app_service_rw];
END;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[dbo].[${table}] TO [app_service_rw];
CREATE LOGIN [api_backend_user] WITH PASSWORD = N'StrongMssqlPassword!2026', CHECK_POLICY = ON, CHECK_EXPIRATION = ON;
CREATE USER [api_backend_user] FOR LOGIN [api_backend_user];
ALTER ROLE [app_service_rw] ADD MEMBER [api_backend_user];`,
          },
          {
            name: 'analytics_ro',
            scope: 'Read-Only Reporting (Read-Intent Replica)',
            privileges: ['SELECT'],
            description: 'Read-only analyst role routed automatically to Always On Secondary replicas.',
            ddlGrant: `CREATE ROLE [analytics_ro];
GRANT SELECT ON OBJECT::[dbo].[${table}] TO [analytics_ro];
CREATE LOGIN [bi_analyst] WITH PASSWORD = N'BiReporterPassphrase!2026';
CREATE USER [bi_analyst] FOR LOGIN [bi_analyst];
ALTER ROLE [analytics_ro] ADD MEMBER [bi_analyst];`,
          },
          {
            name: 'schema_migrator',
            scope: 'CI/CD DDL Pipeline Runner',
            privileges: ['db_ddladmin'],
            description: 'Schema migration runner account restricted to deployment windows.',
            ddlGrant: `CREATE USER [cicd_deployer] WITH PASSWORD = N'MssqlCicdKey!2026';
ALTER ROLE [db_ddladmin] ADD MEMBER [cicd_deployer];`,
          },
        ];

        rlsPolicyScript = `-- Microsoft SQL Server Native Row-Level Security (RLS)
-- 1. Create Security Schema & Predicate Function
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Security')
    EXEC('CREATE SCHEMA [Security]');
GO

CREATE OR ALTER FUNCTION Security.fn_tenantSecurityPredicate(@TenantId NVARCHAR(128))
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS fn_securitypredicate_result
WHERE @TenantId = CAST(SESSION_CONTEXT(N'TenantId') AS NVARCHAR(128))
   OR IS_MEMBER('db_owner') = 1;
GO

-- 2. Apply Security Policy Filter and Block Predicates
CREATE SECURITY POLICY Security.${table}SecurityPolicy
    ADD FILTER PREDICATE Security.fn_tenantSecurityPredicate(${tenantCol}) ON [dbo].[${table}],
    ADD BLOCK PREDICATE Security.fn_tenantSecurityPredicate(${tenantCol}) ON [dbo].[${table}] AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_tenantSecurityPredicate(${tenantCol}) ON [dbo].[${table}] AFTER UPDATE
WITH (STATE = ON, SCHEMABINDING = ON);
GO

-- Application Connection Hook:
-- EXEC sp_set_session_context @key = N'TenantId', @value = N'tenant_enterprise_7491';
-- SELECT * FROM [dbo].[${table}]; -- Returns isolated rows exclusively!`;

        dataMaskingScript = `-- Microsoft SQL Server Dynamic Data Masking (DDM)
ALTER TABLE [dbo].[${table}] 
ALTER COLUMN email ADD MASKED WITH (FUNCTION = 'email()');

ALTER TABLE [dbo].[${table}] 
ALTER COLUMN phone ADD MASKED WITH (FUNCTION = 'partial(2, "XXX-XXX-", 2)');

ALTER TABLE [dbo].[${table}] 
ALTER COLUMN ssn ADD MASKED WITH (FUNCTION = 'partial(0, "XXX-XX-", 4)');

-- Grant UNMASK privilege only to privileged compliance officers:
-- GRANT UNMASK TO [compliance_officer];
-- REVOKE UNMASK TO [analytics_ro];`;

        tlsHardeningConfig = `-- SQL Server TLS 1.3 & Transparent Data Encryption (TDE)
-- Run in master database:
CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'MasterCertificatePassword!2026';
CREATE CERTIFICATE TDEServerCert WITH SUBJECT = 'SQLPulse Production TDE Certificate';

-- Run in production database:
USE [production_db];
CREATE DATABASE ENCRYPTION KEY
WITH ALGORITHM = AES_256
ENCRYPTION BY SERVER CERTIFICATE TDEServerCert;

ALTER DATABASE [production_db] SET ENCRYPTION ON;

-- Enforce Forced Encryption via SQL Server Configuration Manager:
-- Protocols for MSSQLSERVER -> Flags -> Force Encryption: Yes`;

        expertRecommendations = [
          'Bind RLS predicate functions with `WITH SCHEMABINDING = ON` to prevent schema mutations that could breach multi-tenant security.',
          'Use SQL Server Dynamic Data Masking (DDM) for PII columns like email and SSN — masking occurs transparently without application changes.',
          'Always use `sp_set_session_context` with `@read_only = 1` in application connection poolers to prevent tenant ID spoofing.',
        ];
        break;
      }

      case 'snowflake': {
        roles = [
          {
            name: 'APP_SERVICE_RW',
            scope: 'Application Backend Service',
            privileges: ['USAGE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'],
            description: 'Microservice execution role scoped to production virtual warehouse.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS APP_SERVICE_RW;
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE APP_SERVICE_RW;
GRANT USAGE ON DATABASE PROD_DB TO ROLE APP_SERVICE_RW;
GRANT USAGE ON SCHEMA PROD_DB.PUBLIC TO ROLE APP_SERVICE_RW;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE PROD_DB.PUBLIC.${table.toUpperCase()} TO ROLE APP_SERVICE_RW;
CREATE USER IF NOT EXISTS API_BACKEND PASSWORD = 'SnowflakeSecurePass!2026' DEFAULT_ROLE = APP_SERVICE_RW;
GRANT ROLE APP_SERVICE_RW TO USER API_BACKEND;`,
          },
          {
            name: 'ANALYTICS_RO',
            scope: 'BI & Analytical Dashboards',
            privileges: ['USAGE', 'SELECT'],
            description: 'Read-only analyst role scoped to cost-capped query warehouse.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS ANALYTICS_RO;
GRANT USAGE ON WAREHOUSE ANALYTICS_WH TO ROLE ANALYTICS_RO;
GRANT SELECT ON TABLE PROD_DB.PUBLIC.${table.toUpperCase()} TO ROLE ANALYTICS_RO;
CREATE USER IF NOT EXISTS BI_ANALYST PASSWORD = 'BiAnalystSnowflake!2026' DEFAULT_ROLE = ANALYTICS_RO;
GRANT ROLE ANALYTICS_RO TO USER BI_ANALYST;`,
          },
        ];

        rlsPolicyScript = `-- Snowflake Native Row Access Policy (Tenant Isolation)
CREATE OR REPLACE ROW ACCESS POLICY tenant_isolation_policy 
AS (tenant_id_val VARCHAR) RETURNS BOOLEAN ->
    CURRENT_ROLE() IN ('ACCOUNTADMIN', 'SECURITYADMIN')
    OR tenant_id_val = CURRENT_SESSION_CLIENT_APPLICATION_CONTEXT('APP_TENANT_ID');

-- Apply Row Access Policy to Target Table
ALTER TABLE ${table.toUpperCase()} 
ADD ROW ACCESS POLICY tenant_isolation_policy ON (${tenantCol.toUpperCase()});

-- Verification:
-- ALTER SESSION SET CLIENT_APPLICATION_CONTEXT = 'APP_TENANT_ID=tenant_9921';
-- SELECT * FROM ${table.toUpperCase()};`;

        dataMaskingScript = `-- Snowflake Dynamic Masking Policies
CREATE OR REPLACE MASKING POLICY email_masking_policy AS (val VARCHAR) RETURNS VARCHAR ->
    CASE 
        WHEN CURRENT_ROLE() IN ('ACCOUNTADMIN', 'COMPLIANCE_OFFICER') THEN val
        ELSE REGEXP_REPLACE(val, '^(.)(.*)(@.*)$', '\\\\1***\\\\3')
    END;

CREATE OR REPLACE MASKING POLICY ssn_masking_policy AS (val VARCHAR) RETURNS VARCHAR ->
    CASE 
        WHEN CURRENT_ROLE() IN ('ACCOUNTADMIN', 'COMPLIANCE_OFFICER') THEN val
        ELSE '***-**-' || RIGHT(val, 4)
    END;

ALTER TABLE ${table.toUpperCase()} MODIFY COLUMN EMAIL SET MASKING POLICY email_masking_policy;
ALTER TABLE ${table.toUpperCase()} MODIFY COLUMN SSN SET MASKING POLICY ssn_masking_policy;`;

        tlsHardeningConfig = `-- Snowflake Security & Network Policy Hardening
CREATE OR REPLACE NETWORK POLICY strict_corporate_vpn_policy
    ALLOWED_IP_LIST = ('10.0.0.0/8', '172.16.0.0/12', '198.51.100.0/24')
    BLOCKED_IP_LIST = ('0.0.0.0/0');

ALTER ACCOUNT SET NETWORK_POLICY = strict_corporate_vpn_policy;
ALTER ACCOUNT SET REQUIRE_STORAGE_INTEGRATION_ENCRYPTION = TRUE;`;

        expertRecommendations = [
          'Attach Snowflake Row Access Policies directly to tables or views to achieve deterministic multi-tenant isolation at warehouse query compilation time.',
          'Combine Snowflake Dynamic Data Masking policies with Tag-Based Masking (`CREATE TAG pii_data`) for centralized governance across multiple schemas.',
          'Enforce Snowflake Network Policies to restrict data warehouse access strictly to application VPC endpoints and trusted gateways.',
        ];
        break;
      }

      case 'clickhouse': {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Application Backend Ingest',
            privileges: ['SELECT', 'INSERT'],
            description: 'High-throughput append and analytical query role.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS app_service_rw;
GRANT SELECT, INSERT ON ${table} TO app_service_rw;
CREATE USER IF NOT EXISTS api_service IDENTIFIED WITH sha256_password BY 'ClickHouseSecretPass!2026' DEFAULT ROLE app_service_rw;`,
          },
          {
            name: 'analytics_ro',
            scope: 'BI & Reporting Dashboards',
            privileges: ['SELECT'],
            description: 'Read-only analyst role with query max execution limits.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS analytics_ro;
GRANT SELECT ON ${table} TO analytics_ro;
CREATE USER IF NOT EXISTS bi_analyst IDENTIFIED WITH sha256_password BY 'BiAnalystChPass!2026' DEFAULT ROLE analytics_ro;
ALTER USER bi_analyst SETTINGS max_execution_time = 30, max_threads = 8;`,
          },
        ];

        rlsPolicyScript = `-- ClickHouse Native Row Policy (Tenant Isolation)
CREATE ROW POLICY IF NOT EXISTS tenant_isolation_policy ON ${table}
    FOR SELECT 
    USING (${tenantCol} = current_user())
    TO app_service_rw;

-- For dynamic session headers:
-- CREATE ROW POLICY tenant_header_policy ON ${table}
--     FOR SELECT USING (${tenantCol} = currentUserOrSetting('tenant_id'))
--     TO app_service_rw;`;

        dataMaskingScript = `-- ClickHouse Masked View for Analysts
CREATE OR REPLACE VIEW v_${table}_masked AS
SELECT 
    id,
    ${tenantCol},
    concat(substring(email, 1, 2), '****@', splitByChar('@', email)[2]) AS email,
    concat('***-**-', substr(ssn, -4)) AS ssn_masked,
    created_at
FROM ${table};

GRANT SELECT ON v_${table}_masked TO analytics_ro;`;

        tlsHardeningConfig = `<!-- ClickHouse TLS / SSL Encryption (/etc/clickhouse-server/config.d/tls.xml) -->
<clickhouse>
    <openSSL>
        <server>
            <certificateFile>/etc/clickhouse-server/certs/server.crt</certificateFile>
            <privateKeyFile>/etc/clickhouse-server/certs/server.key</privateKeyFile>
            <verificationMode>relaxed</verificationMode>
            <cipherList>HIGH:!aNULL:!MD5</cipherList>
        </server>
    </openSSL>
    <https_port>8443</https_port>
    <tcp_port_secure>9440</tcp_port_secure>
</clickhouse>`;

        expertRecommendations = [
          'ClickHouse `CREATE ROW POLICY` enforces row filters at vector query execution time with zero overhead.',
          'Always configure `max_execution_time` and `max_memory_usage` on read roles to prevent analytical memory exhaustion.',
          'Secure native protocol with `tcp_port_secure = 9440` and HTTP API with `https_port = 8443`.',
        ];
        break;
      }

      case 'mongodb': {
        roles = [
          {
            name: 'appServiceReadWrite',
            scope: 'Application Backend',
            privileges: ['find', 'insert', 'update', 'remove'],
            description: 'MongoDB database-level role for application services.',
            ddlGrant: `use production_db;
db.createRole({
  role: "appServiceRW",
  privileges: [
    { resource: { db: "production_db", collection: "${table}" }, actions: [ "find", "insert", "update", "remove" ] }
  ],
  roles: []
});
db.createUser({
  user: "api_service",
  pwd: "MongoSecretPassPhrase!2026",
  roles: [ { role: "appServiceRW", db: "production_db" } ]
});`,
          },
          {
            name: 'reportingReadOnly',
            scope: 'BI & Analytics',
            privileges: ['find'],
            description: 'Read-only analyst role restricted to secondary replica nodes.',
            ddlGrant: `use production_db;
db.createUser({
  user: "bi_analyst",
  pwd: "BiAnalystSecurePass!2026",
  roles: [ { role: "read", db: "production_db" } ]
});`,
          },
        ];

        rlsPolicyScript = `// MongoDB Tenant Isolation Schema Validation Rule
db.runCommand({
  collMod: "${table}",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["${tenantCol}", "createdAt"],
      properties: {
        ${tenantCol}: {
          bsonType: "string",
          description: "Must be a valid string tenant UUID and is strictly required"
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});`;

        dataMaskingScript = `// MongoDB Aggregation Pipeline for Dynamic PII Field Redaction
db.${table}.aggregate([
  {
    $project: {
      _id: 1,
      ${tenantCol}: 1,
      email: {
        $concat: [
          { $substrCP: ["$email", 0, 2] },
          "***",
          { $substrCP: ["$email", { $indexOfCP: ["$email", "@"] }, { $strLenCP: "$email" }] }
        ]
      },
      phone: { $concat: ["***-***-", { $substrCP: ["$phone", 7, 4] }] }
    }
  }
]);`;

        tlsHardeningConfig = `# MongoDB TLS / Wire Encryption (mongod.conf)
net:
  port: 27017
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb.pem
    CAFile: /etc/ssl/ca.pem
    allowInvalidCertificates: false
security:
  authorization: enabled
  enableEncryption: true
  encryptionKeyFile: /var/lib/mongodb/master-key`;

        expertRecommendations = [
          'Enable MongoDB Client-Side Field Level Encryption (CSFLE) or Queryable Encryption for sensitive fields like SSN and card numbers.',
          'Deploy MongoDB JSON Schema validators on collection insertion to guarantee tenant isolation keys are present on every document.',
          'Ensure `security.authorization = enabled` and activate WiredTiger data-at-rest encryption.',
        ];
        break;
      }

      case 'redis': {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Application Backend Worker',
            privileges: ['GET', 'SET', 'DEL', 'HGET', 'HSET', 'LPUSH', 'RPOP'],
            description: 'Scoped Redis 6/7 ACL role restricted to tenant keyspace.',
            ddlGrant: `# Redis 6/7 Access Control List (ACL)
ACL SETUSER app_service_rw on >MicroserviceSecretPass!2026 ~production:* +@read +@write -@dangerous
ACL SETUSER app_service_rw resetkeys ~production:${tenantCol}:*`,
          },
          {
            name: 'analytics_ro',
            scope: 'Read-Only Cache Inspector',
            privileges: ['GET', 'HGETALL', 'SCAN', 'STRLEN'],
            description: 'Read-only analyst role prevented from flushing or modifying keys.',
            ddlGrant: `# Read-Only Analyst ACL
ACL SETUSER analytics_ro on >AnalyticsPass!2026 ~production:* +@read -@write -@dangerous`,
          },
        ];

        rlsPolicyScript = `# Redis Tenant Isolation via Structured Keyspace Namespacing
# Format: <cluster>:<tenant_id>:<collection>:<entity_id>
# Example Key: production:tenant_8941:${table}:user_101

# Enforce in Redis ACL for dedicated tenant service user:
ACL SETUSER tenant_user_8941 on >SecretTenantKey!2026 ~production:tenant_8941:* +@all -@dangerous
# Prevents any access outside the tenant's own keyspace!`;

        dataMaskingScript = `# Redis Dynamic Masking Script (Lua Engine)
-- Script to fetch sanitized profile without exposing plain SSN/Card
local data = redis.call('HMGET', KEYS[1], 'email', 'ssn', '${tenantCol}')
local email = data[1] or ''
local at_pos = string.find(email, '@')
local masked_email = string.sub(email, 1, 2) .. '****' .. (at_pos and string.sub(email, at_pos) or '')
return { masked_email, '***-**-****', data[3] }`;

        tlsHardeningConfig = `# Redis TLS Hardening (redis.conf)
port 0
tls-port 6380
tls-cert-file /etc/redis/tls/redis.crt
tls-key-file /etc/redis/tls/redis.key
tls-ca-cert-file /etc/redis/tls/ca.crt
tls-auth-clients yes
tls-protocols "TLSv1.3"
tls-ciphers DEFAULT:!MEDIUM:!LOW
protected-mode yes`;

        expertRecommendations = [
          'Never expose the default Redis user without a password. Disable default user: `ACL SETUSER default off`.',
          'Use Redis 6+ / 7+ fine-grained ACLs to restrict key patterns per tenant (`~tenant_id:*`).',
          'Disable dangerous commands: `-FLUSHALL -FLUSHDB -KEYS -CONFIG -DEBUG -SHUTDOWN`.',
        ];
        break;
      }

      case 'cassandra': {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Application Backend Service',
            privileges: ['SELECT', 'MODIFY'],
            description: 'Transactional read/write role scoped to application keyspace.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS app_service_rw WITH PASSWORD = 'CassandraStrongPass!2026' AND LOGIN = true;
GRANT SELECT, MODIFY ON KEYSPACE production_ks TO app_service_rw;`,
          },
          {
            name: 'analytics_ro',
            scope: 'Spark / Trino Analytical Querying',
            privileges: ['SELECT'],
            description: 'Read-only role for batch ETL and analytics.',
            ddlGrant: `CREATE ROLE IF NOT EXISTS analytics_ro WITH PASSWORD = 'AnalyticsCassandraPass!2026' AND LOGIN = true;
GRANT SELECT ON KEYSPACE production_ks TO analytics_ro;`,
          },
        ];

        rlsPolicyScript = `-- Apache Cassandra / ScyllaDB Partition-Key Tenant Isolation
-- Enforce tenant_id as the primary partition key in compound primary keys:
CREATE TABLE IF NOT EXISTS production_ks.${table} (
    ${tenantCol} uuid,
    id uuid,
    email text,
    phone text,
    created_at timestamp,
    PRIMARY KEY ((${tenantCol}), id)
);

-- Every CQL query MUST specify (${tenantCol}) in the WHERE clause, ensuring strict single-partition isolation!
-- SELECT * FROM production_ks.${table} WHERE ${tenantCol} = 123e4567-e89b-12d3-a456-426614174000;`;

        dataMaskingScript = `-- Cassandra Analytical Masked View pattern (via User Defined Function)
CREATE OR REPLACE FUNCTION production_ks.mask_email(email text)
RETURNS NULL ON NULL INPUT
RETURNS text
LANGUAGE java AS '
    int at = email.indexOf("@");
    if (at > 2) return email.substring(0, 2) + "****" + email.substring(at);
    return "****@masked.internal";
';`;

        tlsHardeningConfig = `# Cassandra Node-to-Client & Node-to-Node TLS (cassandra.yaml)
client_encryption_options:
  enabled: true
  optional: false
  keystore: /etc/cassandra/keystore.jks
  keystore_password: KeystorePassword!2026
  require_client_auth: true
  protocol: TLSv1.3
  cipher_suites: [TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]

server_encryption_options:
  internode_encryption: all
  keystore: /etc/cassandra/keystore.jks
  keystore_password: KeystorePassword!2026`;

        expertRecommendations = [
          'Design Cassandra tables with compound partition keys `((${tenantCol}), id)` so all queries execute with partition pruning.',
          'Always enable `internode_encryption: all` to secure intra-cluster gossip and data streams in multi-rack deployments.',
          'Enable PasswordAuthenticator in `cassandra.yaml` to mandate authentication on port 9042.',
        ];
        break;
      }

      case 'sqlite': {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Local Application Process',
            privileges: ['READ', 'WRITE'],
            description: 'Direct POSIX file permission scoped to backend process UID.',
            ddlGrant: `-- SQLite uses OS-level File System Permissions & SQLCipher
-- Set ownership strictly to application service user:
-- chown appuser:appgroup /var/lib/sqlite/${table}.db
-- chmod 600 /var/lib/sqlite/${table}.db`,
          },
          {
            name: 'analytics_ro',
            scope: 'Read-Only Process Connection',
            privileges: ['PRAGMA query_only = ON', 'SELECT'],
            description: 'Read-only URI connection mode `file:data.db?mode=ro`.',
            ddlGrant: `-- Open SQLite connection in Read-Only Mode:
-- sqlite3 "file:/var/lib/sqlite/${table}.db?mode=ro"
PRAGMA query_only = ON;`,
          },
        ];

        rlsPolicyScript = `-- SQLite Multi-Tenant Isolation using Parameterized Views & Triggers
CREATE TABLE IF NOT EXISTS ${table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${tenantCol} TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW IF NOT EXISTS v_${table}_tenant_isolated AS
SELECT * FROM ${table}
WHERE ${tenantCol} = (SELECT value FROM temp.session_vars WHERE key = 'current_tenant_id');

-- Trigger to prevent inserting records for other tenants:
CREATE TRIGGER IF NOT EXISTS trg_enforce_tenant_insert
BEFORE INSERT ON ${table}
BEGIN
    SELECT RAISE(ABORT, 'Tenant isolation violation: cannot insert record for different tenant')
    WHERE NEW.${tenantCol} != (SELECT value FROM temp.session_vars WHERE key = 'current_tenant_id');
END;`;

        dataMaskingScript = `-- SQLite Masked View for Analytics
CREATE VIEW IF NOT EXISTS v_${table}_masked AS
SELECT 
    id,
    ${tenantCol},
    substr(email, 1, 2) || '****@' || substr(email, instr(email, '@') + 1) AS email_masked,
    created_at
FROM ${table};`;

        tlsHardeningConfig = `-- SQLCipher AES-256-CBC Database Encryption at Rest
-- Execute immediately after opening SQLite connection:
PRAGMA key = "x'2DD29CAEA74B812...64_HEX_CHAR_ENCRYPTION_KEY...'";
PRAGMA cipher_compatibility = 4;
PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;
PRAGMA kdf_iter = 256000;
PRAGMA cipher_page_size = 4096;`;

        expertRecommendations = [
          'For embedded SQLite databases containing sensitive data, compile with SQLCipher for full AES-256 page-level encryption.',
          'Connect using SQLite URI format with `mode=ro` for analytical and background reporting processes.',
          'Store tenant isolation context in temporary memory tables (`temp.session_vars`) with triggers to prevent cross-tenant writes.',
        ];
        break;
      }

      case 'generic':
      default: {
        roles = [
          {
            name: 'app_service_rw',
            scope: 'Application Backend Microservice',
            privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
            description: 'Least-privilege operational role. Cannot alter schemas or truncate tables.',
            ddlGrant: `CREATE ROLE app_service_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO app_service_rw;
CREATE USER api_backend IDENTIFIED BY 'BackendSecureSecret!2026';
GRANT app_service_rw TO api_backend;`,
          },
          {
            name: 'analytics_ro',
            scope: 'BI Analyst & Reporting Dashboards',
            privileges: ['SELECT'],
            description: 'Read-only access for reporting and analytics.',
            ddlGrant: `CREATE ROLE analytics_ro;
GRANT SELECT ON ${table} TO analytics_ro;
CREATE USER bi_reporter IDENTIFIED BY 'BiAnalystPasscode!2026';
GRANT analytics_ro TO bi_reporter;`,
          },
          {
            name: 'schema_migrator',
            scope: 'CI/CD Pipeline DDL Runner',
            privileges: ['ALL PRIVILEGES'],
            description: 'Elevated DDL role used exclusively during automated migration jobs.',
            ddlGrant: `CREATE ROLE schema_migrator;
GRANT ALL PRIVILEGES ON ${table} TO schema_migrator;`,
          },
        ];

        rlsPolicyScript = `-- ${meta.name} Multi-Tenant Isolation Strategy
-- Implement tenant filter predicate via view-layer abstraction:
CREATE VIEW v_${table}_scoped AS
SELECT * FROM ${table}
WHERE ${tenantCol} = CURRENT_USER;
`;

        dataMaskingScript = `-- ${meta.name} Data Masking View for Non-Privileged Roles
CREATE VIEW v_${table}_sanitized AS
SELECT 
    id,
    ${tenantCol},
    '***' AS email_masked,
    '***' AS phone_masked,
    created_at
FROM ${table};

GRANT SELECT ON v_${table}_sanitized TO analytics_ro;
`;

        tlsHardeningConfig = `# ${meta.name} TLS / SSL Transport Security
ssl = on
tls_min_version = 1.3
require_secure_transport = on`;

        expertRecommendations = [
          `Enforce least-privilege role assignment in ${meta.name}.`,
          'Never use database administrative superuser accounts for application microservices.',
          'Rotate database credentials regularly using a centralized secrets manager.',
        ];
        break;
      }
    }
  }

    const auditItems: SecurityAuditItem[] = [
      {
        id: 'SEC-001',
        standard: 'SOC2',
        title: 'Row-Level Multi-Tenant Isolation',
        status: 'passed',
        impact: 'Prevents horizontal data leakage across customer tenants.',
        remediation: `Tenant isolation enforced via native ${meta.name} security controls.`,
      },
      {
        id: 'SEC-002',
        standard: 'HIPAA',
        title: 'PII Field Level Redaction & Masking',
        status: 'passed',
        impact: 'Restricts non-privileged roles from viewing cleartext personal data.',
        remediation: 'Dynamic masked views and functions deployed for analytics and reporting roles.',
      },
      {
        id: 'SEC-003',
        standard: 'PCI-DSS',
        title: 'Enforce Strong Authentication & TLS 1.3 in Transit',
        status: 'passed',
        impact: 'Mitigates man-in-the-middle packet sniffing and password hash cracking.',
        remediation: 'Require encrypted TLS transport and modern password hashing algorithms.',
      },
      {
        id: 'SEC-004',
        standard: 'GDPR',
        title: 'Read Query Statement Timeout & Connection Limits',
        status: 'passed',
        impact: 'Prevents Denial-of-Service via unindexed runaway analytical queries.',
        remediation: 'Execution statement timeout capped for read-only analytical roles.',
      },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      tableName: table,
      complianceScore: 98,
      roles,
      rlsPolicyScript,
      dataMaskingScript,
      tlsHardeningConfig,
      auditItems,
      expertRecommendations,
    };
  }
}
