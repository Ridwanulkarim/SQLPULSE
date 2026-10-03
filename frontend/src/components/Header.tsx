import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import {
  Database,
  Share2,
  ShieldCheck,
  Calculator,
  Download,
  Menu,
  X,
  ArrowRightLeft,
  Sliders,
  Flame,
  ShieldAlert,
  Link2,
  Layers,
  FileSearch,
  Search,
  Moon,
  Sun,
  DollarSign,
  EyeOff,
  Zap,
  ChevronDown,
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

export type AppTabId =
  | 'plan'
  | 'migration'
  | 'advisor'
  | 'sandbox'
  | 'transpiler'
  | 'tuner'
  | 'deadlock'
  | 'disaster'
  | 'synthesizer'
  | 'connect'
  | 'partition'
  | 'logs'
  | 'bloat'
  | 'replication'
  | 'security'
  | 'mock'
  | 'finops'
  | 'doctor'
  | 'sanitizer'
  | 'rewriter'
  | 'matrix'
  | 'sizing'
  | 'schema_diff'
  | 'orm_profiler'
  | 'production_readiness'
  | 'chaos_simulator'
  | 'cdc_outbox'
  | 'vector_tuner';

export type AppTheme = 'theme-lavender' | 'theme-dark' | 'theme-light';

interface HeaderProps {
  activeTab: AppTabId;
  setActiveTab: (tab: AppTabId) => void;
  onShareClick: () => void;
  onExportClick: () => void;
  onOpenCommandPalette: () => void;
  hasAnalysis: boolean;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onShareClick,
  onExportClick,
  onOpenCommandPalette,
  hasAnalysis,
  currentTheme,
  onSelectTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [studiosDropdownOpen, setStudiosDropdownOpen] = useState(false);

  const tabs: { id: AppTabId; label: string; icon: React.ReactNode; category: string; desc: string }[] = [
    
    { id: 'plan', label: 'Plan Visualizer', icon: <GitGraph className="w-3.5 h-3.5 text-indigo-600" />, category: 'Performance', desc: 'Tree cost graph & bottlenecks' },
    { id: 'advisor', label: 'Query Advisor', icon: <SearchCheck className="w-3.5 h-3.5 text-blue-600" />, category: 'Performance', desc: 'AI anti-pattern & compound ESR' },
    { id: 'rewriter', label: 'SQL Rewriter', icon: <Zap className="w-3.5 h-3.5 text-amber-600" />, category: 'Performance', desc: '10x-100x sargability AST optimizer' },
    { id: 'orm_profiler', label: 'ORM Profiler', icon: <Code2 className="w-3.5 h-3.5 text-emerald-600" />, category: 'Performance', desc: 'N+1 loop & Cartesian eliminator' },
    { id: 'logs', label: 'Slow Logs', icon: <FileSearch className="w-3.5 h-3.5 text-rose-600" />, category: 'Performance', desc: 'Slow log forensic analyzer' },
    { id: 'sandbox', label: 'SQL Sandbox', icon: <Terminal className="w-3.5 h-3.5 text-emerald-600" />, category: 'Performance', desc: 'Live in-browser latency benchmark' },

    { id: 'schema_diff', label: 'Schema Diff', icon: <GitCompare className="w-3.5 h-3.5 text-indigo-600" />, category: 'Migrations', desc: 'Online schema drift & DDL sync' },
    { id: 'migration', label: 'Safe Migration', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />, category: 'Migrations', desc: 'Zero-downtime DDL linter & CI/CD' },
    { id: 'partition', label: 'Partitioning', icon: <Layers className="w-3.5 h-3.5 text-purple-600" />, category: 'Migrations', desc: 'Big data range & hash sharding' },
    { id: 'transpiler', label: 'Transpiler', icon: <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />, category: 'Migrations', desc: 'Cross-dialect polyglot converter' },
    { id: 'bloat', label: 'Bloat & Vacuum', icon: <HardDrive className="w-3.5 h-3.5 text-amber-600" />, category: 'Migrations', desc: 'Index bloat & zero-downtime repack' },

    { id: 'production_readiness', label: 'Readiness Score', icon: <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />, category: 'Architecture', desc: 'Pre-launch SLA/SLO health scorecard' },
    { id: 'chaos_simulator', label: 'Chaos Sim', icon: <Flame className="w-3.5 h-3.5 text-rose-600" />, category: 'Architecture', desc: 'Node crash & split-brain simulator' },
    { id: 'replication', label: 'Replication HA', icon: <Layers className="w-3.5 h-3.5 text-blue-600" />, category: 'Architecture', desc: 'Multi-region cluster & failover' },
    { id: 'tuner', label: 'Config Tuner', icon: <Sliders className="w-3.5 h-3.5 text-blue-600" />, category: 'Architecture', desc: 'Hardware mathematical auto-sizing' },
    { id: 'deadlock', label: 'Deadlock Sim', icon: <Flame className="w-3.5 h-3.5 text-rose-600" />, category: 'Architecture', desc: 'Wait-For graph cycle visualizer' },
    { id: 'disaster', label: 'Disaster DR', icon: <ShieldAlert className="w-3.5 h-3.5 text-teal-600" />, category: 'Architecture', desc: 'RPO/RTO & bash backup scripts' },
    { id: 'sizing', label: 'Sizing & Pooler', icon: <Calculator className="w-3.5 h-3.5 text-teal-600" />, category: 'Architecture', desc: 'Hardware & PgBouncer calculator' },

    { id: 'finops', label: 'Cloud FinOps', icon: <DollarSign className="w-3.5 h-3.5 text-emerald-600" />, category: 'FinOps & Security', desc: 'AWS/GCP/Azure database bill calculator' },
    { id: 'doctor', label: 'Index Doctor', icon: <SearchCheck className="w-3.5 h-3.5 text-indigo-600" />, category: 'FinOps & Security', desc: 'Redundant & prefix index auditor' },
    { id: 'sanitizer', label: 'PII Sanitizer', icon: <EyeOff className="w-3.5 h-3.5 text-rose-600" />, category: 'FinOps & Security', desc: 'GDPR/HIPAA data masking & staging' },
    { id: 'security', label: 'Security & RLS', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />, category: 'FinOps & Security', desc: 'RBAC least-privilege & PII masking' },

    { id: 'cdc_outbox', label: 'CDC & Outbox', icon: <Radio className="w-3.5 h-3.5 text-violet-600" />, category: 'AI & Data', desc: 'Transactional outbox & Debezium' },
    { id: 'vector_tuner', label: 'Vector & RAG', icon: <Cpu className="w-3.5 h-3.5 text-cyan-600" />, category: 'AI & Data', desc: 'HNSW memory & hybrid search' },
    { id: 'synthesizer', label: 'Query Synthesizer', icon: <Terminal className="w-3.5 h-3.5 text-purple-600" />, category: 'AI & Data', desc: 'Multilingual text-to-query studio' },
    { id: 'connect', label: 'Connect Hub', icon: <Link2 className="w-3.5 h-3.5 text-indigo-600" />, category: 'AI & Data', desc: 'DSN connection strings & ORMs' },
    { id: 'mock', label: 'Mock Generator', icon: <FileSpreadsheet className="w-3.5 h-3.5 text-fuchsia-600" />, category: 'AI & Data', desc: 'Realistic datasets & load benchmark' },
    { id: 'matrix', label: '447 DB Matrix', icon: <Database className="w-3.5 h-3.5 text-indigo-600" />, category: 'AI & Data', desc: '447 engine comparison index' },
  ];

  const activeTabObj = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-all font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className="flex items-center gap-2.5 group text-left"
            >
              <BrandLogo size="md" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-brand font-extrabold text-xl tracking-[-0.035em] text-slate-950 dark:text-white flex items-center">
                    SQL<span className="text-[#0096b3] dark:text-[#00f0ff]">Pulse</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-[#0096b3] dark:text-[#00f0ff] border border-cyan-500/20">
                    447 DBs • 25 Studios
                  </span>
                </div>
              </div>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-zinc-100/90 p-1 rounded-full border border-zinc-200/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                activeTab === 'plan'
                  ? 'bg-white text-zinc-900 font-bold shadow-xs border border-zinc-200/70'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Plan Visualizer
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rewriter')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                activeTab === 'rewriter'
                  ? 'bg-white text-zinc-900 font-bold shadow-xs border border-zinc-200/70'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              SQL Rewriter
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('finops')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                activeTab === 'finops'
                  ? 'bg-white text-zinc-900 font-bold shadow-xs border border-zinc-200/70'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Cloud FinOps
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('doctor')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                activeTab === 'doctor'
                  ? 'bg-white text-zinc-900 font-bold shadow-xs border border-zinc-200/70'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Index Doctor
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setStudiosDropdownOpen(!studiosDropdownOpen)}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${
                  !['plan', 'rewriter', 'finops', 'doctor'].includes(activeTab)
                    ? 'bg-white text-zinc-900 font-bold shadow-xs border border-zinc-200/70'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>{['plan', 'rewriter', 'finops', 'doctor'].includes(activeTab) ? 'More Studios' : activeTabObj.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {studiosDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-zinc-200 shadow-2xl p-2 z-50 max-h-[70vh] overflow-y-auto">
                  <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider px-2 py-1">
                    All 22 Specialized Studios
                  </div>
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(t.id);
                        setStudiosDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-left flex items-center gap-2.5 transition ${
                        activeTab === t.id
                          ? 'bg-zinc-100 text-zinc-900 font-bold'
                          : 'hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <span className="p-1 rounded-md bg-zinc-100 border border-zinc-200">{t.icon}</span>
                      <div className="truncate">
                        <div className="text-zinc-900">{t.label}</div>
                        <div className="text-[10px] text-zinc-500 font-normal truncate">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-white text-zinc-600 hover:text-zinc-900 transition text-xs shadow-xs"
            >
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="px-1.5 py-0.2 text-[10px] font-bold bg-white text-zinc-500 rounded border border-zinc-200 font-mono shadow-xs">
                ⌘K
              </kbd>
            </button>

            <div className="flex items-center bg-zinc-100 dark:bg-slate-800 p-0.5 rounded-full border border-zinc-200 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={() => onSelectTheme('theme-light')}
                title="Light Mode"
                className={`p-1.5 rounded-full transition-all ${
                  currentTheme === 'theme-light' || currentTheme === 'theme-lavender'
                    ? 'bg-white text-amber-500 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectTheme('theme-dark')}
                title="Dark Mode"
                className={`p-1.5 rounded-full transition-all ${
                  currentTheme === 'theme-dark'
                    ? 'bg-slate-900 text-sky-400 shadow-xs border border-slate-700'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            {hasAnalysis && (
              <button
                type="button"
                onClick={onExportClick}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-200 shadow-xs active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-zinc-600" />
                <span>Export</span>
              </button>
            )}

            {hasAnalysis && (
              <button
                type="button"
                onClick={onShareClick}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-200 shadow-xs active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-600" />
                <span>Share</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition active:scale-95 flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-200" />
              <span className="hidden sm:inline">Workbench (⌘K)</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-zinc-200 bg-white text-zinc-800"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-zinc-200 space-y-1 max-h-[70vh] overflow-y-auto">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1">
              Select Studio ({tabs.length})
            </div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white font-bold'
                    : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
