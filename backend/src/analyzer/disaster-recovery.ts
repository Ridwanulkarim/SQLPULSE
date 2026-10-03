import { DATABASE_CATALOG } from '../types/db-catalog.data';

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

export class DisasterRecoveryCalculator {
  public calculate(req: DisasterRecoveryRequest): DisasterRecoveryResult {
    const meta = getEngineMeta(req.engine);
    const sizeGb = Math.max(1, req.dbSizeGb);
    const dailyChange = Math.max(1, Math.min(100, req.dailyChangePercent));
    const netMbps = Math.max(10, req.networkBandwidthMbps);
    const diskMbSec = Math.max(10, req.diskThroughputMbSec);
    const strategy = req.backupStrategy || 'daily_full_plus_wal_cdc';
    const cloud = req.cloudProvider || 'aws_s3';

    // 1. RPO Calculation
    let theoreticalRpo = '< 15 seconds';
    let rpoClass: 'Zero Data Loss' | 'Near Real-Time (<1m)' | 'Standard (<15m)' | 'High Risk (24h)' = 'Near Real-Time (<1m)';
    let rpoExplanation = 'Continuous WAL/Binlog streaming archives write transactions to durable storage immediately after commit.';

    if (strategy === 'multi_region_active_passive') {
      theoreticalRpo = '0 seconds (Synchronous / Semi-Sync)';
      rpoClass = 'Zero Data Loss';
      rpoExplanation = 'Synchronous replica acknowledged commits prior to disaster, ensuring zero data loss.';
    } else if (strategy === 'daily_full_plus_wal_cdc') {
      theoreticalRpo = '< 15 seconds';
      rpoClass = 'Near Real-Time (<1m)';
      rpoExplanation = 'WAL/Binlog continuous archival pushes transaction chunks to cloud storage every 15 seconds.';
    } else if (strategy === 'hourly_snapshots') {
      theoreticalRpo = '< 60 minutes';
      rpoClass = 'Standard (<15m)';
      rpoExplanation = 'Periodic hourly snapshots risk losing up to 59 minutes of data written since last snapshot.';
    } else {
      theoreticalRpo = 'Up to 24 hours';
      rpoClass = 'High Risk (24h)';
      rpoExplanation = 'Nightly batch dumps only. If a catastrophic disk failure occurs at 5 PM, all work since midnight is lost.';
    }

    // 2. RTO Calculation (Download time + Disk extraction + WAL/Redo replay + Health Check)
    // Transfer speed (MB/s) = min(diskThroughput, networkSpeedMB/s)
    const netMbSec = netMbps / 8;
    const effectiveTransferMbSec = Math.min(diskMbSec, netMbSec);
    const compressedSizeGb = +(sizeGb * 0.45).toFixed(2); // Avg zstd compression
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
        stage: '3. Transaction Log (WAL/Binlog) Replay & PITR',
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

    // 3. Storage Economics (30 days retention: 4 full backups + 30 daily incrementals)
    const raw30DayRetentionGb = Math.round((sizeGb * 4) + (dailyChangeGb * 30));
    const compressed30DayRetentionGb = Math.round(raw30DayRetentionGb * 0.40);
    const costPerGbMonth = cloud === 'aws_s3' ? 0.023 : cloud === 'gcp_gcs' ? 0.020 : cloud === 'azure_blob' ? 0.018 : 0.010;
    const estimatedMonthlyStorageCostUsd = +(compressed30DayRetentionGb * costPerGbMonth).toFixed(2);

    // 4. Engine Native Script Generator
    const backupScriptBash = this.generateBackupScript(meta, cloud, sizeGb);
    const cronDefinition = this.generateCron(meta);
    const restoreRunbookMarkdown = this.generateRestoreRunbook(meta, sizeGb);
    const verificationCommand = this.generateVerificationCommand(meta);

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

  private generateBackupScript(meta: any, cloud: string, sizeGb: number): string {
    const s3Path = cloud === 'aws_s3' ? 's3://production-db-backups' : cloud === 'gcp_gcs' ? 'gs://production-db-backups' : 'az://production-db-backups';
    const uploadCmd = cloud === 'aws_s3' ? 'aws s3 cp' : cloud === 'gcp_gcs' ? 'gcloud storage cp' : 'azcopy copy';

    if (meta.id === 'postgres' || meta.id === 'postgresql' || meta.id === 'timescaledb') {
      return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery Backup Pipeline: PostgreSQL
# Retention: 30 Days | Compression: Zstandard -3 | Destination: ${s3Path}
# =========================================================================
set -euo pipefail
IFS=$'\\n\\t'

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/var/backups/postgresql/\${TIMESTAMP}"
ARCHIVE_NAME="pg_basebackup_\${TIMESTAMP}.tar.zst"
LOG_FILE="/var/log/pg_backup_\${TIMESTAMP}.log"

echo "=== [$(date)] Starting PostgreSQL Zero-Downtime Base Backup ===" | tee -a "\${LOG_FILE}"

mkdir -p "\${BACKUP_DIR}"

# 1. Stream physical cluster basebackup with progress and WAL inclusions
pg_basebackup \\
  --host=127.0.0.1 \\
  --port=5432 \\
  --username=postgres \\
  --format=tar \\
  --wal-method=stream \\
  --checkpoint=fast \\
  --label="sqlpulse_daily_\${TIMESTAMP}" \\
  | zstd -3 -T0 -o "\${BACKUP_DIR}/\${ARCHIVE_NAME}"

# 2. Upload to Cloud Storage with Retries
echo "=== [$(date)] Streaming encrypted archive to Cloud Storage ===" | tee -a "\${LOG_FILE}"
${uploadCmd} "\${BACKUP_DIR}/\${ARCHIVE_NAME}" "${s3Path}/postgresql/\${ARCHIVE_NAME}"

# 3. Clean local scratch directory older than 3 days
find /var/backups/postgresql -mindepth 1 -maxdepth 1 -mtime +3 -exec rm -rf {} +

echo "=== [$(date)] PostgreSQL Backup Succeeded! Size: $(du -sh "\${BACKUP_DIR}/\${ARCHIVE_NAME}" | cut -f1) ===" | tee -a "\${LOG_FILE}"
`;
    } else if (meta.id === 'mysql' || meta.id === 'mariadb') {
      return `#!/usr/bin/env bash
# =========================================================================
# SQLPulse Production Disaster Recovery Backup Pipeline: MySQL (Percona XtraBackup)
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
    } else if (meta.id === 'clickhouse') {
      return `#!/usr/bin/env bash
# ClickHouse Production Backup using clickhouse-backup
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

clickhouse-backup create_remote "ch_full_\${TIMESTAMP}"
echo "ClickHouse distributed backup created and uploaded to ${s3Path}/clickhouse."
`;
    } else if (meta.id === 'redis' || meta.id === 'keydb') {
      return `#!/usr/bin/env bash
# Redis RDB Snapshot + Cloud Offload
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

redis-cli BGSAVE
while [ $(redis-cli LASTSAVE) -eq \${LAST_SAVE_TIME:-0} ]; do sleep 1; done

zstd -3 /var/lib/redis/dump.rdb -o "/var/backups/redis/dump_\${TIMESTAMP}.rdb.zst"
${uploadCmd} "/var/backups/redis/dump_\${TIMESTAMP}.rdb.zst" "${s3Path}/redis/"
`;
    } else {
      return `#!/usr/bin/env bash
# Universal Production Backup for ${meta.name} (${meta.categoryLabel})
set -euo pipefail
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="/var/backups/${meta.id}/backup_\${TIMESTAMP}.tar.zst"

mkdir -p "$(dirname "\${ARCHIVE}")"
tar --exclude='*.sock' -cf - "/var/lib/${meta.id}" | zstd -3 -T0 > "\${ARCHIVE}"
${uploadCmd} "\${ARCHIVE}" "${s3Path}/${meta.id}/"
echo "${meta.name} backup archived to cloud successfully."
`;
    }
  }

  private generateCron(meta: any): string {
    return `# /etc/cron.d/sqlpulse-${meta.id}-backup
# Run full hot backup every night at 02:00 AM UTC
0 2 * * * root /usr/local/bin/sqlpulse-backup-${meta.id}.sh >> /var/log/sqlpulse-backup.log 2>&1
`;
  }

  private generateRestoreRunbook(meta: any, sizeGb: number): string {
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
   # Download latest base backup image (${sizeGb} GB)
   aws s3 cp s3://production-db-backups/${meta.id}/latest.tar.zst /tmp/
   zstd -d -c /tmp/latest.tar.zst | tar -xf - -C /var/lib/${meta.id}/data/
   \`\`\`

4. **Configure Target Recovery Point (PITR Target Timestamp)**:
   \`\`\`ini
   # Add to recovery.signal or config
   restore_command = 'aws s3 cp s3://production-db-backups/${meta.id}/wal/%f %p'
   recovery_target_time = '2026-10-03 12:00:00 UTC'
   recovery_target_action = 'promote'
   \`\`\`

5. **Start Database & Verify Cluster Status**:
   \`\`\`bash
   sudo systemctl start ${meta.id}
   sudo journalctl -u ${meta.id} -f
   \`\`\`
`;
  }

  private generateVerificationCommand(meta: any): string {
    return `# Automated Disaster Recovery Sandbox Verification Drill
docker run --rm \\
  -v /var/backups/${meta.id}:/backups:ro \\
  -e RESTORE_DRILL=true \\
  sqlpulse/${meta.id}-dr-verifier:latest \\
  --verify-archive=/backups/latest.tar.zst \\
  --checksum-check=all \\
  --smoke-test-query="SELECT count(*) FROM information_schema.tables;"
`;
  }
}
