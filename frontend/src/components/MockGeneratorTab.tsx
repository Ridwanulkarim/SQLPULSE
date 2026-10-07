import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG, MockDataResult, DomainPresetType } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { generateMockDataset } from '../services/api';
import { Database, Copy, Check, RefreshCw, Layers, Gauge, Terminal, Zap, FileSpreadsheet, AlertTriangle } from 'lucide-react';

interface MockGeneratorTabProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
}

export const MockGeneratorTab: React.FC<MockGeneratorTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [preset, setPreset] = useState<DomainPresetType>('ecommerce');
  const [rowCount, setRowCount] = useState<number>(5000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MockDataResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateMockDataset({
        engine: selectedEngine,
        preset,
        rowCount,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate mock data');
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically adjust domain preset and row volume based on engine family
  useEffect(() => {
    const norm = selectedEngine.toLowerCase();
    const meta = DATABASE_CATALOG.find(d => d.id === selectedEngine);
    const cat = meta?.category;

    if (cat === 'timeseries' || norm.includes('timescale') || norm.includes('influx')) {
      setPreset('iot');
      setRowCount(25000);
    } else if (cat === 'olap' || norm.includes('click') || norm.includes('snow')) {
      setPreset('fraud_detection');
      setRowCount(50000);
    } else if (cat === 'vector' || norm.includes('milvus') || norm.includes('pinecone')) {
      setPreset('vector_embeddings');
      setRowCount(10000);
    } else if (cat === 'keyvalue' || norm.includes('redis')) {
      setPreset('gaming');
      setRowCount(20000);
    } else if (cat === 'baas_embedded' || norm.includes('sqlite')) {
      setPreset('saas');
      setRowCount(1500);
    }
  }, [selectedEngine]);

  useEffect(() => {
    handleGenerate();
  }, [selectedEngine, preset, rowCount]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-fuchsia-950 to-purple-950 text-white shadow-xl shadow-fuchsia-950/20 border border-fuchsia-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-400/40">
              Realistic Synthetic Datasets &amp; Benchmarks
            </span>
            <span className="text-xs text-fuchsia-300 font-medium">
              447 Database Engines • 52 Industry Domain Presets • Streaming Load Scripts
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-fuchsia-400" />
            Synthetic Mock Data &amp; Load Benchmark Generator
          </h2>
          <p className="text-xs sm:text-sm text-fuchsia-100/90 mt-1 max-w-3xl">
            Synthesize 1,000 to 1,000,000+ realistic records across 52 business verticals for {engineMeta.name}. Export bulk binary inserts (`COPY`, multi-value batches, RESP pipe) and high-concurrency stress benchmarks (`pgbench`, `sysbench`, `k6`).
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-fuchsia-600" />
              Domain Schema Preset (52 Industry Verticals)
            </label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
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
              <optgroup label="🚀 AI, Real-Time Media &amp; Communications (12)">
                <option value="vector_embeddings">🧠 GenAI &amp; Vector Search (1536-dim RAG Embeddings)</option>
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
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              Row Volume ({rowCount.toLocaleString()} Records)
            </label>
            <select
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value={100}>100 Rows (Quick Dev Preview)</option>
              <option value={1000}>1,000 Rows (Integration Tests)</option>
              <option value={5000}>5,000 Rows (Staging Batch)</option>
              <option value={50000}>50,000 Rows (Performance Audit)</option>
              <option value={500000}>500,000 Rows (Stress / Load Test)</option>
              <option value={1000000}>1,000,000 Rows (Big Data Scale)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 text-white shadow-md shadow-fuchsia-500/20 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              <span>Generate Mock Dataset ➔</span>
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
            <div className="p-4 rounded-2xl bg-white border border-fuchsia-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-fuchsia-700 uppercase tracking-wider block">
                Estimated Ingestion Rate
              </span>
              <div className="text-2xl font-black text-fuchsia-900 font-mono">
                {result.performanceCharacteristics.ingestionRateRowsPerSec}
              </div>
              <p className="text-[11px] text-fuchsia-700 font-medium">Via native binary pipeline</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Payload Footprint
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {result.estimatedSizeFormatted}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {result.rowCount.toLocaleString()} target records
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                RAM Overhead
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {result.performanceCharacteristics.ramFootprintMb}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Working memory required</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                Index Build Time
              </span>
              <div className="text-2xl font-black text-emerald-800 font-mono">
                {result.performanceCharacteristics.indexBuildTimeSec}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">Post-load index creation</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-fuchsia-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Sample Record Schema &amp; Field Distribution ({engineMeta.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(result.sampleRecordsJson, null, 2), 'sample')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
              >
                {copiedKey === 'sample' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                <span>{copiedKey === 'sample' ? 'Copied' : 'Copy Sample JSON'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-fuchsia-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-[260px] selection:bg-fuchsia-600 selection:text-white">
              {JSON.stringify(result.sampleRecordsJson, null, 2)}
            </pre>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      High-Throughput Bulk Ingestion Script
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.bulkScript, 'bulk')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copiedKey === 'bulk' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copiedKey === 'bulk' ? 'Copied' : 'Copy Bulk Script'}</span>
                  </button>
                </div>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-amber-200 font-mono text-xs overflow-x-auto leading-relaxed max-h-[320px] selection:bg-amber-600 selection:text-white">
                  {result.bulkScript}
                </pre>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      High-Concurrency Stress &amp; Load Benchmark
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.benchmarkScript, 'bench')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copiedKey === 'bench' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copiedKey === 'bench' ? 'Copied' : 'Copy Benchmark'}</span>
                  </button>
                </div>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-[320px] selection:bg-cyan-600 selection:text-white">
                  {result.benchmarkScript}
                </pre>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-950 dark:text-purple-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />
              High-Velocity Bulk Loading Principles:
            </h3>
            <ul className="space-y-1.5">
              {result.expertRecommendations.map((rec, i) => (
                <li key={i} className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-600 dark:bg-fuchsia-400 mt-1.5 flex-shrink-0" />
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
