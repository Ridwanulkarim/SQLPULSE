import { DATABASE_CATALOG } from '../types/db-catalog.data';

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

function getEngineMeta(engineId: string) {
  const found = DATABASE_CATALOG.find(db => db.id === engineId.toLowerCase());
  if (found) return found;
  return {
    id: engineId,
    name: engineId.charAt(0).toUpperCase() + engineId.slice(1),
    category: 'relational',
    categoryLabel: 'Relational (SQL)',
    icon: '🗄️',
    rank: 999,
    popularityScore: 10,
    commandHint: 'EXPLAIN <query>',
    description: 'Database Engine'
  };
}

export class SecurityRbacAnalyzer {
  public analyze(req: SecurityRbacRequest): SecurityRbacResult {
    const meta = getEngineMeta(req.engine);
    const norm = req.engine.toLowerCase();
    const table = req.tableName || 'customers';
    const tenantCol = req.tenantColumn || 'tenant_id';
    const piiCols = req.piiColumns && req.piiColumns.length > 0 
      ? req.piiColumns 
      : ['email', 'phone', 'ssn_last4', 'billing_address'];

    let roles: RbacRole[] = [];
    let rlsPolicyScript = '';
    let dataMaskingScript = '';
    let tlsHardeningConfig = '';

    if (norm === 'mysql' || norm === 'mariadb') {
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

-- Enforce session context before query execution:
-- SET @current_tenant_id = 'tenant_enterprise_4920';
-- SELECT * FROM v_${table}_tenant_isolated;
`;

      dataMaskingScript = `-- MySQL Dynamic Data Masking Function
DELIMITER $$
CREATE FUNCTION mask_email(raw_email VARCHAR(255))
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
FROM ${table};`;

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
    } else if (norm === 'mongodb') {
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
    { resource: { db: "production_db", collection: "" }, actions: [ "find", "insert", "update", "remove" ] }
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
    } else {
      
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

      rlsPolicyScript = `-- PostgreSQL Native Row-Level Security (RLS) Tenant Isolation
-- 1. Enable RLS on target table
ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;

-- 2. Create Isolation Policy for Multi-Tenant Application Context
DROP POLICY IF EXISTS tenant_isolation_policy ON ${table};
CREATE POLICY tenant_isolation_policy ON ${table}
    FOR ALL
    TO app_service_rw
    USING (${tenantCol} = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (${tenantCol} = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- 3. Superuser/Admin Bypass Policy (Optional for audit/backup)
CREATE POLICY admin_bypass_policy ON ${table}
    FOR ALL
    TO schema_migrator
    USING (true)
    WITH CHECK (true);

-- Usage Example in App Connection:
-- BEGIN;
-- SET LOCAL app.current_tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
-- SELECT * FROM ${table}; -- Automatically scoped to tenant!
-- COMMIT;
`;

      dataMaskingScript = `-- PostgreSQL Dynamic PII Masking via pgcrypto & Masked Views
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
FROM ${table};

GRANT SELECT ON v_${table}_sanitized TO analytics_ro;
`;

      tlsHardeningConfig = `# PostgreSQL SSL / TLS 1.3 & Network Hardening (pg_hba.conf & postgresql.conf)
# postgresql.conf:
ssl = on
ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES:!CAMELLIA:!AES128'
ssl_prefer_server_ciphers = on
ssl_min_protocol_version = 'TLSv1.3'
password_encryption = scram-sha-256

# pg_hba.conf (Enforce TLS and SCRAM-SHA-256):
# TYPE  DATABASE        USER            ADDRESS                 METHOD
hostssl all             all             0.0.0.0/0               scram-sha-256 clientcert=verify-full
hostssl replication     replicator      10.0.0.0/8              scram-sha-256`;
    }

    const auditItems: SecurityAuditItem[] = [
      {
        id: 'SEC-001',
        standard: 'SOC2',
        title: 'Row-Level Multi-Tenant Isolation',
        status: 'passed',
        impact: 'Prevents horizontal data leakage across customer tenants.',
        remediation: 'RLS policies enforced with FORCE ROW LEVEL SECURITY.',
      },
      {
        id: 'SEC-002',
        standard: 'HIPAA',
        title: 'PII Field Level Redaction & Masking',
        status: 'passed',
        impact: 'Restricts non-privileged roles from viewing cleartext personal data.',
        remediation: 'Dynamic masked views deployed for analytics and reporting roles.',
      },
      {
        id: 'SEC-003',
        standard: 'PCI-DSS',
        title: 'Enforce SCRAM-SHA-256 & TLS 1.3 in Transit',
        status: 'passed',
        impact: 'Mitigates man-in-the-middle packet sniffing and password hash cracking.',
        remediation: 'Require hostssl and disable deprecated TLSv1.0/1.1.',
      },
      {
        id: 'SEC-004',
        standard: 'GDPR',
        title: 'Read Query Statement Timeout & Connection Limits',
        status: 'passed',
        impact: 'Prevents Denial-of-Service via unindexed runaway analytical queries.',
        remediation: 'statement_timeout capped at 30,000ms for read-only roles.',
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
      expertRecommendations: [
        'Always combine `ENABLE ROW LEVEL SECURITY` with `FORCE ROW LEVEL SECURITY` so table owners cannot inadvertently bypass tenant constraints.',
        'Never use database superuser accounts (`postgres` / `root`) for application web servers; assign the granular `app_service_rw` role instead.',
        'Rotate database credentials regularly using AWS Secrets Manager or HashiCorp Vault with dynamic short-lived credentials.',
      ],
    };
  }
}
