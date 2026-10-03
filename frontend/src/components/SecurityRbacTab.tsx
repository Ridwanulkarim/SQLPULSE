import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG, SecurityRbacResult } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { generateSecurityRbac } from '../services/api';
import { ShieldCheck, Copy, Check, RefreshCw, Lock, Key, EyeOff, ShieldAlert, UserCheck, AlertTriangle } from 'lucide-react';

interface SecurityRbacTabProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
}

export const SecurityRbacTab: React.FC<SecurityRbacTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [tableName, setTableName] = useState('customers');
  const [tenantColumn, setTenantColumn] = useState('tenant_id');
  const [enforceTls, setEnforceTls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SecurityRbacResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateSecurityRbac({
        engine: selectedEngine,
        tableName,
        tenantColumn,
        enforceTls,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate security matrix');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [selectedEngine, tableName, tenantColumn, enforceTls]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white shadow-xl shadow-emerald-950/20 border border-emerald-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
              Zero-Trust Database Security Matrix
            </span>
            <span className="text-xs text-emerald-300 font-medium">
              447 Database Engines • RBAC Least-Privilege &amp; Row-Level Security (RLS)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Database RBAC, Dynamic PII Masking &amp; Row-Level Security (RLS)
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-3xl">
            Generate least-privilege roles, multi-tenant Row-Level Security isolation policies, dynamic PII masking views, and TLS 1.3 / TDE encryption for {engineMeta.name}.
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Target Table / Model
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="customers"
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-teal-600" />
              Tenant Scope Column
            </label>
            <input
              type="text"
              value={tenantColumn}
              onChange={(e) => setTenantColumn(e.target.value)}
              placeholder="tenant_id"
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enforceTls}
                onChange={(e) => setEnforceTls(e.target.checked)}
                className="rounded bg-white border-purple-300 text-emerald-600 focus:ring-emerald-500/20 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-700">Enforce TLS 1.3 &amp; TDE</span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              <span>Generate Security Matrix ➔</span>
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
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                Zero-Trust Security Score
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono">
                {result.complianceScore} / 100
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Hardened against SQL injection &amp; data leaks
              </p>
            </div>

            {result.auditItems.map((audit) => (
              <div key={audit.id} className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {audit.standard} Standard
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono uppercase">
                    {audit.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {audit.title}
                </div>
                <p className="text-[11px] text-slate-500">
                  {audit.impact}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Least-Privilege Role-Based Access Control (RBAC)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.roles.map((role) => (
                <div key={role.name} className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {role.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(role.ddlGrant, role.name)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-white text-purple-900 border border-purple-200 hover:bg-purple-50 shadow-xs"
                        title="Copy Role DDL"
                      >
                        {copiedKey === role.name ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-purple-600" />}
                        <span>{copiedKey === role.name ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-bold font-mono mb-1.5">
                      Scope: {role.scope}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">
                      {role.description}
                    </p>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-300 overflow-x-auto selection:bg-emerald-600 selection:text-white">
                    {role.ddlGrant}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      Multi-Tenant Row-Level Security (RLS) Policy
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.rlsPolicyScript, 'rls')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copiedKey === 'rls' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copiedKey === 'rls' ? 'Copied' : 'Copy RLS'}</span>
                  </button>
                </div>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-teal-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-[300px] selection:bg-teal-600 selection:text-white">
                  {result.rlsPolicyScript}
                </pre>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-cyan-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      Dynamic PII Field Redaction &amp; Masking
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.dataMaskingScript, 'masking')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copiedKey === 'masking' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copiedKey === 'masking' ? 'Copied' : 'Copy Masking'}</span>
                  </button>
                </div>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-[300px] selection:bg-cyan-600 selection:text-white">
                  {result.dataMaskingScript}
                </pre>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  TLS 1.3 Transport &amp; TDE Storage Encryption Hardening ({engineMeta.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(result.tlsHardeningConfig, 'tls')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
              >
                {copiedKey === 'tls' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                <span>{copiedKey === 'tls' ? 'Copied' : 'Copy TLS'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-200 font-mono text-xs overflow-x-auto leading-relaxed selection:bg-emerald-600 selection:text-white">
              {result.tlsHardeningConfig}
            </pre>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-950 dark:text-purple-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Zero-Trust Database Hardening Principles:
            </h3>
            <ul className="space-y-1.5">
              {result.expertRecommendations.map((rec, i) => (
                <li key={i} className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 flex-shrink-0" />
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
