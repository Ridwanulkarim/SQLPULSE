import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  HardDrive,
  DollarSign,
  Cloud,
  Copy,
  Check,
  Layers,
  Database
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { calculateDisasterRecovery } from '../services/api';
import { DisasterRecoveryResult, DATABASE_CATALOG } from '../types';

import { DatabaseEngine } from '../types';

import { resolveDisasterRecoveryPreset, getEngineMetadataSafe } from '../utils/enginePresets';

interface DisasterRecoveryTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const DisasterRecoveryTab: React.FC<DisasterRecoveryTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<string>(
    (propEngine as string) || 'postgresql'
  );

  useEffect(() => {
    if (propEngine && propEngine !== selectedEngine) {
      setSelectedEngine(propEngine);
    }
  }, [propEngine]);
  const [dbSizeGb, setDbSizeGb] = useState<number>(500);
  const [dailyChangePercent, setDailyChangePercent] = useState<number>(10);
  const [networkBandwidthMbps, setNetworkBandwidthMbps] = useState<number>(1000);
  const [diskThroughputMbSec, setDiskThroughputMbSec] = useState<number>(500);
  const [backupStrategy, setBackupStrategy] = useState<string>('daily_full_plus_wal_cdc');
  const [cloudProvider, setCloudProvider] = useState<string>('aws_s3');

  // Dynamically update disaster recovery sizing when switching ANY of the 447 engines
  useEffect(() => {
    const preset = resolveDisasterRecoveryPreset(selectedEngine);
    setDbSizeGb(preset.dbSizeGb);
    setDailyChangePercent(preset.dailyChangePercent);
    setCloudProvider(preset.cloudProvider);
  }, [selectedEngine]);

  const [result, setResult] = useState<DisasterRecoveryResult | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'cron' | 'runbook' | 'verify'>('script');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCalculate = async () => {
    try {
      const res = await calculateDisasterRecovery({
        engine: selectedEngine,
        dbSizeGb,
        dailyChangePercent,
        networkBandwidthMbps,
        diskThroughputMbSec,
        backupStrategy,
        cloudProvider,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Calculation failed');
    }
  };

  useEffect(() => {
    handleCalculate();
  }, [
    selectedEngine,
    dbSizeGb,
    dailyChangePercent,
    networkBandwidthMbps,
    diskThroughputMbSec,
    backupStrategy,
    cloudProvider,
  ]);

  const getCurrentCode = () => {
    if (!result) return '';
    if (activeTab === 'script') return result.backupScriptBash;
    if (activeTab === 'cron') return result.cronDefinition;
    if (activeTab === 'runbook') return result.restoreRunbookMarkdown;
    return result.verificationCommand;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find((db) => db.id === selectedEngine) || {
    name: selectedEngine,
    icon: '🗄️',
  };

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-purple-950 text-white shadow-xl shadow-teal-950/20 border border-teal-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-teal-500/30 text-teal-200 border border-teal-400/40">
              High Availability &amp; DR Studio
            </span>
            <span className="text-xs text-teal-300 font-medium">
              447 Database Engine RPO / RTO &amp; Automation Generator
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-teal-400" />
            Disaster Recovery &amp; Backup RPO/RTO Calculator
          </h2>
          <p className="text-xs sm:text-sm text-teal-200/90 mt-1 max-w-3xl">
            Simulate disaster recovery downtime, estimate cloud storage cost footprint, and generate zero-downtime hot physical backup automation scripts for {engineMeta.name}.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={(eng) => {
              setSelectedEngine(eng);
              onSelectEngine?.(eng as DatabaseEngine);
            }}
          />
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {[
              { id: 'postgres', label: 'PostgreSQL', icon: '🐘' },
              { id: 'mysql', label: 'MySQL', icon: '🐬' },
              { id: 'oracle', label: 'Oracle', icon: '🔴' },
              { id: 'sqlserver', label: 'SQL Server', icon: '🪟' },
              { id: 'mongodb', label: 'MongoDB', icon: '🍃' },
              { id: 'redis', label: 'Redis', icon: '⚡' },
              { id: 'clickhouse', label: 'ClickHouse', icon: '🟡' },
              { id: 'sqlite', label: 'SQLite', icon: '🪶' },
              { id: 'snowflake', label: 'Snowflake', icon: '❄️' },
              { id: 'cassandra', label: 'Cassandra', icon: '👁️' },
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSelectedEngine(preset.id);
                  onSelectEngine?.(preset.id as DatabaseEngine);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  selectedEngine.toLowerCase().includes(preset.id)
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 border-t border-purple-100">
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-teal-600" /> Database Total Size
              </span>
              <span className="font-mono text-purple-700 font-extrabold">{dbSizeGb} GB</span>
            </div>
            <input
              type="range"
              min={10}
              max={10000}
              step={50}
              value={dbSizeGb}
              onChange={(e) => setDbSizeGb(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Daily Write / Change Rate</span>
              <span className="font-mono text-teal-700 font-extrabold">{dailyChangePercent}% / day</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={dailyChangePercent}
              onChange={(e) => setDailyChangePercent(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-purple-600" /> Disk Restore Bandwidth
              </span>
              <span className="font-mono text-purple-700 font-extrabold">{diskThroughputMbSec} MB/s</span>
            </div>
            <select
              value={diskThroughputMbSec}
              onChange={(e) => setDiskThroughputMbSec(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value={150}>Standard Disk (150 MB/s)</option>
              <option value={500}>High-Performance SATA SSD (500 MB/s)</option>
              <option value={1500}>⚡ NVMe PCIe 4.0 (1,500 MB/s)</option>
              <option value={3000}>🚀 Enterprise NVMe RAID (3,000 MB/s)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              <Cloud className="w-4 h-4 text-blue-600 inline mr-1" /> Cloud Network Ingress / Egress
            </label>
            <select
              value={networkBandwidthMbps}
              onChange={(e) => setNetworkBandwidthMbps(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value={100}>100 Mbps (Standard Broadband)</option>
              <option value={1000}>1 Gbps (Standard Cloud Transit)</option>
              <option value={10000}>⚡ 10 Gbps (Direct Connect / Fast Cloud Backbone)</option>
              <option value={25000}>🚀 25 Gbps (Data Center Interconnect)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              <Layers className="w-4 h-4 text-indigo-600 inline mr-1" /> Backup Architecture
            </label>
            <select
              value={backupStrategy}
              onChange={(e) => setBackupStrategy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value="daily_full_plus_wal_cdc">✨ Full Basebackup + Continuous WAL/CDC Streaming (Low RPO)</option>
              <option value="multi_region_active_passive">🛡️ Multi-Region Synchronous Active-Passive (0 RPO)</option>
              <option value="hourly_snapshots">⏱️ Hourly Storage Volume Snapshots (1h RPO)</option>
              <option value="daily_full_differential">📦 Daily Full + Differential Dump (24h RPO)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Cloud Storage Destination
            </label>
            <select
              value={cloudProvider}
              onChange={(e) => setCloudProvider(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value="aws_s3">Amazon AWS S3 Standard ($0.023/GB)</option>
              <option value="gcp_gcs">Google Cloud Storage ($0.020/GB)</option>
              <option value="azure_blob">Microsoft Azure Blob Hot ($0.018/GB)</option>
              <option value="local_nfs">On-Premises Dedicated NAS / MinIO ($0.010/GB)</option>
            </select>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-teal-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Recovery Point (RPO)</span>
                <Clock className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-xl font-black text-teal-950">{result.rpo.theoreticalRpo}</div>
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-100 text-teal-900">
                {result.rpo.rpoClassification}
              </span>
              <p className="text-[11px] text-slate-500 pt-1 leading-tight">{result.rpo.explanation}</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Recovery Time (RTO)</span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-black text-purple-950">{result.rto.formattedRto}</div>
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-900">
                Est. Downtime Duration
              </span>
              <p className="text-[11px] text-slate-500 pt-1 leading-tight">
                Includes fetch, disk decompression, log replay, and sanity checks.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">30-Day Storage Retention</span>
                <HardDrive className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-black text-indigo-950">
                {result.storageEconomics.compressed30DayRetentionGb} GB
              </div>
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-900">
                {result.storageEconomics.compressionRatio}
              </span>
              <p className="text-[11px] text-slate-500 pt-1 leading-tight">
                Raw uncompressed size: {result.storageEconomics.raw30DayRetentionGb} GB.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cloud Storage Cost</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-950">
                ${result.storageEconomics.estimatedMonthlyStorageCostUsd} / mo
              </div>
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900">
                Tier: Standard S3 / Blob
              </span>
              <p className="text-[11px] text-slate-500 pt-1 leading-tight">
                Excludes egress fees during active disaster drills.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Recovery Time Objective (RTO) Step-by-Step Timeline Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {result.rto.stages.map((st, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/40 space-y-1.5">
                  <div className="text-xs font-extrabold text-purple-950">{st.stage}</div>
                  <div className="text-sm font-black text-teal-700 font-mono">
                    ~{st.durationMinutes} mins
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">{st.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            
            <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-purple-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('script')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'script'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📜 Backup Bash Pipeline
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cron')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'cron'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⏰ Crontab / Systemd Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('runbook')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'runbook'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🚨 PITR Restoration Runbook
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('verify')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'verify'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🐳 Docker Verification Drill
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-purple-300 text-purple-900 hover:bg-purple-50 shadow-sm transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-teal-200 overflow-x-auto selection:bg-teal-600 selection:text-white max-h-[500px] overflow-y-auto">
              {getCurrentCode()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
