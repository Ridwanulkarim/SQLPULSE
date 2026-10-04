import React, { useState, useEffect } from 'react';
import {
  Link2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Code2
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { fetchConnectHubConfig } from '../services/api';
import { ConnectHubResult, DATABASE_CATALOG } from '../types';
import { DbBrandLogo } from './DbBrandLogo';

import { DatabaseEngine } from '../types';

interface ConnectHubTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const ConnectHubTab: React.FC<ConnectHubTabProps> = ({
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
  const [host, setHost] = useState<string>('db.production.internal');
  const [port, setPort] = useState<number>(5432);
  const [database, setDatabase] = useState<string>('ecommerce_prod');
  const [username, setUsername] = useState<string>('app_user');
  const [password, setPassword] = useState<string>('Sup3rS3curePass!99');
  const [sslMode, setSslMode] = useState<string>('require');
  const [poolSize, setPoolSize] = useState<number>(20);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [result, setResult] = useState<ConnectHubResult | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<string>('typescript');
  const [activeOrmTab, setActiveOrmTab] = useState<string>('prisma');
  const [copiedUri, setCopiedUri] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    const norm = selectedEngine.toLowerCase();
    if (norm === 'mysql' || norm === 'mariadb' || norm === 'tidb') setPort(3306);
    else if (norm === 'oracle' || norm.includes('oracle')) setPort(1521);
    else if (norm.includes('mssql') || norm.includes('sqlserver') || norm.includes('sql_server')) setPort(1433);
    else if (norm === 'clickhouse') setPort(8123);
    else if (norm === 'redis' || norm === 'keydb' || norm === 'dragonfly') setPort(6379);
    else if (norm === 'mongodb' || norm.includes('mongo')) setPort(27017);
    else if (norm === 'cassandra' || norm === 'scylladb') setPort(9042);
    else if (norm === 'neo4j' || norm.includes('neo4j')) setPort(7687);
    else if (norm === 'elasticsearch' || norm === 'opensearch') setPort(9200);
    else if (norm === 'snowflake') setPort(443);
    else setPort(5432);
  }, [selectedEngine]);

  const handleGenerate = async () => {
    try {
      const res = await fetchConnectHubConfig({
        engine: selectedEngine,
        host,
        port,
        database,
        username,
        password,
        sslMode,
        poolSize,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to generate connection string');
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [selectedEngine, host, port, database, username, password, sslMode, poolSize]);

  const handleCopyUri = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.connectionUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const handleCopyActiveCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white shadow-xl shadow-purple-950/20 border border-purple-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
              Polyglot Driver &amp; DSN Studio
            </span>
            <span className="text-xs text-indigo-300 font-medium">
              447 Database Engines • 6 Programming Languages • ORMs
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-400" />
            Connection String &amp; Driver Studio
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200/90 mt-1 max-w-3xl">
            Generate production connection URIs, JDBC descriptors, and copy-paste ready connection boilerplate for Node.js, Python, Go, Rust, Java, Prisma, and Drizzle.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={(eng) => {
              setSelectedEngine(eng);
              onSelectEngine?.(eng as DatabaseEngine);
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Host / Domain</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Database / Keyspace Name</label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">SSL Mode</label>
            <select
              value={sslMode}
              onChange={(e) => setSslMode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white"
            >
              <option value="require">Require (Encrypted)</option>
              <option value="verify-full">Verify-Full (CA Certified)</option>
              <option value="disable">Disable (Local Dev Only)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Connection Pool Max</label>
            <input
              type="number"
              min={1}
              max={500}
              value={poolSize}
              onChange={(e) => setPoolSize(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-purple-200 bg-white"
            />
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DbBrandLogo engineId={selectedEngine} size={20} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Standard Connection URI ({engineMeta.name})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? 'Hide Secret' : 'Reveal Secret'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition active:scale-95"
                >
                  {copiedUri ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUri ? 'Copied' : 'Copy URI'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs sm:text-sm text-emerald-300 overflow-x-auto selection:bg-emerald-600 selection:text-white">
              {showPassword ? result.connectionUri : result.maskedUri}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-purple-200 overflow-x-auto">
                {result.codeSnippets.map((snip) => (
                  <button
                    key={snip.language}
                    type="button"
                    onClick={() => setActiveCodeTab(snip.language)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      activeCodeTab === snip.language
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {snip.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const current = result.codeSnippets.find(s => s.language === activeCodeTab);
                  if (current) handleCopyActiveCode(current.code);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-purple-300 text-purple-900 hover:bg-purple-50 shadow-sm transition active:scale-95"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Code</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-purple-100 overflow-x-auto selection:bg-purple-600 selection:text-white max-h-[400px]">
              {result.codeSnippets.find(s => s.language === activeCodeTab)?.code}
            </pre>
          </div>

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-indigo-50/80 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-bold text-indigo-950">ORM Schema &amp; Connection Definitions</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-indigo-200">
                {result.ormSnippets.map((orm) => (
                  <button
                    key={orm.orm}
                    type="button"
                    onClick={() => setActiveOrmTab(orm.orm)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      activeOrmTab === orm.orm
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {orm.label}
                  </button>
                ))}
              </div>
            </div>
            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-indigo-200 overflow-x-auto selection:bg-indigo-600 selection:text-white">
              {result.ormSnippets.find(o => o.orm === activeOrmTab)?.code}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
