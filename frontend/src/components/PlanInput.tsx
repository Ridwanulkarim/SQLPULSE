import React, { useState, useEffect } from 'react';
import { Play, Terminal, FileCode2, RotateCcw, Database, Search, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DatabaseEngine, DATABASE_CATALOG, DatabaseCategory } from '../types';

interface PlanInputProps {
  onAnalyze: (planInput: string, rawQuery?: string, engine?: DatabaseEngine) => void;
  isLoading: boolean;
  onLoadSample: (type: 'slow' | 'optimized', engine: DatabaseEngine) => void;
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
  rawPlanInput?: any;
  rawQueryInput?: string;
}

export const PlanInput: React.FC<PlanInputProps> = ({
  onAnalyze,
  isLoading,
  onLoadSample,
  selectedEngine,
  onSelectEngine,
  rawPlanInput,
  rawQueryInput,
}) => {
  const [planText, setPlanText] = useState('');
  const [queryText, setQueryText] = useState('');
  const [showQueryInput, setShowQueryInput] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DatabaseCategory | 'all' | 'top_ranked'>('top_ranked');
  const [searchFilter, setSearchFilter] = useState('');

  const currentDb = DATABASE_CATALOG.find((d) => d.id === selectedEngine) || DATABASE_CATALOG[0];

  useEffect(() => {
    if (rawPlanInput !== undefined && rawPlanInput !== null) {
      const formatted = typeof rawPlanInput === 'string' ? rawPlanInput : JSON.stringify(rawPlanInput, null, 2);
      setPlanText(formatted);
    }
  }, [rawPlanInput]);

  useEffect(() => {
    if (rawQueryInput !== undefined && rawQueryInput !== null) {
      setQueryText(rawQueryInput);
      if (rawQueryInput.trim().length > 0) {
        setShowQueryInput(true);
      }
    }
  }, [rawQueryInput]);

  useEffect(() => {
    if (activeCategory !== 'all' && activeCategory !== 'top_ranked' && currentDb.category !== activeCategory) {
      setActiveCategory(currentDb.category);
    }
  }, [selectedEngine]);

  const categories: { id: DatabaseCategory | 'all' | 'top_ranked'; label: string; icon: string }[] = [
    { id: 'top_ranked', label: '🏆 Top Ranked (DB-Engines)', icon: '🏆' },
    { id: 'all', label: `All DBs (${DATABASE_CATALOG.length})`, icon: '🌐' },
    { id: 'relational', label: 'Relational (SQL)', icon: '🏛️' },
    { id: 'olap', label: 'Analytics & OLAP', icon: '📊' },
    { id: 'document', label: 'Document NoSQL', icon: '📄' },
    { id: 'keyvalue', label: 'Key-Value & In-Memory', icon: '⚡' },
    { id: 'vector', label: 'Vector AI & ML', icon: '🧠' },
    { id: 'search', label: 'Search Engines', icon: '🔍' },
    { id: 'graph', label: 'Graph DBs', icon: '🕸️' },
    { id: 'timeseries', label: 'Time-Series', icon: '📈' },
    { id: 'wide_column', label: 'Wide-Column', icon: '📦' },
    { id: 'baas_embedded', label: 'BaaS & Embedded', icon: '🚀' },
    { id: 'geo_spatial', label: 'Spatial & Geo', icon: '🗺️' },
    { id: 'streaming_ledger', label: 'Streaming & Ledgers', icon: '📼' },
  ];

  const filteredDatabases = DATABASE_CATALOG.filter((d) => {
    let matchesCategory = true;
    if (activeCategory === 'top_ranked') {
      matchesCategory = !!d.rank && d.rank <= 50;
    } else if (activeCategory !== 'all') {
      matchesCategory = d.category === activeCategory;
    }

    const matchesSearch =
      searchFilter.trim() === '' ||
      d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.categoryLabel.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (activeCategory === 'top_ranked') {
      return (a.rank || 999) - (b.rank || 999);
    }
    return 0;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planText.trim()) return;
    onAnalyze(planText, queryText, selectedEngine);
  };

  const getPlaceholder = () => {
    switch (currentDb.category) {
      case 'olap':
        return 'EXPLAIN ANALYZE SELECT symbol, avg(price) FROM trades GROUP BY symbol;\nPipeline: HashAggregate -> Exchange -> ScanFilterProject (ClickHouse / DuckDB / Snowflake / BigQuery)';
      case 'vector':
        return '{\n  "query_type": "HNSW",\n  "efSearch": 64,\n  "dimension": 1536,\n  "metric": "cosine",\n  "took_ms": 3.2\n}';
      case 'document':
      case 'baas_embedded':
        return '{\n  "executionStats": {\n    "nReturned": 100,\n    "totalDocsExamined": 150000,\n    "executionStages": { "stage": "COLLSCAN", ... }\n  }\n}';
      case 'keyvalue':
        return 'SLOWLOG GET 10\n1) 1) (integer) 42\n   2) (integer) 1696238120\n   3) (integer) 45000\n   4) 1) "KEYS"\n      2) "user:*"';
      case 'search':
        return '{\n  "took": 15,\n  "timed_out": false,\n  "hits": { "total": 100, "hits": [ { "_score": 0.94 } ] },\n  "deep_pagination": false\n}';
      case 'graph':
        return 'Cypher Execution Plan / Graph Trace:\nPlanner: COST\nRuntime: PIPELINED\n+-------------------+----------------+\n| Operator          | Details        |\n+-------------------+----------------+\n| +AllNodesScan     | u:User         |\n+-------------------+----------------+';
      case 'timeseries':
        return 'Flux / PromQL Execution Trace:\nfrom(bucket: "telemetry") |> range(start: -30d) |> filter(fn: (r) => r.non_indexed_field == "value")\nWarning: Pushdown disabled.';
      case 'wide_column':
        return 'Tracing session:\nActivity: Executing cross-shard query\nWarning: ALLOW FILTERING was executed across 16 nodes in cluster ring.';
      case 'geo_spatial':
        return 'EXPLAIN ANALYZE SELECT name FROM places WHERE ST_DWithin(geom, ST_MakePoint(-73.985, 40.748), 1000);';
      case 'streaming_ledger':
        return 'Topic: order-events, Partition: 3, Offset: 84912, Lag: 45000 msg, Consumer Group: analytics-worker';
      case 'relational':
      default:
        return '[\n  {\n    "Plan": {\n      "Node Type": "Seq Scan",\n      "Relation Name": "orders",\n      "Total Cost": 24500,\n      "Actual Rows": 94500,\n      "Filter": "(status = \'completed\')"\n    }\n  }\n]';
    }
  };

  return (
    <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-100/80 text-purple-700 border border-purple-200 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500">Universal Database Optimizer</h3>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-amber-100 text-amber-900 rounded-full border border-amber-200 shadow-sm flex items-center gap-1">
                <Trophy className="w-2.5 h-2.5 text-amber-600" />
                DB-Engines Top Ranked Index
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Select Database Engine &amp; Model</h2>
          </div>
        </div>

        <div className="relative w-full sm:w-auto sm:min-w-[260px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Search across ${DATABASE_CATALOG.length} DBs (Oracle, Postgres, DuckDB, Chroma)...`}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/90 border border-purple-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-purple-400 transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-purple-200/50 overflow-x-auto max-w-full scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setActiveCategory(cat.id);
              if (cat.id !== 'all' && cat.id !== 'top_ranked') {
                const firstInCat = DATABASE_CATALOG.find((d) => d.category === cat.id);
                if (firstInCat) onSelectEngine(firstInCat.id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeCategory === cat.id
                ? 'bg-white text-purple-950 shadow-sm border border-purple-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
          <span>Available Engines ({filteredDatabases.length}):</span>
          <span className="text-[10px] text-purple-600 font-bold sm:hidden">Tap to switch</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap max-h-48 sm:max-h-none overflow-y-auto sm:overflow-visible pr-1 sm:pr-0">
          {filteredDatabases.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No database found matching "{searchFilter}"</span>
          ) : (
            filteredDatabases.map((db) => (
              <button
                key={db.id}
                type="button"
                onClick={() => onSelectEngine(db.id)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                  selectedEngine === db.id
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20 ring-2 ring-purple-300'
                    : 'bg-white/85 text-slate-700 hover:bg-white hover:text-slate-900 border-purple-200 hover:border-purple-300'
                }`}
              >
                <span>{db.icon}</span>
                <span>{db.name}</span>
                {db.rank && (
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                      selectedEngine === db.id
                        ? 'bg-purple-800 text-purple-100'
                        : 'bg-purple-100/80 text-purple-800 border border-purple-200/60'
                    }`}
                  >
                    #{db.rank}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="bg-purple-50/70 border border-purple-200/70 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs text-slate-700 font-semibold">
              Command for <strong className="text-purple-900">{currentDb.name}</strong>
              {currentDb.rank && (
                <span className="ml-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                  #{currentDb.rank}
                </span>
              )}
              :
            </span>
          </div>
          <code className="px-2 py-1 rounded font-mono text-[11px] bg-white border border-purple-200 text-purple-900 font-bold break-all sm:break-normal overflow-x-auto">
            {currentDb.commandHint}
          </code>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={() => onLoadSample('slow', selectedEngine)}
            className="flex-1 sm:flex-initial px-2.5 py-1.5 sm:py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>Slow Plan</span>
          </button>
          <button
            type="button"
            onClick={() => onLoadSample('optimized', selectedEngine)}
            className="flex-1 sm:flex-initial px-2.5 py-1.5 sm:py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Optimized Plan</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        
        {showQueryInput ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <FileCode2 className="w-3.5 h-3.5 text-indigo-500" />
                Original Query (Optional context for index &amp; query tuning)
              </label>
              <button
                type="button"
                onClick={() => setShowQueryInput(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Hide
              </button>
            </div>
            <textarea
              rows={2}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="SELECT * FROM table ... / db.collection.find(...) / MATCH (n) ... / NearVector(...)"
              className="w-full rounded-xl px-3.5 py-2 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 bg-white/80 border border-purple-200/80 text-slate-800 focus:ring-purple-400/40 focus:border-purple-400 shadow-inner transition"
            />
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowQueryInput(true)}
              className="text-xs text-purple-600 hover:text-purple-800 font-semibold transition flex items-center gap-1"
            >
              + Add original Query for context
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            rows={7}
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full rounded-xl px-3.5 py-3 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 bg-slate-900 border border-slate-800 text-emerald-400 focus:ring-purple-400/50 shadow-md transition leading-relaxed"
            required
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              setPlanText('');
              setQueryText('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 transition py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Plan Input
          </button>

          <button
            type="submit"
            disabled={isLoading || !planText.trim()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:opacity-95 shadow-lg shadow-purple-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing {currentDb.name} Plan...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Analyze {currentDb.name} Execution Plan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
