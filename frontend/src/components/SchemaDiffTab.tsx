import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  Code2,
  Table2,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { diffSchema } from '../services/api';
import { SchemaDiffResult, SchemaDiffChange } from '../types';
import { DbBrandLogo } from './DbBrandLogo';
import { DatabaseEngine } from '../types';

interface SchemaDiffTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const SchemaDiffTab: React.FC<SchemaDiffTabProps> = ({
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

  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [sourceEnv, setSourceEnv] = useState<string>('feature/2fa-orders (Git Source)');
  const [targetEnv, setTargetEnv] = useState<string>('AWS RDS Aurora Production (Target)');
  const [activeCodeTab, setActiveCodeTab] = useState<'forward' | 'rollback'>('forward');
  const [copied, setCopied] = useState<boolean>(false);
  const [filterImpact, setFilterImpact] = useState<string>('all');

  const [sourceDdl, setSourceDdl] = useState<string>(`-- Source Schema (New Git Migration / Staging)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(128) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC);

CREATE TABLE audit_event_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);

  const [targetDdl, setTargetDdl] = useState<string>(`-- Target Schema (Live Production Cluster)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SchemaDiffResult | null>(null);

  const presets = [
    {
      label: '🛒 E-Commerce & 2FA Drift',
      source: 'feature/2fa-orders (Git Source)',
      target: 'AWS RDS Aurora Production',
      engine: 'postgresql',
      srcDdl: `-- Source Schema (Feature Branch)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(128) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount NUMERIC(14, 4) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC);
CREATE TABLE audit_event_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`,
      tgtDdl: `-- Target Schema (Live Prod)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
    },
    {
      label: '💳 SaaS Billing & Precision Drift',
      source: 'v2.4-stripe-billing (Staging)',
      target: 'Google Cloud SQL Main',
      engine: 'mysql',
      srcDdl: `-- Source Schema (MySQL v2.4 Staging)
CREATE TABLE subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_tier_v2 VARCHAR(64) DEFAULT 'pro_yearly',
    status VARCHAR(32) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT NOT NULL,
    subtotal_cents BIGINT NOT NULL,
    due_date DATE,
    status VARCHAR(32) NOT NULL
);
CREATE INDEX idx_invoices_due_date_status ON invoices (due_date, status);
CREATE TABLE billing_audit_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
      tgtDdl: `-- Target Schema (MySQL Production)
CREATE TABLE subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT NOT NULL,
    subtotal_cents INT NOT NULL,
    due_date DATE,
    status VARCHAR(32) NOT NULL
);`
    },
    {
      label: '🏢 Enterprise ERP & Inventory Sync',
      source: 'Release-14-Inventory (Dev)',
      target: 'Oracle Exadata Live',
      engine: 'oracle',
      srcDdl: `-- Source Schema (Oracle Dev)
CREATE TABLE inventory_items (
    item_id NUMBER(10) PRIMARY KEY,
    sku VARCHAR2(64) NOT NULL,
    warehouse_id NUMBER(10) NOT NULL,
    quantity NUMBER(12, 2)
);
CREATE TABLE general_ledger_entries (
    entry_id NUMBER(12) PRIMARY KEY,
    account_code VARCHAR2(32) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    posting_date DATE DEFAULT SYSDATE
);
CREATE INDEX idx_gl_journal_posting_date ON general_ledger_entries (posting_date, account_code);
CREATE TABLE erp_compliance_logs (
    log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auditor_id VARCHAR2(64) NOT NULL,
    change_hash VARCHAR2(128) NOT NULL
);`,
      tgtDdl: `-- Target Schema (Oracle Live Exadata)
CREATE TABLE inventory_items (
    item_id NUMBER(10) PRIMARY KEY,
    sku VARCHAR2(64) NOT NULL,
    quantity NUMBER(12, 2)
);
CREATE TABLE general_ledger_entries (
    entry_id NUMBER(12) PRIMARY KEY,
    account_code VARCHAR2(32) NOT NULL,
    currency_code VARCHAR2(10) NULL,
    posting_date DATE DEFAULT SYSDATE
);`
    },
    {
      label: '🏥 Healthcare HIPAA Audit Drift',
      source: 'HIPAA-v3.0-Compliance-Branch',
      target: 'Production Healthcare Cluster',
      engine: 'postgresql',
      srcDdl: `-- Source Schema (Healthcare Dev)
CREATE TABLE patients (
    patient_id BIGSERIAL PRIMARY KEY,
    name_encrypted BYTEA NOT NULL,
    medical_record_hash VARCHAR(64) NOT NULL,
    dob DATE NOT NULL
);
CREATE TABLE access_logs (
    log_id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    doctor_id BIGINT NOT NULL,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_access_logs_patient_doctor ON access_logs (patient_id, doctor_id, accessed_at DESC);
CREATE TABLE hipaa_audit_trail (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    phi_viewed BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45) NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);`,
      tgtDdl: `-- Target Schema (Live Healthcare Prod)
CREATE TABLE patients (
    patient_id BIGSERIAL PRIMARY KEY,
    name_encrypted BYTEA NOT NULL,
    dob DATE NOT NULL
);
CREATE TABLE access_logs (
    log_id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    doctor_id BIGINT NOT NULL,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);`
    },
    {
      label: '📱 Multi-Tenant Sharding Drift',
      source: 'Multi-Tenant-V2-Release',
      target: 'Global Tenant Cluster',
      engine: 'postgresql',
      srcDdl: `-- Source Schema
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY,
    tenant_name VARCHAR(128) NOT NULL,
    isolation_tier VARCHAR(32) DEFAULT 'shared'
);
CREATE TABLE tenant_events (
    event_id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    event_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tenant_events_created_at ON tenant_events (tenant_id, created_at DESC);
CREATE TABLE tenant_shards_routing (
    tenant_id UUID PRIMARY KEY,
    connection_uri VARCHAR(512) NOT NULL,
    active BOOLEAN DEFAULT TRUE
);`,
      tgtDdl: `-- Target Schema
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY,
    tenant_name VARCHAR(128) NOT NULL
);
CREATE TABLE tenant_events (
    event_id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    event_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
    },
    {
      label: '🏦 FinTech Crypto & Ledger Drift',
      source: 'FinTech-Merkle-Ledger-v1.8',
      target: 'Primary Settlement Engine',
      engine: 'postgresql',
      srcDdl: `-- Source Schema
CREATE TABLE wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    settlement_currency VARCHAR(8) DEFAULT 'USD',
    balance NUMERIC(18, 8) DEFAULT 0
);
CREATE TABLE ledger_entries (
    entry_id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    amount NUMERIC(18, 8) NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_account_tx_date ON ledger_entries (account_id, posted_at DESC);
CREATE TABLE immutable_transaction_proofs (
    tx_id BIGSERIAL PRIMARY KEY,
    merkle_root VARCHAR(64) NOT NULL,
    signature BYTEA NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NOW()
);`,
      tgtDdl: `-- Target Schema
CREATE TABLE wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    balance NUMERIC(18, 8) DEFAULT 0
);
CREATE TABLE ledger_entries (
    entry_id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    amount NUMERIC(18, 8) NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT NOW()
);`
    }
  ];

  const handleDiff = async (
    engine = selectedEngine,
    src = sourceEnv,
    tgt = targetEnv,
    srcD = mode === 'custom' ? sourceDdl : undefined,
    tgtD = mode === 'custom' ? targetDdl : undefined
  ) => {
    setIsLoading(true);
    try {
      const data = await diffSchema({
        engine,
        sourceEnv: src,
        targetEnv: tgt,
        sourceDdl: srcD,
        targetDdl: tgtD,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to analyze schema diff.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleDiff(
      selectedEngine,
      sourceEnv,
      targetEnv,
      mode === 'custom' ? sourceDdl : undefined,
      mode === 'custom' ? targetDdl : undefined
    );
  }, [selectedEngine, sourceEnv, targetEnv, mode]);

  const handleApplyPreset = (p: typeof presets[0]) => {
    setSelectedEngine(p.engine);
    onSelectEngine?.(p.engine as DatabaseEngine);
    setSourceEnv(p.source);
    setTargetEnv(p.target);
    setSourceDdl(p.srcDdl);
    setTargetDdl(p.tgtDdl);
    handleDiff(p.engine, p.source, p.target, p.srcDdl, p.tgtDdl);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredChanges = result?.changes.filter((c: SchemaDiffChange) => {
    if (filterImpact === 'breaking') return c.impactLevel === 'BREAKING';
    if (filterImpact === 'safe') return c.impactLevel === 'SAFE';
    if (filterImpact === 'warning') return c.impactLevel === 'WARNING';
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white shadow-xl shadow-indigo-950/20 border border-indigo-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 flex items-center gap-1">
              <GitCompare className="w-3 h-3 text-indigo-300" /> Schema Drift &amp; Reversible DDL
            </span>
            <span className="text-xs text-indigo-300 font-medium">
              Zero-Downtime Forward &amp; Rollback Migration Generator
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-indigo-400" />
            Schema Diff &amp; Online Drift Studio
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200/90 mt-1 max-w-3xl">
            Compare Dev/Staging vs Live Production schemas. Pinpoint missing tables, altered columns, unindexed foreign keys, and generate 100% reversible online DDLs.
          </p>
        </div>
      </div>

      {/* Preset / Custom Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-indigo-200/70 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" /> Scenarios:
          </span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-indigo-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm transition active:scale-95 flex items-center gap-1"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('presets')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${mode === 'presets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Presets Mode
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${mode === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Custom DDL Diff
          </button>
        </div>
      </div>

      {/* Engine & Environment Selectors */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-indigo-200/70 shadow-sm backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Database Engine
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Source Environment / Branch
            </label>
            <input
              type="text"
              value={sourceEnv}
              onChange={(e) => setSourceEnv(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-indigo-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Environment / Live DB
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetEnv}
                onChange={(e) => setTargetEnv(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-indigo-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
              <button
                type="button"
                onClick={() => handleDiff(selectedEngine, sourceEnv, targetEnv, mode === 'custom' ? sourceDdl : undefined, mode === 'custom' ? targetDdl : undefined)}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95 shrink-0 flex items-center gap-1"
              >
                {isLoading ? 'Diffing...' : 'Compare ➔'}
              </button>
            </div>
          </div>
        </div>

        {/* Custom DDL Editors if mode is 'custom' */}
        {mode === 'custom' && (
          <div className="pt-4 border-t border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-600" /> Interactive Source &amp; Target DDL Editors
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Paste SQL CREATE TABLE / INDEX definitions to detect real differences
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-purple-700">Source DDL (Migration / Dev)</label>
                <textarea
                  value={sourceDdl}
                  onChange={(e) => setSourceDdl(e.target.value)}
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-slate-900 text-purple-200 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="CREATE TABLE ... CREATE INDEX ..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-amber-700">Target DDL (Live Production)</label>
                <textarea
                  value={targetDdl}
                  onChange={(e) => setTargetDdl(e.target.value)}
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-slate-900 text-amber-200 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="CREATE TABLE ..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleDiff(selectedEngine, sourceEnv, targetEnv, sourceDdl, targetDdl)}
                disabled={isLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Compute Custom DDL Diff
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Drifts</span>
              <div className="text-2xl font-black text-indigo-700 font-mono">{result.totalDriftCount} Objects</div>
              <p className="text-[11px] text-slate-500">Mismatches detected</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Breaking Changes</span>
              <div className="text-2xl font-black text-rose-600 font-mono">{result.breakingChangesCount} High Risk</div>
              <p className="text-[11px] text-rose-600 font-medium">Requires shadow column</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Online Safe</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">{result.safeChangesCount} Safe</div>
              <p className="text-[11px] text-emerald-600 font-medium">Zero-downtime DDL</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Sync Integrity</span>
              <div className="text-2xl font-black text-purple-700 font-mono">{result.driftScore}%</div>
              <p className="text-[11px] text-purple-600 font-medium">Schema alignment</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-indigo-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-indigo-50/70 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DbBrandLogo engineId={selectedEngine} size={18} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                  Detected Schema Drifts &amp; Discrepancies ({filteredChanges.length})
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterImpact('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${filterImpact === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-indigo-100'}`}
                >
                  All ({result.changes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact('breaking')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${filterImpact === 'breaking' ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 hover:bg-rose-50'}`}
                >
                  Breaking ({result.breakingChangesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact('safe')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${filterImpact === 'safe' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 hover:bg-emerald-50'}`}
                >
                  Safe ({result.safeChangesCount})
                </button>
              </div>
            </div>

            <div className="divide-y divide-indigo-100">
              {filteredChanges.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No schema differences detected!</p>
                  <p className="text-xs">Source and target schemas are in 100% synchronization.</p>
                </div>
              ) : (
                filteredChanges.map((change) => (
                  <div key={change.id} className="p-4 hover:bg-indigo-50/30 transition space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                          change.impactLevel === 'BREAKING'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : change.impactLevel === 'WARNING'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {change.impactLevel}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-900">{change.targetObject}</span>
                        <span className="text-[11px] text-slate-500">({change.type})</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">{change.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-slate-900 text-purple-200 border border-slate-800 overflow-x-auto">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block mb-1">Source (Dev / Branch):</span>
                        {change.sourceDef}
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 text-amber-200 border border-slate-800 overflow-x-auto">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block mb-1">Target (Live Prod):</span>
                        {change.targetDef}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs font-mono space-y-1">
                      <span className="text-[10px] font-sans font-extrabold text-indigo-900 block">Safe Forward DDL:</span>
                      <pre className="text-indigo-950 whitespace-pre-wrap">{change.safeForwardDdl}</pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-indigo-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('forward')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'forward' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Forward Migration Script
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('rollback')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'rollback' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Rollback Script
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activeCodeTab === 'forward' ? result.forwardMigrationScript : result.rollbackMigrationScript)}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-indigo-200 font-mono text-xs overflow-x-auto leading-relaxed">
              {activeCodeTab === 'forward' ? result.forwardMigrationScript : result.rollbackMigrationScript}
            </pre>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider">
                Automated Zero-Downtime Preflight Verifications
              </h4>
            </div>
            <ul className="text-xs space-y-1.5 list-disc pl-5 text-amber-800">
              {result.preflightChecks.map((chk, idx) => (
                <li key={idx}>{chk}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
