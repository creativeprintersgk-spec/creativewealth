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
  console.log('--- Fetching all acmac1 rows ---');
  let acmac1Rows: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await s.from('acmac1').select('*').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    acmac1Rows = acmac1Rows.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total acmac1 rows: ${acmac1Rows.length}`);

  const pdfScrips = [
    'Laurus', 'Digitide', 'Bluspring', 'Cemindia', 'John Cockerill',
    'Sanghvi', 'Ajmera', 'Sammaan', 'LG Electronics', 'Navneet',
    'Tourism Finance', 'Arisinfra', 'ICICI Prudential Asset', 'L&T Finance',
    'Aegis Vopak', 'Bharat Heavy', 'Larsen', 'Rites', 'Rail Vikas',
    'RailTel', 'IRCON', 'Indian Railway Finance', 'Ramco Cements',
    'Allcargo', 'Concord', 'HDFC Bank', 'PSU Bank BeES', 'Indian Oil'
  ];

  const matchedLedgers = acmac1Rows.filter(r => 
    pdfScrips.some(p => r.name && r.name.toLowerCase().includes(p.toLowerCase()))
  );

  console.log(`\nMatched ${matchedLedgers.length} ledgers in acmac1:`);
  matchedLedgers.forEach(m => console.log(`id: ${m.id} | acid (pfid): ${m.acid} | name: ${m.name}`));

  const targetAmids = matchedLedgers.map(m => m.id);

  console.log('\n--- Fetching transactions from bs1 ---');
  let allTx: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await s.from('bs1').select('*').in('amid', targetAmids).range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    allTx = allTx.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total bs1 transactions for target scrips: ${allTx.length}`);

  // Also fetch all bs1 transactions to be safe
  let fullBs1: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await s.from('bs1').select('*').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    fullBs1 = fullBs1.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total full bs1 transactions: ${fullBs1.length}`);

  // Create name lookup
  const nameMap = new Map(acmac1Rows.map(r => [r.id, r.name]));

  // Group transactions by amid
  const txByAmid: Record<number, any[]> = {};
  fullBs1.forEach(t => {
    const amid = Number(t.amid);
    if (!txByAmid[amid]) txByAmid[amid] = [];
    txByAmid[amid].push(t);
  });

  const fromDate = '2025-04-01';
  const toDate = '2026-03-31';

  let grandSTCG = 0, grandLTCG = 0, grandProceeds = 0, grandCost = 0;
  const results: any[] = [];

  for (const amid of targetAmids) {
    const tList = txByAmid[amid] || [];
    if (tList.length === 0) continue;

    tList.sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
    const deliveryLots: any[] = [];

    tList.forEach(t => {
      const dt = t.dt || '';
      const trty = Number(t.trty);
      const qn = Number(t.qn) || 0;
      const amt = Number(t.amt) || 0;

      // Handle split ratio (85/45)
      if (trty === 85) {
        const inflow = tList.find(x => x.dt === dt && Number(x.trty) === 45);
        if (inflow && qn > 0) {
          const inQty = Number(inflow.qn) || 0;
          const ratio = inQty / qn;
          deliveryLots.forEach(lot => {
            lot.qty *= ratio;
            lot.remaining *= ratio;
            lot.costPerUnit /= ratio;
          });
        }
        return;
      }
      if (trty === 45) return;

      const isBuy = [19, 20, 12, 25, 30, 40, 46].includes(trty);
      const isSell = [99, 101].includes(trty);

      if (isBuy) {
        if (qn > 0) {
          const cpu = trty === 40 ? 0 : amt / qn;
          deliveryLots.push({
            date: dt,
            qty: qn,
            remaining: qn,
            costPerUnit: cpu
          });
        }
      } else if (isSell) {
        let sellQty = qn;
        const sellPrice = qn > 0 ? amt / qn : 0;
        const isInPeriod = dt >= fromDate && dt <= toDate;

        deliveryLots.forEach(lot => {
          if (sellQty <= 0 || lot.remaining <= 0) return;
          const mq = Math.min(sellQty, lot.remaining);
          lot.remaining -= mq;
          sellQty -= mq;

          if (isInPeriod) {
            const cost = mq * lot.costPerUnit;
            const proceeds = mq * sellPrice;
            const gain = proceeds - cost;
            const days = lot.date && dt
              ? Math.floor((new Date(dt).getTime() - new Date(lot.date).getTime()) / 86400000)
              : 0;

            const isLTCG = days >= 365;
            if (isLTCG) grandLTCG += gain;
            else grandSTCG += gain;
            grandProceeds += proceeds;
            grandCost += cost;

            results.push({
              scrip: nameMap.get(amid) || `Scrip ${amid}`,
              buyDate: lot.date,
              sellDate: dt,
              qty: mq,
              sellPrice,
              proceeds,
              buyPrice: lot.costPerUnit,
              cost,
              gain,
              isLTCG
            });
          }
        });
      }
    });
  }

  console.log('\n========================================');
  console.log('--- CAPITAL GAINS MATCH FOR MPROFIT SCRIPS (FY 2025-26) ---');
  console.log(`Total Sales: ₹${grandProceeds.toFixed(2)} | Total Cost: ₹${grandCost.toFixed(2)}`);
  console.log(`STCG: ₹${grandSTCG.toFixed(2)} | LTCG: ₹${grandLTCG.toFixed(2)} | Grand Total Gain: ₹${(grandSTCG + grandLTCG).toFixed(2)}`);
  console.log(`Total Matched Trades Count: ${results.length}`);

  console.log('\n--- TRADE BY TRADE BREAKDOWN ---');
  results.forEach(r => {
    console.log(`${r.sellDate} | ${r.scrip.padEnd(28)} | Qty: ${r.qty.toString().padStart(5)} | SP: ${r.sellPrice.toFixed(2).padStart(8)} | SaleAmt: ${r.proceeds.toFixed(2).padStart(10)} | PurDate: ${r.buyDate} | Cost: ${r.cost.toFixed(2).padStart(10)} | Gain: ${r.gain.toFixed(2).padStart(10)} | ${r.isLTCG ? 'LTCG' : 'STCG'}`);
  });
}

run().catch(console.error);
