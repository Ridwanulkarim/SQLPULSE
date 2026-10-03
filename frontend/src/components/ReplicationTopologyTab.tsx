import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG, ReplicationTopologyResult } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { simulateReplicationTopology } from '../services/api';
import { Network, Copy, Check, RefreshCw, Server, Globe, Shield, Activity, AlertTriangle } from 'lucide-react';

interface ReplicationTopologyTabProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
}

export const ReplicationTopologyTab: React.FC<ReplicationTopologyTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [primaryRegion, setPrimaryRegion] = useState('us-east-1 (N. Virginia)');
  const [syncReplicasCount, setSyncReplicasCount] = useState<number>(1);
  const [asyncReplicasCount, setAsyncReplicasCount] = useState<number>(2);
  const [networkRttMs] = useState<number>(15);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReplicationTopologyResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSimulate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await simulateReplicationTopology({
        engine: selectedEngine,
        primaryRegion,
        syncReplicasCount,
        asyncReplicasCount,
        networkRttMs,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to simulate replication topology');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [selectedEngine]);

  const copyConfig = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.haConfigSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white shadow-xl shadow-blue-950/20 border border-blue-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-500/30 text-blue-200 border border-blue-400/40">
              High Availability &amp; Multi-Region Mesh
            </span>
            <span className="text-xs text-blue-300 font-medium">
              447 Database Engines • Quorum Standby &amp; Automated Failover Simulation
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-blue-400" />
            Multi-Region Cluster &amp; Replication Topology Visualizer
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-3xl">
            Simulate synchronous quorum replication, async read pool routing, and split-brain mitigation for {engineMeta.name}. Generate HA orchestration configs (`patroni.yml`, GTID, Redis Sentinel, MongoDB Replica Set).
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={onSelectEngine}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              Primary Region
            </label>
            <select
              value={primaryRegion}
              onChange={(e) => setPrimaryRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="us-east-1 (N. Virginia)">us-east-1 (N. Virginia)</option>
              <option value="us-west-2 (Oregon)">us-west-2 (Oregon)</option>
              <option value="eu-central-1 (Frankfurt)">eu-central-1 (Frankfurt)</option>
              <option value="ap-southeast-1 (Singapore)">ap-southeast-1 (Singapore)</option>
              <option value="ap-south-1 (Mumbai)">ap-south-1 (Mumbai)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Sync Standby Nodes (Quorum)
            </label>
            <select
              value={syncReplicasCount}
              onChange={(e) => setSyncReplicasCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value={1}>1 Sync Node (RPO=0, Low RTT)</option>
              <option value={2}>2 Sync Nodes (3-AZ Quorum)</option>
              <option value={0}>0 (Async Only / Lowest Write Latency)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-purple-600" />
              Async Read Pool Replicas
            </label>
            <select
              value={asyncReplicasCount}
              onChange={(e) => setAsyncReplicasCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value={1}>1 Read Replica</option>
              <option value={2}>2 Read Replicas (Load-balanced)</option>
              <option value={4}>4 Read Replicas (High-throughput)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSimulate}
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
              <span>Simulate HA Topology ➔</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Failover Manager
              </span>
              <div className="text-sm font-black text-slate-900 truncate font-mono">
                {result.failoverMechanism}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Consensus quorum active</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                Recovery Point (RPO)
              </span>
              <div className="text-sm font-black text-emerald-800 font-mono">
                {result.rpoEstimate}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">Zero data loss guarantee</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-cyan-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider block">
                Recovery Time (RTO)
              </span>
              <div className="text-sm font-black text-cyan-800 font-mono">
                {result.rtoEstimate}
              </div>
              <p className="text-[11px] text-cyan-700 font-medium">Automated failover election</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                Read Scaling Factor
              </span>
              <div className="text-sm font-black text-purple-950 font-mono">
                {result.readScalingFactor}
              </div>
              <p className="text-[11px] text-purple-700 font-medium">
                {result.totalNodesCount} Total Active Nodes
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              Live Cluster Node Mesh &amp; Health State ({engineMeta.name})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.nodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border transition-all ${
                    node.role === 'primary'
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                      : node.role === 'sync_standby'
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : node.role === 'dr_replica'
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-purple-50/70 border-purple-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 font-display">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          node.role === 'primary'
                            ? 'bg-emerald-500 animate-pulse'
                            : node.role === 'sync_standby'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-purple-500'
                        }`}
                      />
                      {node.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-black uppercase ${
                        node.role === 'primary'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : node.role === 'sync_standby'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {node.role.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 mb-3 flex items-center gap-1 font-medium">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    {node.region}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-purple-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold">REPLICATION LAG</span>
                      <span className="text-slate-900 font-bold">{node.replicationLagMs} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold">READ CAPACITY</span>
                      <span className="text-slate-900 font-bold">{node.readCapacityQps.toLocaleString()} QPS</span>
                    </div>
                  </div>

                  {node.quorumVote && (
                    <div className="mt-2.5 text-[11px] font-mono text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                      <Shield className="w-3 h-3 text-emerald-600" /> Raft / Paxos Quorum Voter
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600" />
                Automated Failover Execution Sequence
              </h3>
              <div className="space-y-3">
                {result.failoverSimulationPlan.map((step) => (
                  <div key={step.step} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {step.title}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-700 font-bold bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                          +{step.durationMs}ms
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {step.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      High-Availability Cluster Configuration
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={copyConfig}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copied ? 'Copied' : 'Copy Config'}</span>
                  </button>
                </div>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-blue-200 font-mono text-xs overflow-x-auto leading-relaxed max-h-[380px] selection:bg-blue-600 selection:text-white">
                  {result.haConfigSnippet}
                </pre>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-950 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Cluster Reliability Best Practices:
            </h3>
            <ul className="space-y-1.5">
              {result.expertRecommendations.map((rec, i) => (
                <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
