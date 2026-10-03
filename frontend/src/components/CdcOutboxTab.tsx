import React, { useState, useEffect } from 'react';
import {
  Radio,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { generateCdcOutbox } from '../services/api';
import { CdcOutboxResult } from '../types';

export const CdcOutboxTab: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('postgresql');
  const [sourceTable, setSourceTable] = useState<string>('orders');
  const [destinationBroker, setDestinationBroker] = useState<'kafka' | 'rabbitmq' | 'sqs' | 'redis_streams'>('kafka');
  const [activeCodeTab, setActiveCodeTab] = useState<'ddl' | 'debezium' | 'worker'>('ddl');
  const [copied, setCopied] = useState<boolean>(false);
  const [result, setResult] = useState<CdcOutboxResult | null>(null);

  const brokers = [
    { id: 'kafka', name: 'Apache Kafka', icon: '⚡' },
    { id: 'rabbitmq', name: 'RabbitMQ', icon: '🐇' },
    { id: 'sqs', name: 'AWS SQS / SNS', icon: '📦' },
    { id: 'redis_streams', name: 'Redis Streams', icon: '🔴' },
  ];

  const handleGenerate = async () => {
    try {
      const data = await generateCdcOutbox({
        engine: selectedEngine,
        sourceTable,
        destinationBroker,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to generate CDC Outbox architecture.');
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [selectedEngine, sourceTable, destinationBroker]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveCode = () => {
    if (!result) return '';
    if (activeCodeTab === 'ddl') return result.outboxDdl;
    if (activeCodeTab === 'debezium') return result.debeziumConnectorConfigJson;
    return result.consumerWorkerCode;
  };

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 text-white shadow-xl shadow-violet-950/20 border border-violet-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-violet-500/30 text-violet-200 border border-violet-400/40 flex items-center gap-1">
              <Radio className="w-3 h-3 text-violet-300" /> Event-Driven Architecture &amp; CDC
            </span>
            <span className="text-xs text-violet-300 font-medium">
              Zero-Loss Transactional Outbox &amp; Debezium Event Streaming
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-violet-400" />
            CDC &amp; Transactional Outbox Architect
          </h2>
          <p className="text-xs sm:text-sm text-violet-200/90 mt-1 max-w-3xl">
            Design bulletproof event streaming architectures without dual-write race conditions. Generates Outbox DDL, Debezium Kafka Connect JSON, and idempotent consumer workers.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-violet-200/70 shadow-sm backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Source Database
            </label>
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Aggregate Domain Table
            </label>
            <input
              type="text"
              value={sourceTable}
              onChange={(e) => setSourceTable(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-violet-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Message Broker
            </label>
            <select
              value={destinationBroker}
              onChange={(e) => setDestinationBroker(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-violet-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800"
            >
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-violet-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Consistency Model</span>
              <div className="text-xl font-black text-slate-900 font-mono">Exactly-Once Emitted</div>
              <p className="text-[11px] text-slate-500">Atomic single-transaction commit</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">CDC Streaming Protocol</span>
              <div className="text-xl font-black text-slate-900 font-mono">Postgres pgoutput</div>
              <p className="text-[11px] text-slate-500">WAL log reader with zero query load</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Idempotency Guard</span>
              <div className="text-xl font-black text-emerald-600 font-mono">Ledger Lock Table</div>
              <p className="text-[11px] text-slate-500">Duplicate replay protection</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-violet-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('ddl')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'ddl' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Transactional Outbox DDL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('debezium')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'debezium' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Debezium Kafka Connect JSON
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('worker')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'worker' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Idempotent Consumer Worker (TS)
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(getActiveCode())}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-violet-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-violet-400" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-violet-200 overflow-x-auto selection:bg-violet-600 selection:text-white max-h-[450px]">
              {getActiveCode()}
            </pre>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-violet-50/80 border border-violet-200 shadow-sm space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-violet-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-violet-600" />
              Event-Driven Architecture &amp; CDC Rules of Thumb
            </h4>
            <ul className="space-y-1.5 text-xs text-violet-900 list-disc list-inside">
              {result.architectureGuidelines.map((guide, idx) => (
                <li key={idx} className="leading-relaxed">{guide}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
