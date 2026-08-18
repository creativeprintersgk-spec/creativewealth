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
  const { data: allTx } = await s.from('bs1')
    .select('*')
    .eq('pfid', 4)
    .order('dt', { ascending: true });

  const buyTrty = new Set([19, 20, 12, 25, 30, 35, 40, 45, 46, 47]);
  const sellTrty = new Set([99, 101, 85]);

  const lotsMap: Record<string, any[]> = {};
  const fromDate = '2025-04-01';
  const toDate = '2026-03-31';
  const results: any[] = [];

  allTx?.forEach((t: any) => {
    const key = `${t.pfid}_${t.amid}`;
    if (!lotsMap[key]) lotsMap[key] = [];
    const lots = lotsMap[key];

    if (buyTrty.has(t.trty)) {
      const qty = Number(t.qn) || 0;
      lots.push({
        date: t.dt,
        qty,
        remaining: qty,
        costPerUnit: qty > 0 ? (Number(t.amt) || 0) / qty : 0
      });
    } else if (sellTrty.has(t.trty)) {
      let sellQty = Number(t.qn) || 0;
      const sellAmt = Number(t.amt) || 0;
      const sellPrice = sellQty > 0 ? sellAmt / sellQty : 0;
      const isInPeriod = t.dt >= fromDate && t.dt <= toDate && t.trty !== 85;

      lots.forEach((lot: any) => {
        if (sellQty <= 0 || lot.remaining <= 0) return;
        const mq = Math.min(sellQty, lot.remaining);
        lot.remaining -= mq;
        sellQty -= mq;

        if (isInPeriod) {
          const cost = mq * lot.costPerUnit;
          const proceeds = mq * sellPrice;
          const gain = proceeds - cost;
          results.push({
            amid: t.amid,
            dt: t.dt,
            buyDate: lot.date,
            qty: mq,
            cost,
            proceeds,
            gain
          });
        }
      });
    }
  });

  console.log(`FY 2025-26 Matches for pfid=4: ${results.length}`);
  results.forEach(r => {
    console.log(`  amid=${r.amid}, sellDt=${r.dt}, buyDt=${r.buyDate}, qty=${r.qty}, cost=${r.cost.toFixed(2)}, proceeds=${r.proceeds.toFixed(2)}, gain=${r.gain.toFixed(2)}`);
  });
}

run().catch(console.error);
