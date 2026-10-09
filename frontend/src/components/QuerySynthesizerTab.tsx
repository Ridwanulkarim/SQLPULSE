import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Layers,
  Code2,
  Clock,
  Cpu
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { synthesizeQuery } from '../services/api';
import { QuerySynthesizeResult, DATABASE_CATALOG } from '../types';

import { DatabaseEngine } from '../types';

interface QuerySynthesizerTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const QuerySynthesizerTab: React.FC<QuerySynthesizerTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [prompt, setPrompt] = useState<string>(
    'Find top 10 customers with highest purchase volume in the last 90 days who have placed at least 3 orders'
  );
  const [targetEngine, setTargetEngine] = useState<string>(
    (propEngine as string) || 'postgresql'
  );

  useEffect(() => {
    if (propEngine && propEngine !== targetEngine) {
      setTargetEngine(propEngine);
    }
  }, [propEngine]);
  const [domainPreset, setDomainPreset] = useState<string>('ecommerce');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<QuerySynthesizeResult | null>(null);
  const [copiedQuery, setCopiedQuery] = useState<boolean>(false);
  const [copiedIndexDdl, setCopiedIndexDdl] = useState<boolean>(false);

  const samplePrompts = [
    {
      label: '🛒 Top Customers with Orders',
      engine: 'postgresql',
      domain: 'ecommerce',
      text: 'Find top 10 customers with highest purchase volume in the last 90 days who have placed at least 3 orders',
    },
    {
      label: '🇧🇩 Anti-Join Inactivity (বাংলা)',
      engine: 'postgresql',
      domain: 'ecommerce',
      text: 'গেল ১ বছরে সবচেয়ে বেশি কেনাকাটা করা সেরা ১০ গ্রাহক যারা গত ৬০ দিনে কোনো রিভিউ দেয়নি তাদের তালিকা বের করো',
    },
    {
      label: 'Vector Semantic Search',
      engine: 'pinecone',
      domain: 'vector_rag',
      text: 'Search top 10 document embeddings matching query with category and published_year metadata filters',
    },
    {
      label: '📈 TimescaleDB Telemetry P95',
      engine: 'timescaledb',
      domain: 'iot_timeseries',
      text: 'Aggregate 1-hour time_bucket intervals calculating average CPU and P95 latency for online devices over last 24 hours',
    },
    {
      label: '🍃 MongoDB Aggregation Pipeline',
      engine: 'mongodb',
      domain: 'ecommerce',
      text: 'MongoDB aggregation pipeline for completed orders in last 90 days grouped by customer with total spent',
    },
    {
      label: '🕸️ Neo4j Graph Recommendations',
      engine: 'neo4j',
      domain: 'social_network',
      text: 'Find customers who placed orders for database products with total spend and purchase count in Cypher',
    },
    {
      label: '⚡ Redis Leaderboard & Hash Pipeline',
      engine: 'redis',
      domain: 'ecommerce',
      text: 'Redis leaderboard query for top 10 spending customers using ZREVRANGE and pipelined hash lookups',
    },
  ];

  const handleSynthesize = async (promptToUse = prompt, engineToUse = targetEngine, domainToUse = domainPreset) => {
    if (!promptToUse.trim()) return;
    setIsLoading(true);
    try {
      const res = await synthesizeQuery({
        prompt: promptToUse,
        targetEngine: engineToUse,
        domainPreset: domainToUse,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Query synthesis failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const norm = targetEngine.toLowerCase();
    let newPrompt = prompt;
    let newDomain = domainPreset;

    if (norm.includes('pinecone') || norm.includes('milvus') || norm.includes('qdrant')) {
      newPrompt = 'Search top 10 document embeddings matching query with category and published_year metadata filters';
      newDomain = 'vector_rag';
    } else if (norm.includes('timescale') || norm.includes('influx')) {
      newPrompt = 'Aggregate 1-hour time_bucket intervals calculating average CPU and P95 latency for online devices over last 24 hours';
      newDomain = 'iot_timeseries';
    } else if (norm.includes('mongo')) {
      newPrompt = 'MongoDB aggregation pipeline for completed orders in last 90 days grouped by customer with total spent';
      newDomain = 'ecommerce';
    } else if (norm.includes('neo4j')) {
      newPrompt = 'Find customers who placed orders for database products with total spend and purchase count in Cypher';
      newDomain = 'social_network';
    } else if (norm.includes('redis')) {
      newPrompt = 'Redis leaderboard query for top 10 spending customers using ZREVRANGE and pipelined hash lookups';
      newDomain = 'ecommerce';
    } else if (norm.includes('click') || norm.includes('duck')) {
      newPrompt = 'Aggregate hourly request metrics and distinct user sessions over the last 30 days grouped by country';
      newDomain = 'fintech_iot';
    } else {
      newPrompt = 'Find top 10 customers with highest purchase volume in the last 90 days who have placed at least 3 orders';
      newDomain = 'ecommerce';
    }

    setPrompt(newPrompt);
    setDomainPreset(newDomain);
    handleSynthesize(newPrompt, targetEngine, newDomain);
  }, [targetEngine]);

  const applySamplePrompt = (sample: typeof samplePrompts[0]) => {
    setPrompt(sample.text);
    setTargetEngine(sample.engine);
    setDomainPreset(sample.domain);
    handleSynthesize(sample.text, sample.engine, sample.domain);
  };

  const handleCopyQuery = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.synthesizedQuery);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  const handleCopyIndex = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.zeroDowntimeIndexDdl);
    setCopiedIndexDdl(true);
    setTimeout(() => setCopiedIndexDdl(false), 2000);
  };

  const targetMeta = DATABASE_CATALOG.find((db) => db.id === targetEngine) || {
    name: targetEngine,
    icon: '🗄️',
  };

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white shadow-xl shadow-purple-950/20 border border-purple-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/40 flex items-center gap-1">
              <Code2 className="w-3 h-3 text-purple-300" /> Natural Language Synthesizer
            </span>
            <span className="text-xs text-purple-300 font-medium">
              Multilingual Text-to-Query across 447 Database Dialects
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-purple-400" />
            Query Synthesizer &amp; Index Architect
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 mt-1 max-w-3xl">
            Describe what you need in plain English or Bengali. Instantly synthesize high-performance SQL, MQL, Cypher, PromQL, CQL, or Vector searches along with zero-downtime index DDLs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-purple-600" /> Quick Prompts:
        </span>
        {samplePrompts.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => applySamplePrompt(s)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-purple-200 text-slate-700 hover:bg-purple-50 hover:border-purple-400 shadow-sm transition active:scale-95"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Natural Language Query Request (English / বাংলা):
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Find top 10 customers with highest purchase volume in 2024 who haven't placed an order in the last 60 days..."
              className="w-full p-3.5 rounded-xl text-xs sm:text-sm font-sans border border-purple-200 bg-purple-50/20 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Domain Schema Preset (52 Industry Verticals)
            </label>
            <select
              value={domainPreset}
              onChange={(e) => setDomainPreset(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <optgroup label="🛍️ Commerce, Retail &amp; Financial Services (10)">
                <option value="ecommerce">🛒 E-Commerce &amp; Retail (Orders, Items &amp; Checkout)</option>
                <option value="fintech">💳 FinTech &amp; Banking (Double-Entry Ledger &amp; Wire Transfers)</option>
                <option value="stock_trading">📈 Stock Exchange &amp; HFT (Order Book, Bids/Asks &amp; Trades)</option>
                <option value="crypto_web3">⚡ Crypto &amp; Web3 (Smart Contracts, Gas &amp; Wallets)</option>
                <option value="insurance_claims">📑 Insurance &amp; Actuarial (Policies, Claims &amp; Adjusters)</option>
                <option value="real_estate">🏡 Real Estate &amp; MLS (Properties, Leases &amp; Valuations)</option>
                <option value="pos_retail">🏪 POS &amp; Retail Checkout (Cashiers, Barcodes &amp; Receipts)</option>
                <option value="fraud_detection">🛡️ AML &amp; Fraud Detection (Velocity Rules, ML Risk &amp; Signals)</option>
                <option value="luxury_provenance">💎 Luxury Goods &amp; Authenticity (RFID, NFC &amp; Provenance)</option>
                <option value="live_events_ticketing">🎟️ Live Events &amp; Ticketing (Dynamic Pricing, Barcodes &amp; Gates)</option>
              </optgroup>
              <optgroup label="📊 Enterprise, Governance, Legal &amp; HR (10)">
                <option value="saas">📊 SaaS Multi-Tenant (Tenant Scopes, Events &amp; Audit Logs)</option>
                <option value="cybersecurity">🛡️ Cyber Security &amp; SIEM (Firewalls, CVEs &amp; Scans)</option>
                <option value="hr_payroll">👥 HRMS &amp; Global Payroll (Roster, Salaries &amp; Taxes)</option>
                <option value="legal_contracts">⚖️ LegalTech &amp; Compliance (NDAs, Redlines &amp; Jurisdictions)</option>
                <option value="customer_support">🎧 CRM &amp; Helpdesk (Tickets, SLA Timers &amp; CSAT Scores)</option>
                <option value="gov_civic_registry">🏛️ Civic Governance &amp; Citizen ID (Passports, Taxes &amp; Registry)</option>
                <option value="gdpr_privacy_audit">⚖️ GDPR &amp; Data Privacy Governance (DSAR, Consent &amp; Purge)</option>
                <option value="compliance_sox">📑 SOX Compliance &amp; Audit Logs (Privileged Access &amp; Changes)</option>
                <option value="procurement_rfp">📋 Enterprise Procurement &amp; RFP (Vendor Quotations &amp; POs)</option>
                <option value="facility_management">🏨 Facility &amp; Asset Management (HVAC, Sensors &amp; Maintenance)</option>
              </optgroup>
              <optgroup label="🏥 Healthcare, Pharma &amp; Life Sciences (5)">
                <option value="healthcare">🏥 Healthcare &amp; EHR (Patients, Diagnoses &amp; HIPAA Records)</option>
                <option value="pharma_clinical">💊 Pharma &amp; Clinical Trials (Formulations, Dosages &amp; FDA)</option>
                <option value="genomics_sequencing">🧬 Genomics &amp; DNA Sequencing (Variant Calling, Mutations &amp; Reads)</option>
                <option value="radiology_dicom">🏥 Radiology PACS &amp; Medical Imaging (DICOM Metadata &amp; Scans)</option>
                <option value="fitness_wearables">🏋️ Fitness &amp; Wearables Health (HRV, Sleep Stages &amp; SpO2)</option>
              </optgroup>
              <optgroup label="Vector, Real-Time Media &amp; Communications (12)">
                <option value="vector_embeddings">Vector Search (1536-dim RAG Embeddings)</option>
                <option value="iot">📡 IoT &amp; Smart Telemetry (Sensors, Temp &amp; Vibration)</option>
                <option value="ride_sharing">🚗 Ride-Sharing &amp; Mobility (Trips, GPS &amp; Surge Dispatch)</option>
                <option value="food_delivery">🍕 Food Delivery &amp; Kitchens (Live Courier GPS &amp; Menus)</option>
                <option value="streaming_media">🎬 Streaming Media &amp; OTT (Video/Audio Playbacks &amp; Bitrates)</option>
                <option value="music_audio">🎵 Music &amp; Audio Streaming (Tracks, Royalty Splits &amp; Playlists)</option>
                <option value="gaming">🎮 Gaming &amp; Esports (Matches, Leaderboards &amp; Player Stats)</option>
                <option value="social_media">📱 Social Media &amp; Feeds (Posts, Graph &amp; Reactions)</option>
                <option value="telecom_5g">📶 Telecom &amp; 5G Carrier (CDRs, Cell Towers &amp; Roaming)</option>
                <option value="podcast_ad_tech">🎙️ Podcast AdTech &amp; Dynamic Audio (DAI, Mid-Rolls &amp; Geo)</option>
                <option value="digital_publishing">📰 Digital Publishing &amp; CMS (Articles, Paywalls &amp; SEO)</option>
                <option value="edtech">🎓 EdTech &amp; Learning LMS (Courses, Quizzes &amp; GPA Scores)</option>
              </optgroup>
              <optgroup label="🔬 Science, Energy, Transportation &amp; Logistics (15)">
                <option value="travel_hospitality">🏨 Travel &amp; Hospitality (Hotels, Flights &amp; Bookings)</option>
                <option value="supply_chain">🏭 Supply Chain &amp; ERP (Warehouse, SKUs &amp; Shipments)</option>
                <option value="energy_grid">⚡ Energy Grid &amp; Utilities (Smart Meters, Solar &amp; Outages)</option>
                <option value="ev_charging">🔌 EV Charging Network (Terminals, kWh Dispensed &amp; Batts)</option>
                <option value="aerospace_flight">✈️ Aviation &amp; Space Flight (ADS-B, Aircraft Tracking &amp; Radar)</option>
                <option value="meteorology">🌦️ Meteorology &amp; Climate (Doppler Radar, Pressures &amp; Wind)</option>
                <option value="smart_city">🏙️ Smart City &amp; Traffic (Sensors, ANPR &amp; Congestion Tolls)</option>
                <option value="agriculture_agtech">🚜 AgriTech &amp; Smart Farming (Soil, Crop Yield &amp; Irrigation)</option>
                <option value="autonomous_vehicles">🚗 Autonomous Vehicles &amp; V2X (CAN Bus, LiDAR &amp; Pathfinding)</option>
                <option value="warehouse_robotics">📦 Warehouse Automation &amp; AMR Robotics (Fleet, Pallets &amp; Paths)</option>
                <option value="maritime_shipping">⚓ Maritime Shipping &amp; AIS Logistics (Vessels, Containers &amp; Ports)</option>
                <option value="industrial_scada">🏭 Industrial Automation &amp; SCADA (PLCs, Vibration &amp; Motors)</option>
                <option value="satellite_constellation">📡 Satellite Constellation &amp; Orbit (TLE, Solar Arrays &amp; Downlink)</option>
                <option value="carbon_esg_tracking">🌿 Carbon Accounting &amp; ESG Audits (Scope 1/2/3 &amp; Offset Credits)</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Database Dialect ({DATABASE_CATALOG.length} Engines)
            </label>
            <UniversalDbSelector
              selectedEngine={targetEngine}
              onSelectEngine={(eng) => {
                setTargetEngine(eng);
                onSelectEngine?.(eng as DatabaseEngine);
              }}
            />
          </div>

          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => handleSynthesize()}
              disabled={isLoading || !prompt.trim()}
              className="w-full px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-lg shadow-purple-500/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Synthesizing...</span>
              ) : (
                <>
                  <Terminal className="w-4 h-4" />
                  <span>Synthesize Dialect Query &amp; Index ➔</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Time Complexity</span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-sm font-black text-purple-950 font-mono">
                {result.complexityAnalysis.timeComplexity}
              </div>
              <p className="text-[11px] text-slate-500">Sargable scan bound</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Memory Overhead</span>
                <Cpu className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-sm font-black text-indigo-950 font-mono">
                {result.complexityAnalysis.estimatedMemory}
              </div>
              <p className="text-[11px] text-slate-500">Hash table &amp; sort buffer</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Index Retrieval Type</span>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-sm font-black text-emerald-950 font-mono">
                {result.complexityAnalysis.indexLookupType}
              </div>
              <p className="text-[11px] text-slate-500">Index-accelerated access</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-bold text-slate-900">
                  Synthesized {targetMeta.icon} {result.engineName} Query ({result.dialectCategory})
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyQuery}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white border border-purple-300 text-purple-900 hover:bg-purple-50 shadow-sm transition active:scale-95"
              >
                {copiedQuery ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedQuery ? 'Copied' : 'Copy Query'}</span>
              </button>
            </div>
            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-purple-200 overflow-x-auto selection:bg-purple-600 selection:text-white">
              {result.synthesizedQuery}
            </pre>
          </div>

          {result.zeroDowntimeIndexDdl && (
            <div className="rounded-2xl bg-white border border-emerald-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950">
                    Zero-Downtime Concurrent Indexing Script ({result.engineName})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyIndex}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-sm transition active:scale-95"
                >
                  {copiedIndexDdl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIndexDdl ? 'Copied' : 'Copy Index DDL'}</span>
                </button>
              </div>
              <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-emerald-300 overflow-x-auto selection:bg-emerald-600 selection:text-white">
                {result.zeroDowntimeIndexDdl}
              </pre>
            </div>
          )}

          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 border border-purple-200 shadow-sm space-y-3">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-950 mb-1">
                Query Architecture Explanation
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">{result.queryExplanation}</p>
            </div>

            {result.antipatternWarnings.length > 0 && (
              <div className="pt-2 border-t border-purple-100">
                <h5 className="text-xs font-bold text-purple-900 mb-1">
                  Performance Guardrails &amp; Anti-Patterns Avoided:
                </h5>
                <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                  {result.antipatternWarnings.map((w, idx) => (
                    <li key={idx} className="leading-relaxed">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
