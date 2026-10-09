import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Database,
  ShieldCheck,
  Calculator,
  ArrowRightLeft,
  Sliders,
  Flame,
  ShieldAlert,
  Link2,
  Layers,
  FileSearch,
  X,
  ArrowRight,
  DollarSign,
  EyeOff,
  Zap,
  GitGraph,
  SearchCheck,
  Terminal,
  HardDrive,
  FileSpreadsheet,
  GitCompare,
  Code2,
  Radio,
  Cpu
} from 'lucide-react';
import { DATABASE_CATALOG, DatabaseEngineMetadata } from '../types';
import { AppTabId } from './Header';
import { DbBrandLogo } from './DbBrandLogo';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: AppTabId) => void;
  onSelectEngine: (engineId: string) => void;
}

interface FeatureAction {
  id: AppTabId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  category: string;
}

type PaletteItem =
  | { type: 'feature'; data: FeatureAction }
  | { type: 'database'; data: DatabaseEngineMetadata };

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onSelectEngine,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const featureActions: FeatureAction[] = [
    { id: 'plan', title: 'Plan Visualizer', subtitle: 'Interactive execution tree, cost breakdown & bottlenecks', icon: <GitGraph className="w-4 h-4 text-indigo-600" />, category: 'Features' },
    { id: 'migration', title: 'Safe Migration Linter', subtitle: 'Zero-downtime DDL safety scanner & CI/CD exporter', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />, category: 'Features' },
    { id: 'advisor', title: 'Query Advisor', subtitle: 'Anti-pattern detection & compound ESR index recommendations', icon: <SearchCheck className="w-4 h-4 text-blue-600" />, category: 'Features' },
    { id: 'sandbox', title: 'Live SQL Sandbox', subtitle: 'In-browser latency comparison and B-Tree indexing benchmarks', icon: <Terminal className="w-4 h-4 text-emerald-600" />, category: 'Features' },
    { id: 'transpiler', title: 'Cross-Engine Transpiler', subtitle: 'Polyglot SQL, NoSQL & Vector cross-dialect converter', icon: <ArrowRightLeft className="w-4 h-4 text-purple-600" />, category: 'Features' },
    { id: 'tuner', title: 'Config Auto-Tuner', subtitle: 'Hardware mathematical auto-sizing & /etc/sysctl.conf tuning', icon: <Sliders className="w-4 h-4 text-blue-600" />, category: 'Features' },
    { id: 'deadlock', title: 'Deadlock & Concurrency Sim', subtitle: 'Interactive Wait-For Graph cycle visualizer & timeline player', icon: <Flame className="w-4 h-4 text-rose-600" />, category: 'Features' },
    { id: 'disaster', title: 'Disaster Recovery RPO/RTO', subtitle: 'RPO/RTO calculations, cloud storage costs & bash backup scripts', icon: <ShieldAlert className="w-4 h-4 text-teal-600" />, category: 'Features' },
    { id: 'synthesizer', title: 'Query Synthesizer', subtitle: 'Multilingual natural language text-to-query studio', icon: <Terminal className="w-4 h-4 text-purple-600" />, category: 'Features' },
    { id: 'connect', title: 'Connect Hub & DSN Studio', subtitle: 'Polyglot connection strings & ORM driver boilerplate', icon: <Link2 className="w-4 h-4 text-indigo-600" />, category: 'Features' },
    { id: 'partition', title: 'Partitioning & Sharding Architect', subtitle: 'Declarative big data range/hash slices & retention cron', icon: <Layers className="w-4 h-4 text-purple-600" />, category: 'Features' },
    { id: 'logs', title: 'Slow Query Log Inspector', subtitle: 'Slow log forensic analyzer & fingerprint index suggester', icon: <FileSearch className="w-4 h-4 text-rose-600" />, category: 'Features' },
    { id: 'bloat', title: 'Index Bloat, Vacuum & Repack Studio', subtitle: 'Dead tuple bloat, page split diagnostic & zero-downtime repack', icon: <HardDrive className="w-4 h-4 text-amber-600" />, category: 'Features' },
    { id: 'replication', title: 'Cluster & Replication Topology', subtitle: 'Multi-region quorum standby, read pool routing & automated failover', icon: <Layers className="w-4 h-4 text-blue-600" />, category: 'Features' },
    { id: 'security', title: 'Security RBAC & Row-Level Security', subtitle: 'Least-privilege roles, multi-tenant RLS & dynamic PII masking', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />, category: 'Features' },
    { id: 'mock', title: 'Synthetic Mock Data & Benchmarking', subtitle: 'Realistic synthetic datasets & pgbench/sysbench load scripts', icon: <FileSpreadsheet className="w-4 h-4 text-fuchsia-600" />, category: 'Features' },
    { id: 'finops', title: 'Cloud Database FinOps Sizer', subtitle: 'AWS Aurora, GCP Cloud SQL, Azure & Atlas monthly bill & IOPS calculator', icon: <DollarSign className="w-4 h-4 text-emerald-600" />, category: 'Features' },
    { id: 'doctor', title: 'Index Doctor & Redundancy Auditor', subtitle: 'Detect redundant prefix indexes & eliminate write I/O amplification', icon: <SearchCheck className="w-4 h-4 text-indigo-600" />, category: 'Features' },
    { id: 'sanitizer', title: 'PII Data Sanitizer & Masker', subtitle: 'GDPR/HIPAA safe-harbor masking & pg_dump_anon staging stream', icon: <EyeOff className="w-4 h-4 text-rose-600" />, category: 'Features' },
    { id: 'rewriter', title: 'SQL AST Query Rewriter', subtitle: '10x-100x faster index-seek rewrite for non-sargable functions', icon: <Zap className="w-4 h-4 text-amber-600" />, category: 'Features' },
    { id: 'matrix', title: '447 DB Comparison Matrix', subtitle: 'Comprehensive engine ranking, paradigms & query hints', icon: <Database className="w-4 h-4 text-indigo-600" />, category: 'Features' },
    { id: 'sizing', title: 'Database Sizing & PgBouncer', subtitle: 'Vector RAM, storage growth & connection pooler calculator', icon: <Calculator className="w-4 h-4 text-teal-600" />, category: 'Features' },
    { id: 'schema_diff', title: 'Schema Diff & Online Sync', subtitle: 'Dev vs Prod drift detector & zero-downtime reversible DDL', icon: <GitCompare className="w-4 h-4 text-indigo-600" />, category: 'Features' },
    { id: 'orm_profiler', title: 'ORM N+1 & Latency Profiler', subtitle: 'Prisma, TypeORM, Hibernate & Django loop optimizer', icon: <Code2 className="w-4 h-4 text-emerald-600" />, category: 'Features' },
    { id: 'production_readiness', title: 'Production Readiness Scorecard', subtitle: 'Pre-launch SLA, timeout & health checklist auditor', icon: <ShieldCheck className="w-4 h-4 text-teal-600" />, category: 'Features' },
    { id: 'chaos_simulator', title: 'Chaos & Fault Injection Sim', subtitle: 'Primary crash, split-brain & connection exhaustion simulator', icon: <Flame className="w-4 h-4 text-rose-600" />, category: 'Features' },
    { id: 'cdc_outbox', title: 'CDC & Transactional Outbox', subtitle: 'Zero-loss Debezium, Kafka Connect & idempotent consumer worker', icon: <Radio className="w-4 h-4 text-violet-600" />, category: 'Features' },
    { id: 'vector_tuner', title: 'Vector Search & HNSW Tuner', subtitle: 'pgvector/Pinecone/Milvus RAM sizing & hybrid BM25 RRF queries', icon: <Cpu className="w-4 h-4 text-cyan-600" />, category: 'Features' },
  ];

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredFeatures: FeatureAction[] = featureActions.filter(f =>
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDatabases: DatabaseEngineMetadata[] = DATABASE_CATALOG.filter(db =>
    db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    db.categoryLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    db.id.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  const allItems: PaletteItem[] = [
    ...filteredFeatures.map(f => ({ type: 'feature' as const, data: f })),
    ...filteredDatabases.map(d => ({ type: 'database' as const, data: d })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allItems[selectedIndex];
      if (current) {
        if (current.type === 'feature') {
          onSelectTab(current.data.id);
        } else {
          onSelectEngine(current.data.id);
        }
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-purple-200/80 overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="p-4 border-b border-purple-100 flex items-center gap-3 bg-purple-50/40">
          <Search className="w-5 h-5 text-purple-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search across all 447 databases, tools, features, or queries..."
            className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-500 border border-slate-200">
              ESC to close
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching database engine or feature studio found for "{searchTerm}".
            </div>
          ) : (
            allItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (item.type === 'feature') {
                    onSelectTab(item.data.id);
                  } else {
                    onSelectEngine(item.data.id);
                  }
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl text-left flex items-center justify-between transition-all ${
                  selectedIndex === idx
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-800 hover:bg-purple-50/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${selectedIndex === idx ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                    {item.type === 'feature' ? item.data.icon : <DbBrandLogo engineId={item.data.id} size={20} />}
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2">
                      <span>{item.type === 'feature' ? item.data.title : item.data.name}</span>
                      {item.type === 'database' && (
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.2 rounded-full ${
                          selectedIndex === idx ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                        }`}>
                          Rank #{item.data.rank} • {item.data.categoryLabel}
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] truncate max-w-md ${selectedIndex === idx ? 'text-purple-100' : 'text-slate-500'}`}>
                      {item.type === 'feature' ? item.data.subtitle : item.data.description}
                    </div>
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 shrink-0 opacity-70 ${selectedIndex === idx ? 'text-white' : 'text-slate-400'}`} />
              </button>
            ))
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-purple-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <span className="font-mono text-purple-700 font-bold">
            {DATABASE_CATALOG.length} Database Catalog
          </span>
        </div>
      </div>
    </div>
  );
};
