import React, { useState } from 'react';
import { BottleneckFinding, PlanAnalysisResult } from '../types';
import { AlertOctagon, Check, Copy, Lightbulb, ArrowUpRight } from 'lucide-react';

interface BottlenecksListProps {
  bottlenecks: BottleneckFinding[];
  recommendations: PlanAnalysisResult['recommendations'];
  theme?: 'lavender' | 'dark';
}

export const BottlenecksList: React.FC<BottlenecksListProps> = ({
  bottlenecks,
  recommendations,
  theme = 'lavender',
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isLavender = theme === 'lavender';
  const cardClass = isLavender ? 'glass-card-light' : 'glass-card-dark';

  const handleCopy = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      <div className={`${cardClass} rounded-2xl p-5 shadow-lg`}>
        <h3 className={`text-sm font-bold flex items-center gap-2 mb-4 ${isLavender ? 'text-slate-900' : 'text-white'}`}>
          <AlertOctagon className="w-4 h-4 text-rose-500" />
          Detected Bottlenecks & Execution Issues ({bottlenecks.length})
        </h3>

        {bottlenecks.length === 0 ? (
          <div className={`p-4 rounded-xl text-center border ${
            isLavender
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-emerald-950/20 border-emerald-500/20'
          }`}>
            <span className={`text-xs font-bold ${isLavender ? 'text-emerald-800' : 'text-emerald-400'}`}>
              🎉 No critical performance bottlenecks detected! The query execution path is optimal.
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {bottlenecks.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border ${
                  item.severity === 'CRITICAL'
                    ? isLavender
                      ? 'border-rose-300 bg-rose-50/80 shadow-sm'
                      : 'border-rose-500/30 bg-rose-950/10'
                    : isLavender
                    ? 'border-amber-300 bg-amber-50/80 shadow-sm'
                    : 'border-amber-500/30 bg-amber-950/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.severity === 'CRITICAL'
                            ? isLavender
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : isLavender
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {item.severity}
                      </span>
                      <h4 className={`text-sm font-bold ${isLavender ? 'text-slate-900' : 'text-white'}`}>{item.title}</h4>
                    </div>
                    <p className={`text-xs mt-1.5 leading-relaxed ${isLavender ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>{item.description}</p>
                  </div>

                  <div className="text-left sm:text-right whitespace-nowrap bg-purple-50/50 sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-purple-100">
                    <span className={`text-[10px] uppercase font-bold block ${isLavender ? 'text-slate-500' : 'text-slate-400'}`}>{item.metricLabel}</span>
                    <span className={`text-sm font-mono font-bold ${isLavender ? 'text-rose-700' : 'text-rose-400'}`}>{item.metricValue.toLocaleString()}</span>
                  </div>
                </div>

                {item.suggestedSql && (
                  <div className={`mt-3 pt-3 border-t ${isLavender ? 'border-purple-200/60' : 'border-slate-800/80'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-bold flex items-center gap-1 ${isLavender ? 'text-purple-800' : 'text-emerald-400'}`}>
                        <Lightbulb className="w-3.5 h-3.5" />
                        Suggested Zero-Downtime Index SQL:
                      </span>
                      <button
                        onClick={() => handleCopy(item.suggestedSql!, item.id)}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded border transition ${
                          isLavender
                            ? 'text-slate-800 bg-white hover:bg-slate-50 border-purple-200 shadow-sm'
                            : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy SQL
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto shadow-md">
                      {item.suggestedSql}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${cardClass} rounded-2xl p-5 shadow-lg`}>
        <h3 className={`text-sm font-bold flex items-center gap-2 mb-4 ${isLavender ? 'text-slate-900' : 'text-white'}`}>
          <Lightbulb className={`w-4 h-4 ${isLavender ? 'text-purple-600' : 'text-emerald-400'}`} />
          Optimization Action Items
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                isLavender
                  ? 'border-purple-100 bg-white/70 shadow-sm'
                  : 'border-slate-800 bg-[#080C14]/50'
              }`}
            >
              <div className={`p-2 rounded-lg border mt-0.5 ${
                isLavender
                  ? 'bg-purple-100/70 text-purple-700 border-purple-200'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isLavender ? 'text-slate-900' : 'text-white'}`}>{rec.title}</span>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                    isLavender
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {rec.category}
                  </span>
                </div>
                <p className={`text-xs mt-1 leading-relaxed ${isLavender ? 'text-slate-600' : 'text-slate-400'}`}>{rec.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
