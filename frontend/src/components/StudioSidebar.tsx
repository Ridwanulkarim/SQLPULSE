import React from 'react';
import { AppTabId } from './Header';
import {
  GitGraph,
  Zap,
  SearchCheck,
  Terminal,
  FileSearch,
  Code2,
  ShieldCheck,
  Sliders,
  Layers,
  ArrowRightLeft,
  GitCompare,
  Database,
  Flame,
  ShieldAlert,
  Calculator,
  DollarSign,
  HardDrive,
  EyeOff,
  Cpu,
  Radio,
  Link2,
  FileSpreadsheet,
} from 'lucide-react';

interface StudioSidebarProps {
  activeTab: AppTabId;
  setActiveTab: (tab: AppTabId) => void;
  className?: string;
  onItemClick?: () => void;
}

interface StudioItem {
  id: AppTabId;
  label: string;
  icon?: React.ReactNode;
}

interface StudioSection {
  title: string;
  items: StudioItem[];
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  activeTab,
  setActiveTab,
  className = '',
  onItemClick,
}) => {
  const sections: StudioSection[] = [
    {
      title: 'Performance & Queries',
      items: [
        { id: 'plan', label: 'Plan Visualizer', icon: <GitGraph className="w-3.5 h-3.5" /> },
        { id: 'rewriter', label: 'SQL Rewriter', icon: <Zap className="w-3.5 h-3.5" /> },
        { id: 'advisor', label: 'Query Advisor', icon: <SearchCheck className="w-3.5 h-3.5" /> },
        { id: 'doctor', label: 'Index Doctor', icon: <SearchCheck className="w-3.5 h-3.5" /> },
        { id: 'sandbox', label: 'SQL Sandbox', icon: <Terminal className="w-3.5 h-3.5" /> },
        { id: 'orm_profiler', label: 'ORM Profiler', icon: <Code2 className="w-3.5 h-3.5" /> },
        { id: 'logs', label: 'Slow Logs', icon: <FileSearch className="w-3.5 h-3.5" /> },
        { id: 'synthesizer', label: 'Synthesizer', icon: <Terminal className="w-3.5 h-3.5" /> },
      ],
    },
    {
      title: 'Architecture & Migrations',
      items: [
        { id: 'migration', label: 'Safe Migration', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
        { id: 'tuner', label: 'Config Tuner', icon: <Sliders className="w-3.5 h-3.5" /> },
        { id: 'partition', label: 'Partitioning', icon: <Layers className="w-3.5 h-3.5" /> },
        { id: 'schema_diff', label: 'Schema Diff', icon: <GitCompare className="w-3.5 h-3.5" /> },
        { id: 'transpiler', label: 'Transpiler', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
        { id: 'sizing', label: 'Sizing & Pooler', icon: <Calculator className="w-3.5 h-3.5" /> },
        { id: 'matrix', label: '447 DB Matrix', icon: <Database className="w-3.5 h-3.5" /> },
      ],
    },
    {
      title: 'Resilience & Reliability',
      items: [
        { id: 'disaster', label: 'Disaster DR', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
        { id: 'deadlock', label: 'Deadlock Sim', icon: <Flame className="w-3.5 h-3.5" /> },
        { id: 'chaos_simulator', label: 'Chaos Sim', icon: <Flame className="w-3.5 h-3.5" /> },
        { id: 'replication', label: 'Replication HA', icon: <Layers className="w-3.5 h-3.5" /> },
        { id: 'cdc_outbox', label: 'CDC & Outbox', icon: <Radio className="w-3.5 h-3.5" /> },
      ],
    },
    {
      title: 'FinOps & Governance',
      items: [
        { id: 'finops', label: 'Cloud FinOps', icon: <DollarSign className="w-3.5 h-3.5" /> },
        { id: 'bloat', label: 'Bloat & Reclaim', icon: <HardDrive className="w-3.5 h-3.5" /> },
        { id: 'security', label: 'Security & RLS', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
        { id: 'sanitizer', label: 'PII Sanitizer', icon: <EyeOff className="w-3.5 h-3.5" /> },
        { id: 'vector_tuner', label: 'Vector Index', icon: <Cpu className="w-3.5 h-3.5" /> },
        { id: 'production_readiness', label: 'Readiness Score', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
        { id: 'connect', label: 'Connect Hub', icon: <Link2 className="w-3.5 h-3.5" /> },
        { id: 'mock', label: 'Mock Generator', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
      ],
    },
  ];

  return (
    <nav className={`space-y-6 ${className}`}>
      {/* Subtle top tracking header matching Next Elite doc style */}
      <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        On This Page
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <div className="px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
            {section.title}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    onItemClick?.();
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 font-normal'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};
