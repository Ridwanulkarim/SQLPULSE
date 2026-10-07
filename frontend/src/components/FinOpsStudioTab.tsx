import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingDown,
  Server,
  HardDrive,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  Cpu
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { calculateFinOps } from '../services/api';
import { FinOpsResult, CloudProviderType, DATABASE_CATALOG } from '../types';

import { resolveFinOpsPreset, getEngineMetadataSafe } from '../utils/enginePresets';

interface FinOpsStudioTabProps {
  selectedEngine: string;
  onSelectEngine: (engine: string) => void;
}

export const FinOpsStudioTab: React.FC<FinOpsStudioTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [provider, setProvider] = useState<CloudProviderType>('aws_aurora');
  const [dbSizeGb, setDbSizeGb] = useState<number>(250);
  const [vCpuCount, setVCpuCount] = useState<number>(8);
  const [ramGb, setRamGb] = useState<number>(32);
  const [readsM, setReadsM] = useState<number>(50);
  const [writesM, setWritesM] = useState<number>(15);
  const [isHa, setIsHa] = useState<boolean>(true);
  const [backupRetentionDays, setBackupRetentionDays] = useState<number>(30);

  // Dynamically update cloud database finops sizing when switching ANY of the 447 engines
  useEffect(() => {
    const preset = resolveFinOpsPreset(selectedEngine);
    setProvider(preset.provider);
    setDbSizeGb(preset.dbSizeGb);
    setVCpuCount(preset.vCpuCount);
    setRamGb(preset.ramGb);
    setReadsM(preset.readsM);
    setWritesM(preset.writesM);
  }, [selectedEngine]);

  const [result, setResult] = useState<FinOpsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIaC, setCopiedIaC] = useState(false);
  const [copiedSnippetIdx, setCopiedSnippetIdx] = useState<number | null>(null);

  const runCalculation = async () => {
    setIsLoading(true);
    try {
      const res = await calculateFinOps({
        engine: selectedEngine,
        cloudProvider: provider,
        dbSizeGb,
        vCpuCount,
        ramGb,
        monthlyReadQueriesMillion: readsM,
        monthlyWriteQueriesMillion: writesM,
        multiRegionHa: isHa,
        backupRetentionDays,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'FinOps calculation failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runCalculation();
  }, [selectedEngine, provider, dbSizeGb, vCpuCount, ramGb, readsM, writesM, isHa, backupRetentionDays]);

  const handleCopyIaC = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.terraformIaC);
    setCopiedIaC(true);
    setTimeout(() => setCopiedIaC(false), 2000);
  };

  const handleCopySnippet = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetIdx(idx);
    setTimeout(() => setCopiedSnippetIdx(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find((db) => db.id === selectedEngine) || {
    name: selectedEngine,
    icon: '🗄️',
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs relative overflow-hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
              Cloud Database FinOps &amp; Capacity Architect
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              AWS • GCP • Azure • Neon • Supabase • Atlas • 447 Engines
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Cloud Database Bill &amp; Capacity Sizer
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
            Simulate monthly cloud infrastructure costs across compute nodes, provisioned IOPS, storage tiering, and backup snapshots for {engineMeta.name}. Unlock automated 40%+ cost reduction recommendations and ready-to-deploy Terraform HCL.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={onSelectEngine}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-600" />
              Cloud Infrastructure Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <optgroup label="Amazon Web Services (AWS)">
                <option value="aws_aurora">AWS Aurora PostgreSQL / MySQL (Multi-AZ)</option>
                <option value="aws_rds">AWS RDS Provisioned (GP3 / IO2)</option>
              </optgroup>
              <optgroup label="Google Cloud Platform (GCP)">
                <option value="gcp_alloydb">Google Cloud AlloyDB (HA Cluster)</option>
                <option value="gcp_cloudsql">Google Cloud SQL Enterprise HA</option>
              </optgroup>
              <optgroup label="Microsoft Azure">
                <option value="azure_sql">Azure Database / Flexible Server</option>
                <option value="azure_cosmos">Azure Cosmos DB (Global RU/s)</option>
              </optgroup>
              <optgroup label="Serverless &amp; Managed Clouds">
                <option value="neon_serverless">Neon Serverless Postgres (Autoscale)</option>
                <option value="supabase_cloud">Supabase Cloud Dedicated Pro</option>
                <option value="mongodb_atlas">MongoDB Atlas Dedicated M40/M50</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-teal-600" />
              Database Storage (GB)
            </label>
            <input
              type="number"
              min={10}
              max={64000}
              step={50}
              value={dbSizeGb}
              onChange={(e) => setDbSizeGb(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              Compute Sizing (vCPU &amp; RAM)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={vCpuCount}
                onChange={(e) => setVCpuCount(Number(e.target.value))}
                className="px-2 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value={2}>2 vCPU</option>
                <option value={4}>4 vCPU</option>
                <option value={8}>8 vCPU</option>
                <option value={16}>16 vCPU</option>
                <option value={32}>32 vCPU</option>
                <option value={64}>64 vCPU</option>
              </select>
              <select
                value={ramGb}
                onChange={(e) => setRamGb(Number(e.target.value))}
                className="px-2 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value={8}>8 GB RAM</option>
                <option value={16}>16 GB RAM</option>
                <option value={32}>32 GB RAM</option>
                <option value={64}>64 GB RAM</option>
                <option value={128}>128 GB RAM</option>
                <option value={256}>256 GB RAM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              HA &amp; Retention Days
            </label>
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHa}
                    onChange={(e) => setIsHa(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  Multi-AZ HA Standby
                </label>
                {isLoading && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Calculating...</span>}
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div>
                  <span className="text-slate-500 font-bold block">Reads (M)</span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={readsM}
                    onChange={(e) => setReadsM(Number(e.target.value))}
                    className="w-full px-1.5 py-1 rounded-lg text-xs font-bold border border-purple-200 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Writes (M)</span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={writesM}
                    onChange={(e) => setWritesM(Number(e.target.value))}
                    className="w-full px-1.5 py-1 rounded-lg text-xs font-bold border border-purple-200 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Backup Days</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={backupRetentionDays}
                    onChange={(e) => setBackupRetentionDays(Number(e.target.value))}
                    className="w-full px-1.5 py-1 rounded-lg text-xs font-bold border border-purple-200 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/90 border border-emerald-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated Monthly Cost</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
                ${result.monthlyTotalCostUsd.toLocaleString()} <span className="text-xs font-bold text-slate-500">/ mo</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Annual Run-Rate: ${(result.annualTotalCostUsd).toLocaleString()} USD
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recommended Instance</div>
              <div className="text-base sm:text-lg font-black text-slate-900 mt-1 font-mono">
                {result.recommendedInstanceClass}
              </div>
              <div className="text-xs text-purple-600 font-semibold mt-1">
                {vCpuCount} vCPU • {ramGb}GB RAM (Memory Optimized)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-teal-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Storage &amp; Baseline IOPS</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {result.storageConfiguration.allocatedGb} GB NVMe
              </div>
              <div className="text-xs text-teal-700 font-semibold mt-1">
                {result.storageConfiguration.effectiveIops.toLocaleString()} IOPS • {result.storageConfiguration.throughputMbSec} MB/s
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-amber-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Max Potential Savings</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1 flex items-center gap-1">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
                ${result.savingsOpportunities.reduce((acc, s) => acc + s.monthlySavingsUsd, 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">/ mo</span>
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                Up to 42% Net Bill Reduction
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Granular Line-Item Cost Allocation
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-purple-50/50 text-slate-800 uppercase font-black tracking-wider border-b border-purple-200">
                  <tr>
                    <th className="py-2.5 px-3">Cost Category</th>
                    <th className="py-2.5 px-3">Resource Details</th>
                    <th className="py-2.5 px-3 text-right">Monthly (USD)</th>
                    <th className="py-2.5 px-3 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 font-medium">
                  {result.costBreakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/40 transition">
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">{item.category}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.description}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">${item.monthlyCostUsd.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          {item.pctOfTotal}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              Actionable FinOps Optimization Opportunities ({result.savingsOpportunities.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {result.savingsOpportunities.map((opp, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900">{opp.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Save ~${opp.monthlySavingsUsd}/mo
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 font-medium">
                      {opp.actionableFix}
                    </p>
                  </div>

                  <div className="bg-slate-950 rounded-xl p-3 relative group">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1 border-b border-slate-800 pb-1">
                      <span>Implementation Script</span>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet(opp.ddlOrConfigSnippet, idx)}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1"
                      >
                        {copiedSnippetIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedSnippetIdx === idx ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre">
                      {opp.ddlOrConfigSnippet}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Production Terraform IaC Module (Cost-Tagged)
              </h3>
              <button
                type="button"
                onClick={handleCopyIaC}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow transition active:scale-95 flex items-center gap-1.5"
              >
                {copiedIaC ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedIaC ? 'Copied HCL' : 'Copy Terraform'}
              </button>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-purple-200 overflow-x-auto max-h-80">
              <pre>{result.terraformIaC}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
