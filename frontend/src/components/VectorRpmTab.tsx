import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { tuneVectorIndex } from '../services/api';
import { VectorTuningResult } from '../types';

import { DatabaseEngine } from '../types';

interface VectorRpmTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const VectorRpmTab: React.FC<VectorRpmTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<string>(
    (propEngine as string) || 'pgvector'
  );

  useEffect(() => {
    if (propEngine && propEngine !== selectedEngine) {
      setSelectedEngine(propEngine);
    }
  }, [propEngine]);
  const [dimension, setDimension] = useState<number>(1536);
  const [vectorCount, setVectorCount] = useState<number>(500000);
  const [indexType] = useState<'HNSW' | 'IVFFLAT'>('HNSW');
  const [distanceMetric, setDistanceMetric] = useState<'cosine' | 'l2' | 'inner_product'>('cosine');
  const [activeCodeTab, setActiveCodeTab] = useState<'ddl' | 'hybrid'>('ddl');
  const [copied, setCopied] = useState<boolean>(false);
  const [result, setResult] = useState<VectorTuningResult | null>(null);

  const embeddingPresets = [
    { label: 'OpenAI text-embedding-3-small (1536 dim)', dim: 1536 },
    { label: 'OpenAI text-embedding-3-large (3072 dim)', dim: 3072 },
    { label: 'Cohere Embed-v3 (1024 dim)', dim: 1024 },
    { label: 'MiniLM-L6-v2 (384 dim)', dim: 384 },
    { label: 'Google Gecko Multimodal (768 dim)', dim: 768 },
  ];

  const handleTune = async () => {
    try {
      const data = await tuneVectorIndex({
        engine: selectedEngine,
        dimension,
        vectorCount,
        indexType,
        distanceMetric,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to tune vector index.');
    }
  };

  useEffect(() => {
    handleTune();
  }, [selectedEngine, dimension, vectorCount, indexType, distanceMetric]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 text-white shadow-xl shadow-cyan-950/20 border border-cyan-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-300" /> Vector Database &amp; RAG Tuner
            </span>
            <span className="text-xs text-cyan-300 font-medium">
              HNSW Index Memory Sizing &amp; Hybrid BM25/Dense Reciprocal Rank Fusion
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            Vector Search &amp; Hybrid RAG Index Tuner
          </h2>
          <p className="text-xs sm:text-sm text-cyan-200/90 mt-1 max-w-3xl">
            Accurately size RAM buffer footprints for pgvector, Pinecone, Milvus, and Qdrant. Tune HNSW (M, efConstruction, efSearch) parameters and generate hybrid sparse+dense RRF queries.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-cyan-200/70 shadow-sm backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Vector Database Engine
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
              Embedding Dimension ({dimension})
            </label>
            <select
              value={dimension}
              onChange={(e) => setDimension(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-cyan-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800"
            >
              {embeddingPresets.map((p, idx) => (
                <option key={idx} value={p.dim}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Total Vector Count ({vectorCount.toLocaleString()})
            </label>
            <select
              value={vectorCount}
              onChange={(e) => setVectorCount(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-cyan-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800"
            >
              <option value={100000}>100,000 Vectors</option>
              <option value={500000}>500,000 Vectors</option>
              <option value={1000000}>1,000,000 Vectors (1M)</option>
              <option value={5000000}>5,000,000 Vectors (5M)</option>
              <option value={10000000}>10,000,000 Vectors (10M)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Distance Metric
            </label>
            <select
              value={distanceMetric}
              onChange={(e) => setDistanceMetric(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-cyan-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800"
            >
              <option value="cosine">Cosine Distance (&lt;=&gt;)</option>
              <option value="l2">Euclidean L2 (&lt;-&gt;)</option>
              <option value="inner_product">Inner Product (&lt;#&gt;)</option>
            </select>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-cyan-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-cyan-700 uppercase tracking-wider">Required Index RAM</span>
              <div className="text-2xl font-black text-cyan-700 font-mono">{result.estimatedRamMb} MB</div>
              <p className="text-[11px] text-slate-500">Shared buffer allocation</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">ANN Recall Accuracy</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">{result.recallScorePercentage}%</div>
              <p className="text-[11px] text-emerald-700">At ef_search = 64</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Estimated QPS</span>
              <div className="text-2xl font-black text-blue-700 font-mono">~{result.estimatedQps} QPS</div>
              <p className="text-[11px] text-blue-700">Sub-10ms retrieval</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Build Time</span>
              <div className="text-2xl font-black text-purple-700 font-mono">~{result.estimatedBuildTimeSec}s</div>
              <p className="text-[11px] text-purple-700">Index build duration</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-cyan-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('ddl')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'ddl' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  HNSW Vector Index DDL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('hybrid')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'hybrid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Hybrid Dense + BM25 Search (RRF SQL)
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(activeCodeTab === 'ddl' ? result.vectorIndexDdl : result.hybridSearchQuery)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-cyan-200 overflow-x-auto selection:bg-cyan-600 selection:text-white max-h-[450px]">
              {activeCodeTab === 'ddl' ? result.vectorIndexDdl : result.hybridSearchQuery}
            </pre>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-cyan-50/80 border border-cyan-200 shadow-sm space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" />
              Vector Search &amp; RAG Index Guidelines
            </h4>
            <ul className="space-y-1.5 text-xs text-cyan-900 list-disc list-inside">
              {result.bestPractices.map((guide, idx) => (
                <li key={idx} className="leading-relaxed">{guide}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
