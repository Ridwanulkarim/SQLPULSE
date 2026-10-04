import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Copy,
  Check,
  Activity,
  ShieldCheck,
  Server,
  AlertTriangle,
  Terminal,
  Zap,
  RefreshCw,
  Network,
  Database,
  Cpu,
  Radio,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  WifiOff,
  Layers,
  Vote,
  Clock,
  Gauge,
  ArrowRight,
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { simulateChaos } from '../services/api';
import {
  ChaosSimulationResult,
  ChaosStep,
  ChaosNodeStatus,
  DatabaseEngine,
  DATABASE_CATALOG,
} from '../types';

interface ChaosSimulatorTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

const POPULAR_ENGINES = [
  { id: 'postgresql', label: 'PostgreSQL', port: 5432, daemon: 'postgres' },
  { id: 'mysql', label: 'MySQL', port: 3306, daemon: 'mysqld' },
  { id: 'oracle', label: 'Oracle', port: 1521, daemon: 'oracle' },
  { id: 'sqlserver', label: 'SQL Server', port: 1433, daemon: 'sqlservr' },
  { id: 'mongodb', label: 'MongoDB', port: 27017, daemon: 'mongod' },
  { id: 'redis', label: 'Redis', port: 6379, daemon: 'redis-server' },
  { id: 'clickhouse', label: 'ClickHouse', port: 8123, daemon: 'clickhouse' },
  { id: 'cassandra', label: 'Cassandra', port: 9042, daemon: 'cassandra' },
  { id: 'sqlite', label: 'SQLite', port: 0, daemon: 'in-process' },
];

export const ChaosSimulatorTab: React.FC<ChaosSimulatorTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<string>(
    (propEngine as string) || 'postgresql'
  );

  useEffect(() => {
    if (propEngine && propEngine !== selectedEngine) {
      setSelectedEngine(propEngine);
    }
  }, [propEngine]);

  const [scenarioId, setScenarioId] = useState<string>('primary_crash');
  const [clusterSize, setClusterSize] = useState<number>(3);
  const [syncMode, setSyncMode] = useState<'sync' | 'async'>('sync');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ChaosSimulationResult | null>(null);

  // Interactive timeline & scrubber state
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'runbook' | 'config' | 'script'>('runbook');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scenarios = [
    {
      id: 'primary_crash',
      label: '💥 Sudden Primary Crash & Quorum Failover',
      desc: 'Hardware kernel panic or OOM kill on leader node; automated election & promotion',
      category: 'Leader Election',
      tagColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'network_split',
      label: '🌐 Split-Brain & Multi-AZ Network Partition',
      desc: 'Inter-AZ network severed; majority consensus quorum evaluation & node STONITH fencing',
      category: 'Consensus & Fencing',
      tagColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'connection_starvation',
      label: '⚡ Thundering Herd & Connection Storm',
      desc: 'Lock cascading stall, worker thread saturation & pooler circuit breaker tripping',
      category: 'Concurrency & Locking',
      tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      id: 'replica_lag_spike',
      label: '⏳ Replication Lag Avalanche & Read Hazard',
      desc: 'Bulk write ingestion delays replica apply stream; automated read pool ejection',
      category: 'Replication SLA',
      tagColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    },
    {
      id: 'disk_out_of_space',
      label: '💾 WAL / Transaction Log Disk Exhaustion',
      desc: 'Unchecked log retention reaches 95% capacity; emergency read-only panic guard',
      category: 'Storage Capacity',
      tagColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
  ];

  const handleSimulate = async () => {
    setIsLoading(true);
    setIsPlaying(false);
    try {
      const data = await simulateChaos({
        engine: selectedEngine,
        scenarioId,
        clusterSize,
        syncMode,
      });
      setResult(data);
      setSelectedStepIndex(0);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate chaos scenario.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [selectedEngine, scenarioId, clusterSize, syncMode]);

  // Autoplay simulation timer
  useEffect(() => {
    if (isPlaying && result && result.timeline.length > 0) {
      timerRef.current = setInterval(() => {
        setSelectedStepIndex((prev) => {
          if (prev >= result.timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2200);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, result]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const engineMeta =
    DATABASE_CATALOG.find((db) => db.id === selectedEngine) || {
      name: selectedEngine,
      icon: '🗄️',
    };

  const currentStep: ChaosStep | undefined =
    result?.timeline && result.timeline.length > 0
      ? result.timeline[Math.min(selectedStepIndex, result.timeline.length - 1)]
      : undefined;

  const currentNodes: ChaosNodeStatus[] = currentStep?.nodeStates || [];
  const votingNodesCount = currentNodes.filter((n) => n.quorumVote).length;
  const majorityThreshold = Math.floor(clusterSize / 2) + 1;
  const hasQuorum = votingNodesCount >= majorityThreshold;

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Header */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-red-950 text-white shadow-xl shadow-rose-950/20 border border-rose-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/40 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-300" /> Distributed Chaos &amp; Fault Injection Simulator
            </span>
            <span className="text-xs text-rose-300 font-medium">
              Leader Election • Quorum Consensus • Split-Brain Fencing • Circuit Breakers
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-400" />
            High-Availability Chaos &amp; Disaster Simulator
          </h2>
          <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-3xl">
            Inject catastrophic production failures into a {engineMeta.name} cluster: sudden primary crashes, split-brain network partitions, connection storms, and disk stalls. Verify automated failover timelines and zero-data-loss SLAs.
          </p>

          {/* Quick Engine Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-rose-800/40">
            <span className="text-[11px] text-rose-300/80 font-bold uppercase tracking-wider mr-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-rose-400" /> Cluster Engine:
            </span>
            {POPULAR_ENGINES.map((eng) => (
              <button
                key={eng.id}
                type="button"
                onClick={() => {
                  setSelectedEngine(eng.id);
                  onSelectEngine?.(eng.id as DatabaseEngine);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1 ${
                  selectedEngine.toLowerCase().includes(eng.id)
                    ? 'bg-rose-400 text-slate-950 shadow-md font-bold'
                    : 'bg-rose-900/60 text-rose-200 hover:bg-rose-800/80 border border-rose-700/50'
                }`}
              >
                <span>{eng.label}</span>
                {eng.port > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">:{eng.port}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cluster Configuration Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border border-rose-200/80 shadow-xs backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-rose-600" /> Target Database Engine
            </label>
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={(eng) => {
                setSelectedEngine(eng);
                onSelectEngine?.(eng as DatabaseEngine);
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-indigo-600" /> Cluster Node Topology
            </label>
            <select
              value={clusterSize}
              onChange={(e) => setClusterSize(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-rose-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-2xs"
            >
              <option value={3}>3 Nodes (Standard HA Quorum: 2/3 votes)</option>
              <option value={5}>5 Nodes (Multi-AZ Resilient Quorum: 3/5 votes)</option>
              <option value={7}>7 Nodes (Global Geo-Distributed: 4/7 votes)</option>
              <option value={2}>2 Nodes + Witness (Edge Active/Standby)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-teal-600" /> Replication Commit Mode
            </label>
            <div className="flex rounded-xl border border-rose-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setSyncMode('sync')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                  syncMode === 'sync'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sync (Zero RPO)
              </button>
              <button
                type="button"
                onClick={() => setSyncMode('async')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                  syncMode === 'async'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Async (Lowest Latency)
              </button>
            </div>
          </div>
        </div>

        {/* Chaos Scenario Selector Grid */}
        <div className="pt-3 border-t border-rose-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-600" /> Select Production Chaos Failure Scenario
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {scenarios.map((sc) => {
              const isActive = scenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setScenarioId(sc.id);
                    setSelectedStepIndex(0);
                    setIsPlaying(false);
                  }}
                  className={`p-3 rounded-2xl border text-left transition active:scale-95 space-y-1 flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-br from-rose-50 to-white border-rose-500 ring-2 ring-rose-500/30 shadow-md'
                      : 'bg-white/80 border-slate-200 hover:border-rose-300 hover:bg-rose-50/40'
                  }`}
                >
                  <div>
                    <span
                      className={`text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded border ${sc.tagColor}`}
                    >
                      {sc.category}
                    </span>
                    <h4 className={`text-xs font-bold mt-1.5 leading-snug ${isActive ? 'text-rose-950 font-extrabold' : 'text-slate-900'}`}>
                      {sc.label}
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{sc.desc}</p>
                  </div>
                  {isActive && (
                    <div className="pt-1 flex items-center gap-1 text-[10px] font-bold text-rose-600">
                      <span>Active Simulation</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-rose-500" />
            <span>Click any scenario above or scrub timeline steps below to inspect failover dynamics.</span>
          </div>

          <button
            type="button"
            onClick={() => handleSimulate()}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-md shadow-rose-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Injecting Chaos Fault...' : 'Re-Run Chaos Simulation ➔'}</span>
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          {/* Executive Chaos Metrics HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Est. Failover Time
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
                {result.totalDowntimeEstimatedSec}s
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                RTO to full service restoration
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                Data Loss Risk (RPO)
              </span>
              <div className="text-xl font-black text-emerald-600 font-mono">
                {result.dataLossRisk === 'ZERO_DATA_LOSS_SYNC' ? '0 Data Loss' : '< 1s Async Lag'}
              </div>
              <p className="text-[11px] text-emerald-700 truncate">
                {result.clusterTopologySummary?.syncMode === 'sync'
                  ? 'Synchronous replication quorum'
                  : 'Asynchronous LSN stream'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                Resilience Rating
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono">
                {result.resilienceScore} / 100
              </div>
              <p className="text-[11px] text-indigo-700 truncate">Fault tolerance index</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
                Quorum Requirement
              </span>
              <div className="text-lg font-black text-purple-700 font-mono">
                {result.clusterTopologySummary?.quorumRequirement ||
                  `${majorityThreshold}/${clusterSize} Nodes`}
              </div>
              <p className="text-[11px] text-purple-700 truncate">
                {result.clusterTopologySummary?.failoverManager || 'Automated Failover Manager'}
              </p>
            </div>
          </div>

          {/* Interactive Phase Scrubber & Cluster State Visualizer */}
          <div className="rounded-2xl bg-white border border-rose-200/80 shadow-xs overflow-hidden">
            {/* Header with Play/Pause & Step Controls */}
            <div className="px-4 py-3 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-rose-100">
                    Live Cluster Timeline &amp; State Machine
                  </h3>
                  <p className="text-[10px] text-rose-300">
                    {result.scenarioTitle} • Step {selectedStepIndex + 1} of {result.timeline.length}
                  </p>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition flex items-center gap-1.5 active:scale-95"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Auto-Play Timeline
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStepIndex(0);
                    setIsPlaying(false);
                  }}
                  className="p-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Reset to Step 1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Clickable Phase Scrubber Buttons */}
            <div className="p-4 bg-slate-50/70 border-b border-rose-100 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {result.timeline.map((step, idx) => {
                  const isSelected = selectedStepIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedStepIndex(idx);
                        setIsPlaying(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 active:scale-95 border ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400/40'
                          : 'bg-white text-slate-700 hover:bg-rose-50/60 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          isSelected ? 'bg-white text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-mono text-[11px]">T+{step.timeOffsetSec}s:</span>
                      <span className="max-w-[130px] truncate">{step.phase}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Step Status Banner */}
            {currentStep && (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/60 via-slate-50 to-indigo-50/40 border border-rose-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-rose-600 text-white">
                        T+{currentStep.timeOffsetSec}s
                      </span>
                      <h4 className="text-sm font-black text-slate-900">{currentStep.phase}</h4>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          currentStep.clusterState === 'HEALTHY' || currentStep.clusterState === 'RECOVERED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : currentStep.clusterState === 'SPLIT_BRAIN'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {currentStep.clusterState}
                      </span>
                    </div>

                    {/* Circuit Breaker Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Circuit Breaker:</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
                          currentStep.circuitBreakerStatus === 'CLOSED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : currentStep.circuitBreakerStatus === 'HALF_OPEN'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                            : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            currentStep.circuitBreakerStatus === 'CLOSED'
                              ? 'bg-emerald-500'
                              : currentStep.circuitBreakerStatus === 'HALF_OPEN'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        {currentStep.circuitBreakerStatus}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {currentStep.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">
                        Active Cluster Primary:
                      </span>
                      <span className="font-bold text-slate-900">{currentStep.activePrimary}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">
                        Client Ingress Impact:
                      </span>
                      <span className="font-bold text-rose-700">{currentStep.clientImpact}</span>
                    </div>
                  </div>
                </div>

                {/* Visual Cluster Node Architecture Map */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Visual Node Topology at T+{currentStep.timeOffsetSec}s
                      </h4>
                    </div>

                    {/* Live Quorum Gauge */}
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Vote className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-slate-600">Quorum Consensus:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          hasQuorum
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {votingNodesCount} / {clusterSize} Votes ({hasQuorum ? 'Quorum Maintained' : 'Quorum Lost'})
                      </span>
                    </div>
                  </div>

                  {/* Node Grid Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                    {currentNodes.map((node, nodeIdx) => {
                      const isPrimary = node.role === 'primary' || node.role === 'promoted_leader';
                      const isCrashed = node.role === 'crashed' || node.state === 'OFFLINE';
                      const isIsolated = node.role === 'isolated' || node.state === 'FENCED';
                      const isVoting = node.state === 'VOTING';

                      return (
                        <div
                          key={nodeIdx}
                          className={`p-3.5 rounded-2xl border transition shadow-2xs space-y-2 relative overflow-hidden ${
                            isCrashed
                              ? 'bg-red-50/60 border-red-300'
                              : isIsolated
                              ? 'bg-amber-50/60 border-amber-300'
                              : isPrimary
                              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              {isPrimary ? '👑' : isCrashed ? '💥' : isIsolated ? '🛑' : '🛡️'}
                              {node.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                node.state === 'ONLINE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : node.state === 'OFFLINE'
                                  ? 'bg-red-200 text-red-900 font-bold'
                                  : node.state === 'VOTING'
                                  ? 'bg-purple-100 text-purple-800 animate-pulse'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {node.state}
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] text-slate-600">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cluster Role:</span>
                              <span className="font-bold text-slate-800 capitalize">
                                {node.role.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Heartbeat Ping:</span>
                              <span
                                className={`font-mono font-bold ${
                                  node.latencyMs > 0 ? 'text-slate-700' : 'text-red-600 font-black'
                                }`}
                              >
                                {node.latencyMs > 0 ? `${node.latencyMs}ms` : 'TIMEOUT'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5 border-t border-slate-200/60">
                              <span className="text-slate-400">Quorum Vote:</span>
                              <span
                                className={`font-mono text-[10px] font-bold ${
                                  node.quorumVote ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {node.quorumVote ? '✓ VALID' : '✗ NONE'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SRE Deep-Dive Tabs: Runbook, Config Patch & Shell Injection */}
          <div className="rounded-2xl bg-white border border-rose-200/80 shadow-xs overflow-hidden">
            {/* Tabs Header */}
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('runbook')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeCodeTab === 'runbook'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SRE Recovery Runbook
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('config')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeCodeTab === 'config'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-amber-400" /> HA Quorum Config Patch
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('script')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeCodeTab === 'script'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Chaos Injection Script
                </button>
              </div>

              {/* Copy Button */}
              <button
                type="button"
                onClick={() => {
                  const text =
                    activeCodeTab === 'runbook'
                      ? result.mitigationRunbook
                      : activeCodeTab === 'config'
                      ? result.recommendedConfigPatch
                      : result.chaosInjectionScript;
                  copyToClipboard(text, activeCodeTab);
                }}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-rose-300 hover:bg-slate-700 transition active:scale-95"
              >
                {copiedKey === activeCodeTab ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{copiedKey === activeCodeTab ? 'Copied to Clipboard' : 'Copy'}</span>
              </button>
            </div>

            {/* Code Box */}
            <div className="bg-slate-950 p-4 overflow-x-auto">
              <pre
                className={`font-mono text-xs leading-relaxed max-h-[380px] overflow-y-auto ${
                  activeCodeTab === 'runbook'
                    ? 'text-rose-200'
                    : activeCodeTab === 'config'
                    ? 'text-amber-200'
                    : 'text-cyan-200'
                }`}
              >
                {activeCodeTab === 'runbook' && result.mitigationRunbook}
                {activeCodeTab === 'config' && result.recommendedConfigPatch}
                {activeCodeTab === 'script' && result.chaosInjectionScript}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
