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
  console.log('--- Fetching all bs1 transactions ---');
  let allTx: any[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await s
      .from('bs1')
      .select('*')
      .order('dt', { ascending: true })
      .range(from, from + step - 1);

    if (error || !data || data.length === 0) break;
    allTx = allTx.concat(data);
    if (data.length < step) break;
    from += step;
  }

  const { data: samRows } = await s.from('sam').select('amid, anm, isin, atyid');
  const samMap = new Map(samRows?.map(r => [r.amid, r]));

  // Portfolio IDs for Saahil & Pramesh
  const saahilPfs = [1, 11, 12, 13, 31, 62, 67];
  const prameshPfs = [4, 5, 7, 8, 9, 30, 32, 34, 35, 66];
  const targetPfs = new Set<number>([...saahilPfs, ...prameshPfs]);

  // Filter only Stock assets (atyid === 10 or 12 or equity shares)
  // Let's inspect atyid values for stocks vs mutual funds
  const stockTx = allTx.filter(t => {
    if (!targetPfs.has(Number(t.pfid)) && !targetPfs.has(Number(t.acid))) return false;
    const sam = samMap.get(Number(t.amid));
    if (!sam) return false;
    // atyid 10 is equity shares
    return sam.atyid === 10 || sam.atyid === 12;
  });

  console.log(`Matching STOCK transactions count: ${stockTx.length}`);

  // Group by Asset
  const txByAsset: Record<string, any[]> = {};
  stockTx.forEach((t: any) => {
    const key = String(t.amid);
    if (!txByAsset[key]) txByAsset[key] = [];
    txByAsset[key].push(t);
  });

  const fromDate = '2025-04-01';
  const toDate = '2026-03-31';

  let stcgGain = 0, stcgProceeds = 0, stcgCost = 0;
  let ltcgGain = 0, ltcgProceeds = 0, ltcgCost = 0;

  const stcgList: any[] = [];
  const ltcgList: any[] = [];

  Object.entries(txByAsset).forEach(([amidStr, tList]) => {
    const deliveryLots: any[] = [];

    // Ensure sorted chronologically
    tList.sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));

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
            const sam = samMap.get(Number(amidStr));

            const record = {
              assetName: sam?.anm || `Asset ${amidStr}`,
              isin: sam?.isin || '',
              buyDate: lot.date,
              sellDate: dt,
              qty: mq,
              sellPrice,
              proceeds,
              buyPrice: lot.costPerUnit,
              cost,
              gain,
              days
            };

            if (isLTCG) {
              ltcgGain += gain;
              ltcgProceeds += proceeds;
              ltcgCost += cost;
              ltcgList.push(record);
            } else {
              stcgGain += gain;
              stcgProceeds += proceeds;
              stcgCost += cost;
              stcgList.push(record);
            }
          }
        });
      }
    });
  });

  console.log('\n========================================');
  console.log('--- OUR APP STOCKS CAPITAL GAINS (FY 2025-26) ---');
  console.log(`STCG: Sale = ₹${stcgProceeds.toFixed(2)}, Cost = ₹${stcgCost.toFixed(2)}, Gain = ₹${stcgGain.toFixed(2)} (Count: ${stcgList.length})`);
  console.log(`LTCG: Sale = ₹${ltcgProceeds.toFixed(2)}, Cost = ₹${ltcgCost.toFixed(2)}, Gain = ₹${ltcgGain.toFixed(2)} (Count: ${ltcgList.length})`);
  console.log(`GRAND TOTAL: Sale = ₹${(stcgProceeds + ltcgProceeds).toFixed(2)}, Cost = ₹${(stcgCost + ltcgCost).toFixed(2)}, Gain = ₹${(stcgGain + ltcgGain).toFixed(2)}`);

  console.log('\n--- MPROFIT PDF SUMMARY (FY 2025-26) ---');
  console.log('STCG: Sale = ₹15,60,853.47, Cost = ₹13,97,885.47, Gain = ₹1,62,968.00');
  console.log('LTCG: Sale = ₹3,78,197.49, Cost = ₹3,57,930.58, Gain = ₹20,266.91');
  console.log('GRAND TOTAL: Sale = ₹19,39,050.96, Cost = ₹17,55,816.05, Gain = ₹1,83,234.91');

  console.log('\n--- DETAILED OUR APP STCG TRADES ---');
  stcgList.forEach(r => {
    console.log(`${r.sellDate} | ${r.assetName.padEnd(28)} | Qty: ${r.qty.toString().padStart(5)} | SP: ${r.sellPrice.toFixed(2).padStart(8)} | SaleAmt: ${r.proceeds.toFixed(2).padStart(10)} | PurDate: ${r.buyDate} | Cost: ${r.cost.toFixed(2).padStart(10)} | Gain: ${r.gain.toFixed(2).padStart(10)}`);
  });

  console.log('\n--- DETAILED OUR APP LTCG TRADES ---');
  ltcgList.forEach(r => {
    console.log(`${r.sellDate} | ${r.assetName.padEnd(28)} | Qty: ${r.qty.toString().padStart(5)} | SP: ${r.sellPrice.toFixed(2).padStart(8)} | SaleAmt: ${r.proceeds.toFixed(2).padStart(10)} | PurDate: ${r.buyDate} | Cost: ${r.cost.toFixed(2).padStart(10)} | Gain: ${r.gain.toFixed(2).padStart(10)}`);
  });
}

run().catch(console.error);
