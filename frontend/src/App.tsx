import { useState, useEffect } from 'react';
import { Header, AppTabId, AppTheme } from './components/Header';
import { BrandLogo } from './components/BrandLogo';
import { MetricsOverview } from './components/MetricsOverview';
import { PlanInput } from './components/PlanInput';
import { VisualPlanGraph } from './components/VisualPlanGraph';
import { BottlenecksList } from './components/BottlenecksList';
import { MigrationLinterTab } from './components/MigrationLinterTab';
import { QueryAdvisorTab } from './components/QueryAdvisorTab';
import { LiveSqlSandboxTab } from './components/LiveSqlSandboxTab';
import { TranspilerTab } from './components/TranspilerTab';
import { ConfigTunerTab } from './components/ConfigTunerTab';
import { DeadlockSimulatorTab } from './components/DeadlockSimulatorTab';
import { DisasterRecoveryTab } from './components/DisasterRecoveryTab';
import { QuerySynthesizerTab } from './components/QuerySynthesizerTab';
import { ConnectHubTab } from './components/ConnectHubTab';
import { PartitionArchitectTab } from './components/PartitionArchitectTab';
import { LogInspectorTab } from './components/LogInspectorTab';
import { BloatAnalyzerTab } from './components/BloatAnalyzerTab';
import { ReplicationTopologyTab } from './components/ReplicationTopologyTab';
import { SecurityRbacTab } from './components/SecurityRbacTab';
import { MockGeneratorTab } from './components/MockGeneratorTab';
import { FinOpsStudioTab } from './components/FinOpsStudioTab';
import { IndexDoctorTab } from './components/IndexDoctorTab';
import { PiiSanitizerTab } from './components/PiiSanitizerTab';
import { QueryRewriterTab } from './components/QueryRewriterTab';
import { DatabaseComparisonTab } from './components/DatabaseComparisonTab';
import { DatabaseSizingTab } from './components/DatabaseSizingTab';
import { SchemaDiffTab } from './components/SchemaDiffTab';
import { OrmProfilerTab } from './components/OrmProfilerTab';
import { ProductionReadinessTab } from './components/ProductionReadinessTab';
import { ChaosSimulatorTab } from './components/ChaosSimulatorTab';
import { CdcOutboxTab } from './components/CdcOutboxTab';
import { VectorRpmTab } from './components/VectorRpmTab';
import { PlanComparisonModal } from './components/PlanComparisonModal';
import { ExportReportModal } from './components/ExportReportModal';
import { ShareModal } from './components/ShareModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { analyzeQueryPlan, fetchSamples, saveReportPermalink } from './services/api';
import { PlanAnalysisResult, DatabaseEngine, DATABASE_CATALOG } from './types';
import { GitCompare, Database, Search } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<AppTabId>('plan');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('sqlpulse_theme') as AppTheme) || 'theme-light';
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Sync theme with HTML root class and localStorage
  useEffect(() => {
    localStorage.setItem('sqlpulse_theme', currentTheme);
    if (currentTheme === 'theme-dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentTheme]);

  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>('postgres');
  const [analysisResult, setAnalysisResult] = useState<PlanAnalysisResult | null>(null);
  const [rawPlanInput, setRawPlanInput] = useState<any>(null);
  const [rawQuery, setRawQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Comparison State
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [baselineResult, setBaselineResult] = useState<PlanAnalysisResult | null>(null);
  const [optimizedResult, setOptimizedResult] = useState<PlanAnalysisResult | null>(null);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K)
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

  const handleAnalyze = async (planText: string, query?: string, engine: DatabaseEngine = selectedEngine) => {
    setIsLoading(true);
    try {
      let parsedPlan = planText;
      try {
        parsedPlan = JSON.parse(planText);
      } catch (e) {
        // Leave as string if not valid JSON
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
      alert(err.message || 'Failed to load sample plan');
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
      {/* Ambient background glow orbs */}
      {currentTheme === 'theme-lavender' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-purple-200/40 blur-[100px]" />
          <div className="absolute top-[20%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-indigo-100/50 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-violet-200/30 blur-[90px]" />
        </div>
      )}

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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 relative z-10">
        {/* Next-Elite Style Clean Minimalist Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-4 pt-2 pb-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            SQLPulse Engine • 447 Databases • 25 Professional Studios
          </div>

          <div className="flex items-center justify-center gap-3.5">
            <BrandLogo size="lg" />
            <h1 className="text-4xl sm:text-6xl font-brand font-extrabold tracking-[-0.035em] text-slate-950 dark:text-white flex items-center">
              SQL<span className="text-[#0096b3] dark:text-[#00f0ff]">Pulse</span>
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Enterprise database performance tuning, zero-downtime migrations, Cloud FinOps cost sizer, index doctor, and PII anonymization across 447 relational, NoSQL, and vector engines.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="px-4 py-2 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm transition active:scale-95 flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>⌘K Spotlight Studio Search</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 transition active:scale-95 flex items-center gap-1.5 shadow-xs"
            >
              <Database className="w-3.5 h-3.5 text-zinc-500" />
              <span>Explore 447 Database Matrix</span>
            </button>
          </div>
        </div>

        {activeTab === 'plan' && (
          <>
            {/* Input Section with Multi-Database Selector */}
            <PlanInput
              onAnalyze={handleAnalyze}
              isLoading={isLoading}
              onLoadSample={handleLoadSample}
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />

            {/* Plan Regression Comparison Trigger Bar */}
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

            {/* Analysis Dashboard */}
            {analysisResult && (
              <div className="space-y-8">
                {/* 1. Metrics Score & Cards */}
                <MetricsOverview data={analysisResult} />

                {/* 2. Visual Execution Tree Graph & Node Inspector */}
                <VisualPlanGraph nodes={analysisResult.graph.nodes} />

                {/* 3. Bottlenecks & 1-Click Fixes */}
                <BottlenecksList
                  bottlenecks={analysisResult.bottlenecks}
                  recommendations={analysisResult.recommendations}
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'migration' && <MigrationLinterTab />}

        {activeTab === 'advisor' && <QueryAdvisorTab />}

        {activeTab === 'sandbox' && <LiveSqlSandboxTab />}

        {activeTab === 'transpiler' && <TranspilerTab />}

        {activeTab === 'tuner' && <ConfigTunerTab />}

        {activeTab === 'deadlock' && <DeadlockSimulatorTab />}

        {activeTab === 'disaster' && <DisasterRecoveryTab />}

        {activeTab === 'synthesizer' && <QuerySynthesizerTab />}

        {activeTab === 'connect' && <ConnectHubTab />}

        {activeTab === 'partition' && <PartitionArchitectTab />}

        {activeTab === 'logs' && <LogInspectorTab />}

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

        {activeTab === 'matrix' && <DatabaseComparisonTab />}

        {activeTab === 'sizing' && <DatabaseSizingTab />}

        {activeTab === 'schema_diff' && <SchemaDiffTab />}

        {activeTab === 'orm_profiler' && <OrmProfilerTab />}

        {activeTab === 'production_readiness' && <ProductionReadinessTab />}

        {activeTab === 'chaos_simulator' && <ChaosSimulatorTab />}

        {activeTab === 'cdc_outbox' && <CdcOutboxTab />}

        {activeTab === 'vector_tuner' && <VectorRpmTab />}
      </main>

      {/* Global Spotlight Search Modal (Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={setActiveTab}
        onSelectEngine={(engineId) => {
          setSelectedEngine(engineId);
          setActiveTab('plan');
        }}
      />

      {/* Comparison Modal */}
      <PlanComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        baselinePlan={baselineResult}
        optimizedPlan={optimizedResult}
      />

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        result={analysisResult}
        query={rawQuery}
      />

      {/* Share Modal */}
      {shareUrl && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          shareUrl={shareUrl}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-purple-200/50 py-6 text-center text-xs text-slate-500 relative z-10 font-sans">
        <p>
          SQLPulse — Universal Database Engineering Studio • {DATABASE_CATALOG.length} Engines Supported Across SQL, NoSQL, Vector AI, Graph, Time-Series &amp; In-Memory. Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-purple-200 shadow-xs">⌘K</kbd> to search anytime.
        </p>
      </footer>
    </div>
  );
}

export default App;
