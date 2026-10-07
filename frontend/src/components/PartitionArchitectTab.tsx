import React, { useState, useEffect } from 'react';
import {
  Layers,
  Copy,
  Check,
  Zap,
  Table2,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { planPartitionStrategy } from '../services/api';
import { PartitionResult, DATABASE_CATALOG } from '../types';

import { resolvePartitionPreset, getEngineMetadataSafe } from '../utils/enginePresets';
import { DatabaseEngine } from '../types';

interface PartitionArchitectTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const PartitionArchitectTab: React.FC<PartitionArchitectTabProps> = ({
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

  const [activeCategory, setActiveCategory] = useState<string>('top_ranked');
  const [tableName, setTableName] = useState<string>('order_transactions');
  const [partitionColumn, setPartitionColumn] = useState<string>('created_at');
  const [strategy, setStrategy] = useState<string>('range_monthly');
  const [estimatedMonthlyRows, setEstimatedMonthlyRows] = useState<number>(25000000);
  const [retentionMonths, setRetentionMonths] = useState<number>(24);

  // Dynamically synchronize realistic partition parameters when switching ANY of the 447 engines
  useEffect(() => {
    const preset = resolvePartitionPreset(selectedEngine);
    setTableName(preset.tableName);
    setPartitionColumn(preset.partitionColumn);
    setStrategy(preset.strategy);
    setEstimatedMonthlyRows(preset.estimatedMonthlyRows);
    setRetentionMonths(preset.retentionMonths);
  }, [selectedEngine]);

  const [result, setResult] = useState<PartitionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'ddl' | 'partman'>('ddl');
  const [copied, setCopied] = useState<boolean>(false);

  const handlePlan = async () => {
    try {
      const res = await planPartitionStrategy({
        engine: selectedEngine,
        tableName,
        partitionColumn,
        strategy,
        estimatedMonthlyRows,
        retentionMonths,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Partition calculation failed');
    }
  };

  useEffect(() => {
    handlePlan();
  }, [selectedEngine, tableName, partitionColumn, strategy, estimatedMonthlyRows, retentionMonths]);

  const handleCopy = () => {
    if (!result) return;
    const code = activeTab === 'ddl' ? result.partitionDdl : result.maintenanceAutomation;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const engineMeta = getEngineMetadataSafe(selectedEngine);

  const categoryPills = [
    { id: 'top_ranked', label: '🏆 Top Ranked' },
    { id: 'olap', label: '📊 Columnar & OLAP' },
    { id: 'relational', label: '🏛️ Relational (SQL)' },
    { id: 'timeseries', label: '📈 Time-Series' },
    { id: 'wide_column', label: '📦 Wide-Column' },
    { id: 'document', label: '📄 Document NoSQL' },
    { id: 'search', label: '🔍 Search Indices' },
    { id: 'baas_embedded', label: '🚀 Embedded / Edge' },
  ];

  const quickEngines = DATABASE_CATALOG.filter((db) => {
    if (activeCategory === 'top_ranked') return db.rank && db.rank <= 12;
    return db.category === activeCategory;
  }).slice(0, 10);

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white shadow-xl shadow-purple-950/20 border border-purple-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/40">
              Big Data Architecture
            </span>
            <span className="text-xs text-purple-300 font-medium">
              447 Database Engine Range, Hash, List &amp; Sharding Partitioning
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-400" />
            Table Partitioning &amp; Sharding Architect
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 mt-1 max-w-3xl">
            Architect declarative range slices, hash distributed shards, and automated partition retention policies with query pruning verification for <span className="text-purple-300 font-bold">{engineMeta.name}</span> across all {DATABASE_CATALOG.length} catalog models.
          </p>

          {/* Category Filter & Quick Engine Pills */}
          <div className="mt-4 pt-3 border-t border-purple-800/40 space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[11px] text-purple-300/90 font-bold uppercase tracking-wider shrink-0 mr-1">
                Architecture Families:
              </span>
              {categoryPills.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition active:scale-95 ${
                    activeCategory === cat.id
                      ? 'bg-purple-400 text-slate-950 shadow-sm'
                      : 'bg-purple-900/50 text-purple-200 hover:bg-purple-800/70 border border-purple-700/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-purple-300/70 font-semibold uppercase tracking-wider mr-1">
                Quick Models:
              </span>
              {quickEngines.map((eng) => {
                const isSelected = selectedEngine.toLowerCase() === eng.id.toLowerCase();
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => {
                      setSelectedEngine(eng.id);
                      onSelectEngine?.(eng.id as DatabaseEngine);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-400 text-slate-950 shadow-md font-bold'
                        : 'bg-purple-950/70 text-purple-100 hover:bg-purple-900 border border-purple-700/40'
                    }`}
                  >
                    <span>{eng.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Table Name</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Partition Key Column</label>
            <input
              type="text"
              value={partitionColumn}
              onChange={(e) => setPartitionColumn(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Ingest (Rows)</label>
            <input
              type="number"
              step={1000000}
              value={estimatedMonthlyRows}
              onChange={(e) => setEstimatedMonthlyRows(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Partitioning Pattern</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value="range_monthly">📅 Monthly Range Slices (Range Partitioning)</option>
              <option value="range_daily">⚡ Daily Range Slices (High Ingestion Telemetry)</option>
              <option value="hash_sharding">🌐 Distributed Hash Sharding (Multi-Node)</option>
              <option value="list_region">🗺️ List Partitioning (Region / Country Codes)</option>
              <option value="composite_range_hash">🏗️ Composite (Tenant Hash + Time Range)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Retention Window</label>
            <select
              value={retentionMonths}
              onChange={(e) => setRetentionMonths(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value={6}>6 Months (Drop older)</option>
              <option value={12}>12 Months (1 Year)</option>
              <option value={24}>24 Months (2 Years)</option>
              <option value={36}>36 Months (3 Years)</option>
              <option value={84}>84 Months (7 Years Compliance)</option>
            </select>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="p-4 sm:p-6 rounded-2xl bg-purple-50/60 border border-purple-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-extrabold text-purple-950">
                Partition Pruning &amp; Query Acceleration Impact
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-white border border-purple-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Example Filter Query</span>
                <div className="font-mono text-xs text-purple-950 bg-slate-50 p-2 rounded-lg">
                  {result.pruningSimulation.sampleQuery}
                </div>
                <div className="text-xs text-emerald-700 font-extrabold flex items-center gap-1 pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{result.pruningSimulation.speedupFactor}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-purple-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pruning Execution Stats</span>
                <div className="text-sm font-black text-purple-950">
                  {result.pruningSimulation.partitionsScanned}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {result.pruningSimulation.explanation}
                </p>
              </div>
            </div>
          </div>

          {result.shardDistribution.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Table2 className="w-4 h-4 text-purple-600" />
                Partition Slices &amp; Storage Distribution
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-purple-50 text-slate-700 border-b border-purple-100">
                    <tr>
                      <th className="py-2.5 px-3">Child Partition Table</th>
                      <th className="py-2.5 px-3">Bounds / Shard Hash Range</th>
                      <th className="py-2.5 px-3">Est. Row Capacity</th>
                      <th className="py-2.5 px-3">Est. Disk Footprint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100 font-mono">
                    {result.shardDistribution.map((shard, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/40">
                        <td className="py-2.5 px-3 font-bold text-purple-950">{shard.shardName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{shard.rangeOrHash}</td>
                        <td className="py-2.5 px-3 text-indigo-700 font-bold">{shard.estimatedRows}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-extrabold">{shard.estimatedSizeGb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-purple-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('ddl')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'ddl'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📜 Declarative Partition DDL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('partman')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'partman'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚙️ Retention Automation &amp; Cron
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

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-purple-200 overflow-x-auto selection:bg-purple-600 selection:text-white max-h-[450px]">
              {activeTab === 'ddl' ? result.partitionDdl : result.maintenanceAutomation}
            </pre>
          </div>

          {result.expertGuidelines.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 shadow-sm space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Senior DBA Partitioning Rules &amp; Best Practices
              </h4>
              <ul className="space-y-1.5 text-xs text-indigo-900 dark:text-indigo-100 list-disc list-inside">
                {result.expertGuidelines.map((guide, idx) => (
                  <li key={idx} className="leading-relaxed">{guide}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
