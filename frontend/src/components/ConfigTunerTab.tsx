import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Cpu,
  HardDrive,
  Copy,
  Check,
  Download,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Server
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { tuneDatabaseConfig } from '../services/api';
import { ConfigTuningResult, DATABASE_CATALOG } from '../types';

export const ConfigTunerTab: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('postgresql');
  const [ramGb, setRamGb] = useState<number>(32);
  const [cpuCores, setCpuCores] = useState<number>(8);
  const [storageType, setStorageType] = useState<string>('nvme_ssd');
  const [workloadType, setWorkloadType] = useState<string>('oltp_web');
  const [maxConnections, setMaxConnections] = useState<number>(300);

  const [result, setResult] = useState<ConfigTuningResult | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'engine' | 'sysctl' | 'limits'>('engine');
  const [copied, setCopied] = useState(false);

  const ramPresets = [4, 8, 16, 32, 64, 128, 256];
  const cpuPresets = [2, 4, 8, 16, 32, 64];

  const handleTune = async () => {
    try {
      const res = await tuneDatabaseConfig({
        engine: selectedEngine,
        ramGb,
        cpuCores,
        storageType,
        workloadType,
        maxConnections,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to auto-tune configuration');
    }
  };

  useEffect(() => {
    handleTune();
  }, [selectedEngine, ramGb, cpuCores, storageType, workloadType, maxConnections]);

  const getCurrentCode = () => {
    if (!result) return '';
    if (activeCodeTab === 'engine') return result.generatedConfigText;
    if (activeCodeTab === 'sysctl') return result.sysctlConfigText;
    return result.limitsConfigText;
  };

  const getFileName = () => {
    if (!result) return 'config.conf';
    if (activeCodeTab === 'engine') return result.configFileName;
    if (activeCodeTab === 'sysctl') return 'sysctl.conf';
    return '99-database.conf';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([getCurrentCode()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white shadow-xl shadow-purple-950/20 border border-purple-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/40">
              Auto-Sizing &amp; Kernel Tuner
            </span>
            <span className="text-xs text-purple-300 font-medium">
              447 Database Engine Hardware Mathematical Optimizer
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Universal Database &amp; Kernel Config Auto-Tuner
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 mt-1 max-w-3xl">
            Mathematically size memory pools, buffer caches, worker parallelism, and Linux OS sysctl kernel limits for {engineMeta.name} and all 447 engines.
          </p>
        </div>
      </div>

      {/* Control Dashboard & Sliders */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-6">
        {/* Engine Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={setSelectedEngine}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 border-t border-purple-100">
          {/* RAM Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Server className="w-4 h-4 text-purple-600" /> Host Physical RAM
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-mono font-extrabold">
                {ramGb} GB
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={512}
              step={2}
              value={ramGb}
              onChange={(e) => setRamGb(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ramPresets.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRamGb(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                    ramGb === r
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-slate-600 border-purple-200 hover:bg-purple-50'
                  }`}
                >
                  {r}GB
                </button>
              ))}
            </div>
          </div>

          {/* CPU Cores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-600" /> CPU Cores / vCPUs
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-mono font-extrabold">
                {cpuCores} Cores
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={128}
              value={cpuCores}
              onChange={(e) => setCpuCores(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {cpuPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCpuCores(c)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                    cpuCores === c
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-purple-200 hover:bg-indigo-50'
                  }`}
                >
                  {c}C
                </button>
              ))}
            </div>
          </div>

          {/* Storage Hardware */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              <HardDrive className="w-4 h-4 text-teal-600 inline mr-1" /> Storage Drive Tier
            </label>
            <select
              value={storageType}
              onChange={(e) => setStorageType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="nvme_ssd">⚡ Ultra-Fast NVMe SSD (High IOPS, &lt; 0.1ms seek)</option>
              <option value="sata_ssd">💾 SATA / Standard SSD (~500 MB/s)</option>
              <option value="ebs_network">☁️ Cloud Network Block / EBS gp3 (3000 IOPS)</option>
              <option value="hdd">🔄 Spinning Mechanical HDD (4ms seek penalty)</option>
            </select>
          </div>

          {/* Workload Profile */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              <Layers className="w-4 h-4 text-purple-600 inline mr-1" /> Workload Profile
            </label>
            <select
              value={workloadType}
              onChange={(e) => setWorkloadType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="oltp_web">🌐 Web Application / High-Throughput OLTP</option>
              <option value="olap_dw">📊 Data Warehouse / Heavy Analytics (OLAP)</option>
              <option value="mixed_hybrid">⚖️ Mixed Hybrid (HTAP / Moderate Reports)</option>
              <option value="vector_ai">🤖 Vector AI / Semantic Search &amp; RAG</option>
              <option value="cache_inmemory">⚡ In-Memory Cache / Fast Key-Value</option>
              <option value="timeseries_iot">📈 Time-Series / IoT High-Ingestion</option>
            </select>
          </div>

          {/* Concurrent Connections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Max Concurrent Connections</span>
              <span className="font-mono text-purple-700">{maxConnections}</span>
            </div>
            <input
              type="number"
              min={10}
              max={10000}
              step={10}
              value={maxConnections}
              onChange={(e) => setMaxConnections(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white text-slate-800 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          {/* Memory Allocation Breakdown Bar */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                Physical RAM Allocation Blueprint ({ramGb} GB Total)
              </h3>
              <span className="text-xs text-slate-500">Mathematical sizing model</span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner bg-slate-100 p-0.5 gap-0.5">
              {result.ramAllocation.map((slice, idx) => (
                <div
                  key={idx}
                  style={{ width: `${slice.percentage}%`, backgroundColor: slice.color }}
                  className="h-full rounded-lg transition-all duration-500 relative group flex items-center justify-center text-[10px] font-extrabold text-white"
                  title={`${slice.label}: ${slice.sizeGb} GB (${slice.percentage}%)`}
                >
                  {slice.percentage >= 12 && <span>{slice.percentage}%</span>}
                </div>
              ))}
            </div>

            {/* Allocation Legend Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {result.ramAllocation.map((slice, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-purple-100 bg-purple-50/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="text-xs font-bold text-slate-900 truncate">{slice.label}</span>
                  </div>
                  <div className="text-sm font-extrabold text-purple-950 font-mono">
                    {slice.sizeGb} GB <span className="text-xs font-normal text-slate-500">({slice.percentage}%)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">{slice.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Key Parameters Table */}
          {result.keyParameters.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Key Sized Parameters for {result.engineName}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-purple-50 text-slate-700 border-b border-purple-100">
                    <tr>
                      <th className="py-2.5 px-3">Configuration Parameter</th>
                      <th className="py-2.5 px-3">Calculated Value</th>
                      <th className="py-2.5 px-3">Engine Default</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Rationale &amp; Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100 font-sans">
                    {result.keyParameters.map((p, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-950">{p.param}</td>
                        <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-700">{p.value}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{p.defaultVal}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{p.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Code Tabs & Output Viewer */}
          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            {/* Header Tabs */}
            <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-purple-200">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('engine')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeCodeTab === 'engine'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📁 {result.configFileName}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('sysctl')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeCodeTab === 'sysctl'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚙️ /etc/sysctl.conf
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('limits')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeCodeTab === 'limits'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🛡️ limits.d/99-database.conf
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-purple-300 text-purple-900 hover:bg-purple-50 shadow-sm transition active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>

            {/* Code Output */}
            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-purple-100 overflow-x-auto selection:bg-purple-600 selection:text-white max-h-[500px] overflow-y-auto">
              {getCurrentCode()}
            </pre>
          </div>

          {/* Expert Production Tips */}
          {result.expertTips.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Senior DBA &amp; Infrastructure Engineering Recommendations
              </h4>
              <ul className="space-y-1.5 text-xs text-indigo-900 dark:text-indigo-100 list-disc list-inside">
                {result.expertTips.map((tip, idx) => (
                  <li key={idx} className="leading-relaxed">{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
