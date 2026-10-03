import React from 'react';
import { Clock, HardDrive, Cpu, Zap, Activity } from 'lucide-react';
import { PlanAnalysisResult } from '../types';

interface MetricsOverviewProps {
  data: PlanAnalysisResult;
  theme?: 'lavender' | 'dark';
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ data, theme = 'lavender' }) => {
  const isLavender = theme === 'lavender';
  const cardClass = isLavender ? 'glass-card-light' : 'glass-card-dark';

  const getScoreColor = (score: number) => {
    if (score >= 85)
      return isLavender
        ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
        : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60)
      return isLavender
        ? 'text-amber-700 border-amber-300 bg-amber-50'
        : 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return isLavender
      ? 'text-rose-700 border-rose-300 bg-rose-50'
      : 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 85) return 'OPTIMIZED';
    if (score >= 60) return 'NEEDS INDEXING';
    return 'CRITICAL BOTTLENECK';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {/* Score Card */}
      <div className={`${cardClass} rounded-2xl p-4 sm:p-5 flex items-center justify-between col-span-1 sm:col-span-2 lg:col-span-1 shadow-sm`}>
        <div>
          <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            Performance Index
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-3xl font-black ${isLavender ? 'text-slate-900' : 'text-white'}`}>
              {data.performanceScore}
            </span>
            <span className={`text-xs ${isLavender ? 'text-slate-500 font-semibold' : 'text-slate-500'}`}>/ 100</span>
          </div>
          <span
            className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${getScoreColor(
              data.performanceScore
            )}`}
          >
            {getScoreBadge(data.performanceScore)}
          </span>
        </div>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke={isLavender ? '#e2e8f0' : '#1e293b'}
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke={
                data.performanceScore >= 85
                  ? '#16a34a'
                  : data.performanceScore >= 60
                  ? '#d97706'
                  : '#e11d48'
              }
              strokeWidth="5"
              strokeDasharray={163.36}
              strokeDashoffset={163.36 * (1 - data.performanceScore / 100)}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <Activity className={`w-5 h-5 absolute ${isLavender ? 'text-slate-600' : 'text-slate-300'}`} />
        </div>
      </div>

      {/* Execution Time */}
      <div className={`${cardClass} rounded-2xl p-5 flex flex-col justify-between`}>
        <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>
          <Clock className={`w-3.5 h-3.5 ${isLavender ? 'text-indigo-600' : 'text-cyan-400'}`} />
          Execution Time
        </span>
        <div className="mt-2">
          <span className={`text-2xl font-black font-mono ${isLavender ? 'text-slate-900' : 'text-white'}`}>
            {data.executionTimeMs.toFixed(2)}
          </span>
          <span className={`text-xs ml-1 font-semibold ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>ms</span>
        </div>
        <div className={`text-[11px] mt-2 font-medium ${isLavender ? 'text-slate-600' : 'text-slate-500'}`}>
          Planning: <span className={`font-mono font-bold ${isLavender ? 'text-slate-800' : 'text-slate-400'}`}>{data.planningTimeMs}ms</span>
        </div>
      </div>

      {/* Total Cost */}
      <div className={`${cardClass} rounded-2xl p-5 flex flex-col justify-between`}>
        <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>
          <Cpu className={`w-3.5 h-3.5 ${isLavender ? 'text-purple-600' : 'text-purple-400'}`} />
          Planner Cost
        </span>
        <div className="mt-2">
          <span className={`text-2xl font-black font-mono ${isLavender ? 'text-slate-900' : 'text-white'}`}>
            {data.totalCost.toLocaleString()}
          </span>
        </div>
        <div className={`text-[11px] mt-2 font-medium ${isLavender ? 'text-slate-600' : 'text-slate-500'}`}>
          Relative computational units
        </div>
      </div>

      {/* Cache Hit Ratio */}
      <div className={`${cardClass} rounded-2xl p-5 flex flex-col justify-between`}>
        <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>
          <HardDrive className={`w-3.5 h-3.5 ${isLavender ? 'text-emerald-600' : 'text-emerald-400'}`} />
          Buffer Cache Hit
        </span>
        <div className="mt-2">
          <span className={`text-2xl font-black font-mono ${isLavender ? 'text-slate-900' : 'text-white'}`}>
            {data.cacheHitRatioPercentage}%
          </span>
        </div>
        <div className={`text-[11px] mt-2 font-medium ${isLavender ? 'text-slate-600' : 'text-slate-500'}`}>
          {data.totalMemoryHits.toLocaleString()} Hits vs {data.totalDiskReads.toLocaleString()} Reads
        </div>
      </div>

      {/* Bottlenecks Found */}
      <div className={`${cardClass} rounded-2xl p-5 flex flex-col justify-between`}>
        <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>
          <Activity className={`w-3.5 h-3.5 ${isLavender ? 'text-amber-600' : 'text-amber-400'}`} />
          Bottlenecks
        </span>
        <div className="mt-2">
          <span className={`text-2xl font-black ${isLavender ? 'text-slate-900' : 'text-white'}`}>
            {data.bottlenecks.length}
          </span>
          <span className={`text-xs ml-1.5 font-medium ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>issues detected</span>
        </div>
        <div className={`text-[11px] mt-2 font-medium ${isLavender ? 'text-slate-600' : 'text-slate-500'}`}>
          {data.bottlenecks.filter((b) => b.severity === 'CRITICAL').length} Critical,{' '}
          {data.bottlenecks.filter((b) => b.severity === 'WARNING').length} Warnings
        </div>
      </div>
    </div>
  );
};
