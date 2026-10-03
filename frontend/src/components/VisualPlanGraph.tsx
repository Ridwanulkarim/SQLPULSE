import React, { useState } from 'react';
import { GraphNodeData } from '../types';
import { Layers, AlertTriangle, CheckCircle, Info, ChevronRight } from 'lucide-react';

interface VisualPlanGraphProps {
  nodes: GraphNodeData[];
  theme?: 'lavender' | 'dark';
}

export const VisualPlanGraph: React.FC<VisualPlanGraphProps> = ({ nodes, theme = 'lavender' }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(nodes[0] || null);
  const isLavender = theme === 'lavender';
  const cardClass = isLavender ? 'glass-card-light' : 'glass-card-dark';

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            WARNING
          </span>
        );
      case 'INFO':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            FAST
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      
      <div className={`lg:col-span-7 ${cardClass} rounded-2xl p-5 shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLavender ? 'text-slate-900' : 'text-white'}`}>
            <Layers className={`w-4 h-4 ${isLavender ? 'text-purple-600' : 'text-emerald-400'}`} />
            Query Execution Tree ({nodes.length} Nodes)
          </h3>
          <span className={`text-xs ${isLavender ? 'text-slate-500' : 'text-slate-400'}`}>Click a node to inspect buffer details</span>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {nodes.map((node, index) => {
            const isSelected = selectedNode?.id === node.id;
            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? isLavender
                      ? 'border-purple-500 bg-purple-50/80 shadow-md shadow-purple-500/15 ring-2 ring-purple-400'
                      : 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                    : node.severity === 'CRITICAL'
                    ? isLavender
                      ? 'border-rose-300 bg-rose-50/70 hover:border-rose-400'
                      : 'border-rose-900/50 bg-rose-950/10 hover:border-rose-700/60'
                    : isLavender
                    ? 'border-purple-100 bg-white/60 hover:bg-white hover:border-purple-300'
                    : 'border-slate-800 bg-[#080C14]/70 hover:border-slate-700'
                }`}
              >
                
                <div
                  className={`absolute top-0 left-0 h-1 transition-all ${
                    node.severity === 'CRITICAL'
                      ? 'bg-rose-500'
                      : node.severity === 'WARNING'
                      ? 'bg-amber-500'
                      : isLavender
                      ? 'bg-purple-600'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(5, node.timePercentage)}%` }}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400 w-5 shrink-0 pt-0.5 sm:pt-0">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold font-mono ${isLavender ? 'text-slate-900' : 'text-white'}`}>
                          {node.nodeType}
                        </span>
                        {node.relationName && (
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                            isLavender
                              ? 'text-purple-700 bg-purple-100/70 border-purple-200'
                              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          }`}>
                            {node.relationName}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] sm:text-xs mt-1 flex items-center gap-2.5 sm:gap-3 font-mono flex-wrap ${isLavender ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span>Cost: <strong className={isLavender ? 'text-slate-800' : 'text-slate-200'}>{node.totalCost.toLocaleString()}</strong></span>
                        {node.actualTotalTimeMs !== undefined && (
                          <span>Time: <strong className={isLavender ? 'text-slate-800' : 'text-slate-200'}>{node.actualTotalTimeMs.toFixed(2)}ms</strong> ({node.timePercentage}%)</span>
                        )}
                        {node.actualRows !== undefined && (
                          <span>Rows: <strong className={isLavender ? 'text-slate-800' : 'text-slate-200'}>{node.actualRows.toLocaleString()}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-purple-100/60 sm:border-0 w-full sm:w-auto">
                    {getSeverityBadge(node.severity)}
                    <span className="text-[10px] text-purple-600 font-bold sm:hidden flex items-center gap-0.5">
                      Inspect <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`lg:col-span-5 ${cardClass} rounded-2xl p-5 shadow-lg flex flex-col justify-between`}>
        {selectedNode ? (
          <div>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isLavender ? 'border-purple-200/60' : 'border-slate-800'}`}>
              <div>
                <span className={`text-[10px] uppercase font-bold ${isLavender ? 'text-slate-500' : 'text-slate-400'}`}>Node Inspector</span>
                <h4 className={`text-base font-bold font-mono flex items-center gap-2 ${isLavender ? 'text-slate-900' : 'text-white'}`}>
                  {selectedNode.nodeType}
                  {selectedNode.relationName && (
                    <span className={`text-xs ${isLavender ? 'text-purple-700 font-bold' : 'text-emerald-400'}`}>({selectedNode.relationName})</span>
                  )}
                </h4>
              </div>
              {getSeverityBadge(selectedNode.severity)}
            </div>

            <div className="space-y-4 text-xs font-mono">
              
              <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl border ${isLavender ? 'bg-white/90 border-purple-200 shadow-sm' : 'bg-[#080C14] border-slate-800/80'}`}>
                <div>
                  <span className={`text-[11px] font-semibold ${isLavender ? 'text-slate-500' : 'text-slate-500'}`}>Total Cost</span>
                  <p className={`text-sm font-bold ${isLavender ? 'text-slate-900' : 'text-slate-100'}`}>{selectedNode.totalCost}</p>
                </div>
                <div>
                  <span className={`text-[11px] font-semibold ${isLavender ? 'text-slate-500' : 'text-slate-500'}`}>Actual Time</span>
                  <p className={`text-sm font-bold ${isLavender ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    {selectedNode.actualTotalTimeMs !== undefined ? `${selectedNode.actualTotalTimeMs} ms` : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className={`text-[11px] font-semibold ${isLavender ? 'text-slate-500' : 'text-slate-500'}`}>Plan vs Actual Rows</span>
                  <p className={isLavender ? 'text-slate-700 font-medium' : 'text-slate-200'}>
                    {selectedNode.planRows.toLocaleString()} vs{' '}
                    <strong className={isLavender ? 'text-purple-700 font-bold' : 'text-cyan-400'}>{selectedNode.actualRows?.toLocaleString() ?? 'N/A'}</strong>
                  </p>
                </div>
                <div>
                  <span className={`text-[11px] font-semibold ${isLavender ? 'text-slate-500' : 'text-slate-500'}`}>Rows Discarded</span>
                  <p className={`font-bold ${isLavender ? 'text-rose-600' : 'text-rose-400'}`}>
                    {selectedNode.rowsRemovedByFilter?.toLocaleString() ?? 0}
                  </p>
                </div>
              </div>

              <div>
                <span className={`font-bold block mb-1 ${isLavender ? 'text-slate-700' : 'text-slate-400'}`}>Buffer I/O Activity</span>
                <div className={`p-3 rounded-xl border space-y-1.5 ${isLavender ? 'bg-white/90 border-purple-200 shadow-sm' : 'bg-[#080C14] border-slate-800/80'}`}>
                  <div className="flex justify-between">
                    <span className={isLavender ? 'text-slate-600' : 'text-slate-400'}>Memory Hits (RAM):</span>
                    <span className={`font-bold ${isLavender ? 'text-emerald-700' : 'text-emerald-400'}`}>{selectedNode.sharedHitBlocks.toLocaleString()} blocks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isLavender ? 'text-slate-600' : 'text-slate-400'}>Disk Reads:</span>
                    <span className={selectedNode.sharedReadBlocks > 0 ? (isLavender ? 'text-amber-700 font-bold' : 'text-amber-400 font-bold') : (isLavender ? 'text-slate-500' : 'text-slate-400')}>
                      {selectedNode.sharedReadBlocks.toLocaleString()} blocks
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className={`font-bold block mb-1 ${isLavender ? 'text-slate-700' : 'text-slate-400'}`}>Node Attributes</span>
                <pre className={`p-3 rounded-xl border text-[11px] max-h-48 overflow-y-auto ${
                  isLavender
                    ? 'bg-slate-900 text-emerald-300 border-slate-800 shadow-md'
                    : 'bg-[#080C14] text-slate-300 border-slate-800/80'
                }`}>
                  {JSON.stringify(selectedNode.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 text-xs">
            Select a node from the tree to inspect details
          </div>
        )}
      </div>
    </div>
  );
};
