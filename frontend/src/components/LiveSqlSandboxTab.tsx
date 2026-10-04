import React, { useState, useEffect } from 'react';
import { Play, Zap, Clock, Layers, Database, CheckCircle2, Cpu, Info } from 'lucide-react';

import { DatabaseEngine } from '../types';

interface MockRow {
  [key: string]: any;
}

interface LiveSqlSandboxTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const LiveSqlSandboxTab: React.FC<LiveSqlSandboxTabProps> = ({
  selectedEngine,
}) => {
  const [datasetSize, setDatasetSize] = useState<number>(100000);
  const [hasIndex, setHasIndex] = useState<boolean>(false);
  const [sqlQuery, setSqlQuery] = useState<string>(
    `SELECT id, customer_id, total_amount, status, created_at\nFROM orders\nWHERE customer_id = 4821\n  AND status = 'completed'\nORDER BY created_at DESC\nLIMIT 20;`
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    latencyMs: number;
    rowsExamined: number;
    rowsReturned: number;
    scanType: 'Sequential Scan (Full Table Scan)' | 'Index Scan (B-Tree Lookups)';
    memoryHits: number;
    diskReads: number;
    sampleRows: MockRow[];
    columns: string[];
    tableName: string;
  } | null>(null);

  const runLiveQuery = (withIndex = hasIndex, size = datasetSize, queryToRun = sqlQuery) => {
    setIsRunning(true);
    setTimeout(() => {
      let latencyMs = 0;
      let rowsExamined = 0;
      let rowsReturned = 0;
      let scanType: 'Sequential Scan (Full Table Scan)' | 'Index Scan (B-Tree Lookups)';
      let memoryHits = 0;
      let diskReads = 0;

      // Extract limit if present
      const limitMatch = queryToRun.match(/LIMIT\s+(\d+)/i) || queryToRun.match(/TOP\s+(\d+)/i) || queryToRun.match(/ROWNUM\s*(?:<=|<)\s*(\d+)/i);
      const limitNum = limitMatch ? Math.min(100, parseInt(limitMatch[1], 10)) : 14;

      // Extract table name
      const tableMatch = queryToRun.match(/FROM\s+[`"\[]?([a-zA-Z0-9_]+)[`"\]]?/i);
      const tableName = tableMatch ? tableMatch[1] : 'orders';

      // Extract selected columns
      const selectMatch = queryToRun.match(/SELECT\s+(?:TOP\s+\d+\s+)?([\s\S]+?)\s+FROM/i);
      let columns: string[] = ['id', 'customer_id', 'total_amount', 'status', 'created_at'];
      if (selectMatch) {
        const rawCols = selectMatch[1]
          .split(',')
          .map(c => c.trim().replace(/[`"\[\]]/g, '').replace(/AS\s+[a-zA-Z0-9_]+/i, '').trim())
          .filter(c => c && !c.includes('*'));
        if (rawCols.length > 0) {
          columns = rawCols.map(c => {
            const parts = c.split('.');
            return parts[parts.length - 1];
          });
        }
      }

      if (!withIndex) {
        latencyMs = parseFloat((35 + Math.random() * 25 + (size / 100000) * 45).toFixed(2));
        rowsExamined = size;
        rowsReturned = limitNum;
        scanType = 'Sequential Scan (Full Table Scan)';
        memoryHits = Math.round(size * 0.4);
        diskReads = Math.round(size * 0.6);
      } else {
        latencyMs = parseFloat((0.8 + Math.random() * 1.4).toFixed(2));
        rowsExamined = Math.max(limitNum, Math.round(limitNum * 1.3));
        rowsReturned = limitNum;
        scanType = 'Index Scan (B-Tree Lookups)';
        memoryHits = 4;
        diskReads = 0;
      }

      const sampleNames = ['Alex Chen', 'Sarah Jenkins', 'David Patel', 'Elena Rostova', 'Marcus Vance', 'Amina Yusuf'];
      const sampleStatuses = ['completed', 'active', 'pending', 'verified', 'processing'];
      const sampleDepartments = ['Engineering', 'Finance', 'Growth', 'Operations', 'Security'];

      const sampleRows: MockRow[] = [];
      for (let i = 0; i < Math.min(6, limitNum); i++) {
        const row: MockRow = {};
        for (const col of columns) {
          const lCol = col.toLowerCase();
          if (lCol === 'id' || lCol.endsWith('_id')) {
            row[col] = lCol === 'id' ? 100000 + i * 347 : 4820 + (i % 5);
          } else if (lCol.includes('name') || lCol.includes('user')) {
            row[col] = sampleNames[i % sampleNames.length];
          } else if (lCol.includes('email')) {
            const sanitized = (sampleNames[i % sampleNames.length]).toLowerCase().replace(' ', '.');
            row[col] = `${sanitized}@company.org`;
          } else if (lCol.includes('amount') || lCol.includes('total') || lCol.includes('price') || lCol.includes('salary') || lCol.includes('cost')) {
            row[col] = parseFloat((45.5 + i * 18.25 + (lCol.includes('salary') ? 75000 : 0)).toFixed(2));
          } else if (lCol.includes('status') || lCol.includes('state')) {
            row[col] = sampleStatuses[i % sampleStatuses.length];
          } else if (lCol.includes('dept') || lCol.includes('department') || lCol.includes('team')) {
            row[col] = sampleDepartments[i % sampleDepartments.length];
          } else if (lCol.includes('date') || lCol.includes('time') || lCol.endsWith('_at')) {
            row[col] = `2026-0${(i % 9) + 1}-1${(i % 8) + 1} 14:22:00 UTC`;
          } else {
            row[col] = `val_${col}_${i + 1}`;
          }
        }
        sampleRows.push(row);
      }

      setExecutionResult({
        latencyMs,
        rowsExamined,
        rowsReturned,
        scanType,
        memoryHits,
        diskReads,
        sampleRows,
        columns,
        tableName,
      });
      setIsRunning(false);
    }, 300);
  };

  useEffect(() => {
    runLiveQuery(hasIndex, datasetSize, sqlQuery);
  }, [hasIndex, datasetSize, selectedEngine]);

  const handleApplyIndex = () => {
    const nextVal = !hasIndex;
    setHasIndex(nextVal);
    runLiveQuery(nextVal, datasetSize);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="w-5 h-5 text-purple-600 fill-purple-500/20 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Interactive B-Tree &amp; Sequential Scan Simulation Demo
              </h2>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                Latency Simulator Demo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate query execution against a synthesized table of {datasetSize.toLocaleString()} rows. Toggle B-Tree indexes to visualize latency, I/O hits, and scan patterns.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-purple-200/60 text-xs font-semibold overflow-x-auto scrollbar-none">
              <span className="text-slate-500 px-1.5 sm:px-2 text-[11px] sm:text-xs">Table Size:</span>
              <button
                type="button"
                onClick={() => setDatasetSize(50000)}
                className={`px-2 py-1 rounded-lg transition text-[11px] sm:text-xs ${
                  datasetSize === 50000 ? 'bg-white text-purple-950 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                50K
              </button>
              <button
                type="button"
                onClick={() => setDatasetSize(100000)}
                className={`px-2 py-1 rounded-lg transition text-[11px] sm:text-xs ${
                  datasetSize === 100000 ? 'bg-white text-purple-950 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                100K
              </button>
              <button
                type="button"
                onClick={() => setDatasetSize(500000)}
                className={`px-2 py-1 rounded-lg transition text-[11px] sm:text-xs ${
                  datasetSize === 500000 ? 'bg-white text-purple-950 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                500K
              </button>
            </div>

            <button
              type="button"
              onClick={handleApplyIndex}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm border shrink-0 active:scale-95 ${
                hasIndex
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20'
                  : 'bg-white text-slate-700 hover:bg-purple-50 border-purple-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{hasIndex ? '✅ B-Tree Active' : '➕ Add B-Tree Index'}</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Educational Simulation Model:</span> This sandbox simulates database engine metrics (disk reads, buffer hits, index node traversal, and latency deltas) in the browser to demonstrate the performance impact of indexing strategies on large tables.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              Simulated Table: <code className="bg-purple-100 text-purple-950 px-1.5 py-0.5 rounded font-mono">orders ({datasetSize.toLocaleString()} records)</code>
            </span>
            <div className="text-[11px] text-slate-500">
              Active Index State: <span className={`font-bold ${hasIndex ? 'text-emerald-700' : 'text-rose-700'}`}>{hasIndex ? 'Covering B-Tree (idx_orders_customer)' : 'None (Unindexed Sequential Scan)'}</span>
            </div>
          </div>

          <textarea
            rows={5}
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            className="w-full rounded-xl px-3.5 py-3 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 bg-slate-950 border border-slate-800 text-purple-300 focus:ring-purple-400/50 shadow-md transition leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Cpu className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Models buffer cache hits, row filtering overhead, and B-Tree branch lookups.</span>
            </div>

            <button
              type="button"
              onClick={() => runLiveQuery(hasIndex, datasetSize)}
              disabled={isRunning}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:opacity-95 shadow-lg shadow-purple-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isRunning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running Simulation Model...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  ▶️ Run Latency Simulation
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {executionResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-2xl border space-y-1 shadow-sm ${
                hasIndex
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50/90 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Simulated Latency
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${hasIndex ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                  {hasIndex ? 'Sub-Millisecond ⚡' : 'Slow Scan 🐌'}
                </span>
              </div>
              <div className="text-2xl font-black font-mono">
                {executionResult.latencyMs} ms
              </div>
              <span className="text-[10px] text-slate-500">
                {hasIndex ? '~50x - 80x Speedup with B-Tree' : 'Bottleneck: Full table sequential scan'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-purple-200/80 bg-white/90 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500">Rows Examined</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {executionResult.rowsExamined.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500">
                {hasIndex ? 'Exact B-Tree branch lookups' : `Full Table: 100% of ${datasetSize.toLocaleString()} rows scanned`}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-indigo-200/80 bg-white/90 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500">Access Method</span>
              <div className="text-sm font-bold text-indigo-950 font-mono truncate">
                {executionResult.scanType}
              </div>
              <span className="text-[10px] text-slate-500 truncate block">
                {hasIndex
                  ? `Index Scan using idx_${executionResult.tableName}_${executionResult.columns[0] || 'id'}`
                  : `Seq Scan on ${executionResult.tableName}`}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-teal-200/80 bg-white/90 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500">Buffer Cache I/O</span>
              <div className="text-2xl font-black text-teal-950 font-mono">
                {hasIndex ? '100% Cache Hit' : `${executionResult.memoryHits} hits / ${executionResult.diskReads} disk reads`}
              </div>
              <span className="text-[10px] text-slate-500">
                {hasIndex ? 'Zero disk I/O churn' : 'Heavy disk I/O & page thrashing'}
              </span>
            </div>
          </div>

          <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Simulated Result Rows ({executionResult.rowsReturned} matching records returned from <span className="font-mono text-purple-700 font-bold">{executionResult.tableName}</span>)
              </h3>
              <span className="text-[10px] font-mono text-slate-400">SELECT {executionResult.columns.join(', ')}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-200/70 text-slate-500 font-semibold bg-purple-50/50">
                    {executionResult.columns.map((col) => (
                      <th key={col} className="py-2 px-3 capitalize">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 font-mono text-[11px]">
                  {executionResult.sampleRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/40 transition">
                      {executionResult.columns.map((col) => {
                        const val = row[col];
                        const isNum = typeof val === 'number' || (typeof val === 'string' && /^\$?\d+(\.\d+)?$/.test(val));
                        const isStatus = col.toLowerCase().includes('status') || col.toLowerCase().includes('state');
                        return (
                          <td key={col} className={`py-2 px-3 ${col.toLowerCase().includes('id') ? 'font-bold text-purple-950' : isNum ? 'text-emerald-700 font-bold' : 'text-slate-700'}`}>
                            {isStatus ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-sans">
                                {String(val)}
                              </span>
                            ) : isNum && col.toLowerCase().includes('amount') ? (
                              `$${val}`
                            ) : (
                              String(val ?? '-')
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
