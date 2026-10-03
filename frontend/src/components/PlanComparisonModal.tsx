import React from 'react';
import { X, GitCompare, TrendingDown, Clock, Database, Zap } from 'lucide-react';
import { PlanAnalysisResult } from '../types';


interface PlanComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  baselinePlan: PlanAnalysisResult | null;
  optimizedPlan: PlanAnalysisResult | null;
}

export const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({
  isOpen,
  onClose,
  baselinePlan,
  optimizedPlan,
}) => {
  if (!isOpen || !baselinePlan || !optimizedPlan) return null;

  const costDeltaPercent = (
    ((baselinePlan.totalCost - optimizedPlan.totalCost) / Math.max(1, baselinePlan.totalCost)) *
    100
  ).toFixed(1);

  const timeDeltaPercent = (
    ((baselinePlan.executionTimeMs - optimizedPlan.executionTimeMs) /
      Math.max(0.001, baselinePlan.executionTimeMs)) *
    100
  ).toFixed(1);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white/95 rounded-2xl sm:rounded-3xl border border-purple-200/80 shadow-2xl max-w-5xl w-full p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-200/70 pb-3 sm:pb-4 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
              <GitCompare className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Plan Execution Diff &amp; Regression Studio
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Performance delta comparison between unindexed baseline and optimized plan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Delta Key Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-800 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Total Cost
            </span>
            <div className="text-lg sm:text-2xl font-black text-emerald-950 font-mono">
              -{costDeltaPercent}%
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-700 block truncate">
              {baselinePlan.totalCost.toLocaleString()} ➔ {optimizedPlan.totalCost.toLocaleString()}
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-50 border border-purple-200 space-y-1">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-purple-800 flex items-center gap-1">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Latency
            </span>
            <div className="text-lg sm:text-2xl font-black text-purple-950 font-mono">
              -{timeDeltaPercent}%
            </div>
            <span className="text-[10px] sm:text-[11px] text-purple-700 block truncate">
              {baselinePlan.executionTimeMs} ms ➔ {optimizedPlan.executionTimeMs} ms
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-800 flex items-center gap-1">
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Score
            </span>
            <div className="text-lg sm:text-2xl font-black text-indigo-950 font-mono">
              +{optimizedPlan.performanceScore - baselinePlan.performanceScore} pts
            </div>
            <span className="text-[10px] sm:text-[11px] text-indigo-700 block truncate">
              {baselinePlan.performanceScore} ➔ {optimizedPlan.performanceScore} / 100
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-teal-50 border border-teal-200 space-y-1">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-teal-800 flex items-center gap-1">
              <Database className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Buffer Hit
            </span>
            <div className="text-lg sm:text-2xl font-black text-teal-950 font-mono">
              {optimizedPlan.cacheHitRatioPercentage}%
            </div>
            <span className="text-[10px] sm:text-[11px] text-teal-700 block truncate">
              {baselinePlan.cacheHitRatioPercentage}% ➔ {optimizedPlan.cacheHitRatioPercentage}%
            </span>
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Baseline Plan */}
          <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-rose-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  BASELINE (SLOW)
                </span>
                <span className="text-xs font-bold text-slate-800">Unoptimized Full Scan</span>
              </div>
              <span className="text-xs font-mono font-bold text-rose-700">
                {baselinePlan.executionTimeMs} ms
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Execution Hierarchy:</span>
              <div className="space-y-2 font-mono text-xs">
                {baselinePlan.graph.nodes.slice(0, 4).map((n, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-rose-200/80 bg-white/90 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-rose-900">{n.nodeType}</div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        Relation: {n.relationName || 'n/a'}
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="font-bold text-rose-700">Cost: {n.totalCost}</div>
                      <div className="text-[10px] text-slate-400">{n.actualRows || n.planRows} rows</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Optimized Plan */}
          <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  OPTIMIZED (FAST)
                </span>
                <span className="text-xs font-bold text-slate-800">Index-Only B-Tree Access</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700">
                {optimizedPlan.executionTimeMs} ms
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Execution Hierarchy:</span>
              <div className="space-y-2 font-mono text-xs">
                {optimizedPlan.graph.nodes.slice(0, 4).map((n, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-emerald-200/80 bg-white/90 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-emerald-900">{n.nodeType}</div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        Relation: {n.relationName || 'n/a'}
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="font-bold text-emerald-700">Cost: {n.totalCost}</div>
                      <div className="text-[10px] text-slate-400">{n.actualRows || n.planRows} rows</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow-md shadow-purple-500/20"
          >
            Close Diff Studio
          </button>
        </div>
      </div>
    </div>
  );
};
