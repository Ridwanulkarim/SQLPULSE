import { useState, useEffect, lazy, Suspense } from 'react';
import { Header, AppTabId, AppTheme } from './components/Header';
import { BrandLogo } from './components/BrandLogo';
import { StudioSidebar } from './components/StudioSidebar';
import { MetricsOverview } from './components/MetricsOverview';
import { PlanInput } from './components/PlanInput';
import { VisualPlanGraph } from './components/VisualPlanGraph';
import { BottlenecksList } from './components/BottlenecksList';
import { analyzeQueryPlan, fetchSamples, saveReportPermalink } from './services/api';
import { PlanAnalysisResult, DatabaseEngine, DATABASE_CATALOG, getEngineProfile, StudioId } from './types';
import { GitCompare, Database, Search, AlertTriangle } from 'lucide-react';

const TAB_TO_STUDIO_MAP: Partial<Record<AppTabId, StudioId>> = {
  plan: 'plan',
  migration: 'migration',
  advisor: 'query-advise',
  sandbox: 'query-advise',
  transpiler: 'transpile',
  tuner: 'config-tuner',
  deadlock: 'deadlock-simulate',
  disaster: 'disaster-recovery',
  synthesizer: 'synthesize-query',
  connect: 'connect-hub',
  partition: 'partition-plan',
  logs: 'inspect-logs',
  bloat: 'bloat',
  replication: 'replication',
  security: 'security-rbac',
  mock: 'mock-data',
  finops: 'finops',
  doctor: 'index-doctor',
  sanitizer: 'pii-sanitizer',
  rewriter: 'query-rewriter',
  schema_diff: 'schema-diff',
  orm_profiler: 'orm-profile',
  production_readiness: 'production-readiness',
  chaos_simulator: 'chaos-simulate',
  cdc_outbox: 'cdc-outbox',
  vector_tuner: 'vector-tune',
};

const SIMULATION_STUDIOS: Set<AppTabId> = new Set([
  'plan',
  'deadlock',
  'disaster',
  'chaos_simulator',
  'finops',
  'replication',
  'sandbox',
]);

const MigrationLinterTab = lazy(() => import('./components/MigrationLinterTab').then((m) => ({ default: m.MigrationLinterTab })));
const QueryAdvisorTab = lazy(() => import('./components/QueryAdvisorTab').then((m) => ({ default: m.QueryAdvisorTab })));
const LiveSqlSandboxTab = lazy(() => import('./components/LiveSqlSandboxTab').then((m) => ({ default: m.LiveSqlSandboxTab })));
const TranspilerTab = lazy(() => import('./components/TranspilerTab').then((m) => ({ default: m.TranspilerTab })));
const ConfigTunerTab = lazy(() => import('./components/ConfigTunerTab').then((m) => ({ default: m.ConfigTunerTab })));
const DeadlockSimulatorTab = lazy(() => import('./components/DeadlockSimulatorTab').then((m) => ({ default: m.DeadlockSimulatorTab })));
const DisasterRecoveryTab = lazy(() => import('./components/DisasterRecoveryTab').then((m) => ({ default: m.DisasterRecoveryTab })));
const QuerySynthesizerTab = lazy(() => import('./components/QuerySynthesizerTab').then((m) => ({ default: m.QuerySynthesizerTab })));
const ConnectHubTab = lazy(() => import('./components/ConnectHubTab').then((m) => ({ default: m.ConnectHubTab })));
const PartitionArchitectTab = lazy(() => import('./components/PartitionArchitectTab').then((m) => ({ default: m.PartitionArchitectTab })));
const LogInspectorTab = lazy(() => import('./components/LogInspectorTab').then((m) => ({ default: m.LogInspectorTab })));
const BloatAnalyzerTab = lazy(() => import('./components/BloatAnalyzerTab').then((m) => ({ default: m.BloatAnalyzerTab })));
const ReplicationTopologyTab = lazy(() => import('./components/ReplicationTopologyTab').then((m) => ({ default: m.ReplicationTopologyTab })));
const SecurityRbacTab = lazy(() => import('./components/SecurityRbacTab').then((m) => ({ default: m.SecurityRbacTab })));
const MockGeneratorTab = lazy(() => import('./components/MockGeneratorTab').then((m) => ({ default: m.MockGeneratorTab })));
const FinOpsStudioTab = lazy(() => import('./components/FinOpsStudioTab').then((m) => ({ default: m.FinOpsStudioTab })));
const IndexDoctorTab = lazy(() => import('./components/IndexDoctorTab').then((m) => ({ default: m.IndexDoctorTab })));
const PiiSanitizerTab = lazy(() => import('./components/PiiSanitizerTab').then((m) => ({ default: m.PiiSanitizerTab })));
const QueryRewriterTab = lazy(() => import('./components/QueryRewriterTab').then((m) => ({ default: m.QueryRewriterTab })));
const DatabaseComparisonTab = lazy(() => import('./components/DatabaseComparisonTab').then((m) => ({ default: m.DatabaseComparisonTab })));
const DatabaseSizingTab = lazy(() => import('./components/DatabaseSizingTab').then((m) => ({ default: m.DatabaseSizingTab })));
const SchemaDiffTab = lazy(() => import('./components/SchemaDiffTab').then((m) => ({ default: m.SchemaDiffTab })));
const OrmProfilerTab = lazy(() => import('./components/OrmProfilerTab').then((m) => ({ default: m.OrmProfilerTab })));
const ProductionReadinessTab = lazy(() => import('./components/ProductionReadinessTab').then((m) => ({ default: m.ProductionReadinessTab })));
const ChaosSimulatorTab = lazy(() => import('./components/ChaosSimulatorTab').then((m) => ({ default: m.ChaosSimulatorTab })));
const CdcOutboxTab = lazy(() => import('./components/CdcOutboxTab').then((m) => ({ default: m.CdcOutboxTab })));
const VectorRpmTab = lazy(() => import('./components/VectorRpmTab').then((m) => ({ default: m.VectorRpmTab })));

const PlanComparisonModal = lazy(() => import('./components/PlanComparisonModal').then((m) => ({ default: m.PlanComparisonModal })));
const ExportReportModal = lazy(() => import('./components/ExportReportModal').then((m) => ({ default: m.ExportReportModal })));
const ShareModal = lazy(() => import('./components/ShareModal').then((m) => ({ default: m.ShareModal })));
const CommandPaletteModal = lazy(() => import('./components/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal })));

function StudioLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3 min-h-[350px] glass-card-light rounded-2xl border border-purple-200/60">
      <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-500 font-mono">Loading studio module...</span>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTabId>('plan');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('sqlpulse_theme') as AppTheme) || 'theme-light';
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sqlpulse_theme', currentTheme);
    if (currentTheme === 'theme-dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentTheme]);

  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>('postgres');
  const currentEngineId = typeof selectedEngine === 'object' ? (selectedEngine as any)?.id : selectedEngine;
  const currentProfile = getEngineProfile(currentEngineId);
  const currentStudioId = TAB_TO_STUDIO_MAP[activeTab];
  const currentCapability = currentStudioId ? currentProfile.capabilities[currentStudioId] : 'native';
  const unsupportedReason = currentStudioId ? currentProfile.unsupportedReason?.[currentStudioId] : undefined;
  const isSimulation = SIMULATION_STUDIOS.has(activeTab);

  const [analysisResult, setAnalysisResult] = useState<PlanAnalysisResult | null>(null);
  const [rawPlanInput, setRawPlanInput] = useState<any>(null);
  const [rawQuery, setRawQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [baselineResult, setBaselineResult] = useState<PlanAnalysisResult | null>(null);
  const [optimizedResult, setOptimizedResult] = useState<PlanAnalysisResult | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (activeTab === 'plan') {
      handleLoadSample('slow', selectedEngine);
    }
  }, [selectedEngine, activeTab]);

  const handleAnalyze = async (planText: string, query?: string, engine: DatabaseEngine = selectedEngine) => {
    setIsLoading(true);
    try {
      let parsedPlan = planText;
      try {
        parsedPlan = JSON.parse(planText);
      } catch (e) {
        // Keep string if raw format
      }

      const res = await analyzeQueryPlan(parsedPlan, query, engine);
      setAnalysisResult(res);
      setRawPlanInput(parsedPlan);
      if (query) setRawQuery(query);
    } catch (err: any) {
      alert(err.message || 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getSampleQueryForEngine = (engine: DatabaseEngine): string => {
    switch (engine) {
      case 'weaviate':
      case 'milvus':
      case 'pinecone':
      case 'qdrant':
        return 'client.graphql.get.with_near_vector({ vector: [0.14, -0.82, ...], certainty: 0.85 })';
      case 'elasticsearch':
      case 'meilisearch':
      case 'solr':
        return 'GET /articles/_search { "query": { "match": { "content": "distributed databases" } } }';
      case 'neo4j':
      case 'memgraph':
      case 'dgraph':
        return 'MATCH (u:User {email: "alex@example.com"})-[:PLACED]->(o:Order) RETURN o;';
      case 'redis':
      case 'keydb':
      case 'memcached':
        return 'SCAN 0 MATCH session:user:* COUNT 100';
      case 'influxdb':
      case 'timescale':
      case 'prometheus':
        return 'from(bucket: "telemetry") |> range(start: -1h) |> filter(fn: (r) => r.tag_host == "server-01")';
      case 'cassandra':
      case 'scylladb':
      case 'hbase':
        return 'SELECT * FROM user_events WHERE user_id = 94812 AND event_timestamp >= 1696238120;';
      case 'mongodb':
      case 'dynamodb':
      case 'firestore':
      case 'couchdb':
        return 'db.orders.find({ status: "completed" }).sort({ createdAt: -1 })';
      default:
        return "SELECT * FROM orders WHERE status = 'completed' AND total_amount > 150.00;";
    }
  };

  const handleLoadSample = async (type: 'slow' | 'optimized', engine: DatabaseEngine = selectedEngine) => {
    setIsLoading(true);
    try {
      const samples = await fetchSamples(engine);
      const planToUse = type === 'slow' ? samples.slowPlan : samples.optimizedPlan;
      const sampleQuery = getSampleQueryForEngine(engine);

      const res = await analyzeQueryPlan(planToUse, sampleQuery, engine);
      setAnalysisResult(res);
      setRawPlanInput(planToUse);
      setRawQuery(sampleQuery);
    } catch (err: any) {
      console.warn('Failed to load sample plan for engine:', engine, err);
      if (activeTab === 'plan') {
        alert(err.message || 'Failed to load sample plan');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenComparison = async () => {
    setIsLoading(true);
    try {
      const samples = await fetchSamples(selectedEngine);
      const slowRes = await analyzeQueryPlan(samples.slowPlan, getSampleQueryForEngine(selectedEngine), selectedEngine);
      const optRes = await analyzeQueryPlan(samples.optimizedPlan, getSampleQueryForEngine(selectedEngine), selectedEngine);
      setBaselineResult(slowRes);
      setOptimizedResult(optRes);
      setIsCompareOpen(true);
    } catch (err: any) {
      alert('Failed to prepare plan diff: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!analysisResult || !rawPlanInput) return;
    try {
      const res = await saveReportPermalink(
        `${selectedEngine.toUpperCase()} Query Optimization Report`,
        rawQuery,
        rawPlanInput
      );
      setShareUrl(res.shareUrl);
      setIsShareOpen(true);
    } catch (err: any) {
      alert('Failed to save report: ' + err.message);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col relative ${currentTheme} font-sans`}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-[55vw] h-[45vw] max-w-[700px] max-h-[500px] bg-gradient-to-br from-violet-200/20 via-indigo-100/10 to-transparent blur-[110px]" />
      </div>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onShareClick={handleShare}
        onExportClick={() => setIsExportOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        hasAnalysis={!!analysisResult}
        currentTheme={currentTheme}
        onSelectTheme={setCurrentTheme}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Studio Sidebar (Matching Image 1 On This Page navigation) */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-3 select-none">
          <StudioSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </aside>

        {/* Right Active Studio Workspace */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* Mobile Studio Quick Switcher */}
          <div className="lg:hidden flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Studio</span>
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Switch Studio (⌘K)</span>
            </button>
          </div>

          {currentStudioId && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 sm:py-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Target Engine:</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="text-base leading-none">🗄️</span>
                  {currentProfile.name}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                  dialect: {currentProfile.dialect}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  currentCapability === 'native'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : currentCapability === 'adapted'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {currentCapability === 'native' ? '● Native Engine Support' : currentCapability === 'adapted' ? '◈ Adapted Family Profile' : '▲ Preview'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isSimulation && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                    <span>⚡ Simulation Model</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition flex items-center gap-1.5"
                >
                  <Search className="w-3 h-3 text-zinc-500" />
                  <span>⌘K Studio Search</span>
                </button>
              </div>
            </div>
          )}

          {currentCapability === 'unsupported' && (
            <div className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100">
                  Not applicable for {currentProfile.name}
                </h4>
                <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  {unsupportedReason || `The "${activeTab}" studio features do not directly apply to ${currentProfile.name} (${currentProfile.family}). Equivalent architectural concepts and alternatives are detailed in the engine profile documentation.`}
                </p>
              </div>
            </div>
          )}

        <Suspense fallback={<StudioLoadingFallback />}>
          {activeTab === 'plan' && (
            <>
              <PlanInput
                onAnalyze={handleAnalyze}
                isLoading={isLoading}
                onLoadSample={handleLoadSample}
                selectedEngine={selectedEngine}
                onSelectEngine={setSelectedEngine}
                rawPlanInput={rawPlanInput}
                rawQueryInput={rawQuery}
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900">
                    Side-by-Side Regression Diff Studio:
                  </span>
                  <span className="text-xs text-slate-500 hidden md:inline">
                    Compare unindexed baseline vs optimized plan latency and cost deltas.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenComparison}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Launch Plan Diff &amp; Delta Studio</span>
                </button>
              </div>

              {analysisResult && (
                <div className="space-y-8">
                  {Boolean(analysisResult.isFallbackAnalysis) && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-3 shadow-xs">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold">
                          Generic Relational Heuristics Fallback Notice ({analysisResult.engineMetadata?.name || DATABASE_CATALOG.find(db => db.id === selectedEngine)?.name || selectedEngine})
                        </p>
                        <p className="text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                          {analysisResult.fallbackNotice || `A dedicated native execution plan parser for ${analysisResult.engineMetadata?.name || DATABASE_CATALOG.find(db => db.id === selectedEngine)?.name || selectedEngine} is currently in preview. The plan metrics, cost models, and recommendations below are approximated using general relational heuristics. Please verify indexing syntax and query hints against official documentation before applying them in production.`}
                        </p>
                      </div>
                    </div>
                  )}
                  <MetricsOverview data={analysisResult} />
                  <VisualPlanGraph nodes={analysisResult.graph.nodes} />
                  <BottlenecksList
                    bottlenecks={analysisResult.bottlenecks}
                    recommendations={analysisResult.recommendations}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'migration' && (
            <MigrationLinterTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'advisor' && (
            <QueryAdvisorTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'sandbox' && (
            <LiveSqlSandboxTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'transpiler' && (
            <TranspilerTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'tuner' && (
            <ConfigTunerTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'deadlock' && (
            <DeadlockSimulatorTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'disaster' && (
            <DisasterRecoveryTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'synthesizer' && (
            <QuerySynthesizerTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'connect' && (
            <ConnectHubTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'partition' && (
            <PartitionArchitectTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'logs' && (
            <LogInspectorTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'bloat' && (
            <BloatAnalyzerTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'replication' && (
            <ReplicationTopologyTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'security' && (
            <SecurityRbacTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'mock' && (
            <MockGeneratorTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'finops' && (
            <FinOpsStudioTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'doctor' && (
            <IndexDoctorTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'sanitizer' && (
            <PiiSanitizerTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'rewriter' && (
            <QueryRewriterTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'matrix' && (
            <DatabaseComparisonTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'sizing' && (
            <DatabaseSizingTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'schema_diff' && (
            <SchemaDiffTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'orm_profiler' && (
            <OrmProfilerTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'production_readiness' && (
            <ProductionReadinessTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'chaos_simulator' && (
            <ChaosSimulatorTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'cdc_outbox' && (
            <CdcOutboxTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
          {activeTab === 'vector_tuner' && (
            <VectorRpmTab
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          )}
        </Suspense>
        </div>
      </main>

      <Suspense fallback={null}>
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectTab={setActiveTab}
          onSelectEngine={(engineId) => {
            setSelectedEngine(engineId);
            setActiveTab('plan');
          }}
        />

        <PlanComparisonModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          baselinePlan={baselineResult}
          optimizedPlan={optimizedResult}
        />

        <ExportReportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          result={analysisResult}
          query={rawQuery}
        />

        {shareUrl && (
          <ShareModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            shareUrl={shareUrl}
          />
        )}
      </Suspense>

      <footer className="border-t border-purple-200/50 py-6 text-center text-xs text-slate-500 relative z-10 font-sans">
        <p>
          SQLPulse — Universal Database Engineering Studio • {DATABASE_CATALOG.length} Engines Cataloged Across SQL, NoSQL, Vector, Graph, Time-Series &amp; In-Memory. Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-purple-200 shadow-xs">⌘K</kbd> to search anytime.
        </p>
      </footer>
    </div>
  );
}

export default App;
