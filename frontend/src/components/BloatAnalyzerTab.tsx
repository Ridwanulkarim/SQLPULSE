import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG, BloatAnalyzeResult } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { analyzeTableBloat } from '../services/api';
import {
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Database,
  HardDrive,
  Cpu,
  Activity,
  Clock,
  Zap,
  Sparkles,
  Gauge,
  ArrowDownRight,
  SlidersHorizontal,
} from 'lucide-react';

interface BloatAnalyzerTabProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
}

interface BloatEngineProfile {
  tableName: string;
  totalTableSizeGb: number;
  deadTuplePercentage: number;
  avgDailyUpdates: number;
  targetIoSpeedMbSec: number;
  footprintLabel: string;
}

const ENGINE_PROFILES: Record<string, BloatEngineProfile> = {
  postgresql: { tableName: 'orders', totalTableSizeGb: 120, deadTuplePercentage: 38, avgDailyUpdates: 500000, targetIoSpeedMbSec: 75, footprintLabel: '120 GB' },
  mysql: { tableName: 'customer_orders', totalTableSizeGb: 85, deadTuplePercentage: 32, avgDailyUpdates: 400000, targetIoSpeedMbSec: 80, footprintLabel: '85 GB' },
  oracle: { tableName: 'SALES_TRANSACTIONS', totalTableSizeGb: 250, deadTuplePercentage: 28, avgDailyUpdates: 650000, targetIoSpeedMbSec: 100, footprintLabel: '250 GB' },
  sqlserver: { tableName: 'SalesOrders', totalTableSizeGb: 140, deadTuplePercentage: 35, avgDailyUpdates: 450000, targetIoSpeedMbSec: 90, footprintLabel: '140 GB' },
  sqlite: { tableName: 'user_sessions', totalTableSizeGb: 3.5, deadTuplePercentage: 25, avgDailyUpdates: 50000, targetIoSpeedMbSec: 40, footprintLabel: '3.5 GB' },
  clickhouse: { tableName: 'events_distributed', totalTableSizeGb: 1200, deadTuplePercentage: 22, avgDailyUpdates: 2500000, targetIoSpeedMbSec: 250, footprintLabel: '1.2 TB' },
  mongodb: { tableName: 'orders_collection', totalTableSizeGb: 95, deadTuplePercentage: 34, avgDailyUpdates: 600000, targetIoSpeedMbSec: 85, footprintLabel: '95 GB' },
  cassandra: { tableName: 'sensor_timeseries', totalTableSizeGb: 450, deadTuplePercentage: 40, avgDailyUpdates: 1200000, targetIoSpeedMbSec: 120, footprintLabel: '450 GB' },
  redis: { tableName: 'session_cache', totalTableSizeGb: 12, deadTuplePercentage: 20, avgDailyUpdates: 3000000, targetIoSpeedMbSec: 200, footprintLabel: '12 GB' },
  snowflake: { tableName: 'FACT_TRANSACTIONS', totalTableSizeGb: 2800, deadTuplePercentage: 18, avgDailyUpdates: 5000000, targetIoSpeedMbSec: 350, footprintLabel: '2.8 TB' },
};

const POPULAR_ENGINES = [
  { id: 'postgresql', label: 'PostgreSQL', footprint: '120 GB' },
  { id: 'mysql', label: 'MySQL', footprint: '85 GB' },
  { id: 'oracle', label: 'Oracle', footprint: '250 GB' },
  { id: 'sqlserver', label: 'SQL Server', footprint: '140 GB' },
  { id: 'sqlite', label: 'SQLite', footprint: '3.5 GB' },
  { id: 'clickhouse', label: 'ClickHouse', footprint: '1.2 TB' },
  { id: 'mongodb', label: 'MongoDB', footprint: '95 GB' },
  { id: 'cassandra', label: 'Cassandra', footprint: '450 GB' },
  { id: 'redis', label: 'Redis', footprint: '12 GB' },
  { id: 'snowflake', label: 'Snowflake', footprint: '2.8 TB' },
];

export const BloatAnalyzerTab: React.FC<BloatAnalyzerTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [tableName, setTableName] = useState('orders');
  const [totalTableSizeGb, setTotalTableSizeGb] = useState<number>(120);
  const [deadTuplePercentage, setDeadTuplePercentage] = useState<number>(38);
  const [avgDailyUpdates, setAvgDailyUpdates] = useState<number>(500000);
  const [targetIoSpeedMbSec, setTargetIoSpeedMbSec] = useState<number>(75);
  const [simulatePostVacuum, setSimulatePostVacuum] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BloatAnalyzeResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Automatically update realistic table size, table name, and bloat profile when switching engines
  useEffect(() => {
    const norm = selectedEngine.toLowerCase();
    let profile: BloatEngineProfile | undefined;

    if (norm.includes('sqlite') || norm.includes('turso')) {
      profile = ENGINE_PROFILES.sqlite;
    } else if (norm.includes('redis') || norm.includes('valkey') || norm.includes('keydb')) {
      profile = ENGINE_PROFILES.redis;
    } else if (norm.includes('click') || norm.includes('duck')) {
      profile = ENGINE_PROFILES.clickhouse;
    } else if (norm.includes('snow') || norm.includes('bigquery') || norm.includes('redshift')) {
      profile = ENGINE_PROFILES.snowflake;
    } else if (norm.includes('cassandra') || norm.includes('scylla') || norm.includes('hbase')) {
      profile = ENGINE_PROFILES.cassandra;
    } else if (norm.includes('oracle') || norm.includes('db2')) {
      profile = ENGINE_PROFILES.oracle;
    } else if (norm.includes('sqlserver') || norm.includes('mssql')) {
      profile = ENGINE_PROFILES.sqlserver;
    } else if (norm.includes('mysql') || norm.includes('maria')) {
      profile = ENGINE_PROFILES.mysql;
    } else if (norm.includes('mongo') || norm.includes('document')) {
      profile = ENGINE_PROFILES.mongodb;
    } else {
      profile = ENGINE_PROFILES.postgresql;
    }

    if (profile) {
      setTableName(profile.tableName);
      setTotalTableSizeGb(profile.totalTableSizeGb);
      setDeadTuplePercentage(profile.deadTuplePercentage);
      setAvgDailyUpdates(profile.avgDailyUpdates);
      setTargetIoSpeedMbSec(profile.targetIoSpeedMbSec);
    }
  }, [selectedEngine]);

  const handleAnalyze = async (forcedSimulate?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const isSimulated = forcedSimulate !== undefined ? forcedSimulate : simulatePostVacuum;
      const data = await analyzeTableBloat({
        engine: selectedEngine,
        tableName,
        totalTableSizeGb,
        deadTuplePercentage: isSimulated ? 2 : deadTuplePercentage,
        avgDailyUpdates,
        targetIoSpeedMbSec,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze table bloat');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleAnalyze();
  }, [selectedEngine, tableName, totalTableSizeGb, deadTuplePercentage, avgDailyUpdates, targetIoSpeedMbSec, simulatePostVacuum]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  // Calculate percentage splits for the visual before-and-after storage bar
  const bloatPct = simulatePostVacuum ? 2 : (result?.averageBloatPercentage || deadTuplePercentage);
  const liveDataPct = 100 - bloatPct;

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Header */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-orange-950 text-white shadow-xl shadow-amber-950/20 border border-amber-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/30 text-amber-200 border border-amber-400/40 flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5 text-amber-300" /> Storage Hygiene &amp; Vacuum Optimization
            </span>
            <span className="text-xs text-amber-300 font-medium">
              MVCC Dead Tuples • High Water Mark • B-Tree Page Splits • Zero-Downtime Repack
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-amber-400" />
            Table Bloat &amp; Vacuum Diagnostic Studio
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-3xl">
            Diagnose dead row versions, empty page fragments, and unmerged storage below High Water Marks for {engineMeta.name}. Calculate exact vacuum runtimes, reclaimable disk space, and autovacuum schedule tuning.
          </p>

          {/* Quick Engine Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-amber-800/40">
            <span className="text-[11px] text-amber-300/80 font-bold uppercase tracking-wider mr-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-amber-400" /> Database Presets:
            </span>
            {POPULAR_ENGINES.map((eng) => (
              <button
                key={eng.id}
                type="button"
                onClick={() => onSelectEngine(eng.id as DatabaseEngine)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 ${
                  selectedEngine.toLowerCase().includes(eng.id)
                    ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                    : 'bg-amber-900/60 text-amber-200 hover:bg-amber-800/80 border border-amber-700/50'
                }`}
              >
                <span>{eng.label}</span>
                <span className="text-[10px] opacity-75 font-mono">({eng.footprint})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Strip */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white/95 border border-amber-200/80 shadow-xs backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={onSelectEngine}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-amber-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-600" />
              Target Table / Object
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="orders"
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-amber-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              Total Table Size (GB)
            </label>
            <input
              type="number"
              value={totalTableSizeGb}
              onChange={(e) => setTotalTableSizeGb(Number(e.target.value))}
              min={1}
              max={100000}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-amber-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Dead Tuple / Bloat %
              </span>
              <span className={`font-mono font-black text-xs px-1.5 py-0.5 rounded ${
                deadTuplePercentage >= 40
                  ? 'bg-rose-100 text-rose-800'
                  : deadTuplePercentage >= 20
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {deadTuplePercentage}%
              </span>
            </label>
            <input
              type="range"
              min={5}
              max={85}
              value={deadTuplePercentage}
              onChange={(e) => setDeadTuplePercentage(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer mt-2"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              Daily Updates / Deletes
            </label>
            <input
              type="number"
              value={avgDailyUpdates}
              onChange={(e) => setAvgDailyUpdates(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-amber-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-teal-600" />
              I/O Throughput (MB/s)
            </label>
            <select
              value={targetIoSpeedMbSec}
              onChange={(e) => setTargetIoSpeedMbSec(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-2xs"
            >
              <option value={35}>35 MB/s (Standard Cloud HDD)</option>
              <option value={75}>75 MB/s (Standard SSD gp3)</option>
              <option value={150}>150 MB/s (High-IOPS SSD)</option>
              <option value={350}>350 MB/s (NVMe Storage)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-100">
          <button
            type="button"
            onClick={() => setSimulatePostVacuum(!simulatePostVacuum)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-2xs active:scale-95 ${
              simulatePostVacuum
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 ring-2 ring-emerald-300'
                : 'bg-gradient-to-r from-amber-50 to-orange-50 text-slate-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${simulatePostVacuum ? 'text-amber-200 animate-spin' : 'text-amber-600'}`} />
            <span>{simulatePostVacuum ? 'Vacuum Simulation: ACTIVE (Post-Vacuum State)' : 'Simulate Vacuum & Repack Run'}</span>
          </button>

          <button
            onClick={() => handleAnalyze()}
            disabled={isLoading}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md shadow-amber-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            <span>{isLoading ? 'Calculating...' : 'Run Storage Bloat & Vacuum Check ➔'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Executive Overview HUD Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Current Table Size
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {result.totalTableSizeFormatted}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Target: <strong className="text-slate-800 font-mono">{result.tableName}</strong> ({result.engineName})
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-rose-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block flex items-center justify-between">
                <span>Wasted Dead Bloat</span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black">
                  {result.averageBloatPercentage}%
                </span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
                {result.totalWastedStorageFormatted}
              </div>
              <p className="text-[11px] text-rose-700 font-semibold">
                Dead MVCC row versions &amp; split pages
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Post-Vacuum Clean Size
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                {result.vacuumMetrics?.postVacuumTableSizeGb || (totalTableSizeGb * 0.62).toFixed(1)} GB
              </div>
              <p className="text-[11px] text-emerald-800 font-semibold">
                Reclaims ~{result.vacuumMetrics?.estimatedDiskFreedGb || (totalTableSizeGb * 0.38).toFixed(1)} GB disk space
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-indigo-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block flex items-center justify-between">
                <span>Estimated Vacuum Time</span>
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono">
                ~{result.vacuumMetrics?.estimatedDurationMinutes || 16} min
              </div>
              <p className="text-[11px] text-indigo-800 font-semibold">
                At {targetIoSpeedMbSec} MB/s sustained I/O throughput
              </p>
            </div>
          </div>

          {/* Visual Storage Footprint & Vacuum Simulator Progress Bar */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white border border-amber-500/40 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Physical Storage Partitioning &amp; Vacuum Reclaim Simulation
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  Live Data: {liveDataPct}%
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-400/40">
                  Bloat: {bloatPct}%
                </span>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div className="h-6 w-full rounded-xl bg-slate-800 overflow-hidden flex shadow-inner border border-slate-700">
              <div
                style={{ width: `${liveDataPct}%` }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
              >
                {liveDataPct > 15 ? `Live Data (~${((totalTableSizeGb * liveDataPct) / 100).toFixed(1)} GB)` : ''}
              </div>
              <div
                style={{ width: `${bloatPct}%` }}
                className="bg-gradient-to-r from-rose-600 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500 relative"
              >
                {bloatPct > 15 ? `Dead Bloat (~${((totalTableSizeGb * bloatPct) / 100).toFixed(1)} GB)` : ''}
              </div>
            </div>

            {/* Live Vacuum Execution Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Lock Impact Level:</span>
                <span className="text-emerald-300 font-bold flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {result.vacuumMetrics?.lockLevel || 'Zero Exclusive Lock (Online Repack)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Bloat Growth Rate:</span>
                <span className="text-amber-300 font-mono font-bold mt-0.5 block">
                  +{result.vacuumMetrics?.dailyBloatGrowthMb || 143} MB/day ({avgDailyUpdates.toLocaleString()} updates/day)
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Autovacuum Urgency:</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase mt-0.5 ${
                  result.vacuumMetrics?.autovacuumUrgency === 'CRITICAL'
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-400/40 animate-pulse'
                    : result.vacuumMetrics?.autovacuumUrgency === 'HIGH'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                    : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                }`}>
                  {result.vacuumMetrics?.autovacuumUrgency || 'HIGH'} URGENCY
                </span>
              </div>
            </div>
          </div>

          {/* Fragmented Storage Breakdown Table */}
          <div className="rounded-2xl bg-white border border-amber-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                {result.engineName} Fragmented Storage Object Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-amber-100 text-slate-700 font-bold font-mono">
                    <th className="py-3 px-4">Database Object</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Wasted Space</th>
                    <th className="py-3 px-4">Bloat %</th>
                    <th className="py-3 px-4">Seek Penalty</th>
                    <th className="py-3 px-4">Remedy Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-50 font-mono text-xs">
                  {result.findings.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.objectName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          item.objectType === 'table'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {item.objectType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-rose-600">{item.wastedStorageFormatted}</td>
                      <td className="py-3 px-4 font-bold text-amber-700">{item.bloatPercentage}%</td>
                      <td className="py-3 px-4 font-sans text-slate-600">{item.diskRandomSeekPenalty}</td>
                      <td className="py-3 px-4 font-sans font-bold text-emerald-800">{item.remedyAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Repack Script & Autovacuum DDL Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Repack Script */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Zero-Downtime Repack / Vacuum Command ({result.engineName})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.repackScript, 'repack')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 shadow-2xs transition active:scale-95"
                  >
                    {copiedKey === 'repack' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{copiedKey === 'repack' ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Execute background online rebuild without blocking concurrent client reads or writes.
                </p>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-[300px] selection:bg-emerald-600 selection:text-white">
                  {result.repackScript}
                </pre>
              </div>
            </div>

            {/* Autovacuum / Purge Tuning */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Continuous Background Autovacuum Tuning
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.autovacuumTuningDdl, 'autovacuum')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 shadow-2xs transition active:scale-95"
                  >
                    {copiedKey === 'autovacuum' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{copiedKey === 'autovacuum' ? 'Copied' : 'Copy Tuning DDL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tuned threshold configuration so background cleaners run before bloat accumulates.
                </p>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-amber-200 font-mono text-xs overflow-x-auto leading-relaxed max-h-[300px] selection:bg-amber-600 selection:text-white">
                  {result.autovacuumTuningDdl}
                </pre>
              </div>
            </div>
          </div>

          {/* Engine Diagnostic Query */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Live Engine Bloat Diagnostic Query ({result.engineName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(result.hygieneCheckQuery, 'hygiene')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 shadow-2xs transition active:scale-95"
              >
                {copiedKey === 'hygiene' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                <span>{copiedKey === 'hygiene' ? 'Copied' : 'Copy Query'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed selection:bg-cyan-600 selection:text-white">
              {result.hygieneCheckQuery}
            </pre>
          </div>

          {/* Expert Storage Hygiene Guidelines */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Production Storage Hygiene Guidelines ({result.engineName}):
            </h3>
            <ul className="space-y-1.5">
              {result.expertRecommendations.map((rec, i) => (
                <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
