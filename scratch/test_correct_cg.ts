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
  const targetIds = [4, 7, 9, 66, 30];
  const { data: pflinks } = await s.from('accPflink').select('*');
  const expandedSet = new Set<number>(targetIds);
  pflinks?.forEach((link: any) => {
    if (targetIds.includes(Number(link.acid))) expandedSet.add(Number(link.pfid));
    if (targetIds.includes(Number(link.pfid))) expandedSet.add(Number(link.acid));
  });

  const pArr = Array.from(expandedSet);
  console.log('Expanded portfolio IDs for Pramesh R Shah:', pArr);

  const { data: allTx } = await s.from('bs1')
    .select('*')
    .in('pfid', pArr)
    .order('dt', { ascending: true });

  console.log(`Fetched ${allTx?.length} transactions.`);

  const { data: samRows } = await s.from('sam').select('amid, anm, isin');
  const samMap = new Map(samRows?.map(r => [r.amid, r]));

  const txByAsset: Record<string, any[]> = {};
  allTx?.forEach((t: any) => {
    const key = String(t.amid);
    if (!txByAsset[key]) txByAsset[key] = [];
    txByAsset[key].push(t);
  });

  const fromDate = '2025-04-01';
  const toDate = '2026-03-31';

  const results: any[] = [];

  Object.entries(txByAsset).forEach(([amidStr, txList]) => {
    const deliveryLots: any[] = [];

    txList.forEach(t => {
      const dt = t.dt || '';
      const trty = Number(t.trty);
      const qn = Number(t.qn) || 0;
      const amt = Number(t.amt) || 0;

      // Check for split outflow (85)
      if (trty === 85) {
        const inflow = txList.find(x => x.dt === dt && Number(x.trty) === 45);
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

            const sam = samMap.get(Number(amidStr));

            results.push({
              assetName: sam?.anm || `Asset ${amidStr}`,
              isin: sam?.isin || '',
              buyDate: lot.date,
              sellDate: dt,
              qty: mq,
              buyPrice: lot.costPerUnit,
              sellPrice,
              cost,
              proceeds,
              gain,
              days,
              isLTCG: days >= 365
            });
          }
        });
      }
    });
  });

  console.log('\n=== Capital Gains Results FY 2025-26 for Pramesh R Shah ===\n');
  let totProceeds = 0, totCost = 0, totGain = 0;
  results.forEach(r => {
    totProceeds += r.proceeds;
    totCost += r.cost;
    totGain += r.gain;
    console.log(`${r.sellDate} | ${r.assetName.padEnd(28)} | Qty: ${r.qty.toString().padStart(5)} | SP: ${r.sellPrice.toFixed(2).padStart(7)} | SaleAmt: ${r.proceeds.toFixed(2).padStart(10)} | PurDate: ${r.buyDate} | PP: ${r.buyPrice.toFixed(2).padStart(7)} | Cost: ${r.cost.toFixed(2).padStart(10)} | Gain: ${r.gain.toFixed(2).padStart(10)} | ${r.isLTCG ? 'LTCG' : 'STCG'}`);
  });

  console.log(`\nTOTALS: SaleAmt = ${totProceeds.toFixed(2)}, Cost = ${totCost.toFixed(2)}, Gain = ${totGain.toFixed(2)}`);
}

run().catch(console.error);
