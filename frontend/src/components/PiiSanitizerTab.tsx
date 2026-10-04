import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  Check,
  Copy,
  Lock,
  FileCode,
  Layers,
  Terminal
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { sanitizePii } from '../services/api';
import { PiiSanitizerResult, DATABASE_CATALOG } from '../types';

interface PiiSanitizerTabProps {
  selectedEngine: string;
  onSelectEngine: (engine: string) => void;
}

export const PiiSanitizerTab: React.FC<PiiSanitizerTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [tableName, setTableName] = useState<string>('customers');
  const [salt, setSalt] = useState<string>('SQLPulse_Production_Masking_Salt_2026');
  const [result, setResult] = useState<PiiSanitizerResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedDumpRules, setCopiedDumpRules] = useState(false);
  const [copiedScrubDdl, setCopiedScrubDdl] = useState(false);
  const [copiedBash, setCopiedBash] = useState(false);

  const runSanitize = async () => {
    setIsLoading(true);
    try {
      const res = await sanitizePii({
        engine: selectedEngine,
        tableName,
        anonymizationSalt: salt,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'PII sanitization analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSanitize();
  }, [selectedEngine, tableName, salt]);

  const handleCopy = (text: string, type: 'dump' | 'scrub' | 'bash') => {
    navigator.clipboard.writeText(text);
    if (type === 'dump') {
      setCopiedDumpRules(true);
      setTimeout(() => setCopiedDumpRules(false), 2000);
    } else if (type === 'scrub') {
      setCopiedScrubDdl(true);
      setTimeout(() => setCopiedScrubDdl(false), 2000);
    } else {
      setCopiedBash(true);
      setTimeout(() => setCopiedBash(false), 2000);
    }
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
              Zero-Leakage Production-to-Staging Masking
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              GDPR • HIPAA • PCI-DSS 3.4 • SOC2 • Deterministic HMAC
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-rose-600" />
            PII Data Anonymizer &amp; Staging Sanitizer
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
            Automatically detect personally identifiable information (Emails, Cards, SSNs, Passwords) in {engineMeta.name}. Export zero-leakage masking directives, deterministic relational fakers, and automated CI/CD staging sync scripts.
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
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {[
              { id: 'postgres', label: 'PostgreSQL', icon: '🐘' },
              { id: 'mysql', label: 'MySQL', icon: '🐬' },
              { id: 'oracle', label: 'Oracle', icon: '🔴' },
              { id: 'sqlserver', label: 'SQL Server', icon: '🪟' },
              { id: 'mongodb', label: 'MongoDB', icon: '🍃' },
              { id: 'redis', label: 'Redis', icon: '⚡' },
              { id: 'clickhouse', label: 'ClickHouse', icon: '🟡' },
              { id: 'sqlite', label: 'SQLite', icon: '🪶' },
              { id: 'snowflake', label: 'Snowflake', icon: '❄️' },
              { id: 'cassandra', label: 'Cassandra', icon: '👁️' },
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectEngine(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  selectedEngine.toLowerCase().includes(preset.id)
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-600" />
              Target Table / Entity Name
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. customers, users, patients"
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                Deterministic Anonymization Salt
              </label>
              {isLoading && <span className="text-[10px] font-bold text-rose-600 animate-pulse">Scanning Schema...</span>}
            </div>
            <input
              type="text"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              className="w-full px-3 py-2 rounded-xl font-mono text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/90 border border-emerald-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Compliance Readiness Score</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                {result.overallComplianceScore} / 100
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                GDPR &amp; HIPAA Safe Harbor Ready
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-rose-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detected PII Columns</div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                {result.detectedPiiCount} Sensitive Fields
              </div>
              <div className="text-xs text-rose-700 font-semibold mt-1">
                Requires deterministic masking
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Masking Integrity</div>
              <div className="text-xl sm:text-2xl font-black text-purple-700 mt-1">
                Foreign Key Preserved
              </div>
              <div className="text-xs text-purple-700 font-semibold mt-1">
                HMAC-SHA256 Join Consistency
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              PII Classification &amp; Masking Matrix
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-purple-50/50 text-slate-800 uppercase font-black tracking-wider border-b border-purple-200">
                  <tr>
                    <th className="py-2.5 px-3">Column Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Compliance Tag</th>
                    <th className="py-2.5 px-3">Masking Strategy</th>
                    <th className="py-2.5 px-3">Raw Production Sample</th>
                    <th className="py-2.5 px-3">Masked Staging Output</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 font-medium">
                  {result.fields.map((f, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/40 transition">
                      <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900">{f.columnName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {f.piiCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{f.complianceTag}</td>
                      <td className="py-2.5 px-3 text-indigo-700 font-bold">{f.maskingMethod}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] line-through">{f.sampleOriginalValue}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700 font-bold text-[11px]">{f.sampleMaskedValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-purple-600" />
                  {result.engineName} Anonymizer Rules &amp; Directives
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopy(result.pgDumpAnonRules, 'dump')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-600 text-white hover:bg-purple-700 transition flex items-center gap-1"
                >
                  {copiedDumpRules ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedDumpRules ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-950 rounded-xl p-3 font-mono text-xs text-purple-200 overflow-x-auto max-h-60">
                <pre>{result.pgDumpAnonRules}</pre>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  In-Place Staging Scrub DDL
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopy(result.inPlaceScrubDdl, 'scrub')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  {copiedScrubDdl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedScrubDdl ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-950 rounded-xl p-3 font-mono text-xs text-emerald-300 overflow-x-auto max-h-60">
                <pre>{result.inPlaceScrubDdl}</pre>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Automated Zero-Leakage CI/CD Staging Sync Script (Bash)
              </h3>
              <button
                type="button"
                onClick={() => handleCopy(result.stagingSyncBashScript, 'bash')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition active:scale-95 flex items-center gap-1.5"
              >
                {copiedBash ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedBash ? 'Copied Script' : 'Copy Bash Stream'}
              </button>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-indigo-200 overflow-x-auto max-h-64">
              <pre>{result.stagingSyncBashScript}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
