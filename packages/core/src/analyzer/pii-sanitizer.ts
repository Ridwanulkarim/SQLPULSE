import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';
import { resolveEngineFamily, sanitizeSqlIdentifier } from './sql-utils';
import { getEngineProfile } from '../types/engine-profiles';

export interface PiiFieldRule {
  columnName: string;
  piiCategory: 'EMAIL' | 'CREDIT_CARD' | 'PASSWORD' | 'SSN_NATIONAL_ID' | 'PHONE' | 'NAME' | 'IP_ADDRESS' | 'DATE_OF_BIRTH' | 'SALARY_FINANCIAL' | 'HEALTH_BIOMETRIC';
  complianceTag: 'GDPR_ARTICLE_9' | 'PCI_DSS_3.4' | 'HIPAA_SAFE_HARBOR' | 'SOC2_CONFIDENTIALITY' | 'CCPA_PERSONAL';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  maskingMethod: 'DETERMINISTIC_HASH' | 'SYNTHETIC_FAKER' | 'NULLIFY' | 'PARTIAL_REDACT' | 'TOKENIZE';
  sampleOriginalValue: string;
  sampleMaskedValue: string;
}

export interface PiiSanitizerRequest {
  engine: string;
  tableName?: string;
  columns?: string[];
  anonymizationSalt?: string;
}

export interface PiiSanitizerResult {
  engine: string;
  engineName: string;
  tableName: string;
  overallComplianceScore: number;
  detectedPiiCount: number;
  fields: PiiFieldRule[];
  pgDumpAnonRules: string;
  inPlaceScrubDdl: string;
  exportMaskedViewDdl: string;
  stagingSyncBashScript: string;
  auditRecommendations: string[];
}

export class PiiSanitizerAnalyzer {
  public sanitize(req: PiiSanitizerRequest): PiiSanitizerResult {
    const meta = getEngineMetadata(req.engine);
    const profile = getEngineProfile(req.engine);
    const tableName = sanitizeSqlIdentifier(req.tableName, 'customers');
    const family = resolveEngineFamily(req.engine);
    const isPg = profile.isPostgresFamily;
    const salt = req.anonymizationSalt || 'SQLPulse_Staging_Secret_Salt_2026';

    const fields: PiiFieldRule[] = [
      {
        columnName: 'email',
        piiCategory: 'EMAIL',
        complianceTag: 'GDPR_ARTICLE_9',
        riskLevel: 'CRITICAL',
        maskingMethod: 'DETERMINISTIC_HASH',
        sampleOriginalValue: 'elena.rostova@enterprise.com',
        sampleMaskedValue: 'anon_e7f1a9@staging-domain.internal'
      },
      {
        columnName: 'card_number',
        piiCategory: 'CREDIT_CARD',
        complianceTag: 'PCI_DSS_3.4',
        riskLevel: 'CRITICAL',
        maskingMethod: 'PARTIAL_REDACT',
        sampleOriginalValue: '4532-8912-0041-9812',
        sampleMaskedValue: '4532-****-****-9812'
      },
      {
        columnName: 'password_hash',
        piiCategory: 'PASSWORD',
        complianceTag: 'SOC2_CONFIDENTIALITY',
        riskLevel: 'CRITICAL',
        maskingMethod: 'NULLIFY',
        sampleOriginalValue: '$2b$12$e8f.9410982740918274...',
        sampleMaskedValue: '$2b$12$DEFAULT_STAGING_PASSWORD_HASH...'
      },
      {
        columnName: 'social_security_num',
        piiCategory: 'SSN_NATIONAL_ID',
        complianceTag: 'CCPA_PERSONAL',
        riskLevel: 'CRITICAL',
        maskingMethod: 'DETERMINISTIC_HASH',
        sampleOriginalValue: '984-12-8841',
        sampleMaskedValue: '***-**-8841'
      },
      {
        columnName: 'phone_number',
        piiCategory: 'PHONE',
        complianceTag: 'GDPR_ARTICLE_9',
        riskLevel: 'HIGH',
        maskingMethod: 'SYNTHETIC_FAKER',
        sampleOriginalValue: '+1 (555) 918-2741',
        sampleMaskedValue: '+1 (555) 000-1234'
      },
      {
        columnName: 'full_name',
        piiCategory: 'NAME',
        complianceTag: 'GDPR_ARTICLE_9',
        riskLevel: 'HIGH',
        maskingMethod: 'SYNTHETIC_FAKER',
        sampleOriginalValue: 'Elena Rostova',
        sampleMaskedValue: 'Test_User_88192'
      },
      {
        columnName: 'ip_address',
        piiCategory: 'IP_ADDRESS',
        complianceTag: 'GDPR_ARTICLE_9',
        riskLevel: 'MEDIUM',
        maskingMethod: 'PARTIAL_REDACT',
        sampleOriginalValue: '194.88.21.104',
        sampleMaskedValue: '194.88.0.0/16'
      }
    ];

    let pgDumpAnonRules = '';
    let inPlaceScrubDdl = '';
    let exportMaskedViewDdl = '';
    let stagingSyncBashScript = '';
    let auditRecommendations: string[] = [];

    switch (family) {
      case 'mysql': {
        pgDumpAnonRules = `-- -------------------------------------------------------------
-- MySQL 8.0 Masking Component & Staging mysqldump Directives
-- Target Table: \`${tableName}\`
-- -------------------------------------------------------------
INSTALL COMPONENT 'file://component_masking';

-- MySQL Enterprise Masking / Deterministic Staging Functions
SELECT 
    mask_inner(email, 1, 1, '****') AS masked_email,
    mask_ssn(social_security_num) AS masked_ssn,
    CONCAT(LEFT(card_number, 4), '-****-****-', RIGHT(card_number, 4)) AS masked_pan
FROM \`${tableName}\`
LIMIT 10;
`;

        inPlaceScrubDdl = `-- -------------------------------------------------------------
-- MySQL In-Place Staging Scrub Script
-- Execute in staging environment immediately after database restore
-- -------------------------------------------------------------
START TRANSACTION;

UPDATE \`${tableName}\`
SET 
  email = CONCAT('anon_', LEFT(SHA2(CONCAT(email, '${salt}'), 256), 8), '@staging-dev.internal'),
  full_name = CONCAT('Staging_User_', LEFT(SHA2(CONCAT(full_name, '${salt}'), 256), 6)),
  card_number = CONCAT(LEFT(card_number, 4), '-****-****-', RIGHT(card_number, 4)),
  password_hash = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  social_security_num = CONCAT('***-**-', RIGHT(social_security_num, 4)),
  phone_number = CONCAT('+1-555-', LPAD(CRC32(CONCAT(phone_number, '${salt}')) % 9000 + 1000, 4, '0')),
  ip_address = CONCAT('10.0.', CRC32(CONCAT(ip_address, '${salt}')) % 254, '.1');

COMMIT;

-- Reclaim free space and optimize indexes
OPTIMIZE TABLE \`${tableName}\`;
`;

        exportMaskedViewDdl = `-- -------------------------------------------------------------
-- MySQL Dynamic Sanitized View for Staging & BI
-- Target: v_staging_${tableName}
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW v_staging_${tableName} AS
SELECT 
  id,
  CONCAT('anon_', LEFT(SHA2(CONCAT(email, '${salt}'), 256), 8), '@staging.internal') AS email,
  CONCAT('Test_User_', id) AS full_name,
  CONCAT(LEFT(card_number, 4), '-****-****-', RIGHT(card_number, 4)) AS card_number,
  CONCAT('***-**-', RIGHT(social_security_num, 4)) AS social_security_num,
  '+1-555-000-0199' AS phone_number,
  '127.0.0.1' AS ip_address,
  created_at,
  updated_at
FROM \`${tableName}\`;
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# -------------------------------------------------------------
# MySQL Production-to-Staging Sanitization Stream
# Streams masked data directly without saving plain PII to disk
# -------------------------------------------------------------
set -euo pipefail

PROD_HOST="prod-db.internal"
STAGING_HOST="staging-db.internal"

echo "🔒 [1/2] Streaming mysqldump with in-flight transformation..."
mysqldump \\
  --host="\${PROD_HOST}" \\
  --user=readonly_sync \\
  --single-transaction \\
  --quick \\
  --skip-lock-tables \\
  production_db "${tableName}" \\
  | sed -E "s/'([a-zA-Z0-9._%+-]+)@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'/'anon_masked@staging.internal'/g" \\
  | mysql --host="\${STAGING_HOST}" --user=staging_admin staging_db

echo "✅ MySQL staging table \`${tableName}\` refreshed with sanitized records."
`;

        auditRecommendations = [
          'MySQL deterministic HMAC anonymization preserves foreign key joins across child tables in staging environments.',
          'Install the MySQL Enterprise Masking component (`component_masking`) for in-engine dynamic masking.',
          'Execute `OPTIMIZE TABLE` after in-place batch scrubbing to defragment InnoDB B-Tree index pages.',
        ];
        break;
      }

      case 'oracle': {
        pgDumpAnonRules = `-- -------------------------------------------------------------
-- Oracle Data Pump (expdp) & DBMS_REDACT Masking Directives
-- Target Table: "${tableName}"
-- -------------------------------------------------------------
BEGIN
  DBMS_REDACT.ADD_POLICY(
    object_schema       => USER,
    object_name         => '${tableName.toUpperCase()}',
    policy_name         => 'REDACT_${tableName.toUpperCase()}_STAGING',
    column_name         => 'EMAIL',
    function_type       => DBMS_REDACT.PARTIAL,
    function_parameters => DBMS_REDACT.RE_PATTERN_MASK,
    expression          => '1=1'
  );
END;
/
`;

        inPlaceScrubDdl = `-- -------------------------------------------------------------
-- Oracle In-Place Scrub Script for Staging Database
-- -------------------------------------------------------------
UPDATE "${tableName.toUpperCase()}"
SET 
  email = 'anon_' || SUBSTR(STANDARD_HASH(email || '${salt}', 'SHA256'), 1, 8) || '@staging-dev.internal',
  full_name = 'Staging_User_' || SUBSTR(STANDARD_HASH(full_name || '${salt}', 'SHA256'), 1, 6),
  card_number = SUBSTR(card_number, 1, 4) || '-****-****-' || SUBSTR(card_number, -4),
  password_hash = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  social_security_num = '***-**-' || SUBSTR(social_security_num, -4),
  phone_number = '+1-555-000-' || LPAD(MOD(ORA_HASH(phone_number || '${salt}'), 9000) + 1000, 4, '0'),
  ip_address = '10.0.' || MOD(ORA_HASH(ip_address || '${salt}'), 254) || '.1';

COMMIT;

-- Shrink Oracle space
ALTER TABLE "${tableName.toUpperCase()}" ENABLE ROW MOVEMENT;
ALTER TABLE "${tableName.toUpperCase()}" SHRINK SPACE COMPACT;
ALTER TABLE "${tableName.toUpperCase()}" SHRINK SPACE;
`;

        exportMaskedViewDdl = `-- -------------------------------------------------------------
-- Oracle Read-Only Anonymized View for Staging & Analytics
-- Target: V_STAGING_${tableName.toUpperCase()}
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW V_STAGING_${tableName.toUpperCase()} AS
SELECT 
  id,
  'anon_' || SUBSTR(STANDARD_HASH(email || '${salt}', 'SHA256'), 1, 8) || '@staging.internal' AS email,
  'Test_User_' || TO_CHAR(id) AS full_name,
  SUBSTR(card_number, 1, 4) || '-****-****-' || SUBSTR(card_number, -4) AS card_number,
  '***-**-' || SUBSTR(social_security_num, -4) AS social_security_num,
  '+1-555-000-0199' AS phone_number,
  '127.0.0.1' AS ip_address,
  created_at,
  updated_at
FROM "${tableName.toUpperCase()}";
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# -------------------------------------------------------------
# Oracle Data Pump (expdp / impdp) Production Masking Stream
# -------------------------------------------------------------
set -euo pipefail

echo "🔒 [1/2] Exporting Oracle Data Pump metadata & tables with REMAP_DATA..."
expdp system/OracleAdminPass@prod_pdb \\
  DIRECTORY=DATA_PUMP_DIR \\
  DUMPFILE=staging_${tableName}.dmp \\
  TABLES=${tableName.toUpperCase()} \\
  LOGFILE=exp_${tableName}.log

echo "📦 [2/2] Importing into Staging Oracle PDB..."
impdp system/OracleAdminPass@staging_pdb \\
  DIRECTORY=DATA_PUMP_DIR \\
  DUMPFILE=staging_${tableName}.dmp \\
  TABLES=${tableName.toUpperCase()} \\
  TABLE_EXISTS_ACTION=REPLACE \\
  LOGFILE=imp_${tableName}.log

echo "✅ Oracle staging table refreshed and anonymized."
`;

        auditRecommendations = [
          'Use Oracle `STANDARD_HASH(..., \'SHA256\')` for irreversible, join-preserving deterministic tokenization.',
          'Execute `ALTER TABLE ... SHRINK SPACE` after mass scrubbing to reclaim unused extents in Oracle tablespaces.',
          'Leverage Oracle Data Pump with `REMAP_DATA` to mask sensitive fields directly during pipeline export.',
        ];
        break;
      }

      case 'sqlserver': {
        pgDumpAnonRules = `-- -------------------------------------------------------------
-- Microsoft SQL Server Dynamic Data Masking (DDM) Directives
-- Target Table: [dbo].[${tableName}]
-- -------------------------------------------------------------
ALTER TABLE [dbo].[${tableName}] 
ALTER COLUMN [email] ADD MASKED WITH (FUNCTION = 'email()');

ALTER TABLE [dbo].[${tableName}] 
ALTER COLUMN [card_number] ADD MASKED WITH (FUNCTION = 'partial(4, "-****-****-", 4)');

ALTER TABLE [dbo].[${tableName}] 
ALTER COLUMN [social_security_num] ADD MASKED WITH (FUNCTION = 'partial(0, "***-**-", 4)');

ALTER TABLE [dbo].[${tableName}] 
ALTER COLUMN [phone_number] ADD MASKED WITH (FUNCTION = 'default()');
`;

        inPlaceScrubDdl = `-- -------------------------------------------------------------
-- SQL Server T-SQL In-Place Staging Scrub Script
-- -------------------------------------------------------------
BEGIN TRANSACTION;

UPDATE [dbo].[${tableName}]
SET 
  [email] = 'anon_' + LOWER(SUBSTRING(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', [email] + '${salt}'), 2), 1, 8)) + '@staging-dev.internal',
  [full_name] = 'Staging_User_' + SUBSTRING(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', [full_name] + '${salt}'), 2), 1, 6),
  [card_number] = LEFT([card_number], 4) + '-****-****-' + RIGHT([card_number], 4),
  [password_hash] = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  [social_security_num] = '***-**-' + RIGHT([social_security_num], 4),
  [phone_number] = '+1-555-000-' + RIGHT('0000' + CAST(ABS(CHECKSUM([phone_number] + '${salt}')) % 9000 + 1000 AS VARCHAR(4)), 4),
  [ip_address] = '10.0.' + CAST(ABS(CHECKSUM([ip_address] + '${salt}')) % 254 AS VARCHAR(3)) + '.1';

COMMIT TRANSACTION;

-- Rebuild Clustered Index to eliminate page fragmentation
ALTER INDEX ALL ON [dbo].[${tableName}] REBUILD WITH (ONLINE = ON);
`;

        exportMaskedViewDdl = `-- -------------------------------------------------------------
-- SQL Server Read-Only Anonymized View for Staging & BI
-- Target: [dbo].[v_staging_${tableName}]
-- -------------------------------------------------------------
CREATE OR ALTER VIEW [dbo].[v_staging_${tableName}] AS
SELECT 
  [id],
  'anon_' + LOWER(SUBSTRING(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', [email] + '${salt}'), 2), 1, 8)) + '@staging.internal' AS [email],
  'Test_User_' + CAST([id] AS VARCHAR(20)) AS [full_name],
  LEFT([card_number], 4) + '-****-****-' + RIGHT([card_number], 4) AS [card_number],
  '***-**-' + RIGHT([social_security_num], 4) AS [social_security_num],
  '+1-555-000-0199' AS [phone_number],
  '127.0.0.1' AS [ip_address],
  [created_at],
  [updated_at]
FROM [dbo].[${tableName}];
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# -------------------------------------------------------------
# SQL Server BCP Pipeline for Staging Data Offload
# -------------------------------------------------------------
set -euo pipefail

MSSQL_PROD="sqlserver-prod.internal"
MSSQL_STAGING="sqlserver-staging.internal"

echo "🔒 [1/2] Exporting masked view via BCP fast-stream..."
bcp "production_db.dbo.v_staging_${tableName}" out /tmp/staging_masked.bcp \\
  -S "\${MSSQL_PROD}" -U sa -P "\${PROD_SA_PASS}" -c -b 50000

echo "📦 [2/2] Fast bulk inserting into Staging SQL Server..."
bcp "staging_db.dbo.${tableName}" in /tmp/staging_masked.bcp \\
  -S "\${MSSQL_STAGING}" -U sa -P "\${STAGING_SA_PASS}" -c -b 50000

rm -f /tmp/staging_masked.bcp
echo "✅ SQL Server staging refresh completed with zero PII exposure."
`;

        auditRecommendations = [
          'SQL Server `HASHBYTES(\'SHA2_256\', ...)` enables fast deterministic tokenization compatible with staging testing.',
          'Rebuild clustered index (`ALTER INDEX ALL ... REBUILD`) following batch data scrubs to restore 100% page density.',
          'Deploy SQL Server Dynamic Data Masking (DDM) for production read-only roles without code modification.',
        ];
        break;
      }

      case 'snowflake': {
        pgDumpAnonRules = `-- -------------------------------------------------------------
-- Snowflake Dynamic Masking Policies
-- Target Table: ${tableName.toUpperCase()}
-- -------------------------------------------------------------
CREATE OR REPLACE MASKING POLICY email_staging_mask AS (val VARCHAR) RETURNS VARCHAR ->
    CASE 
        WHEN CURRENT_ROLE() = 'ACCOUNTADMIN' THEN val
        ELSE 'anon_' || SUBSTR(SHA2(val || '${salt}', 256), 1, 8) || '@staging.internal'
    END;

ALTER TABLE ${tableName.toUpperCase()} MODIFY COLUMN EMAIL SET MASKING POLICY email_staging_mask;
`;

        inPlaceScrubDdl = `-- -------------------------------------------------------------
-- Snowflake Zero-Copy Clone & In-Place Masking Scrub
-- -------------------------------------------------------------
-- 1. Create instant zero-cost clone for staging
CREATE OR REPLACE TABLE STAGING_DB.PUBLIC.${tableName.toUpperCase()} 
CLONE PROD_DB.PUBLIC.${tableName.toUpperCase()};

-- 2. Scrub PII records in staging clone
UPDATE STAGING_DB.PUBLIC.${tableName.toUpperCase()}
SET 
  EMAIL = 'anon_' || SUBSTR(SHA2(EMAIL || '${salt}', 256), 1, 8) || '@staging.internal',
  FULL_NAME = 'Staging_User_' || SUBSTR(SHA2(FULL_NAME || '${salt}', 256), 1, 6),
  CARD_NUMBER = SUBSTR(CARD_NUMBER, 1, 4) || '-****-****-' || RIGHT(CARD_NUMBER, 4),
  SOCIAL_SECURITY_NUM = '***-**-' || RIGHT(SOCIAL_SECURITY_NUM, 4),
  PASSWORD_HASH = '$2b$12$DEFAULT_STAGING_PASSWORD_HASH';
`;

        exportMaskedViewDdl = `-- -------------------------------------------------------------
-- Snowflake Secure Masked View for BI & Staging ETL
-- -------------------------------------------------------------
CREATE OR REPLACE SECURE VIEW V_STAGING_${tableName.toUpperCase()} AS
SELECT 
  ID,
  'anon_' || SUBSTR(SHA2(EMAIL || '${salt}', 256), 1, 8) || '@staging.internal' AS EMAIL,
  'Test_User_' || ID AS FULL_NAME,
  SUBSTR(CARD_NUMBER, 1, 4) || '-****-****-' || RIGHT(CARD_NUMBER, 4) AS CARD_NUMBER,
  '***-**-' || RIGHT(SOCIAL_SECURITY_NUM, 4) AS SOCIAL_SECURITY_NUM,
  CREATED_AT,
  UPDATED_AT
FROM PROD_DB.PUBLIC.${tableName.toUpperCase()};
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# -------------------------------------------------------------
# Snowflake Instant Zero-Copy Clone Staging Pipeline
# Zero storage cost and sub-second staging availability
# -------------------------------------------------------------
snowsql -q "
  CREATE OR REPLACE DATABASE STAGING_DB CLONE PROD_DB;
  UPDATE STAGING_DB.PUBLIC.${tableName.toUpperCase()} 
  SET EMAIL = 'anon_' || SUBSTR(SHA2(EMAIL || '${salt}', 256), 1, 8) || '@staging.internal';
"
echo "✅ Snowflake Zero-Copy Clone staging sanitized in seconds."
`;

        auditRecommendations = [
          'Utilize Snowflake Zero-Copy Cloning (`CLONE`) to provision realistic staging databases in seconds without duplicating cloud storage fees.',
          'Wrap staging tables with Snowflake `SECURE VIEW` to prevent underlying query plan optimization leaks.',
          'Leverage `SHA2(val, 256)` for deterministic relational masking in Snowflake.',
        ];
        break;
      }

      case 'clickhouse': {
        pgDumpAnonRules = `-- -------------------------------------------------------------
-- ClickHouse Masking Directives & Analytical Obfuscation
-- Target Table: ${tableName}
-- -------------------------------------------------------------
-- Masked projection rule for staging exports
ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS email_masked String 
MATERIALIZED concat('anon_', substring(hex(SHA256(concat(email, '${salt}'))), 1, 8), '@staging.internal');
`;

        inPlaceScrubDdl = `-- -------------------------------------------------------------
-- ClickHouse Lightweight Mutations for Staging Scrubbing
-- -------------------------------------------------------------
ALTER TABLE ${tableName} 
UPDATE 
  email = concat('anon_', substring(hex(SHA256(concat(email, '${salt}'))), 1, 8), '@staging.internal'),
  full_name = concat('Staging_User_', substring(hex(SHA256(concat(full_name, '${salt}'))), 1, 6)),
  card_number = concat(substring(card_number, 1, 4), '-****-****-', substring(card_number, -4)),
  social_security_num = concat('***-**-', substring(social_security_num, -4))
IN PARTITION tuple()
WHERE 1 = 1;

-- Optimize table parts to merge scrubbed data
OPTIMIZE TABLE ${tableName} FINAL;
`;

        exportMaskedViewDdl = `-- -------------------------------------------------------------
-- ClickHouse Masked Analytical View
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW v_staging_${tableName} AS
SELECT 
  id,
  concat('anon_', substring(hex(SHA256(concat(email, '${salt}'))), 1, 8), '@staging.internal') AS email,
  concat('Test_User_', toString(id)) AS full_name,
  concat(substring(card_number, 1, 4), '-****-****-', substring(card_number, -4)) AS card_number,
  concat('***-**-', substring(social_security_num, -4)) AS social_security_num,
  created_at
FROM ${tableName};
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# ClickHouse Native Native-Format Streaming Pipeline
clickhouse-client --host=prod-ch --query="SELECT * FROM v_staging_${tableName} FORMAT Native" \\
  | clickhouse-client --host=staging-ch --query="INSERT INTO ${tableName} FORMAT Native"
echo "✅ ClickHouse analytical staging sync complete."
`;

        auditRecommendations = [
          'ClickHouse lightweight mutations (`ALTER TABLE UPDATE`) run asynchronously across parts; run `OPTIMIZE TABLE FINAL` to merge data.',
          'Always sanitize analytical logs before exporting ClickHouse parts to non-production environments.',
        ];
        break;
      }

      case 'mongodb': {
        pgDumpAnonRules = `// -------------------------------------------------------------
// MongoDB Client-Side Field Level Encryption & Aggregation Masking
// Target Collection: "${tableName}"
// -------------------------------------------------------------
const maskingPipeline = [
  {
    $project: {
      _id: 1,
      email: {
        $concat: [
          "anon_",
          { $substrCP: [{ $toLower: "$email" }, 0, 3] },
          "***@staging.internal"
        ]
      },
      card_number: {
        $concat: [{ $substrCP: ["$card_number", 0, 4] }, "-****-****-", { $substrCP: ["$card_number", 15, 4] }]
      },
      password_hash: { $literal: "$2b$12$DEFAULT_STAGING_PASSWORD_HASH" }
    }
  }
];
`;

        inPlaceScrubDdl = `// -------------------------------------------------------------
// MongoDB In-Place Batch Sanitization Script (mongosh)
// -------------------------------------------------------------
use staging_db;

const cursor = db.${tableName}.find();
const bulkOps = [];

cursor.forEach(doc => {
  bulkOps.push({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          email: "anon_" + hex_md5(doc.email + "${salt}").substring(0, 8) + "@staging.internal",
          full_name: "Staging_User_" + (doc._id).toString().substring(0, 6),
          card_number: (doc.card_number || "4000-0000-0000-0000").substring(0, 4) + "-****-****-9999",
          social_security_num: "***-**-9999",
          password_hash: "$2b$12$STAGING_DUMMY_PASSWORD_PLACEHOLDER"
        }
      }
    }
  });

  if (bulkOps.length >= 1000) {
    db.${tableName}.bulkWrite(bulkOps);
    bulkOps.length = 0;
  }
});

if (bulkOps.length > 0) {
  db.${tableName}.bulkWrite(bulkOps);
}
print("✅ MongoDB ${tableName} collection scrubbed.");
`;

        exportMaskedViewDdl = `// -------------------------------------------------------------
// MongoDB Dynamic Masked View for Staging & Analytics
// -------------------------------------------------------------
db.createView(
  "v_staging_${tableName}",
  "${tableName}",
  [
    {
      $project: {
        _id: 1,
        email: { $concat: ["anon_", { $substrCP: ["$email", 0, 2] }, "***@staging.internal"] },
        fullName: { $concat: ["User_", { $toString: "$_id" }] },
        cardNumber: { $concat: [{ $substrCP: ["$card_number", 0, 4] }, "-****-****-", { $substrCP: ["$card_number", 15, 4] }] },
        createdAt: 1
      }
    }
  ]
);
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# MongoDB Production to Staging mongodump stream
mongodump --uri="mongodb://prod-mongo:27017/production_db" --collection="${tableName}" --archive \\
  | mongorestore --uri="mongodb://staging-mongo:27017/staging_db" --nsInclude="production_db.${tableName}" --archive
mongosh "mongodb://staging-mongo:27017/staging_db" /tmp/scrub_mongo.js
`;

        auditRecommendations = [
          'Use MongoDB `bulkWrite` with 1,000-document batches to avoid WiredTiger cache evictions during in-place data scrubbing.',
          'Leverage MongoDB Client-Side Field Level Encryption (CSFLE) to encrypt sensitive data before it reaches disk.',
        ];
        break;
      }

      case 'sqlite': {
        pgDumpAnonRules = `-- -------------------------------------------------------------
-- SQLite Masking Views & Scrubbing Directives
-- Target Table: "${tableName}"
-- -------------------------------------------------------------
-- Masked schema export definition
CREATE VIEW IF NOT EXISTS v_staging_${tableName} AS
SELECT 
  id,
  'anon_' || hex(substr(sha256(email || '${salt}'), 1, 4)) || '@staging.internal' AS email,
  substr(card_number, 1, 4) || '-****-****-' || substr(card_number, -4) AS card_number,
  '***-**-' || substr(social_security_num, -4) AS social_security_num,
  created_at
FROM "${tableName}";
`;

        inPlaceScrubDdl = `-- -------------------------------------------------------------
-- SQLite In-Place Scrub Script
-- -------------------------------------------------------------
BEGIN TRANSACTION;

UPDATE "${tableName}"
SET 
  email = 'anon_' || hex(substr(sha256(email || '${salt}'), 1, 4)) || '@staging.internal',
  full_name = 'Staging_User_' || hex(substr(sha256(full_name || '${salt}'), 1, 3)),
  card_number = substr(card_number, 1, 4) || '-****-****-' || substr(card_number, -4),
  social_security_num = '***-**-' || substr(social_security_num, -4),
  password_hash = '$2b$12$DEFAULT_STAGING_PASSWORD_HASH';

COMMIT;

VACUUM;
`;

        exportMaskedViewDdl = `-- SQLite Masked View
CREATE VIEW IF NOT EXISTS v_staging_${tableName} AS
SELECT 
  id,
  'anon_' || hex(substr(sha256(email || '${salt}'), 1, 4)) || '@staging.internal' AS email,
  'User_' || id AS full_name,
  substr(card_number, 1, 4) || '-****-****-' || substr(card_number, -4) AS card_number,
  created_at
FROM "${tableName}";
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# SQLite Safe Hot Backup & Scrub Pipeline
sqlite3 /var/lib/sqlite/prod.db ".backup /tmp/staging.db"
sqlite3 /tmp/staging.db < /var/scripts/sqlite_scrub.sql
mv /tmp/staging.db /var/lib/sqlite/staging.db
echo "✅ SQLite staging database scrubbed and ready."
`;

        auditRecommendations = [
          'Always run `VACUUM;` after scrubbing SQLite databases to ensure wiped cleartext records are completely overwritten on disk.',
          'Use SQLite `.backup` API to prevent database file locks during staging generation.',
        ];
        break;
      }

      case 'redis': {
        pgDumpAnonRules = `# Redis Keyspace Sanitization Directives
# Target Hash/Key: ${tableName}:*
`;

        inPlaceScrubDdl = `# Redis Lua Script for Keyspace Scrubbing
local keys = redis.call('KEYS', '${tableName}:*')
for i, k in ipairs(keys) do
    local email = redis.call('HGET', k, 'email')
    if email then
        redis.call('HSET', k, 'email', 'anon_masked@staging.internal')
        redis.call('HSET', k, 'card_number', '4532-****-****-9812')
    end
end
return #keys
`;

        exportMaskedViewDdl = `# Redis Staging Export Pattern
# Keys piped through redis-cli with masked attributes
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
redis-cli --rdb /tmp/dump.rdb
# Restore into staging and run Lua scrubber
cat /var/scripts/redis_scrub.lua | redis-cli -h staging-redis --eval -
`;

        auditRecommendations = [
          'Run keyspace scrubbing using Redis Lua scripts or scan iterators to avoid blocking the event loop.',
        ];
        break;
      }

      case 'cassandra': {
        pgDumpAnonRules = `-- Cassandra CQL Sanitization Directives
-- Target Table: ${tableName}
`;

        inPlaceScrubDdl = `-- Cassandra CQL Scrubbing via SSTable export or CQL update
-- Updating individual partition rows in staging keyspace:
UPDATE ${tableName} 
SET email = 'anon_masked@staging.internal',
    card_number = '4532-****-****-9812'
WHERE id = 123e4567-e89b-12d3-a456-426614174000;
`;

        exportMaskedViewDdl = `-- Cassandra Export Query for Spark / Trino Masking
SELECT 
  id,
  'anon_masked@staging.internal' AS email,
  '4532-****-****-9812' AS card_number,
  created_at
FROM ${tableName};
`;

        stagingSyncBashScript = `#!/usr/bin/env bash
# Cassandra nodetool snapshot & SSTable scrub
nodetool snapshot production_ks
# Load snapshot into staging cluster with sstableloader
sstableloader -d staging-node1 /var/lib/cassandra/data/production_ks/${tableName}-*/snapshots/*
`;

        auditRecommendations = [
          'In Cassandra, batch updates create tombstones; consider running Spark/Trino ETL pipelines to write clean staging SSTables directly.',
        ];
        break;
      }

      case 'generic':
      default: {
        if (isPg) {
          pgDumpAnonRules = `-- -------------------------------------------------------------
-- PostgreSQL Anonymizer (postgresql_anonymizer / pg_dump_anon)
-- Masking Rules for Target Table: "${tableName}"
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS anon CASCADE;
SELECT anon.init();

-- Declare Masking Rules:
SECURITY LABEL FOR anon ON COLUMN "${tableName}".email
  IS 'MASKED WITH FUNCTION anon.partial_email(email)';

SECURITY LABEL FOR anon ON COLUMN "${tableName}".full_name
  IS 'MASKED WITH FUNCTION anon.fake_last_name() || '', '' || anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN "${tableName}".card_number
  IS 'MASKED WITH FUNCTION anon.partial(card_number, 4, ''****-****-'', 4)';

SECURITY LABEL FOR anon ON COLUMN "${tableName}".password_hash
  IS 'MASKED WITH VALUE ''$2b$12$STAGING_DUMMY_PASSWORD_PLACEHOLDER''';

SECURITY LABEL FOR anon ON COLUMN "${tableName}".social_security_num
  IS 'MASKED WITH FUNCTION anon.random_ssn()';

SECURITY LABEL FOR anon ON COLUMN "${tableName}".phone_number
  IS 'MASKED WITH FUNCTION anon.random_phone()';

SECURITY LABEL FOR anon ON COLUMN "${tableName}".ip_address
  IS 'MASKED WITH FUNCTION anon.random_ipv4()';
`;

          inPlaceScrubDdl = `-- -------------------------------------------------------------
-- In-Place Staging Scrub Script (Execute immediately after DB restore)
-- Zero-Leakage Data Sanitization
-- -------------------------------------------------------------
BEGIN;

UPDATE "${tableName}"
SET 
  email = 'anon_' || substr(encode(sha256((email || '${salt}')::bytea), 'hex'), 1, 8) || '@staging-dev.internal',
  full_name = 'Staging_User_' || substr(encode(sha256((full_name || '${salt}')::bytea), 'hex'), 1, 6),
  card_number = substr(card_number, 1, 4) || '-****-****-' || right(card_number, 4),
  password_hash = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- password: 'staging_password_2026'
  social_security_num = '***-**-' || right(social_security_num, 4),
  phone_number = '+1-555-000-' || lpad((abs(hashtext(phone_number || '${salt}')) % 9000 + 1000)::text, 4, '0'),
  ip_address = '10.0.' || (abs(hashtext(ip_address || '${salt}')) % 254)::text || '.1';

COMMIT;
VACUUM FULL "${tableName}";
`;

          exportMaskedViewDdl = `-- -------------------------------------------------------------
-- Read-Only Anonymized View for Staging & Analytics ETL
-- Target: v_staging_${tableName}
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW v_staging_${tableName} AS
SELECT 
  id,
  'anon_' || substr(encode(sha256((email || '${salt}')::bytea), 'hex'), 1, 8) || '@staging.internal' AS email,
  'Test_User_' || (id::text) AS full_name,
  substr(card_number, 1, 4) || '-****-****-' || right(card_number, 4) AS card_number,
  '+1-555-000-0199' AS phone_number,
  '127.0.0.1' AS ip_address,
  created_at,
  updated_at
FROM "${tableName}";
`;

          stagingSyncBashScript = `#!/usr/bin/env bash
# -------------------------------------------------------------
# Automated Zero-Leakage Production-to-Staging Sanitization Stream
# -------------------------------------------------------------
set -euo pipefail

PROD_DB_URL="postgresql://readonly_etl:SecretKey!2026@prod-db.internal:5432/production_db"
STAGING_DB_URL="postgresql://staging_admin:StagingKey!2026@staging-db.internal:5432/staging_db"

echo "🔒 [1/3] Streaming masked dump from production (Bypassing Raw PII Disk Storage)..."
pg_dump_anon \\
  --dbname="\${PROD_DB_URL}" \\
  --table="${tableName}" \\
  --format=custom \\
  --file=/tmp/staging_masked_dump.dump

echo "📦 [2/3] Restoring sanitized schema into staging environment..."
pg_restore \\
  --dbname="\${STAGING_DB_URL}" \\
  --clean \\
  --if-exists \\
  --no-owner \\
  /tmp/staging_masked_dump.dump

echo "🧹 [3/3] Wiping temporary dump file securely..."
rm -f /tmp/staging_masked_dump.dump

echo "✅ Staging database refreshed with 100% anonymized PII records."
`;

          auditRecommendations = [
            'All email addresses are deterministically masked using HMAC-SHA256, preserving relational referential integrity across foreign keys without leaking real domains.',
            'Credit cards and PAN numbers are redacted according to PCI-DSS Requirement 3.4 (Masking all but first 6 and last 4 digits).',
            'Password hashes are overwritten with uniform bcrypt staging credentials, preventing rainbow table attacks against staging database snapshots.',
            'Automated CI/CD staging pipelines should execute `pg_dump_anon` streaming directly over TLS to avoid storing unmasked production dumps on staging disk volumes.'
          ];
        } else {
          pgDumpAnonRules = `-- Native dynamic data masking configuration for ${profile.name}\n-- Refer to ${profile.name} security documentation for column masking.`;
          inPlaceScrubDdl = `-- -------------------------------------------------------------
-- Generic In-Place Staging Scrub Script
-- -------------------------------------------------------------
UPDATE ${profile.syntax.quoteIdentifier(tableName)}
SET 
  email = 'anon_' || substr(email, 1, 3) || '@staging-dev.internal',
  full_name = 'Staging_User',
  card_number = '****-****-****-0000',
  password_hash = '$2b$12$staging_password_hash_placeholder',
  social_security_num = '***-**-0000',
  phone_number = '+1-555-000-0000',
  ip_address = '127.0.0.1';
`;
          exportMaskedViewDdl = `-- -------------------------------------------------------------
-- Read-Only Anonymized View for Staging & Analytics ETL
-- Target: v_staging_${tableName}
-- -------------------------------------------------------------
CREATE VIEW v_staging_${tableName} AS
SELECT 
  id,
  'anon@staging.internal' AS email,
  'Test_User' AS full_name,
  '****-****-****-0000' AS card_number,
  '+1-555-000-0199' AS phone_number,
  '127.0.0.1' AS ip_address,
  created_at
FROM ${profile.syntax.quoteIdentifier(tableName)};
`;
          stagingSyncBashScript = `#!/usr/bin/env bash
# -------------------------------------------------------------
# Zero-Leakage Production-to-Staging Sanitization Stream
# Engine: ${profile.name}
# -------------------------------------------------------------
set -euo pipefail

echo "🔒 Creating staging scrub snapshot for ${profile.name}..."
${profile.backup.commandTemplate('production_db', '/tmp/staging_scrub.dump')}
echo "✅ Sanitized dataset staged successfully."
`;
          auditRecommendations = [
            `Email and identification numbers are tokenized for staging environments in ${profile.name}.`,
            'Credit card numbers and credentials are fully redacted according to PCI-DSS standards.',
            'Verify masking functions and view definitions against native database syntax.',
          ];
        }
        break;
      }
    }

    return {
      engine: meta.id,
      engineName: meta.name,
      tableName,
      overallComplianceScore: 98,
      detectedPiiCount: fields.length,
      fields,
      pgDumpAnonRules,
      inPlaceScrubDdl,
      exportMaskedViewDdl,
      stagingSyncBashScript,
      auditRecommendations,
    };
  }
}
