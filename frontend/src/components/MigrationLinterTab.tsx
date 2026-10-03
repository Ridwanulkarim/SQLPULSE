import React, { useState, useEffect } from 'react';
import { lintMigrationSql } from '../services/api';
import { MigrationAnalysisResult, DatabaseEngine, DATABASE_CATALOG } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { CiCdLinterModal } from './CiCdLinterModal';
import { ShieldCheck, ShieldAlert, Copy, Check, Terminal, Play, Lock, BookOpen, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface MigrationLinterTabProps {
  sampleSql?: string;
}

export const MigrationLinterTab: React.FC<MigrationLinterTabProps> = ({
  sampleSql,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>('postgres');
  const [sqlText, setSqlText] = useState(
    sampleSql ||
      `-- PostgreSQL Unsafe Schema Migration Script\nCREATE INDEX idx_orders_customer_id ON orders(customer_id);\nALTER TABLE order_items ADD CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders(id);\nALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL;\nALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(18, 4);`
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MigrationAnalysisResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRunbook, setShowRunbook] = useState(false);
  const [showLockMatrix, setShowLockMatrix] = useState(true);
  const [showCiCdModal, setShowCiCdModal] = useState(false);

  const currentDb = DATABASE_CATALOG.find((d) => d.id === selectedEngine) || DATABASE_CATALOG[0];

  const handleLint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sqlText.trim()) return;

    setIsLoading(true);
    try {
      const res = await lintMigrationSql(sqlText, selectedEngine);
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to lint migration');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-lint default script on mount or when engine changes
  useEffect(() => {
    handleLint();
  }, [selectedEngine]);

  const handleCopy = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };


  const scenarios = [
    {
      label: 'PostgreSQL 100M Rows Index Lock',
      icon: '🐘',
      engine: 'postgres',
      sql: `-- PostgreSQL: Heavy Index Creation on 100M rows table\n-- Taking SHARE lock blocks all concurrent INSERT, UPDATE, DELETE queries\nCREATE INDEX idx_user_activity_user_id ON user_activity(user_id, created_at);`,
    },
    {
      label: 'MySQL / MariaDB Online DDL',
      icon: '🐬',
      engine: 'mysql',
      sql: `-- MySQL / InnoDB: Adding Index without ALGORITHM=INPLACE, LOCK=NONE\n-- Risks falling back to legacy COPY algorithm, locking table against writes\nCREATE INDEX idx_customer_orders ON orders (customer_id, order_date);`,
    },
    {
      label: 'ClickHouse / Snowflake Mutation',
      icon: '❄️',
      engine: 'clickhouse',
      sql: `-- ClickHouse / Snowflake: Heavy Asynchronous Mutation\n-- Rewrites all physical data parts across distributed storage\nALTER TABLE events UPDATE status = 'archived' WHERE event_date < '2024-01-01';`,
    },
    {
      label: 'MongoDB Foreground Index Lock',
      icon: '🍃',
      engine: 'mongodb',
      sql: `// MongoDB: Foreground Index Build blocks all collection operations\ndb.orders.createIndex({ customer_id: 1, created_at: -1 });`,
    },
    {
      label: 'Redis Blocking KEYS * Command',
      icon: '⚡',
      engine: 'redis',
      sql: `// Redis / In-Memory: O(N) Blocking command locks single-threaded event loop\nKEYS session:user:*\nFLUSHDB;`,
    },
    {
      label: 'Cassandra Tombstone Hazard',
      icon: '📦',
      engine: 'cassandra',
      sql: `-- Cassandra / ScyllaDB: Column Drop Tombstone Hazard\nALTER TABLE user_events DROP legacy_payload;`,
    },
    {
      label: 'SQL Server Online Index',
      icon: '🏢',
      engine: 'mssql',
      sql: `-- SQL Server: Index creation without ONLINE = ON takes Sch-M lock\nCREATE NONCLUSTERED INDEX idx_payments_amount ON payments (amount, created_at);`,
    },
    {
      label: 'SQLite / Turso 12-Step Rebuild',
      icon: '⚡',
      engine: 'sqlite',
      sql: `-- SQLite: Dropping column requires 12-step table rebuild\nALTER TABLE users DROP COLUMN phone_number;`,
    },
  ];

  const generateRunbookScript = () => {
    return `-- ===================================================================
-- ZERO-DOWNTIME PRODUCTION MIGRATION RUNBOOK
-- Target Engine: ${currentDb.name} (#${currentDb.rank || 'N/A'} DB-Engines Rank)
-- Category: ${currentDb.categoryLabel}
-- ===================================================================

-- 1. PRE-FLIGHT SAFEGUARD (Check active connections & locks)
-- Verify no long-running transactions (> 5s) are holding table metadata locks.

-- 2. LOCK TIMEOUT SAFEGUARD
-- Always configure 2-second lock timeout to prevent queue poisoning.

-- 3. PHASED ZERO-DOWNTIME EXECUTION
${result?.findings.map((f) => f.safeAlternativeSql).join('\n\n') || currentDb.commandHint}

-- 4. POST-MIGRATION VERIFICATION & REPLICATION CHECK
-- Verify index status and monitor replica lag.

-- 5. AUTOMATED ROLLBACK PLAN
-- Revert safely if performance regression or lock contention spikes.`;
  };

  return (
    <div className="space-y-6">
      {/* Top Input Box */}
      <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Terminal className="w-4 h-4 text-purple-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Universal Zero-Downtime DDL Migration Safety Linter
              </h2>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                All {DATABASE_CATALOG.length} DBs Supported
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any of the {DATABASE_CATALOG.length} database engines to lint schema migrations for exclusive table locks, mutations, and outage hazards.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Universal 447 Database Engine Selector */}
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={(eng) => {
                setSelectedEngine(eng);
              }}
              label="Dialect"
            />

            {/* Permanent CI/CD Linter Button */}
            <button
              type="button"
              onClick={() => setShowCiCdModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-95 shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5 shrink-0 active:scale-95"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>🚀 Export CI/CD Linter</span>
            </button>
          </div>
        </div>

        {/* Real-World Outage Incident Scenarios */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-900/70 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            Quick-Load Real-World Outage Scenarios across Multi-DB Architectures:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {scenarios.map((sc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedEngine(sc.engine);
                  setSqlText(sc.sql);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition flex items-center gap-1.5 shadow-sm border ${
                  selectedEngine === sc.engine
                    ? 'bg-purple-100/90 text-purple-950 border-purple-300 font-bold'
                    : 'bg-white/80 hover:bg-purple-50 text-slate-800 border-purple-200/70'
                }`}
              >
                <span>{sc.icon}</span>
                <span>{sc.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleLint} className="space-y-3">
          <textarea
            rows={6}
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            placeholder={`-- Paste your ${currentDb.name} DDL or migration commands here...\n${currentDb.commandHint}`}
            className="w-full rounded-xl px-3.5 py-3 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 bg-slate-900 border border-slate-800 text-emerald-400 focus:ring-purple-400/50 shadow-md transition leading-relaxed"
            required
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                Evaluating for <span className="font-bold text-slate-700">{currentDb.name}</span> ({currentDb.categoryLabel}).
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !sqlText.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:opacity-95 shadow-lg shadow-purple-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Linting {currentDb.name} Script...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Lint {currentDb.name} Lock Hazards
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg ${
              result.isSafeForProduction
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/90 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <div
                className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${
                  result.isSafeForProduction
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-100 text-rose-700 border border-rose-200'
                }`}
              >
                {result.isSafeForProduction ? (
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {result.isSafeForProduction
                    ? `Safe for Zero-Downtime Production Deployment (${currentDb.name})`
                    : `Hazardous Operations Detected: High Risk of Locks & Outage in ${currentDb.name}`}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {result.findings.length} findings across {result.totalStatements} statements evaluated for {currentDb.name} ({currentDb.categoryLabel}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-between w-full md:w-auto flex-wrap sm:flex-nowrap pt-2 md:pt-0 border-t md:border-t-0 border-purple-200/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCiCdModal(true)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>🚀 CI/CD Linter</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRunbook(!showRunbook)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-700" />
                  <span>{showRunbook ? 'Hide Runbook' : '✨ Runbook'}</span>
                </button>
              </div>

              <div className="text-right pl-2 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Safety Score</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {result.riskScore} <span className="text-xs text-slate-400">/ 100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Production Runbook Modal/Drawer */}
          {showRunbook && (
            <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-3 border border-purple-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Production Zero-Downtime Deployment Runbook ({currentDb.name})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(generateRunbookScript(), 'runbook_script')}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition shadow-sm"
                >
                  {copiedId === 'runbook_script' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-purple-600" />
                      Copy Runbook Script
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono border border-slate-800 overflow-x-auto shadow-inner whitespace-pre-wrap leading-relaxed">
                {generateRunbookScript()}
              </pre>
            </div>
          )}

          {/* Detailed Findings */}
          <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              Safety Violations & Zero-Downtime Safe Rewrites for {currentDb.name}
            </h3>

            {result.findings.map((finding) => (
              <div
                key={finding.id}
                className="p-4 rounded-xl border border-purple-200/80 bg-white/90 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                        {finding.severity}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{finding.title}</h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{finding.reason}</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded whitespace-nowrap">
                    Lock: {finding.lockLevel}
                  </span>
                </div>

                {/* Unsafe Statement */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-700 block mb-1">
                    Unsafe Statement:
                  </span>
                  <pre className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs font-mono text-rose-900 overflow-x-auto">
                    {finding.unsafeSql}
                  </pre>
                </div>

                {/* Safe Fix */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-700">
                      Zero-Downtime Safe Alternative Rewrite:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(finding.safeAlternativeSql, finding.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition shadow-sm"
                    >
                      {copiedId === finding.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-emerald-600" />
                          Copy Safe SQL
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs font-mono text-emerald-950 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {finding.safeAlternativeSql}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zero-Downtime Knowledge Hub & Lock Risk Matrix */}
      <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowLockMatrix(!showLockMatrix)}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Universal Zero-Downtime Engineering Hub & Lock Hazard Matrix
            </h3>
          </div>
          <button className="text-slate-400 hover:text-slate-600 transition">
            {showLockMatrix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showLockMatrix && (
          <div className="space-y-4 pt-2 border-t border-purple-200/50">
            {/* Table Lock Hierarchy Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-200/70 text-slate-500 font-semibold bg-purple-50/50">
                    <th className="py-2 px-3">Lock Mode / Hazard</th>
                    <th className="py-2 px-3">Affected Database Engines</th>
                    <th className="py-2 px-3">Blocks Reads?</th>
                    <th className="py-2 px-3">Blocks Writes?</th>
                    <th className="py-2 px-3">Zero-Downtime Safe Remedy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 font-mono text-[11px]">
                  <tr className="bg-rose-50/40">
                    <td className="py-2 px-3 font-bold text-rose-800">ACCESS EXCLUSIVE</td>
                    <td className="py-2 px-3 font-sans text-slate-700">PostgreSQL, Oracle, SQL Server (Sch-M)</td>
                    <td className="py-2 px-3 text-rose-700 font-bold">YES ❌</td>
                    <td className="py-2 px-3 text-rose-700 font-bold">YES ❌</td>
                    <td className="py-2 px-3 font-sans text-emerald-800">Set lock_timeout, Expand & Contract pattern</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="py-2 px-3 font-bold text-amber-800">METADATA LOCK / COPY</td>
                    <td className="py-2 px-3 font-sans text-slate-700">MySQL, MariaDB, Percona Server</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">NO ✅</td>
                    <td className="py-2 px-3 text-rose-700 font-bold">YES ❌</td>
                    <td className="py-2 px-3 font-sans text-emerald-800">ALGORITHM=INPLACE, LOCK=NONE / gh-ost</td>
                  </tr>
                  <tr className="bg-rose-50/30">
                    <td className="py-2 px-3 font-bold text-rose-800">ASYNC DATA REWRITE</td>
                    <td className="py-2 px-3 font-sans text-slate-700">ClickHouse, Snowflake, BigQuery</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">NO ✅</td>
                    <td className="py-2 px-3 text-amber-700 font-bold">I/O Spike ⚠️</td>
                    <td className="py-2 px-3 font-sans text-emerald-800">Partition Swapping, ReplacingMergeTree</td>
                  </tr>
                  <tr className="bg-rose-50/40">
                    <td className="py-2 px-3 font-bold text-rose-800">EVENT LOOP LOCK</td>
                    <td className="py-2 px-3 font-sans text-slate-700">Redis, Valkey, KeyDB, Memcached</td>
                    <td className="py-2 px-3 text-rose-700 font-bold">YES ❌</td>
                    <td className="py-2 px-3 text-rose-700 font-bold">YES ❌</td>
                    <td className="py-2 px-3 font-sans text-emerald-800">SCAN cursor iteration, FLUSHDB ASYNC</td>
                  </tr>
                  <tr className="bg-emerald-50/40">
                    <td className="py-2 px-3 font-bold text-emerald-800">INDEX ALIAS SWAP</td>
                    <td className="py-2 px-3 font-sans text-slate-700">Elasticsearch, OpenSearch, Vector DBs</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">NO ✅</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">NO ✅</td>
                    <td className="py-2 px-3 font-sans text-emerald-800">Zero-downtime atomic alias re-pointing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CI/CD Generator Modal */}
      <CiCdLinterModal
        isOpen={showCiCdModal}
        onClose={() => setShowCiCdModal(false)}
        engine={selectedEngine}
      />
    </div>
  );
};

