import { DATABASE_CATALOG } from '../types/db-catalog.data';

export type CloudProviderType = 'aws_rds' | 'aws_aurora' | 'gcp_cloudsql' | 'gcp_alloydb' | 'azure_sql' | 'azure_cosmos' | 'neon_serverless' | 'supabase_cloud' | 'mongodb_atlas';

export interface FinOpsRequest {
  engine: string;
  cloudProvider?: CloudProviderType;
  dbSizeGb?: number;
  monthlyReadQueriesMillion?: number;
  monthlyWriteQueriesMillion?: number;
  ramGb?: number;
  vCpuCount?: number;
  storageTier?: 'gp3' | 'io2' | 'standard_ssd' | 'serverless_cu' | 'premium_ssd';
  provisionedIops?: number;
  backupRetentionDays?: number;
  multiRegionHa?: boolean;
}

export interface CostBreakdownItem {
  category: string;
  monthlyCostUsd: number;
  pctOfTotal: number;
  description: string;
}

export interface FinOpsResult {
  engine: string;
  engineName: string;
  cloudProvider: CloudProviderType;
  cloudProviderName: string;
  monthlyTotalCostUsd: number;
  annualTotalCostUsd: number;
  costBreakdown: CostBreakdownItem[];
  recommendedInstanceClass: string;
  storageConfiguration: {
    allocatedGb: number;
    storageType: string;
    effectiveIops: number;
    throughputMbSec: number;
    monthlyStorageCostUsd: number;
  };
  savingsOpportunities: {
    title: string;
    monthlySavingsUsd: number;
    difficulty: 'EASY' | 'MODERATE' | 'ADVANCED';
    actionableFix: string;
    ddlOrConfigSnippet: string;
  }[];
  terraformIaC: string;
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

export class FinOpsCalculatorAnalyzer {
  public calculate(req: FinOpsRequest): FinOpsResult {
    const meta = getEngineMeta(req.engine);
    const provider = req.cloudProvider || 'aws_aurora';
    const dbSizeGb = Math.max(10, req.dbSizeGb || 250);
    const readsM = Math.max(0.1, req.monthlyReadQueriesMillion || 50);
    const writesM = Math.max(0.1, req.monthlyWriteQueriesMillion || 15);
    const ramGb = req.ramGb || 32;
    const vCpu = req.vCpuCount || 8;
    const isHa = req.multiRegionHa ?? true;
    const backupDays = req.backupRetentionDays || 30;

    let providerName = 'AWS Aurora Serverless v2';
    let computeCostPerHour = 0.24 * (vCpu / 2);
    let storageRatePerGb = 0.10;
    let iopsCost = 0;
    let instanceType = `db.r6g.${vCpu >= 16 ? '4xlarge' : vCpu >= 8 ? '2xlarge' : 'xlarge'}`;

    switch (provider) {
      case 'aws_aurora':
        providerName = 'AWS Aurora PostgreSQL / MySQL (Multi-AZ)';
        computeCostPerHour = 0.28 * (vCpu / 2);
        storageRatePerGb = 0.10; 
        iopsCost = (readsM + writesM) * 0.20; 
        instanceType = `db.r6g.${vCpu >= 16 ? '4xlarge' : vCpu >= 8 ? '2xlarge' : 'xlarge'}`;
        break;
      case 'aws_rds':
        providerName = 'AWS RDS Provisioned (GP3 / IO2)';
        computeCostPerHour = 0.22 * (vCpu / 2);
        storageRatePerGb = 0.115;
        iopsCost = Math.max(0, ((req.provisionedIops || 3000) - 3000) * 0.005);
        instanceType = `db.m6g.${vCpu >= 8 ? '2xlarge' : 'xlarge'}`;
        break;
      case 'gcp_alloydb':
        providerName = 'Google Cloud AlloyDB for PostgreSQL';
        computeCostPerHour = 0.32 * (vCpu / 2);
        storageRatePerGb = 0.12;
        iopsCost = 0; 
        instanceType = `alloydb-custom-${vCpu}-${ramGb * 1024}`;
        break;
      case 'gcp_cloudsql':
        providerName = 'Google Cloud SQL (Enterprise HA)';
        computeCostPerHour = 0.25 * (vCpu / 2);
        storageRatePerGb = 0.17;
        instanceType = `db-custom-${vCpu}-${ramGb * 1024}`;
        break;
      case 'azure_sql':
        providerName = 'Microsoft Azure SQL Database / Flexible Server';
        computeCostPerHour = 0.27 * (vCpu / 2);
        storageRatePerGb = 0.115;
        instanceType = `Standard_D${vCpu}ds_v5 (${ramGb}GB RAM)`;
        break;
      case 'azure_cosmos':
        providerName = 'Microsoft Azure Cosmos DB (Multi-Region RU/s)';
        computeCostPerHour = 0.18 * (vCpu / 2);
        storageRatePerGb = 0.25;
        iopsCost = (readsM + writesM) * 0.08 * 10;
        instanceType = 'Provisioned Autoscale 10,000 RU/s';
        break;
      case 'neon_serverless':
        providerName = 'Neon Serverless Postgres (Autoscale CU)';
        computeCostPerHour = 0.16 * (vCpu / 2);
        storageRatePerGb = 0.15;
        instanceType = `${Math.ceil(vCpu / 2)} - ${vCpu * 2} Compute Units (CU)`;
        break;
      case 'supabase_cloud':
        providerName = 'Supabase Cloud (Dedicated Pro + Compute Add-on)';
        computeCostPerHour = 0.20 * (vCpu / 2);
        storageRatePerGb = 0.125;
        instanceType = `Supabase ${ramGb >= 32 ? '4XL Compute (32GB)' : '2XL Compute (16GB)'}`;
        break;
      case 'mongodb_atlas':
        providerName = 'MongoDB Atlas Dedicated Cluster';
        computeCostPerHour = 0.30 * (vCpu / 2);
        storageRatePerGb = 0.14;
        instanceType = `Cluster Tier M${vCpu >= 8 ? '50 (32GB RAM)' : '40 (16GB RAM)'}`;
        break;
    }

    const haMultiplier = isHa ? 1.85 : 1.0;
    const monthlyComputeCost = computeCostPerHour * 730 * haMultiplier;
    const monthlyStorageCost = dbSizeGb * storageRatePerGb;
    const monthlyIopsCost = iopsCost;
    const monthlyBackupCost = (dbSizeGb * (backupDays / 30) * 0.095);
    const monthlyEgressCost = (readsM * 0.0004 * 0.09 * 1000); 

    const monthlyTotal = Math.round(monthlyComputeCost + monthlyStorageCost + monthlyIopsCost + monthlyBackupCost + monthlyEgressCost);
    const annualTotal = monthlyTotal * 12;

    const costBreakdown: CostBreakdownItem[] = [
      {
        category: 'vCPU & RAM Compute Nodes',
        monthlyCostUsd: Math.round(monthlyComputeCost),
        pctOfTotal: Math.round((monthlyComputeCost / monthlyTotal) * 100),
        description: `${instanceType} (${vCpu} vCPU, ${ramGb}GB RAM)${isHa ? ' + Standby Failover Replica' : ''}`
      },
      {
        category: 'Primary Disk Storage',
        monthlyCostUsd: Math.round(monthlyStorageCost),
        pctOfTotal: Math.round((monthlyStorageCost / monthlyTotal) * 100),
        description: `${dbSizeGb} GB NVMe SSD Storage @ $${storageRatePerGb.toFixed(3)}/GB-mo`
      },
      {
        category: 'IOPS & Disk Operations',
        monthlyCostUsd: Math.round(monthlyIopsCost),
        pctOfTotal: Math.round((monthlyIopsCost / monthlyTotal) * 100),
        description: `${(readsM + writesM).toFixed(1)}M Monthly I/O Operations & IOPS Burst Allocation`
      },
      {
        category: 'Automated Snapshots & WAL Backup',
        monthlyCostUsd: Math.round(monthlyBackupCost),
        pctOfTotal: Math.round((monthlyBackupCost / monthlyTotal) * 100),
        description: `${backupDays} Days Point-In-Time Continuous Recovery (PITR) Object Retention`
      },
      {
        category: 'Cross-Region Egress & VPC Transfer',
        monthlyCostUsd: Math.round(monthlyEgressCost),
        pctOfTotal: Math.round((monthlyEgressCost / monthlyTotal) * 100),
        description: 'Read replica replication data stream and application gateway egress'
      }
    ];

    const savingsOpportunities = [
      {
        title: 'Upgrade from Legacy GP2 to GP3 Storage (Save 20% on Storage)',
        monthlySavingsUsd: Math.round(monthlyStorageCost * 0.20),
        difficulty: 'EASY' as const,
        actionableFix: 'GP3 provides a baseline 3,000 IOPS and 125 MB/s throughput without paying for unneeded disk storage allocation.',
        ddlOrConfigSnippet: `-- AWS RDS CLI Storage Volume Modification:
aws rds modify-db-instance \\
  --db-instance-identifier prod-db-primary \\
  --storage-type gp3 \\
  --allocated-storage ${dbSizeGb} \\
  --iops 3000 \\
  --apply-immediately`
      },
      {
        title: 'Compress Historical Cold Partitions to ZSTD / Parquet S3 (Save 65% Storage)',
        monthlySavingsUsd: Math.round(monthlyStorageCost * 0.45),
        difficulty: 'MODERATE' as const,
        actionableFix: 'Move records older than 90 days into columnar S3 Iceberg/Parquet tables or apply native ZSTD/TOAST dictionary compression.',
        ddlOrConfigSnippet: `-- PostgreSQL Native Columnar Compression (pg_analytics / pg_tier):
ALTER TABLE orders_archive_2025 SET (toast_tuple_target = 128);
-- Export cold partition to S3 Parquet:
COPY (SELECT * FROM orders WHERE created_at < NOW() - INTERVAL '90 days')
TO 's3://cold-data-lake-prod/orders_cold.parquet' WITH (FORMAT parquet);`
      },
      {
        title: 'Eliminate Redundant Indexes to Cut Write Amplification (Save 30% I/O Costs)',
        monthlySavingsUsd: Math.round(monthlyIopsCost * 0.35 + monthlyComputeCost * 0.08),
        difficulty: 'EASY' as const,
        actionableFix: 'Dropping 3+ overlapping secondary indexes reduces WAL generation and disk write IOPS drastically.',
        ddlOrConfigSnippet: `-- Identify & Drop Unused / Redundant Indexes:
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_id_redundant;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_created_at_duplicate;`
      },
      {
        title: 'Reserved Instance (RI) / Savings Plan Commitment (Save 38% on Compute)',
        monthlySavingsUsd: Math.round(monthlyComputeCost * 0.38),
        difficulty: 'EASY' as const,
        actionableFix: 'Switch from On-Demand pricing to a 1-year or 3-year All-Upfront / No-Upfront Savings Plan.',
        ddlOrConfigSnippet: `# AWS Compute Savings Plan / Reserved DB Instance
# Estimated ROI: 38.2% annual net savings ($${Math.round(monthlyComputeCost * 0.38 * 12).toLocaleString()}/year)
aws rds purchase-reserved-db-instances-offering \\
  --reserved-db-instances-offering-id 48a0-9812-ri-aurora \\
  --db-instance-count 1`
      }
    ];

    const terraformIaC = `# -------------------------------------------------------------
# Production Cloud Infrastructure as Code (Terraform HCL)
# Target Database: ${meta.name} (${providerName})
# Monthly Estimated Cost: $${monthlyTotal.toLocaleString()} USD
# -------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_db_instance" "production_db" {
  identifier           = "sqlpulse-prod-${req.engine}"
  engine               = "${req.engine === 'postgres' ? 'postgres' : req.engine === 'mysql' ? 'mysql' : 'postgres'}"
  instance_class       = "${instanceType.startsWith('db.') ? instanceType : 'db.r6g.xlarge'}"
  allocated_storage    = ${dbSizeGb}
  max_allocated_storage = ${Math.round(dbSizeGb * 2.5)}
  storage_type         = "gp3"
  iops                 = 3000
  storage_throughput   = 125
  
  multi_az             = ${isHa ? 'true' : 'false'}
  publicly_accessible  = false
  skip_final_snapshot  = false
  final_snapshot_identifier = "sqlpulse-prod-${req.engine}-final-snapshot"
  backup_retention_period   = ${backupDays}
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"

  storage_encrypted    = true
  deletion_protection  = true
  auto_minor_version_upgrade = false

  tags = {
    Environment = "Production"
    ManagedBy   = "SQLPulse FinOps Architect"
    Engine      = "${meta.name}"
    CostCenter  = "Core-Infrastructure"
  }
}`;

    return {
      engine: meta.id,
      engineName: meta.name,
      cloudProvider: provider,
      cloudProviderName: providerName,
      monthlyTotalCostUsd: monthlyTotal,
      annualTotalCostUsd: annualTotal,
      costBreakdown,
      recommendedInstanceClass: instanceType,
      storageConfiguration: {
        allocatedGb: dbSizeGb,
        storageType: 'GP3 NVMe (Separated IOPS)',
        effectiveIops: 3000,
        throughputMbSec: 125,
        monthlyStorageCostUsd: Math.round(monthlyStorageCost)
      },
      savingsOpportunities,
      terraformIaC
    };
  }
}
