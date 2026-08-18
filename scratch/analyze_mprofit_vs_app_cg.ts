import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('=== DETAILED MPROFIT VS APP RECONCILIATION ===\n');

  // MProfit PDF Trades (Saahil + Pramesh FY 2025-26)
  const mprofitTrades = [
    { dt: '2025-07-18', scrip: 'Laurus Labs', qty: 10, saleAmt: 8205.50, cost: 5677.50, gain: 2528.00, type: 'STCG' },
    { dt: '2025-07-18', scrip: 'Digitide Solutions', qty: 10, saleAmt: 2486.55, cost: 0.00, gain: 2486.55, type: 'STCG' },
    { dt: '2025-07-18', scrip: 'Bluspring Enterprises', qty: 10, saleAmt: 886.30, cost: 0.00, gain: 886.30, type: 'STCG' },
    { dt: '2025-08-01', scrip: 'Cemindia Projects', qty: 65, saleAmt: 54290.85, cost: 50500.00, gain: 3790.85, type: 'STCG' },
    { dt: '2025-08-08', scrip: 'John Cockerill India', qty: 10, saleAmt: 41940.00, cost: 41202.50, gain: 737.50, type: 'STCG' },
    { dt: '2025-08-11', scrip: 'Cemindia Projects', qty: 65, saleAmt: 49530.00, cost: 50500.00, gain: -970.00, type: 'STCG' },
    { dt: '2025-08-25', scrip: 'John Cockerill India', qty: 2, saleAmt: 9330.00, cost: 8240.50, gain: 1089.50, type: 'STCG' },
    { dt: '2025-09-09', scrip: 'Sanghvi Movers', qty: 14, saleAmt: 4538.80, cost: 6349.20, gain: -1810.40, type: 'STCG' },
    { dt: '2025-09-15', scrip: 'Ajmera Realty & Infra India', qty: 30, saleAmt: 29688.05, cost: 26362.50, gain: 3325.55, type: 'STCG' },
    { dt: '2025-09-15', scrip: 'Sammaan Capital', qty: 775, saleAmt: 105494.20, cost: 102687.50, gain: 2806.70, type: 'STCG' },
    { dt: '2025-10-14', scrip: 'LG Electronics India', qty: 182, saleAmt: 312130.00, cost: 207480.00, gain: 104650.00, type: 'STCG' },
    { dt: '2025-12-15', scrip: 'Navneet Education', qty: 222, saleAmt: 31307.29, cost: 36041.70, gain: -4734.41, type: 'STCG' },
    { dt: '2025-12-15', scrip: 'Tourism Finance Corporation', qty: 500, saleAmt: 33165.00, cost: 36375.00, gain: -3210.00, type: 'STCG' },
    { dt: '2025-12-15', scrip: 'Arisinfra Solutions', qty: 220, saleAmt: 27652.52, cost: 36179.00, gain: -8526.48, type: 'STCG' },
    { dt: '2026-03-24', scrip: 'L&T Finance', qty: 675, saleAmt: 170775.00, cost: 204582.50, gain: -33807.50, type: 'STCG' },
    { dt: '2026-03-24', scrip: 'Aegis Vopak Terminals', qty: 357, saleAmt: 61957.35, cost: 99848.05, gain: -37890.70, type: 'STCG' },
    { dt: '2025-06-25', scrip: 'Bharat Heavy Electricals', qty: 47, saleAmt: 12304.60, cost: 11092.00, gain: 1212.60, type: 'LTCG' },
    { dt: '2025-06-25', scrip: 'Larsen & Toubro', qty: 2, saleAmt: 7253.24, cost: 6921.85, gain: 331.39, type: 'LTCG' },
    { dt: '2025-06-25', scrip: 'Rites Ltd', qty: 13, saleAmt: 3653.65, cost: 7865.00, gain: -4211.35, type: 'LTCG' },
    { dt: '2025-06-25', scrip: 'Rail Vikas Nigam', qty: 8, saleAmt: 3227.20, cost: 2729.60, gain: 497.60, type: 'LTCG' },
    { dt: '2025-06-25', scrip: 'RailTel Corporation of India', qty: 9, saleAmt: 3871.35, cost: 3181.05, gain: 690.30, type: 'LTCG' },
    { dt: '2025-07-14', scrip: 'IRCON International', qty: 61, saleAmt: 11651.61, cost: 14371.50, gain: -2719.89, type: 'LTCG' },
    { dt: '2025-07-14', scrip: 'Indian Railway Finance Corporation', qty: 27, saleAmt: 3619.35, cost: 4359.15, gain: -739.80, type: 'LTCG' },
    { dt: '2025-07-18', scrip: 'The Ramco Cements', qty: 50, saleAmt: 58600.00, cost: 39512.50, gain: 19087.50, type: 'LTCG' },
    { dt: '2025-09-15', scrip: 'Allcargo Logistics', qty: 186, saleAmt: 5920.38, cost: 12129.06, gain: -6208.68, type: 'LTCG' },
    { dt: '2025-12-26', scrip: 'Concord Biotech', qty: 10, saleAmt: 13405.00, cost: 19478.25, gain: -6073.25, type: 'LTCG' },
    { dt: '2026-03-19', scrip: 'HDFC Bank', qty: 26, saleAmt: 20939.10, cost: 45845.15, gain: -24906.05, type: 'LTCG' },
    { dt: '2026-03-30', scrip: 'Indian Oil Corporation', qty: 250, saleAmt: 34100.00, cost: 30972.50, gain: 3127.50, type: 'LTCG' }
  ];

  const { data: acmac1Rows } = await s.from('acmac1').select('id, name, acid');
  const nameMap = new Map(acmac1Rows?.map(r => [r.id, r.name]));

  // Fetch all transc1 rows
  let transc1Rows: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await s.from('transc1').select('*').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    transc1Rows = transc1Rows.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total transc1 rows in DB: ${transc1Rows.length}`);

  mprofitTrades.forEach(p => {
    const matchingLedgers = acmac1Rows?.filter(r => r.name && r.name.toLowerCase().includes(p.scrip.toLowerCase())) || [];
    const ids = matchingLedgers.map(m => m.id);

    const appTxs = transc1Rows.filter(t => ids.includes(t.maid));

    console.log(`\n--------------------------------------------------`);
    console.log(`SCRIP: ${p.scrip.toUpperCase()} (MProfit Date: ${p.dt})`);
    console.log(`MProfit PDF => Sale: ₹${p.saleAmt.toFixed(2)}, Cost: ₹${p.cost.toFixed(2)}, Gain: ₹${p.gain.toFixed(2)} (${p.type})`);
    
    if (appTxs.length === 0) {
      console.log(`APP DB STATUS: NO TRANSACTIONS FOUND IN DB`);
    } else {
      console.log(`APP DB VOUCHERS FOUND (${appTxs.length}):`);
      appTxs.forEach(t => {
        console.log(`   - VID: ${t.vid} | Date: ${t.dt} | Cramt (Sale): ₹${t.cramt.toFixed(2)} | Dramt (Buy): ₹${t.dramt.toFixed(2)} | Acid: ${t.acid}`);
      });
    }
  });
}

run().catch(console.error);
