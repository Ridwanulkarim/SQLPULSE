import React, { useState, useEffect } from 'react';
import {
  FileSearch,
  Check,
  Copy,
  AlertTriangle,
  Zap,
  TrendingDown,
  Layers,
  SearchCheck,
  ShieldCheck,
  PlusCircle
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { auditIndexDoctor } from '../services/api';
import { IndexDoctorResult, DATABASE_CATALOG } from '../types';

interface IndexDoctorTabProps {
  selectedEngine: string;
  onSelectEngine: (engine: string) => void;
}

export const IndexDoctorTab: React.FC<IndexDoctorTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [tableName, setTableName] = useState<string>('orders');
  const [rawDdl, setRawDdl] = useState<string>(`-- Paste existing indexes or use table defaults:
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_customer_and_created ON orders (customer_id, created_at);
CREATE INDEX idx_orders_status_and_user ON orders (status, customer_id);
CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);
CREATE INDEX idx_orders_tenant_only ON orders (tenant_id);
CREATE INDEX idx_orders_created_at_desc ON orders (created_at DESC);`);

  const [result, setResult] = useState<IndexDoctorResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const indexPresets = [
    {
      label: '🛒 E-Commerce Overlapping Left-Prefix',
      table: 'orders',
      engine: 'postgresql',
      ddl: `CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_customer_and_created ON orders (customer_id, created_at);
CREATE INDEX idx_orders_status_and_user ON orders (status, customer_id);
CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);
CREATE INDEX idx_orders_tenant_only ON orders (tenant_id);
CREATE INDEX idx_orders_created_at_desc ON orders (created_at DESC);`
    },
    {
      label: '💳 SaaS Billing Duplicate Indices',
      table: 'invoices',
      engine: 'mysql',
      ddl: `CREATE INDEX idx_inv_account ON invoices (account_id);
CREATE INDEX idx_inv_account_status ON invoices (account_id, status);
CREATE INDEX idx_inv_account_due ON invoices (account_id, due_date);
CREATE INDEX idx_inv_status_only ON invoices (status);`
    },
    {
      label: '👥 User Profile Cardinality Overkill',
      table: 'users',
      engine: 'oracle',
      ddl: `CREATE INDEX idx_users_org ON users (organization_id);
CREATE INDEX idx_users_org_role ON users (organization_id, role);
CREATE INDEX idx_users_is_active ON users (is_active);`
    }
  ];

  const runAudit = async (tbl = tableName, ddl = rawDdl, eng = selectedEngine) => {
    setIsLoading(true);
    try {
      const res = await auditIndexDoctor({
        engine: eng,
        tableName: tbl,
        rawIndexDdl: ddl,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Index audit failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const norm = selectedEngine.toLowerCase();
    let newTable = tableName;
    let newDdl = rawDdl;

    if (norm.includes('mysql') || norm.includes('maria')) {
      newTable = 'invoices';
      newDdl = `CREATE INDEX idx_inv_account ON invoices (account_id);\nCREATE INDEX idx_inv_account_status ON invoices (account_id, status);\nCREATE INDEX idx_inv_account_due ON invoices (account_id, due_date);\nCREATE INDEX idx_inv_status_only ON invoices (status);`;
    } else if (norm.includes('oracle') || norm.includes('db2')) {
      newTable = 'USERS';
      newDdl = `CREATE INDEX IDX_USERS_ORG ON USERS (ORGANIZATION_ID);\nCREATE INDEX IDX_USERS_ORG_ROLE ON USERS (ORGANIZATION_ID, ROLE);\nCREATE INDEX IDX_USERS_IS_ACTIVE ON USERS (IS_ACTIVE);`;
    } else if (norm.includes('sqlserver') || norm.includes('mssql')) {
      newTable = 'SalesOrders';
      newDdl = `CREATE NONCLUSTERED INDEX IX_SalesOrders_Customer ON SalesOrders (CustomerID);\nCREATE NONCLUSTERED INDEX IX_SalesOrders_Customer_Status ON SalesOrders (CustomerID, Status);\nCREATE NONCLUSTERED INDEX IX_SalesOrders_OrderDate ON SalesOrders (OrderDate DESC);`;
    } else if (norm.includes('mongo') || norm.includes('document')) {
      newTable = 'orders';
      newDdl = `db.orders.createIndex({ customer_id: 1 });\ndb.orders.createIndex({ customer_id: 1, created_at: -1 });\ndb.orders.createIndex({ status: 1, customer_id: 1 });`;
    } else {
      newTable = 'orders';
      newDdl = `CREATE INDEX idx_orders_customer_id ON orders (customer_id);\nCREATE INDEX idx_orders_customer_and_created ON orders (customer_id, created_at);\nCREATE INDEX idx_orders_status_and_user ON orders (status, customer_id);\nCREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);\nCREATE INDEX idx_orders_tenant_only ON orders (tenant_id);\nCREATE INDEX idx_orders_created_at_desc ON orders (created_at DESC);`;
    }

    setTableName(newTable);
    setRawDdl(newDdl);
    runAudit(newTable, newDdl, selectedEngine);
  }, [selectedEngine]);

  const handleApplyPreset = (p: typeof indexPresets[0]) => {
    onSelectEngine(p.engine);
    setTableName(p.table);
    setRawDdl(p.ddl);
    runAudit(p.table, p.ddl, p.engine);
  };

  const handleCopyMigration = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.cleanupMigrationScript);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find((db) => db.id === selectedEngine) || {
    name: selectedEngine,
    icon: '🗄️',
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs relative overflow-hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
              Redundant &amp; Duplicate Index Auditor
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              Prefix Overlap Detection • Write Amplification Eliminator • Zero-Downtime DDL
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-indigo-600" />
            Index Doctor &amp; Redundancy Auditor
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
            Detect redundant left-prefix indexes, duplicate B-Trees, and low-cardinality ordering flaws for {engineMeta.name}. Reclaim RAM/Buffer Pool space and reduce write I/O amplification on `INSERT`/`UPDATE` operations.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={onSelectEngine}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-900/70 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Quick-Load Index Audit Scenarios:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {indexPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition flex items-center gap-1.5 shadow-sm border ${
                  selectedEngine === preset.engine && tableName === preset.table
                    ? 'bg-indigo-100/90 text-indigo-950 border-indigo-300 font-bold'
                    : 'bg-white/80 hover:bg-indigo-50 text-slate-800 border-purple-200/70'
                }`}
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Target Table Name
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. orders, transactions, users"
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <SearchCheck className="w-3.5 h-3.5 text-indigo-600" />
              Existing Table Indexes DDL
            </label>
            <textarea
              rows={3}
              value={rawDdl}
              onChange={(e) => setRawDdl(e.target.value)}
              className="w-full p-2.5 rounded-xl font-mono text-xs border border-purple-200 bg-slate-950 text-purple-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => runAudit(tableName, rawDdl, selectedEngine)}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            {isLoading ? 'Auditing Indexes...' : 'Audit Table Indexes'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Index Health Score</div>
              <div className={`text-2xl sm:text-3xl font-black mt-1 ${result.healthScore >= 80 ? 'text-emerald-600' : result.healthScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                {result.healthScore} / 100
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {result.redundanciesCount === 0 ? 'Optimal index distribution' : `${result.redundanciesCount} issues detected`}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-rose-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Redundant Indexes</div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                {result.redundanciesCount} <span className="text-xs font-bold text-slate-500">/ {result.totalIndexesAnalyzed} total</span>
              </div>
              <div className="text-xs text-rose-700 font-semibold mt-1">
                Prefix subsets &amp; duplicates
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-teal-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated RAM/Disk Waste</div>
              <div className="text-2xl sm:text-3xl font-black text-teal-700 mt-1">
                ~{result.totalEstimatedWasteMb} MB
              </div>
              <div className="text-xs text-teal-700 font-semibold mt-1">
                Reclaimable Buffer Pool space
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-emerald-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Write I/O Reduction</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 flex items-center gap-1">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
                -{result.writeAmplificationReductionPct.toFixed(1)}%
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                Faster bulk INSERTs &amp; UPDATEs
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Detected Inefficient &amp; Redundant Indexes ({result.findings.length})
            </h3>

            <div className="space-y-3">
              {result.findings.map((f, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-rose-100 bg-rose-50/30 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-rose-100 text-rose-900">
                        {f.indexName}
                      </span>
                      <span className="text-xs font-mono text-slate-600">
                        ({f.columns.join(', ')})
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-200 text-rose-900">
                      {f.suggestedAction === 'DROP' ? 'Safe to Drop' : 'Reorder Columns'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">
                    {f.redundantReason}
                  </p>

                  <div className="bg-slate-950 rounded-lg p-2 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                    {f.safeDropDdl}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              Recommended Consolidated Composite &amp; Covering Indexes ({result.recommendedConsolidatedIndexes.length})
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {result.recommendedConsolidatedIndexes.map((ci, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-xs font-black text-indigo-900 mb-1">
                      {ci.indexName}
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {ci.purpose}
                    </p>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-2.5 font-mono text-[11px] text-indigo-200 overflow-x-auto">
                    {ci.createDdl}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Zero-Downtime Online Index Cleanup Script
              </h3>
              <button
                type="button"
                onClick={handleCopyMigration}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition active:scale-95 flex items-center gap-1.5"
              >
                {copiedMigration ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedMigration ? 'Copied DDL' : 'Copy Migration Script'}
              </button>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-purple-200 overflow-x-auto max-h-80">
              <pre>{result.cleanupMigrationScript}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
