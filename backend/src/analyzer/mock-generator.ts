import { DATABASE_CATALOG } from '../types/db-catalog.data';

export type DomainPresetType =
  
  | 'ecommerce'
  | 'fintech'
  | 'stock_trading'
  | 'crypto_web3'
  | 'insurance_claims'
  | 'real_estate'
  | 'pos_retail'
  | 'fraud_detection'
  | 'luxury_provenance'
  | 'live_events_ticketing'
  // 📊 Enterprise, Governance, Legal & HR
  | 'saas'
  | 'cybersecurity'
  | 'hr_payroll'
  | 'legal_contracts'
  | 'customer_support'
  | 'gov_civic_registry'
  | 'gdpr_privacy_audit'
  | 'compliance_sox'
  | 'procurement_rfp'
  | 'facility_management'
  // 🏥 Healthcare, Pharma, Biotech & Life Sciences
  | 'healthcare'
  | 'pharma_clinical'
  | 'genomics_sequencing'
  | 'radiology_dicom'
  | 'fitness_wearables'
  // 🚀 AI, Real-Time Media, Gaming & Communications
  | 'vector_embeddings'
  | 'iot'
  | 'ride_sharing'
  | 'food_delivery'
  | 'streaming_media'
  | 'music_audio'
  | 'gaming'
  | 'social_media'
  | 'telecom_5g'
  | 'podcast_ad_tech'
  | 'digital_publishing'
  | 'edtech'
  // 🔬 Science, Clean Energy, Transportation & Logistics
  | 'travel_hospitality'
  | 'supply_chain'
  | 'energy_grid'
  | 'ev_charging'
  | 'aerospace_flight'
  | 'meteorology'
  | 'smart_city'
  | 'agriculture_agtech'
  | 'autonomous_vehicles'
  | 'warehouse_robotics'
  | 'maritime_shipping'
  | 'industrial_scada'
  | 'satellite_constellation'
  | 'carbon_esg_tracking';

export interface MockGeneratorRequest {
  engine: string;
  preset?: DomainPresetType;
  rowCount?: number;
  format?: 'sql' | 'copy' | 'json' | 'redis' | 'benchmark';
}

export interface MockDataResult {
  engine: string;
  engineName: string;
  preset: string;
  presetLabel: string;
  rowCount: number;
  format: string;
  estimatedSizeBytes: number;
  estimatedSizeFormatted: string;
  sampleRecordsJson: any[];
  bulkScript: string;
  benchmarkScript: string;
  performanceCharacteristics: {
    ingestionRateRowsPerSec: string;
    indexBuildTimeSec: string;
    ramFootprintMb: string;
  };
  expertRecommendations: string[];
}

function getEngineMeta(engineId: string) {
  const found = DATABASE_CATALOG.find(db => db.id === engineId.toLowerCase());
  if (found) return found;
  return {
    id: engineId,
    name: engineId.charAt(0).toUpperCase() + engineId.slice(1),
    category: 'relational',
    categoryLabel: 'Relational (SQL)',
    icon: '🗄️',
    rank: 999,
    popularityScore: 10,
    commandHint: 'EXPLAIN <query>',
    description: 'Database Engine'
  };
}

export class MockGeneratorAnalyzer {
  public generate(req: MockGeneratorRequest): MockDataResult {
    const meta = getEngineMeta(req.engine);
    const norm = req.engine.toLowerCase();
    const preset: DomainPresetType = req.preset || 'ecommerce';
    const rowCount = Math.max(10, Math.min(1000000, req.rowCount || 5000));
    const format = req.format || (norm === 'mongodb' ? 'json' : norm === 'redis' ? 'redis' : 'sql');

    let sampleRecordsJson: any[] = [];
    let tableName = 'orders';
    let presetLabel = '🛒 E-Commerce (Orders & Checkout)';
    let bulkScript = '';
    let benchmarkScript = '';

    switch (preset) {
      
      case 'ecommerce':
        tableName = 'orders';
        presetLabel = '🛒 E-Commerce & Retail (Orders, Items & Checkout)';
        sampleRecordsJson = [
          { order_id: 'ord_9182741', customer_id: 'cust_8819', items_count: 4, total_price: 189.50, status: 'COMPLETED', payment_method: 'STRIPE_CARD', shipping_country: 'USA', created_at: '2026-10-03T08:00:00Z' },
          { order_id: 'ord_9182742', customer_id: 'cust_2201', items_count: 1, total_price: 29.99, status: 'PENDING_PAYMENT', payment_method: 'PAYPAL', shipping_country: 'DEU', created_at: '2026-10-03T08:02:11Z' },
          { order_id: 'ord_9182743', customer_id: 'cust_7714', items_count: 2, total_price: 74.00, status: 'SHIPPED', payment_method: 'APPLE_PAY', shipping_country: 'GBR', created_at: '2026-10-03T08:04:45Z' }
        ];
        break;

      case 'fintech':
        tableName = 'transactions';
        presetLabel = '💳 FinTech & Banking (Ledger & Wire Transfers)';
        sampleRecordsJson = [
          { txn_id: 'tx_984128a1c9', account_id: 'acc_77218', amount: 1420.50, currency: 'USD', type: 'wire_transfer', status: 'cleared', risk_score: 0.04, timestamp: '2026-10-03T08:12:44Z' },
          { txn_id: 'tx_984128a1d0', account_id: 'acc_89102', amount: 89.99, currency: 'EUR', type: 'card_swipe', status: 'cleared', risk_score: 0.12, timestamp: '2026-10-03T08:14:10Z' },
          { txn_id: 'tx_984128a1d1', account_id: 'acc_33912', amount: 12500.00, currency: 'USD', type: 'cross_border_swift', status: 'flagged_review', risk_score: 0.88, timestamp: '2026-10-03T08:15:22Z' }
        ];
        break;

      case 'travel_hospitality':
        tableName = 'hotel_bookings';
        presetLabel = '🏨 Travel & Hospitality (Hotels, Flights & Bookings)';
        sampleRecordsJson = [
          { booking_ref: 'HTL_BK_88192', guest_id: 'gst_99120', hotel_id: 'htl_tokyo_shinjuku', room_type: 'deluxe_king', checkin_date: '2026-11-10', checkout_date: '2026-11-15', total_nights: 5, total_price_usd: 1250.00, payment_status: 'confirmed', created_at: '2026-10-03T08:48:00Z' },
          { booking_ref: 'FLT_BK_77192', guest_id: 'gst_44102', hotel_id: 'htl_paris_eiffel', room_type: 'executive_suite', checkin_date: '2026-12-01', checkout_date: '2026-12-05', total_nights: 4, total_price_usd: 2100.00, payment_status: 'confirmed', created_at: '2026-10-03T08:49:10Z' }
        ];
        break;

      case 'supply_chain':
        tableName = 'inventory_shipments';
        presetLabel = '🏭 Supply Chain & ERP (Warehouse, SKUs & Shipments)';
        sampleRecordsJson = [
          { shipment_id: 'SHP_99182', warehouse_id: 'WH_ROTTERDAM_01', sku: 'SKU_CHIP_NVME_2TB', quantity: 4500, unit_cost_usd: 85.00, vendor_id: 'VND_SAMSUNG_SEMI', destination_hub: 'HUB_FRANKFURT', status: 'customs_cleared', est_arrival: '2026-10-08', created_at: '2026-10-03T08:58:00Z' },
          { shipment_id: 'SHP_99183', warehouse_id: 'WH_SINGAPORE_03', sku: 'SKU_DDR5_RAM_64GB', quantity: 12000, unit_cost_usd: 110.00, vendor_id: 'VND_MICRON_TECH', destination_hub: 'HUB_TOKYO', status: 'in_transit_sea', est_arrival: '2026-10-15', created_at: '2026-10-03T08:59:20Z' }
        ];
        break;

      case 'insurance_claims':
        tableName = 'insurance_claims';
        presetLabel = '📑 Insurance & Actuarial (Policies, Claims & Adjusters)';
        sampleRecordsJson = [
          { claim_id: 'CLM_2026_9941', policy_number: 'POL_AUTO_88192', policyholder_id: 'usr_pol_102', incident_date: '2026-09-28', claim_amount_usd: 4850.00, deductible_usd: 500.00, claim_type: 'collision', status: 'under_investigation', adjuster_id: 'adj_sarah_m', created_at: '2026-10-03T09:00:00Z' },
          { claim_id: 'CLM_2026_9942', policy_number: 'POL_HOME_33104', policyholder_id: 'usr_pol_592', incident_date: '2026-09-30', claim_amount_usd: 18200.00, deductible_usd: 1000.00, claim_type: 'water_damage', status: 'approved_pending_payout', adjuster_id: 'adj_mark_k', created_at: '2026-10-03T09:02:15Z' }
        ];
        break;

      case 'real_estate':
        tableName = 'property_listings';
        presetLabel = '🏡 Real Estate & MLS (Properties, Leases & Valuations)';
        sampleRecordsJson = [
          { listing_id: 'MLS_994120', property_address: '742 Evergreen Terrace', city: 'Springfield', state: 'OR', zip_code: '97477', property_type: 'single_family', price_usd: 540000.00, bedrooms: 4, bathrooms: 2.5, sqft: 2850, year_built: 2018, status: 'active_listing', created_at: '2026-10-03T09:05:00Z' },
          { listing_id: 'MLS_994121', property_address: '100 Market St, Penthouse 42', city: 'San Francisco', state: 'CA', zip_code: '94105', property_type: 'condo_luxury', price_usd: 2450000.00, bedrooms: 3, bathrooms: 3.0, sqft: 2100, year_built: 2022, status: 'pending_contract', created_at: '2026-10-03T09:06:20Z' }
        ];
        break;

      case 'stock_trading':
        tableName = 'market_trades';
        presetLabel = '📈 Stock Exchange & HFT (Order Book, Bids/Asks & Trades)';
        sampleRecordsJson = [
          { trade_id: 'TRD_NASDAQ_00192', symbol: 'NVDA', exchange: 'NASDAQ', trade_price: 138.45, trade_size: 500, side: 'BUY', order_type: 'LIMIT', maker_order_id: 'ord_mk_8819', taker_order_id: 'ord_tk_2210', latency_micros: 14, timestamp: '2026-10-03T09:10:00.124500Z' },
          { trade_id: 'TRD_NYSE_00841', symbol: 'AAPL', exchange: 'NYSE', trade_price: 228.10, trade_size: 1200, side: 'SELL', order_type: 'MARKET', maker_order_id: 'ord_mk_4401', taker_order_id: 'ord_tk_9912', latency_micros: 11, timestamp: '2026-10-03T09:10:00.124580Z' }
        ];
        break;

      case 'pos_retail':
        tableName = 'pos_receipts';
        presetLabel = '🏪 POS & Retail Checkout (Cashiers, Barcodes & Receipts)';
        sampleRecordsJson = [
          { receipt_id: 'RCP_STORE_042_991', store_id: 'STR_BERLIN_MITTE', terminal_id: 'POS_04', cashier_id: 'emp_hannah_88', barcode_sku: '4008400404128', item_name: 'Organic Espresso Beans 1kg', quantity: 2, subtotal_eur: 34.00, tax_eur: 2.38, payment_type: 'CONTACTLESS_NFC', timestamp: '2026-10-03T09:15:00Z' },
          { receipt_id: 'RCP_STORE_042_992', store_id: 'STR_BERLIN_MITTE', terminal_id: 'POS_02', cashier_id: 'emp_lukas_12', barcode_sku: '4008400881920', item_name: 'Almond Milk Barista 1L', quantity: 6, subtotal_eur: 14.94, tax_eur: 1.05, payment_type: 'CHIP_PIN', timestamp: '2026-10-03T09:16:15Z' }
        ];
        break;

      case 'saas':
        tableName = 'audit_events';
        presetLabel = '📊 SaaS Multi-Tenant (Tenant Scopes, Events & Audit Logs)';
        sampleRecordsJson = [
          { event_id: 'evt_00192a', tenant_id: 'org_acme_corp', user_id: 'usr_sarah92', action: 'workspace.invite_sent', ip_address: '198.51.100.42', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', latency_ms: 42, created_at: '2026-10-03T08:20:00Z' },
          { event_id: 'evt_00192b', tenant_id: 'org_pied_piper', user_id: 'usr_richard', action: 'file.compressed_stream', ip_address: '203.0.113.19', user_agent: 'Go-http-client/1.1', latency_ms: 18, created_at: '2026-10-03T08:21:15Z' }
        ];
        break;

      case 'cybersecurity':
        tableName = 'security_threat_logs';
        presetLabel = '🛡️ Cyber Security & SIEM (Firewalls, CVEs & Scans)';
        sampleRecordsJson = [
          { log_id: 'siem_00192a', source_ip: '198.51.100.99', destination_port: 22, protocol: 'SSH', threat_level: 'CRITICAL', rule_id: 'SIG_BRUTE_FORCE_SSH', action: 'BLOCKED', geo_country: 'UNKNOWN', timestamp: '2026-10-03T08:55:00Z' },
          { log_id: 'siem_00192b', source_ip: '203.0.113.44', destination_port: 443, protocol: 'HTTPS', threat_level: 'HIGH', rule_id: 'SIG_SQLI_INJECTION_ATTEMPT', action: 'QUARANTINED', geo_country: 'DEU', timestamp: '2026-10-03T08:56:10Z' }
        ];
        break;

      case 'crypto_web3':
        tableName = 'blockchain_blocks';
        presetLabel = '⚡ Crypto & Web3 (Smart Contracts, Gas & Wallets)';
        sampleRecordsJson = [
          { tx_hash: '0x8f9128a1c900e84b912a781290bb341029384729104857291038472910293847', from_address: '0x71C...8912', to_address: '0x32A...4401', value_eth: 3.450000, gas_price_gwei: 28.5, gas_used: 21000, block_number: 20849102, status: 'success', timestamp: '2026-10-03T08:53:00Z' },
          { tx_hash: '0x12a9128b7700e12b8841a992810bb44102938472910485729103847291029112', from_address: '0x99D...1102', to_address: '0xUniSwapV3Pool', value_eth: 12.000000, gas_price_gwei: 32.0, gas_used: 145000, block_number: 20849103, status: 'success', timestamp: '2026-10-03T08:54:12Z' }
        ];
        break;

      case 'healthcare':
        tableName = 'patient_encounters';
        presetLabel = '🏥 Healthcare & EHR (Patients, Diagnoses & HIPAA Records)';
        sampleRecordsJson = [
          { encounter_id: 'enc_99412', patient_mrn: 'MRN_881023', provider_npi: '1892837192', icd10_code: 'E11.9', diagnosis: 'Type 2 Diabetes without complications', bp_systolic: 128, bp_diastolic: 82, encounter_type: 'outpatient', created_at: '2026-10-03T08:30:00Z' },
          { encounter_id: 'enc_99413', patient_mrn: 'MRN_441209', provider_npi: '1092847291', icd10_code: 'I10', diagnosis: 'Essential Primary Hypertension', bp_systolic: 142, bp_diastolic: 94, encounter_type: 'emergency', created_at: '2026-10-03T08:32:15Z' }
        ];
        break;

      case 'pharma_clinical':
        tableName = 'clinical_trials';
        presetLabel = '💊 Pharma & Clinical Trials (Formulations, Dosages & FDA)';
        sampleRecordsJson = [
          { trial_id: 'NCT0489120', protocol_code: 'ONCO_PHASE_III_88', subject_id: 'SUBJ_FRA_104', cohort_group: 'DOSE_100MG_BID', drug_molecule: 'MK-8419B', efficacy_response: 'PARTIAL_RESPONSE', adverse_event_grade: 1, biomarker_value: 4.82, visit_date: '2026-10-03T09:20:00Z' },
          { trial_id: 'NCT0489120', protocol_code: 'ONCO_PHASE_III_88', subject_id: 'SUBJ_FRA_108', cohort_group: 'PLACEBO_CONTROL', drug_molecule: 'PLACEBO', efficacy_response: 'STABLE_DISEASE', adverse_event_grade: 0, biomarker_value: 12.10, visit_date: '2026-10-03T09:22:00Z' }
        ];
        break;

      case 'hr_payroll':
        tableName = 'payroll_runs';
        presetLabel = '👥 HRMS & Global Payroll (Roster, Salaries & Taxes)';
        sampleRecordsJson = [
          { payroll_id: 'PAY_2026_10_01', employee_id: 'EMP_99218', department: 'Cloud Infrastructure', gross_salary_usd: 12500.00, net_payout_usd: 8940.50, federal_tax_usd: 2450.00, state_tax_usd: 820.00, retirement_401k_usd: 289.50, pay_period: '2026-10-01 to 2026-10-15', status: 'DIRECT_DEPOSIT_CLEARED' },
          { payroll_id: 'PAY_2026_10_02', employee_id: 'EMP_44102', department: 'Machine Learning Research', gross_salary_usd: 14800.00, net_payout_usd: 10450.00, federal_tax_usd: 3100.00, state_tax_usd: 950.00, retirement_401k_usd: 300.00, pay_period: '2026-10-01 to 2026-10-15', status: 'DIRECT_DEPOSIT_CLEARED' }
        ];
        break;

      case 'legal_contracts':
        tableName = 'legal_agreements';
        presetLabel = '⚖️ LegalTech & Compliance (NDAs, Redlines & Jurisdictions)';
        sampleRecordsJson = [
          { contract_id: 'CTR_MSA_2026_881', client_name: 'Acme Global Holdings Inc', contract_type: 'MASTER_SERVICES_AGREEMENT', governing_law: 'STATE_OF_DELAWARE', contract_value_usd: 450000.00, liability_cap_usd: 1000000.00, effective_date: '2026-10-01', expiry_date: '2029-09-30', signature_status: 'FULLY_EXECUTED_DOCUSIGN' },
          { contract_id: 'CTR_NDA_2026_440', client_name: 'HyperScale AI Labs GmbH', contract_type: 'MUTUAL_NDA_CONFIDENTIALITY', governing_law: 'FEDERAL_REPUBLIC_OF_GERMANY', contract_value_usd: 0.00, liability_cap_usd: 500000.00, effective_date: '2026-10-03', expiry_date: '2028-10-02', signature_status: 'PENDING_COUNTERSIGN' }
        ];
        break;

      case 'customer_support':
        tableName = 'crm_tickets';
        presetLabel = '🎧 CRM & Helpdesk (Tickets, SLA Timers & CSAT Scores)';
        sampleRecordsJson = [
          { ticket_id: 'TCK_881920', customer_email: 'cto@techcorp.io', priority: 'URGENT_P1', category: 'DATABASE_TIMEOUT', assigned_agent: 'agent_alex_tier3', sla_due_minutes: 30, first_response_mins: 8, resolution_status: 'IN_PROGRESS', csat_score: null, created_at: '2026-10-03T09:25:00Z' },
          { ticket_id: 'TCK_881921', customer_email: 'dev@fintech.co', priority: 'MEDIUM_P3', category: 'API_RATE_LIMIT_INCREASE', assigned_agent: 'agent_elena_tier2', sla_due_minutes: 240, first_response_mins: 22, resolution_status: 'RESOLVED', csat_score: 5, created_at: '2026-10-03T09:28:10Z' }
        ];
        break;

      case 'vector_embeddings':
        tableName = 'document_embeddings';
        presetLabel = '🧠 GenAI & Vector Search (1536-dim RAG Embeddings)';
        sampleRecordsJson = [
          { doc_id: 'doc_rag_88192', title: 'Antigravity Distributed Query Engine', chunk_index: 0, embedding_1536d: [0.0241, -0.0192, 0.0881, 0.0124, -0.0451, '... (1536 dims)'], metadata: { category: 'database_internals', tokens: 340 } },
          { doc_id: 'doc_rag_88193', title: 'MVCC Deadlock Mitigation Whitepaper', chunk_index: 1, embedding_1536d: [-0.0112, 0.0452, -0.0031, 0.0782, 0.0319, '... (1536 dims)'], metadata: { category: 'concurrency', tokens: 410 } }
        ];
        break;

      case 'iot':
        tableName = 'sensor_telemetry';
        presetLabel = '📡 IoT & Smart Telemetry (Sensors, Temp & Vibration)';
        sampleRecordsJson = [
          { sensor_id: 'snr_temp_bay_04', facility: 'Frankfurt-DC-01', temperature_c: 21.4, humidity_pct: 44.2, vibration_hz: 0.08, battery_pct: 98, timestamp: '2026-10-03T08:25:00.120Z' },
          { sensor_id: 'snr_temp_bay_05', facility: 'Frankfurt-DC-01', temperature_c: 22.1, humidity_pct: 45.0, vibration_hz: 0.11, battery_pct: 95, timestamp: '2026-10-03T08:25:01.400Z' }
        ];
        break;

      case 'ride_sharing':
        tableName = 'rides';
        presetLabel = '🚗 Ride-Sharing & Logistics (Trips, GPS Coordinates & Drivers)';
        sampleRecordsJson = [
          { trip_id: 'trip_88291a', passenger_id: 'usr_pax_102', driver_id: 'drv_7741', origin_lat: 40.7128, origin_lng: -74.0060, dest_lat: 40.7589, dest_lng: -73.9851, fare_usd: 24.50, surge_multiplier: 1.25, status: 'completed', duration_mins: 18.5, timestamp: '2026-10-03T08:35:00Z' },
          { trip_id: 'trip_88291b', passenger_id: 'usr_pax_509', driver_id: 'drv_2219', origin_lat: 37.7749, origin_lng: -122.4194, dest_lat: 37.7833, dest_lng: -122.4167, fare_usd: 12.00, surge_multiplier: 1.0, status: 'in_transit', duration_mins: 8.2, timestamp: '2026-10-03T08:36:11Z' }
        ];
        break;

      case 'streaming_media':
        tableName = 'playback_streams';
        presetLabel = '🎬 Streaming Media & OTT (Video/Audio Playbacks & Bitrates)';
        sampleRecordsJson = [
          { stream_id: 'strm_99218', subscriber_id: 'sub_88102', content_id: 'mov_interstellar_4k', resolution: '3840x2160', bitrate_kbps: 18500, cdn_node: 'cdn-fra-04', buffer_health_sec: 45.2, watch_duration_sec: 3600, device_type: 'AppleTV_4K', timestamp: '2026-10-03T08:50:00Z' },
          { stream_id: 'strm_99219', subscriber_id: 'sub_11029', content_id: 'ser_stranger_things_s5e1', resolution: '1920x1080', bitrate_kbps: 5800, cdn_node: 'cdn-iad-02', buffer_health_sec: 28.0, watch_duration_sec: 1420, device_type: 'iPhone_16_Pro', timestamp: '2026-10-03T08:51:30Z' }
        ];
        break;

      case 'gaming':
        tableName = 'player_sessions';
        presetLabel = '🎮 Gaming & Esports (Matches, Leaderboards & Player Stats)';
        sampleRecordsJson = [
          { session_id: 'game_match_9921', player_uuid: 'ply_884192', game_mode: 'battle_royale_ranked', kills: 7, damage_dealt: 1420, rank_tier: 'Diamond_II', xp_gained: 850, micro_txn_spent: 4.99, session_duration_sec: 1240, timestamp: '2026-10-03T08:40:00Z' },
          { session_id: 'game_match_9922', player_uuid: 'ply_110294', game_mode: 'capture_the_flag', kills: 14, damage_dealt: 2890, rank_tier: 'Master', xp_gained: 1400, micro_txn_spent: 0.00, session_duration_sec: 900, timestamp: '2026-10-03T08:42:00Z' }
        ];
        break;

      case 'social_media':
        tableName = 'feed_posts';
        presetLabel = '📱 Social Media & Feeds (Posts, Graph & Reactions)';
        sampleRecordsJson = [
          { post_id: 'post_00192', author_id: 'usr_tech_guru', content_text: 'Scaling distributed consensus with Raft and RocksDB in 2026! 🚀', likes_count: 1420, comments_count: 89, shares_count: 240, media_url: 'https://cdn.example.com/images/arch.png', is_pinned: true, created_at: '2026-10-03T08:45:00Z' },
          { post_id: 'post_00193', author_id: 'usr_ai_researcher', content_text: 'Zero-downtime database indexing guide is live.', likes_count: 850, comments_count: 42, shares_count: 110, media_url: null, is_pinned: false, created_at: '2026-10-03T08:46:30Z' }
        ];
        break;

      case 'music_audio':
        tableName = 'audio_streams';
        presetLabel = '🎵 Music & Audio Streaming (Tracks, Royalty Splits & Playlists)';
        sampleRecordsJson = [
          { stream_id: 'mus_str_88192', listener_id: 'usr_audiophile_9', track_isrc: 'US-S1Z-26-00192', track_title: 'Midnight Synth Odyssey', artist_id: 'art_daft_retro', album_id: 'alb_future_2026', playback_seconds: 240, bit_depth: '24bit_96khz_FLAC', royalty_rate_usd: 0.0042, timestamp: '2026-10-03T09:30:00Z' },
          { stream_id: 'mus_str_88193', listener_id: 'usr_rock_fan_42', track_isrc: 'GB-AYE-26-00441', track_title: 'Quantum Resonance', artist_id: 'art_ambient_mind', album_id: 'alb_nebula', playback_seconds: 185, bit_depth: '16bit_44khz_AAC', royalty_rate_usd: 0.0038, timestamp: '2026-10-03T09:32:15Z' }
        ];
        break;

      case 'telecom_5g':
        tableName = 'cdr_call_records';
        presetLabel = '📶 Telecom & 5G Carrier (CDRs, Cell Towers & Roaming)';
        sampleRecordsJson = [
          { cdr_id: 'CDR_5G_9941208', imsi: '310410884910293', calling_number: '+14155552671', called_number: '+442079460912', cell_tower_id: 'TWR_SFO_BAY_42B', call_duration_sec: 420, data_volume_mb: 850.4, network_type: '5G_STANDALONE_NR', roaming_partner: 'VODAFONE_UK', timestamp: '2026-10-03T09:35:00Z' },
          { cdr_id: 'CDR_5G_9941209', imsi: '310410110294812', calling_number: '+14155559812', called_number: '+12125553310', cell_tower_id: 'TWR_SFO_FIN_08A', call_duration_sec: 110, data_volume_mb: 120.0, network_type: '5G_NSA_LTE', roaming_partner: 'DOMESTIC', timestamp: '2026-10-03T09:36:30Z' }
        ];
        break;

      case 'food_delivery':
        tableName = 'food_orders';
        presetLabel = '🍕 Food Delivery & Kitchens (Live Courier GPS & Menus)';
        sampleRecordsJson = [
          { order_id: 'FOOD_ORD_88192', customer_id: 'usr_foodie_88', restaurant_id: 'rst_luigi_pizzeria', courier_id: 'courier_marco_bike', order_items_json: '[{"item":"Truffle Pizza","qty":2,"price":36.00},{"item":"Tiramisu","qty":1,"price":8.50}]', total_bill_usd: 49.50, courier_tip_usd: 5.00, courier_lat: 40.7306, courier_lng: -73.9352, status: 'OUT_FOR_DELIVERY', est_delivery_time: '2026-10-03T10:15:00Z' },
          { order_id: 'FOOD_ORD_88193', customer_id: 'usr_sushi_lover', restaurant_id: 'rst_tokyo_sushi_bar', courier_id: 'courier_ken_scooter', order_items_json: '[{"item":"Dragon Roll","qty":3,"price":48.00}]', total_bill_usd: 54.00, courier_tip_usd: 6.00, courier_lat: 40.7500, courier_lng: -73.9800, status: 'PREPARING_IN_KITCHEN', est_delivery_time: '2026-10-03T10:20:00Z' }
        ];
        break;

      case 'energy_grid':
        tableName = 'smart_meter_readings';
        presetLabel = '⚡ Energy Grid & Utilities (Smart Meters, Solar & Outages)';
        sampleRecordsJson = [
          { meter_id: 'MTR_GRID_FRA_8819', substation_id: 'SUB_FRANKFURT_NORD', active_power_kw: 4.82, reactive_power_kvar: 0.41, voltage_phase_a: 230.4, frequency_hz: 50.01, solar_infeed_kw: 2.10, grid_status: 'NORMAL_BALANCED', timestamp: '2026-10-03T09:40:00Z' },
          { meter_id: 'MTR_GRID_FRA_8820', substation_id: 'SUB_FRANKFURT_NORD', active_power_kw: 12.40, reactive_power_kvar: 1.10, voltage_phase_a: 228.9, frequency_hz: 49.98, solar_infeed_kw: 0.00, grid_status: 'HIGH_LOAD_WARNING', timestamp: '2026-10-03T09:40:15Z' }
        ];
        break;

      case 'ev_charging':
        tableName = 'ev_charging_sessions';
        presetLabel = '🔌 EV Charging Network (Terminals, kWh Dispensed & Batts)';
        sampleRecordsJson = [
          { session_id: 'EV_CHG_99412', charger_id: 'CHG_DC_SUPER_350KW_04', location_id: 'STN_AUTOBAHN_A5', vehicle_vin: '1G1FX6S08N4109281', battery_start_pct: 18, battery_current_pct: 78, kwh_delivered: 54.2, charging_speed_kw: 240.5, cost_eur: 37.94, connector_type: 'CCS_COMBO_2', timestamp: '2026-10-03T09:42:00Z' },
          { session_id: 'EV_CHG_99413', charger_id: 'CHG_DC_SUPER_350KW_02', location_id: 'STN_AUTOBAHN_A5', vehicle_vin: '5YJ3E1EB2MF881920', battery_start_pct: 35, battery_current_pct: 85, kwh_delivered: 42.0, charging_speed_kw: 180.0, cost_eur: 29.40, connector_type: 'NACS_TESLA', timestamp: '2026-10-03T09:43:10Z' }
        ];
        break;

      case 'aerospace_flight':
        tableName = 'adsb_flight_telemetry';
        presetLabel = '✈️ Aviation & Space Flight (ADS-B, Aircraft Tracking & Radar)';
        sampleRecordsJson = [
          { flight_icao24: 'a8819c', callsign: 'DLH400', aircraft_type: 'B747-8', origin_airport: 'EDDF', dest_airport: 'KJFK', altitude_ft: 36000, ground_speed_knots: 495, heading_deg: 285, current_lat: 54.8129, current_lng: -28.9102, vertical_rate_fpm: 0, squawk: '7700', timestamp: '2026-10-03T09:45:00Z' },
          { flight_icao24: '4b1209', callsign: 'BAW178', aircraft_type: 'A350-1000', origin_airport: 'EGLL', dest_airport: 'KORD', altitude_ft: 38000, ground_speed_knots: 512, heading_deg: 290, current_lat: 56.1029, current_lng: -32.1092, vertical_rate_fpm: 0, squawk: '2104', timestamp: '2026-10-03T09:45:30Z' }
        ];
        break;

      case 'meteorology':
        tableName = 'weather_stations';
        presetLabel = '🌦️ Meteorology & Climate (Doppler Radar, Pressures & Wind)';
        sampleRecordsJson = [
          { station_id: 'WTH_STN_ALP_2962', location_name: 'Zugspitze Summit Observatory', elevation_m: 2962, temp_celsius: -4.2, humidity_rh: 88.5, barometric_pressure_hpa: 704.2, wind_speed_kmh: 68.4, wind_direction_deg: 315, precipitation_mm_1h: 4.2, uv_index: 2, timestamp: '2026-10-03T09:48:00Z' },
          { station_id: 'WTH_STN_SEA_0005', location_name: 'Helgoland North Sea Buoy', elevation_m: 5, temp_celsius: 14.8, humidity_rh: 92.0, barometric_pressure_hpa: 1014.5, wind_speed_kmh: 45.0, wind_direction_deg: 270, precipitation_mm_1h: 0.0, uv_index: 3, timestamp: '2026-10-03T09:48:15Z' }
        ];
        break;

      case 'smart_city':
        tableName = 'traffic_intersections';
        presetLabel = '🏙️ Smart City & Traffic (Sensors, ANPR & Congestion Tolls)';
        sampleRecordsJson = [
          { intersection_id: 'INT_BER_ALEX_04', road_name: 'Alexanderplatz Main Arterial', vehicle_count_per_min: 142, avg_speed_kmh: 28.5, pedestrian_wait_time_sec: 35, signal_phase: 'GREEN_WAVE_NORTH', pollution_pm25_ugm3: 18.2, noise_decibels: 72.4, congestion_level: 'MODERATE', timestamp: '2026-10-03T09:50:00Z' },
          { intersection_id: 'INT_BER_POTS_01', road_name: 'Potsdamer Platz Hub', vehicle_count_per_min: 210, avg_speed_kmh: 18.0, pedestrian_wait_time_sec: 45, signal_phase: 'PEDESTRIAN_ALL_WALK', pollution_pm25_ugm3: 24.8, noise_decibels: 78.1, congestion_level: 'HEAVY_CONGESTION', timestamp: '2026-10-03T09:50:30Z' }
        ];
        break;

      case 'edtech':
        tableName = 'course_submissions';
        presetLabel = '🎓 EdTech & Learning LMS (Courses, Quizzes & GPA Scores)';
        sampleRecordsJson = [
          { submission_id: 'ED_SUB_88192', student_id: 'std_alex_99', course_code: 'CS_6420_DISTRIBUTED_SYSTEMS', module_name: 'Consensus Raft Implementation', quiz_score_pct: 96.5, time_spent_mins: 145, video_completion_pct: 100, attempts_count: 1, grade_letter: 'A+', timestamp: '2026-10-03T09:52:00Z' },
          { submission_id: 'ED_SUB_88193', student_id: 'std_elena_44', course_code: 'CS_6420_DISTRIBUTED_SYSTEMS', module_name: 'Paxos vs Multi-Raft Lab', quiz_score_pct: 88.0, time_spent_mins: 180, video_completion_pct: 95, attempts_count: 2, grade_letter: 'B+', timestamp: '2026-10-03T09:54:10Z' }
        ];
        break;

      case 'agriculture_agtech':
        tableName = 'crop_field_sensors';
        presetLabel = '🚜 AgriTech & Smart Farming (Soil, Crop Yield & Irrigation)';
        sampleRecordsJson = [
          { sensor_node_id: 'AGR_BAY_42_SOIL_01', field_id: 'FLD_CORN_NORTH_12', crop_type: 'Maize_Hybrid_F1', soil_moisture_pct: 38.4, soil_ph: 6.8, soil_nitrogen_ppm: 42.1, ambient_temp_c: 24.5, solar_radiation_w_m2: 820.0, irrigation_valve_state: 'VALVE_CLOSED_OPTIMAL', timestamp: '2026-10-03T09:56:00Z' },
          { sensor_node_id: 'AGR_BAY_42_SOIL_02', field_id: 'FLD_SOYBEAN_SOUTH_04', crop_type: 'Soybean_Organo', soil_moisture_pct: 22.0, soil_ph: 6.5, soil_nitrogen_ppm: 38.0, ambient_temp_c: 25.8, solar_radiation_w_m2: 840.0, irrigation_valve_state: 'VALVE_AUTO_OPEN_PUMPING', timestamp: '2026-10-03T09:56:45Z' }
        ];
        break;

      case 'fraud_detection':
        tableName = 'fraud_risk_evaluations';
        presetLabel = '🛡️ AML & Fraud Detection (Velocity Rules, ML Risk & Signals)';
        sampleRecordsJson = [
          { evaluation_id: 'FRD_EVAL_98129', transaction_ref: 'tx_wire_9182741', account_id: 'acc_us_88192', ip_reputation_score: 94.2, device_fingerprint_risk: 0.12, velocity_last_10m_count: 2, ml_fraud_probability: 0.035, action_decision: 'APPROVE_INSTANT', evaluated_at: '2026-10-03T09:58:00Z' },
          { evaluation_id: 'FRD_EVAL_98130', transaction_ref: 'tx_card_4410291', account_id: 'acc_hk_00192', ip_reputation_score: 21.0, device_fingerprint_risk: 0.89, velocity_last_10m_count: 14, ml_fraud_probability: 0.941, action_decision: 'STEP_UP_2FA_CHALLENGE', evaluated_at: '2026-10-03T09:58:30Z' }
        ];
        break;

      case 'luxury_provenance':
        tableName = 'luxury_asset_provenance';
        presetLabel = '💎 Luxury Goods & Authenticity (RFID, NFC & Physical Provenance)';
        sampleRecordsJson = [
          { asset_serial_number: 'ROLEX_DAYTONA_116500_SERIAL_9918', brand_identifier: 'ROLEX_GENEVA', certificate_hash: '0x8fba201e7492cda192', nfc_tag_uid: '04A1B2C3D4E5F6', manufacturer_facility: 'Geneva_Workshop_04', ownership_transfer_count: 2, current_custodian_vault: 'Zurich_Freeport_Secured', verification_status: 'VERIFIED_GENUINE', last_scanned_at: '2026-10-03T10:00:00Z' }
        ];
        break;

      case 'live_events_ticketing':
        tableName = 'concert_ticket_inventory';
        presetLabel = '🎟️ Live Events & Ticketing (Dynamic Pricing, Barcodes & Gates)';
        sampleRecordsJson = [
          { ticket_barcode_uuid: 'TCK_OASIS_2026_WEMBLEY_A109', event_id: 'EVT_OASIS_LIVE_2026', venue_section: 'CLUB_LEVEL_WEST', row_identifier: 'ROW_12', seat_number: 44, tier_category: 'VIP_HOSPITALITY', purchase_price_usd: 349.50, dynamic_surge_multiplier: 1.45, is_scanned_at_gate: false, gate_turnstile_id: null, purchased_at: '2026-10-03T10:02:00Z' },
          { ticket_barcode_uuid: 'TCK_OASIS_2026_WEMBLEY_A110', event_id: 'EVT_OASIS_LIVE_2026', venue_section: 'GENERAL_ADMISSION_PITCH', row_identifier: 'GA_STANDING', seat_number: 0, tier_category: 'STANDARD_EARLY_BIRD', purchase_price_usd: 125.00, dynamic_surge_multiplier: 1.00, is_scanned_at_gate: true, gate_turnstile_id: 'GATE_G_NORTH_TURNSTILE_03', purchased_at: '2026-10-03T10:02:15Z' }
        ];
        break;

      case 'gov_civic_registry':
        tableName = 'citizen_registry';
        presetLabel = '🏛️ Civic Governance & Citizen ID (Passports, Taxes & Registry)';
        sampleRecordsJson = [
          { citizen_id: 'CIT_EST_39408120019', national_id_number: 'EE_ID_492019', tax_identifier: 'TAX_EE_9940129', voter_status: 'ACTIVE_REGISTERED', municipality_code: 'MUN_TALLINN_CENTRAL', residency_status: 'CITIZEN_PERMANENT', biometric_hash: 'sha256_9fb014e89acb', issued_date: '2026-01-15' }
        ];
        break;

      case 'gdpr_privacy_audit':
        tableName = 'privacy_dsar_requests';
        presetLabel = '⚖️ GDPR & Data Privacy Governance (DSAR, Consent & Purge Logs)';
        sampleRecordsJson = [
          { request_ticket_id: 'DSAR_2026_88190', data_subject_uuid: 'usr_eu_381920', legal_jurisdiction: 'EU_GDPR_ARTICLE_17', request_category: 'RIGHT_TO_BE_FORGOTTEN_PURGE', consent_opt_in_matrix: 'MARKETING:0;ANALYTICS:0;CORE:1', processing_deadline: '2026-11-03T00:00:00Z', data_broker_purge_status: 'PURGE_COMPLETED_14_SYSTEMS', dpo_approver_id: 'dpo_helena_vance', submitted_at: '2026-10-03T10:05:00Z' }
        ];
        break;

      case 'compliance_sox':
        tableName = 'financial_sox_audit_log';
        presetLabel = '📑 SOX Compliance & Audit Logs (Privileged Access & Changes)';
        sampleRecordsJson = [
          { audit_entry_id: 'SOX_AUD_99182', actor_principal_id: 'svc_general_ledger_app', service_endpoint: 'POST /v1/gl/journal-entries', requested_privilege: 'ROLE_FINANCIAL_SUPERUSER', change_payload_hash: '0x99e82710dae91', mfa_authentication_factor: 'FIDO2_HARDWARE_KEY', compliance_policy_id: 'SOX_SEC_404_CONTROL_B', risk_level: 'LOW_APPROVED', timestamp: '2026-10-03T10:06:00Z' }
        ];
        break;

      case 'procurement_rfp':
        tableName = 'procurement_bids';
        presetLabel = '📋 Enterprise Procurement & RFP (Vendor Quotations & Purchase Orders)';
        sampleRecordsJson = [
          { rfp_id: 'RFP_2026_SERVERS_04', vendor_id: 'vnd_dell_enterprise', item_sku: 'POWEREDGE_R760_DUAL_XEON', unit_quantity: 400, proposed_unit_price: 11450.00, delivery_lead_days: 21, payment_terms_code: 'NET_60_DAYS', bid_evaluation_score: 96.4, approval_state: 'APPROVED_BY_VP_OPS', submitted_at: '2026-10-03T10:08:00Z' }
        ];
        break;

      case 'facility_management':
        tableName = 'building_hvac_workorders';
        presetLabel = '🏨 Facility & Asset Management (HVAC, Sensors & Maintenance)';
        sampleRecordsJson = [
          { workorder_id: 'WO_BLD_400_HVAC_19', building_id: 'BLD_CAMPUS_WEST_04', floor_level: 6, asset_equipment_tag: 'CHILLER_DAIKIN_MAGBEARING_02', reported_issue_code: 'ERR_CHILLED_WATER_FLOW_RESTRICTED', technician_badge_id: 'TECH_LEAD_MARK_88', priority_tier: 'P1_CRITICAL', labor_hours_logged: 3.5, completion_status: 'REPAIRED_VALVE_ACTUATOR_SWAPPED', logged_at: '2026-10-03T10:10:00Z' }
        ];
        break;

      case 'genomics_sequencing':
        tableName = 'genomic_variants';
        presetLabel = '🧬 Genomics & DNA Sequencing (Variant Calling, Mutations & Reads)';
        sampleRecordsJson = [
          { variant_id: 'VAR_HG38_CHR7_117199644', chromosome: 'chr7', locus_position: 117199644, reference_allele: 'CTT', alternate_allele: 'C', read_depth_coverage: 142, phred_quality_score: 99.0, gene_symbol: 'CFTR', variant_effect: 'IN_FRAME_DELETION_DF508', clinical_significance: 'PATHOGENIC', sequencing_platform: 'ILLUMINA_NOVASEQ_X', sample_id: 'SMP_PAT_88190', sequenced_at: '2026-10-03T10:12:00Z' }
        ];
        break;

      case 'radiology_dicom':
        tableName = 'pacs_radiology_studies';
        presetLabel = '🏥 Radiology PACS & Medical Imaging (DICOM Metadata & Scans)';
        sampleRecordsJson = [
          { study_instance_uid: '1.2.840.113619.2.55.3.881920.20261003', patient_id: 'PAT_CLINIC_99182', modality_code: 'CT', body_part_examined: 'CHEST_ANGIOGRAPHY', slice_thickness_mm: 0.625, series_instances_count: 512, radiologist_npi: 'NPI_1982740192', ai_detection_confidence_pct: 98.4, ai_finding_summary: 'NO_PULMONARY_EMBOLISM_DETECTED', accession_number: 'ACC_RAD_918274', acquired_at: '2026-10-03T10:14:00Z' }
        ];
        break;

      case 'fitness_wearables':
        tableName = 'biometric_wearable_metrics';
        presetLabel = '🏋️ Fitness & Wearables Health (HRV, Sleep Stages & SpO2)';
        sampleRecordsJson = [
          { user_id: 'usr_fit_99182', device_model: 'APPLE_WATCH_ULTRA_2', heart_rate_bpm: 64, heart_rate_variability_ms: 78.4, blood_oxygen_spo2_pct: 98.5, active_calories_burned: 480.0, step_count: 11420, current_sleep_stage: 'DEEP_STAGE_REM', timestamp: '2026-10-03T10:16:00Z' }
        ];
        break;

      case 'podcast_ad_tech':
        tableName = 'podcast_audio_impressions';
        presetLabel = '🎙️ Podcast AdTech & Dynamic Audio (DAI, Mid-Rolls & Geo-Targeting)';
        sampleRecordsJson = [
          { impression_id: 'IMP_AUD_881920', podcast_slug: 'lex-fridman-podcast', episode_id: 'EP_512_SAM_ALTMAN', listener_guid: 'lsnr_applemusic_991', ad_creative_id: 'AD_CLOUDFLARE_ZERO_TRUST', placement_type: 'MID_ROLL_01', completion_pct: 100, listener_country: 'USA', cpm_rate_usd: 28.50, timestamp: '2026-10-03T10:18:00Z' }
        ];
        break;

      case 'digital_publishing':
        tableName = 'editorial_articles_cms';
        presetLabel = '📰 Digital Publishing & CMS (Articles, Paywalls & SEO)';
        sampleRecordsJson = [
          { article_id: 'ART_TECHCRUNCH_2026_9918', slug: 'quantum-computing-hybrid-cloud-breakthrough', author_id: 'auth_sarah_connor', category_section: 'ARTIFICIAL_INTELLIGENCE', paywall_tier: 'PREMIUM_SUBSCRIBER_ONLY', word_count: 2450, reading_time_mins: 9, total_pageviews: 89400, seo_score: 95.8, published_at: '2026-10-03T10:20:00Z' }
        ];
        break;

      case 'autonomous_vehicles':
        tableName = 'autonomous_vehicle_canbus';
        presetLabel = '🚗 Autonomous Vehicles & V2X (CAN Bus, LiDAR & Pathfinding)';
        sampleRecordsJson = [
          { vehicle_vin: '5YJSA1E29HF991827', autopilot_mode: 'FULL_SELF_DRIVING_V13_SUPERVISED', lidar_point_density_sqm: 4800, steering_angle_deg: -2.4, vehicle_speed_kmh: 84.5, braking_torque_nm: 0.0, v2x_latency_ms: 1.8, disengagement_flag: false, timestamp: '2026-10-03T10:22:00Z' }
        ];
        break;

      case 'warehouse_robotics':
        tableName = 'warehouse_amr_fleet';
        presetLabel = '📦 Warehouse Automation & AMR Robotics (Fleet, Pallets & Paths)';
        sampleRecordsJson = [
          { robot_uuid: 'KIVA_AMR_BAY_42_ROBOT_09', warehouse_zone: 'ZONE_HIGH_BAY_RACK_D', current_pallet_id: 'PLT_ELECTRONICS_9918', target_bin_location: 'BIN_D12_SHELF_04', battery_pct: 88.5, navigation_speed_mps: 1.45, obstacle_events_count: 0, status: 'EN_ROUTE_TO_PICK_STATION', timestamp: '2026-10-03T10:24:00Z' }
        ];
        break;

      case 'maritime_shipping':
        tableName = 'vessel_ais_telemetry';
        presetLabel = '⚓ Maritime Shipping & AIS Logistics (Vessels, Containers & Ports)';
        sampleRecordsJson = [
          { imo_number: 9811000, vessel_name: 'EVER_ACME_CONTAINERSHIP', destination_port: 'ROTTERDAM_NL', latitude: 51.9842, longitude: 4.1205, speed_over_ground_knots: 16.4, true_heading_deg: 88, current_draft_meters: 16.2, cargo_teu_capacity: 24000, navigation_status: 'UNDERWAY_USING_ENGINE', timestamp: '2026-10-03T10:26:00Z' }
        ];
        break;

      case 'industrial_scada':
        tableName = 'factory_scada_telemetry';
        presetLabel = '🏭 Industrial Automation & SCADA (PLCs, Vibration & Motors)';
        sampleRecordsJson = [
          { plc_station_id: 'SIEMENS_S7_1500_LINE_04', assembly_line_id: 'LINE_BMW_CHASSIS_WELDING', motor_vibration_hz: 58.4, spindle_rpm: 3600, bearing_temp_c: 64.2, pneumatic_pressure_bar: 6.4, power_draw_kw: 14.8, operational_mode: 'CONTINUOUS_AUTOMATION_NORMAL', timestamp: '2026-10-03T10:28:00Z' }
        ];
        break;

      case 'satellite_constellation':
        tableName = 'orbital_satellite_telemetry';
        presetLabel = '📡 Satellite Constellation & Orbit (TLE, Solar Arrays & Downlink)';
        sampleRecordsJson = [
          { norad_id: 54120, satellite_name: 'STARLINK_GEN2_LEO_9918', orbital_altitude_km: 550.2, orbital_inclination_deg: 53.2, solar_array_voltage: 48.4, transponder_temp_k: 288.5, downlink_rssi_dbm: -74.2, battery_depth_of_discharge_pct: 12.4, epoch_timestamp: '2026-10-03T10:30:00Z' }
        ];
        break;

      case 'carbon_esg_tracking':
        tableName = 'carbon_esg_emissions';
        presetLabel = '🌿 Carbon Accounting & ESG Audits (Scope 1/2/3 & Offset Credits)';
        sampleRecordsJson = [
          { facility_id: 'FACILITY_DATA_CENTER_IRELAND_01', emission_scope_tier: 'SCOPE_2_INDIRECT_ELECTRICITY', fuel_type_code: 'GRID_MIX_WIND_HYBRID', metric_tons_co2e: 14.28, activity_metric_kwh: 145000.0, offset_certificate_ref: 'VERRA_VCS_CERT_99182', verification_auditor: 'PWC_SUSTAINABILITY_LLP', reporting_quarter: '2026-Q3', recorded_at: '2026-10-03T10:32:00Z' }
        ];
        break;

      default:
        tableName = 'orders';
        presetLabel = '🛒 E-Commerce (Orders & Checkout)';
        sampleRecordsJson = [
          { order_id: 'ord_9182741', customer_id: 'cust_8819', items_count: 4, total_price: 189.50, status: 'COMPLETED', payment_method: 'STRIPE_CARD', shipping_country: 'USA', created_at: '2026-10-03T08:00:00Z' }
        ];
        break;
    }

    const avgRowSizeBytes = preset === 'vector_embeddings' ? 6200 : 260;
    const totalSizeBytes = rowCount * avgRowSizeBytes;
    const totalSizeFormatted = totalSizeBytes >= 1024 * 1024 * 1024 
      ? `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`;

    if (norm === 'mysql' || norm === 'mariadb') {
      const keys = Object.keys(sampleRecordsJson[0] || {});
      bulkScript = `-- MySQL High-Performance Ingestion (${rowCount.toLocaleString()} Rows into \`${tableName}\`)
SET autocommit = 0;
SET unique_checks = 0;
SET foreign_key_checks = 0;

INSERT INTO ${tableName} (${keys.join(', ')})
VALUES 
${sampleRecordsJson.map(r => `  (${keys.map(k => typeof r[k] === 'number' ? r[k] : `'${r[k]}'`).join(', ')})`).join(',\n')},
  -- Execute in streaming batches of 5,000 multi-values for highest throughput
  (${keys.map(k => typeof sampleRecordsJson[0][k] === 'number' ? sampleRecordsJson[0][k] : `'batch_end'`).join(', ')});

COMMIT;
SET unique_checks = 1;
SET foreign_key_checks = 1;
SET autocommit = 1;`;

      benchmarkScript = `# Sysbench MySQL High-Concurrency Stress Benchmark (${tableName})
sysbench oltp_read_write \\
  --mysql-host=127.0.0.1 \\
  --mysql-port=3306 \\
  --mysql-user=api_svc \\
  --mysql-password=ProductionStrongPassword!2026 \\
  --mysql-db=production_db \\
  --tables=10 \\
  --table-size=${rowCount} \\
  --threads=64 \\
  --time=60 \\
  --report-interval=5 \\
  run`;
    } else if (norm === 'mongodb') {
      bulkScript = `// MongoDB Bulk Ingestion (${rowCount.toLocaleString()} documents into "${tableName}")
use production_db;

const batch = [];
for (let i = 0; i < ${Math.min(1000, rowCount)}; i++) {
  batch.push(${JSON.stringify(sampleRecordsJson[0], null, 2)});
}

db.${tableName}.insertMany(batch, { ordered: false });`;

      benchmarkScript = `# k6 Load Benchmark for MongoDB API (${tableName})
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://localhost:4000/api/v1/${tableName}?limit=20');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.1);
}`;
    } else if (norm === 'redis' || norm === 'valkey' || norm === 'dragonfly') {
      bulkScript = `# Redis Mass Insertion Protocol (RESP Protocol via redis-cli --pipe)
*3
$3
SET
$${(tableName + ':001').length}
${tableName}:001
$${JSON.stringify(sampleRecordsJson[0]).length}
${JSON.stringify(sampleRecordsJson[0])}
*3
$3
SET
$${(tableName + ':002').length}
${tableName}:002
$${JSON.stringify(sampleRecordsJson[1] || sampleRecordsJson[0]).length}
${JSON.stringify(sampleRecordsJson[1] || sampleRecordsJson[0])}
`;

      benchmarkScript = `# Redis Benchmark Pipeline Test (${tableName})
redis-benchmark -h 127.0.0.1 -p 6379 -a ProductionStrongKey!2026 -t set,get -n ${rowCount} -c 50 -P 16 -q`;
    } else {
      
      const keys = Object.keys(sampleRecordsJson[0] || {});
      bulkScript = `-- PostgreSQL High-Throughput Synthetic Generation (${rowCount.toLocaleString()} Rows into "${tableName}")
-- Method 1: Instant In-Engine Synthetic Generation via generate_series()
INSERT INTO ${tableName} (${keys.join(', ')})
SELECT 
${keys.map((k) => {
  const val = sampleRecordsJson[0][k];
  if (typeof val === 'number') return `    round((random() * 500 + 10)::numeric, 2) AS ${k}`;
  if (k.includes('id') || k.includes('number') || k.includes('vin') || k.includes('code') || k.includes('hash')) return `    '${k}_' || (1000 + (g % 5000)) AS ${k}`;
  if (k.includes('date') || k.includes('at') || k.includes('timestamp')) return `    NOW() - (g || ' minutes')::interval AS ${k}`;
  return `    'sample_${k}_' || (g % 100) AS ${k}`;
}).join(',\n')}
FROM generate_series(1, ${rowCount}) AS g;

-- Method 2: High-Speed Binary Streaming via COPY (Bypasses Query Parser)
-- COPY ${tableName} (${keys.join(', ')}) FROM STDIN WITH (FORMAT csv, HEADER false);
`;

      benchmarkScript = `# pgbench High-Concurrency Production Benchmark (${tableName})
# Step 1: Initialize pgbench tables with scale factor
pgbench -i -s ${Math.max(10, Math.floor(rowCount / 10000))} -U postgres -d production_db

# Step 2: Run 60s OLTP load test with 50 concurrent connections
pgbench -c 50 -j 8 -T 60 -P 5 -U postgres -d production_db`;
    }

    return {
      engine: meta.id,
      engineName: meta.name,
      preset,
      presetLabel,
      rowCount,
      format,
      estimatedSizeBytes: totalSizeBytes,
      estimatedSizeFormatted: totalSizeFormatted,
      sampleRecordsJson,
      bulkScript,
      benchmarkScript,
      performanceCharacteristics: {
        ingestionRateRowsPerSec: `${Math.round(45000 + Math.random() * 15000).toLocaleString()} rows/sec`,
        indexBuildTimeSec: `${((rowCount / 100000) * (preset === 'vector_embeddings' ? 8.5 : 1.8)).toFixed(1)}s`,
        ramFootprintMb: `${Math.round(totalSizeBytes / (1024 * 1024) * 1.3)} MB`,
      },
      expertRecommendations: [
        'For loads over 100,000 rows, always drop secondary indexes prior to bulk ingestion and rebuild them afterwards (`CREATE INDEX CONCURRENTLY`) to eliminate per-row B-tree splitting overhead.',
        'Use native binary streaming (`COPY ... FROM STDIN` in PostgreSQL or `LOAD DATA INFILE` in MySQL) to bypass query parsing overhead, achieving 5x-10x higher ingestion throughput.',
        'Wrap multi-value inserts in transactions of 5,000 to 10,000 rows each to prevent transaction log (WAL/binlog) saturation.',
      ],
    };
  }
}
