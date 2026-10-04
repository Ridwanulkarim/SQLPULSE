import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';
import { resolveEngineFamily, EngineFamily } from './sql-utils';

export interface DisasterRecoveryRequest {
  engine: string;
  dbSizeGb: number;
  dailyChangePercent: number;
  networkBandwidthMbps: number;
  diskThroughputMbSec: number;
  backupStrategy: 'daily_full_plus_wal_cdc' | 'daily_full_differential' | 'hourly_snapshots' | 'multi_region_active_passive';
  cloudProvider?: 'aws_s3' | 'gcp_gcs' | 'azure_blob' | 'local_nfs';
}

export interface RtoStage {
  stage: string;
  durationMinutes: number;
  description: string;
}

export interface DisasterRecoveryResult {
  engine: string;
  engineName: string;
  strategy: string;
  rpo: {
    theoreticalRpo: string;
    rpoClassification: 'Zero Data Loss' | 'Near Real-Time (<1m)' | 'Standard (<15m)' | 'High Risk (24h)';
    explanation: string;
  };
  rto: {
    totalEstimatedRtoMinutes: number;
    formattedRto: string;
    stages: RtoStage[];
  };
  storageEconomics: {
    raw30DayRetentionGb: number;
    compressed30DayRetentionGb: number;
    compressionRatio: string;
    estimatedMonthlyStorageCostUsd: number;
  };
  backupScriptBash: string;
  cronDefinition: string;
  restoreRunbookMarkdown: string;
  verificationCommand: string;
}

export class DisasterRecoveryCalculator {
  public calculate(req: DisasterRecoveryRequest): DisasterRecoveryResult {
    const meta = getEngineMetadata(req.engine);
    const family = resolveEngineFamily(req.engine);
    const sizeGb = Math.max(1, req.dbSizeGb);
    const dailyChange = Math.max(1, Math.min(100, req.dailyChangePercent));
    const netMbps = Math.max(10, req.networkBandwidthMbps);
    const diskMbSec = Math.max(10, req.diskThroughputMbSec);
    const strategy = req.backupStrategy || 'daily_full_plus_wal_cdc';
    const cloud = req.cloudProvider || 'aws_s3';

    let theoreticalRpo = '< 15 seconds';
    let rpoClass: 'Zero Data Loss' | 'Near Real-Time (<1m)' | 'Standard (<15m)' | 'High Risk (24h)' = 'Near Real-Time (<1m)';
    let rpoExplanation = 'Continuous WAL/Binlog/Redo streaming archives write transactions to durable storage immediately after commit.';

    if (strategy === 'multi_region_active_passive') {
      theoreticalRpo = '0 seconds (Synchronous / Semi-Sync)';
      rpoClass = 'Zero Data Loss';
      rpoExplanation = 'Synchronous standby acknowledged commits prior to disaster, ensuring zero data loss.';
    } else if (strategy === 'daily_full_plus_wal_cdc') {
      theoreticalRpo = '< 15 seconds';
      rpoClass = 'Near Real-Time (<1m)';
      rpoExplanation = 'Transaction log streaming pushes log segments to cloud storage every 15 seconds.';
    } else if (strategy === 'hourly_snapshots') {
      theoreticalRpo = '< 60 minutes';
      rpoClass = 'Standard (<15m)';
      rpoExplanation = 'Periodic hourly snapshots risk losing up to 59 minutes of data written since last snapshot.';
    } else {
      theoreticalRpo = 'Up to 24 hours';
      rpoClass = 'High Risk (24h)';
      rpoExplanation = 'Nightly batch dumps only. If a catastrophic disk failure occurs at 5 PM, all work since midnight is lost.';
    }

    const netMbSec = netMbps / 8;
    const effectiveTransferMbSec = Math.min(diskMbSec, netMbSec);
    const compressedSizeGb = +(sizeGb * 0.45).toFixed(2); 
    const downloadMinutes = +( (compressedSizeGb * 1024) / (effectiveTransferMbSec * 60) ).toFixed(1);
    const diskDecompressMinutes = +( (sizeGb * 1024) / (diskMbSec * 60) ).toFixed(1);
    const dailyChangeGb = (sizeGb * (dailyChange / 100));
    const walReplayMinutes = +( (dailyChangeGb * 1024 * 0.5) / (diskMbSec * 60) + 2 ).toFixed(1);
    const verificationMinutes = +( Math.max(3, sizeGb * 0.02) ).toFixed(1);

    const stages: RtoStage[] = [
      {
        stage: '1. Cloud Archive Fetch & Download',
        durationMinutes: downloadMinutes,
        description: `Downloading ${compressedSizeGb} GB compressed baseline image at ${effectiveTransferMbSec.toFixed(0)} MB/s.`,
      },
      {
        stage: '2. Disk Decompression & Block Layout',
        durationMinutes: diskDecompressMinutes,
        description: `Decompressing Zstandard archive onto target ${diskMbSec} MB/s NVMe storage.`,
      },
      {
        stage: '3. Transaction Log Replay & PITR',
        durationMinutes: walReplayMinutes,
        description: `Applying delta changes to advance engine state to target recovery timestamp.`,
      },
      {
        stage: '4. Integrity Verification & Read-Write Warmup',
        durationMinutes: verificationMinutes,
        description: `Checking table checksums, verifying indexes, and warming buffer pool before switching traffic.`,
      },
    ];

    const totalEstimatedRtoMinutes = +(downloadMinutes + diskDecompressMinutes + walReplayMinutes + verificationMinutes).toFixed(1);
    const formattedRto = totalEstimatedRtoMinutes >= 60 
      ? `${Math.floor(totalEstimatedRtoMinutes / 60)}h ${Math.round(totalEstimatedRtoMinutes % 60)}m` 
      : `${totalEstimatedRtoMinutes} mins`;

    const raw30DayRetentionGb = Math.round((sizeGb * 4) + (dailyChangeGb * 30));
    const compressed30DayRetentionGb = Math.round(raw30DayRetentionGb * 0.40);
    const costPerGbMonth = cloud === 'aws_s3' ? 0.023 : cloud === 'gcp_gcs' ? 0.020 : cloud === 'azure_blob' ? 0.018 : 0.010;
    const estimatedMonthlyStorageCostUsd = +(compressed30DayRetentionGb * costPerGbMonth).toFixed(2);

    const backupScriptBash = this.generateBackupScript(meta, family, cloud, sizeGb);
    const cronDefinition = this.generateCron(meta);
    const restoreRunbookMarkdown = this.generateRestoreRunbook(meta, family, sizeGb);
    const verificationCommand = this.generateVerificationCommand(meta, family);

    return {
      engine: meta.id,
      engineName: meta.name,
      strategy,
      rpo: {
        theoreticalRpo,
        rpoClassification: rpoClass,
        explanation: rpoExplanation,
      },
      rto: {
        totalEstimatedRtoMinutes,
        formattedRto,
        stages,
      },
      storageEconomics: {
        raw30DayRetentionGb,
        compressed30DayRetentionGb,
        compressionRatio: '2.5:1 (Zstandard Level 3)',
        estimatedMonthlyStorageCostUsd,
      },
      backupScriptBash,
      cronDefinition,
      restoreRunbookMarkdown,
      verificationCommand,
    };
  }

  private generateBackupScript(meta: any, family: EngineFamily, cloud: string, sizeGb: number): string {
    const s3Path = cloud === 'aws_s3' ? 's3://production-db-backups' : cloud === 'gcp_gcs' ? 'gs://production-db-backups' : 'az://production-db-backups';
    const uploadCmd = cloud === 'aws_s3' ? 'aws s3 cp' : cloud === 'gcp_gcs' ? 'gcloud storage cp' : 'azcopy copy';

    switch (family) {
      case 'mysql':
        return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery: MySQL (Percona XtraBackup)
# Retention: 30 Days | Destination: ${s3Path}
# =========================================================================
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/var/backups/mysql/\${TIMESTAMP}"
ARCHIVE_NAME="xtrabackup_\${TIMESTAMP}.xbstream.zst"

mkdir -p "\${BACKUP_DIR}"

# Run non-blocking hot physical backup
xtrabackup \\
  --backup \\
  --user=backup_user \\
  --password="\${MYSQL_BACKUP_PASS}" \\
  --stream=xbstream \\
  --parallel=4 \\
  | zstd -3 -T0 > "\${BACKUP_DIR}/\${ARCHIVE_NAME}"

# Upload to Cloud
${uploadCmd} "\${BACKUP_DIR}/\${ARCHIVE_NAME}" "${s3Path}/mysql/\${ARCHIVE_NAME}"
echo "MySQL Backup Completed successfully."
`;

      case 'oracle':
        return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery: Oracle Database (RMAN)
# Destination: ${s3Path}
# =========================================================================
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

rman target / <<EOF
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 30 DAYS;
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE DEVICE TYPE DISK PARALLELISM 4 BACKUP TYPE TO COMPRESSED BACKUPSET;

RUN {
  ALLOCATE CHANNEL ch1 DEVICE TYPE DISK FORMAT '/var/backups/oracle/%d_%T_%U.bkp';
  ALLOCATE CHANNEL ch2 DEVICE TYPE DISK FORMAT '/var/backups/oracle/%d_%T_%U.bkp';
  BACKUP AS COMPRESSED BACKUPSET INCREMENTAL LEVEL 0 DATABASE PLUS ARCHIVELOG DELETE INPUT;
}
EXIT;
EOF

${uploadCmd} /var/backups/oracle/ "${s3Path}/oracle/\${TIMESTAMP}/" --recursive
echo "Oracle RMAN backup uploaded to cloud."
`;

      case 'sqlserver':
        return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery: Microsoft SQL Server
# Destination: ${s3Path}
# =========================================================================
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="/var/backups/sqlserver/production_db_\${TIMESTAMP}.bak"

sqlcmd -S localhost -U sa -P "\${MSSQL_SA_PASSWORD}" -Q "
BACKUP DATABASE [production_db] 
TO DISK = '\${BACKUP_FILE}'
WITH COMPRESSION, CHECKSUM, STATS = 10;
"

# Upload to Cloud
${uploadCmd} "\${BACKUP_FILE}" "${s3Path}/sqlserver/"
echo "SQL Server compressed full backup uploaded successfully."
`;

      case 'snowflake':
        return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery: Snowflake Zero-Copy Backup
# =========================================================================
snowsql -q "
  ALTER TABLE production_db.public.customers SET DATA_RETENTION_TIME_IN_DAYS = 90;
  CREATE OR REPLACE DATABASE production_db_backup_snapshot CLONE production_db;
"
echo "Snowflake 90-day continuous Time Travel & Fail-safe protection confirmed."
`;

      case 'clickhouse':
        return `#!/usr/bin/env bash
# ClickHouse Production Backup using clickhouse-backup
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

clickhouse-backup create_remote "ch_full_\${TIMESTAMP}"
echo "ClickHouse distributed backup created and uploaded to ${s3Path}/clickhouse."
`;

      case 'mongodb':
        return `#!/usr/bin/env bash
# MongoDB Production Physical / Oplog Backup
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mongodump --uri="mongodb://localhost:27017" --oplog --gzip --archive="/var/backups/mongo/mongo_\${TIMESTAMP}.archive.gz"
${uploadCmd} "/var/backups/mongo/mongo_\${TIMESTAMP}.archive.gz" "${s3Path}/mongo/"
echo "MongoDB full oplog backup uploaded."
`;

      case 'redis':
        return `#!/usr/bin/env bash
# Redis RDB Snapshot + Cloud Offload
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

redis-cli BGSAVE
while [ $(redis-cli LASTSAVE) -eq \${LAST_SAVE_TIME:-0} ]; do sleep 1; done

zstd -3 /var/lib/redis/dump.rdb -o "/var/backups/redis/dump_\${TIMESTAMP}.rdb.zst"
${uploadCmd} "/var/backups/redis/dump_\${TIMESTAMP}.rdb.zst" "${s3Path}/redis/"
`;

      case 'sqlite':
        return `#!/usr/bin/env bash
# SQLite Safe Hot Backup Pipeline
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

sqlite3 /var/lib/sqlite/prod.db ".backup /var/backups/sqlite/db_\${TIMESTAMP}.sqlite"
zstd -3 /var/backups/sqlite/db_\${TIMESTAMP}.sqlite -o /var/backups/sqlite/db_\${TIMESTAMP}.sqlite.zst
${uploadCmd} "/var/backups/sqlite/db_\${TIMESTAMP}.sqlite.zst" "${s3Path}/sqlite/"
`;

      case 'cassandra':
        return `#!/usr/bin/env bash
# Cassandra Multi-Node Snapshot Pipeline
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

nodetool snapshot --tag "snap_\${TIMESTAMP}" production_ks
tar -cf - /var/lib/cassandra/data/production_ks/*/snapshots/snap_\${TIMESTAMP} | zstd -3 > "/var/backups/cassandra/snap_\${TIMESTAMP}.tar.zst"
${uploadCmd} "/var/backups/cassandra/snap_\${TIMESTAMP}.tar.zst" "${s3Path}/cassandra/"
`;

      case 'postgres':
      default:
        return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery: PostgreSQL
# Retention: 30 Days | Destination: ${s3Path}
# =========================================================================
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/var/backups/postgresql/\${TIMESTAMP}"
ARCHIVE_NAME="pg_basebackup_\${TIMESTAMP}.tar.zst"

mkdir -p "\${BACKUP_DIR}"

pg_basebackup \\
  --host=127.0.0.1 \\
  --port=5432 \\
  --username=postgres \\
  --format=tar \\
  --wal-method=stream \\
  --checkpoint=fast \\
  --label="sqlpulse_daily_\${TIMESTAMP}" \\
  | zstd -3 -T0 -o "\${BACKUP_DIR}/\${ARCHIVE_NAME}"

${uploadCmd} "\${BACKUP_DIR}/\${ARCHIVE_NAME}" "${s3Path}/postgresql/\${ARCHIVE_NAME}"
echo "PostgreSQL Backup Succeeded!"
`;
    }
  }

  private generateCron(meta: any): string {
    return `# /etc/cron.d/sqlpulse-${meta.id}-backup
# Run full hot backup every night at 02:00 AM UTC
0 2 * * * root /usr/local/bin/sqlpulse-backup-${meta.id}.sh >> /var/log/sqlpulse-backup.log 2>&1
`;
  }

  private generateRestoreRunbook(meta: any, family: EngineFamily, sizeGb: number): string {
    switch (family) {
      case 'mysql':
        return `### 🚨 Disaster Recovery Runbook: MySQL (Percona XtraBackup & Binlog Replay)

1. **Stop MySQL Server**:
   \`\`\`bash
   sudo systemctl stop mysql
   \`\`\`

2. **Download & Prepare Physical Backup**:
   \`\`\`bash
   aws s3 cp s3://production-db-backups/mysql/latest.xbstream.zst /tmp/
   mkdir -p /var/backups/mysql/restore
   zstd -d -c /tmp/latest.xbstream.zst | xbstream -x -C /var/backups/mysql/restore/
   xtrabackup --prepare --target-dir=/var/backups/mysql/restore/
   \`\`\`

3. **Restore Data Directory**:
   \`\`\`bash
   sudo rm -rf /var/lib/mysql/*
   xtrabackup --copy-back --target-dir=/var/backups/mysql/restore/
   sudo chown -R mysql:mysql /var/lib/mysql
   \`\`\`

4. **Point-In-Time Binlog Replay (PITR)**:
   \`\`\`bash
   # Replay transactions up to target recovery point
   mysqlbinlog --stop-datetime="2026-10-03 12:00:00" \\
     /var/log/mysql/binlog.00004* | mysql -u root -p
   \`\`\`

5. **Start MySQL & Verify**:
   \`\`\`bash
   sudo systemctl start mysql
   mysql -e "SHOW SLAVE STATUS\\G"
   \`\`\`
`;

      case 'oracle':
        return `### 🚨 Disaster Recovery Runbook: Oracle Database RMAN Point-In-Time Restoration (PITR)

1. **Start Oracle Instance in NOMOUNT State**:
   \`\`\`bash
   export ORACLE_SID=ORCLCDB
   sqlplus / as sysdba <<EOF
   SHUTDOWN ABORT;
   STARTUP NOMOUNT;
   EXIT;
   EOF
   \`\`\`

2. **Restore Controlfile from Backup**:
   \`\`\`bash
   rman target / <<EOF
   RESTORE CONTROLFILE FROM 's3://production-db-backups/oracle/latest_control.bkp';
   ALTER DATABASE MOUNT;
   EXIT;
   EOF
   \`\`\`

3. **Execute Point-In-Time Recovery (PITR)**:
   \`\`\`bash
   rman target / <<EOF
   RUN {
     SET UNTIL TIME "TO_DATE('2026-10-03 12:00:00', 'YYYY-MM-DD HH24:MI:SS')";
     RESTORE DATABASE;
     RECOVER DATABASE;
   }
   EXIT;
   EOF
   \`\`\`

4. **Open Database with RESETLOGS**:
   \`\`\`bash
   sqlplus / as sysdba <<EOF
   ALTER DATABASE OPEN RESETLOGS;
   SELECT open_mode, database_role FROM v\\$database;
   EXIT;
   EOF
   \`\`\`
`;

      case 'sqlserver':
        return `### 🚨 Disaster Recovery Runbook: Microsoft SQL Server Point-In-Time (STOPAT)

1. **Set Database to SINGLE_USER Mode**:
   \`\`\`sql
   ALTER DATABASE [production_db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
   \`\`\`

2. **Restore Full Baseline Backup WITH NORECOVERY**:
   \`\`\`sql
   RESTORE DATABASE [production_db]
   FROM DISK = N'/var/backups/sqlserver/Full.bak'
   WITH NORECOVERY, REPLACE;
   \`\`\`

3. **Apply Differential and Transaction Logs up to Target STOPAT Timestamp**:
   \`\`\`sql
   RESTORE LOG [production_db]
   FROM DISK = N'/var/backups/sqlserver/Log.trn'
   WITH STOPAT = '2026-10-03 12:00:00', RECOVERY;
   \`\`\`

4. **Return Database to MULTI_USER Mode & Run DBCC Check**:
   \`\`\`sql
   ALTER DATABASE [production_db] SET MULTI_USER;
   DBCC CHECKDB ([production_db]) WITH NO_INFOMSGS;
   \`\`\`
`;

      case 'snowflake':
        return `### 🚨 Disaster Recovery Runbook: Snowflake Instant Time Travel & Table Restore

1. **Instant Undrop (Sub-second RTO)**:
   \`\`\`sql
   UNDROP TABLE production_db.public.customers;
   \`\`\`

2. **Restore Precise Point-in-Time Table State via Time Travel**:
   \`\`\`sql
   -- Clone table exactly as it existed at 12:00 PM UTC
   CREATE OR REPLACE TABLE production_db.public.customers_pitr_restored
   CLONE production_db.public.customers
   AT (TIMESTAMP => '2026-10-03 12:00:00'::timestamp_tz);
   \`\`\`

3. **Swap Restored Table Online (Zero Downtime)**:
   \`\`\`sql
   ALTER TABLE production_db.public.customers 
   SWAP WITH production_db.public.customers_pitr_restored;
   \`\`\`
`;

      case 'clickhouse':
        return `### 🚨 Disaster Recovery Runbook: ClickHouse Distributed Backup Restoration

1. **Restore Backup via clickhouse-backup**:
   \`\`\`bash
   clickhouse-backup download "ch_full_latest"
   clickhouse-backup restore "ch_full_latest"
   \`\`\`

2. **Restart ClickHouse Server**:
   \`\`\`bash
   sudo systemctl restart clickhouse-server
   clickhouse-client --query "SELECT count(*) FROM system.parts WHERE active;"
   \`\`\`
`;

      case 'mongodb':
        return `### 🚨 Disaster Recovery Runbook: MongoDB Point-In-Time Oplog Restoration

1. **Stop mongod Application Traffic**:
   \`\`\`bash
   sudo systemctl stop mongod
   \`\`\`

2. **Restore Baseline Dump with Oplog Replay**:
   \`\`\`bash
   mongorestore \\
     --uri="mongodb://localhost:27017" \\
     --gzip \\
     --archive=/tmp/mongo_latest.archive.gz \\
     --oplogReplay \\
     --oplogLimit="1760000000:1"
   \`\`\`

3. **Verify Cluster State**:
   \`\`\`bash
   mongosh --eval "rs.status()"
   \`\`\`
`;

      case 'sqlite':
        return `### 🚨 Disaster Recovery Runbook: SQLite Hot Database Recovery

1. **Restore Point-in-Time Database Image via Litestream or Snapshot**:
   \`\`\`bash
   litestream restore -timestamp "2026-10-03T12:00:00Z" \\
     -o /var/lib/sqlite/prod.db \\
     s3://production-db-backups/sqlite/db
   \`\`\`

2. **Verify SQLite Integrity**:
   \`\`\`bash
   sqlite3 /var/lib/sqlite/prod.db "PRAGMA integrity_check;"
   \`\`\`
`;

      case 'redis':
        return `### 🚨 Disaster Recovery Runbook: Redis Snapshot & AOF Restore

1. **Stop Redis Daemon**:
   \`\`\`bash
   sudo systemctl stop redis
   \`\`\`

2. **Copy Restored RDB Dump**:
   \`\`\`bash
   cp /var/backups/redis/dump_restored.rdb /var/lib/redis/dump.rdb
   chown redis:redis /var/lib/redis/dump.rdb
   \`\`\`

3. **Start Redis**:
   \`\`\`bash
   sudo systemctl start redis
   redis-cli INFO persistence
   \`\`\`
`;

      case 'cassandra':
        return `### 🚨 Disaster Recovery Runbook: Apache Cassandra SSTable Recovery

1. **Stop Cassandra Service**:
   \`\`\`bash
   nodetool drain
   sudo systemctl stop cassandra
   \`\`\`

2. **Restore SSTable Snapshot**:
   \`\`\`bash
   cp -R /var/backups/cassandra/snapshots/snap_latest/* /var/lib/cassandra/data/production_ks/table-*/
   sudo chown -R cassandra:cassandra /var/lib/cassandra/data/
   \`\`\`

3. **Start Node & Refresh**:
   \`\`\`bash
   sudo systemctl start cassandra
   nodetool refresh -- production_ks table_name
   \`\`\`
`;

      case 'postgres':
      default:
        return `### 🚨 Disaster Recovery Runbook: ${meta.name} Point-In-Time Restoration (PITR)

1. **Stop Database Service**:
   \`\`\`bash
   sudo systemctl stop ${meta.id}
   \`\`\`

2. **Isolate Corrupted Data Directory**:
   \`\`\`bash
   sudo mv /var/lib/${meta.id}/data /var/lib/${meta.id}/data.corrupted_$(date +%s)
   sudo mkdir -p /var/lib/${meta.id}/data
   sudo chown -R ${meta.id}:${meta.id} /var/lib/${meta.id}/data
   \`\`\`

3. **Fetch & Decompress Base Backup**:
   \`\`\`bash
   aws s3 cp s3://production-db-backups/${meta.id}/latest.tar.zst /tmp/
   zstd -d -c /tmp/latest.tar.zst | tar -xf - -C /var/lib/${meta.id}/data/
   \`\`\`

4. **Configure Target Recovery Point (PITR Target Timestamp)**:
   \`\`\`ini
   # Add to postgresql.conf or recovery.signal
   restore_command = 'aws s3 cp s3://production-db-backups/${meta.id}/wal/%f %p'
   recovery_target_time = '2026-10-03 12:00:00 UTC'
   recovery_target_action = 'promote'
   \`\`\`

5. **Start Database & Verify Cluster Status**:
   \`\`\`bash
   sudo touch /var/lib/${meta.id}/data/recovery.signal
   sudo systemctl start ${meta.id}
   sudo journalctl -u ${meta.id} -f
   \`\`\`
`;
    }
  }

  private generateVerificationCommand(meta: any, family: EngineFamily): string {
    let checkQuery = 'SELECT count(*) FROM information_schema.tables;';
    if (family === 'oracle') checkQuery = 'SELECT count(*) FROM all_tables;';
    if (family === 'sqlite') checkQuery = 'PRAGMA integrity_check;';
    if (family === 'mongodb') checkQuery = 'db.runCommand({ ping: 1 });';
    if (family === 'redis') checkQuery = 'redis-cli PING';

    return `# Automated Disaster Recovery Sandbox Verification Drill
docker run --rm \\
  -v /var/backups/${meta.id}:/backups:ro \\
  -e RESTORE_DRILL=true \\
  sqlpulse/${meta.id}-dr-verifier:latest \\
  --verify-archive=/backups/latest.tar.zst \\
  --checksum-check=all \\
  --smoke-test-query="${checkQuery}"
`;
  }
}
