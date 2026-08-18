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
  console.log('=== Testing Capital Gains for pfid=4 in FY 2025-26 ===\n');

  // Fetch all bs1 rows for pfid=4
  const { data: allTx } = await s.from('bs1')
    .select('*')
    .eq('pfid', 4)
    .order('dt', { ascending: true });

  const buyTrty = new Set([19, 20, 12, 25, 30, 35, 40]);
  const sellTrty = new Set([99, 101]);

  const lotsMap: Record<string, any[]> = {};
  allTx?.filter((t: any) => buyTrty.has(t.trty)).forEach((t: any) => {
    const key = `${t.pfid}_${t.amid}`;
    if (!lotsMap[key]) lotsMap[key] = [];
    const qty = Number(t.qn) || 0;
    lotsMap[key].push({
      date: t.dt,
      qty,
      remaining: qty,
      costPerUnit: qty > 0 ? (Number(t.amt) || 0) / qty : 0
    });
  });

  const fromDate = '2025-04-01';
  const toDate = '2026-03-31';

  const allSells = allTx?.filter((t: any) => sellTrty.has(t.trty)) || [];

  const results: any[] = [];

  allSells.forEach((sell: any) => {
    const isInPeriod = sell.dt >= fromDate && sell.dt <= toDate;
    const key = `${sell.pfid}_${sell.amid}`;
    const lots = lotsMap[key] || [];
    let sellQty = Number(sell.qn) || 0;
    const sellAmt = Number(sell.amt) || 0;
    const sellPrice = sellQty > 0 ? sellAmt / sellQty : 0;

    lots.forEach((lot: any) => {
      if (sellQty <= 0 || lot.remaining <= 0) return;
      const mq = Math.min(sellQty, lot.remaining);
      lot.remaining -= mq;
      sellQty -= mq;

      if (!isInPeriod) return;

      const cost = mq * lot.costPerUnit;
      const proceeds = mq * sellPrice;
      const gain = proceeds - cost;
      const days = lot.date && sell.dt
        ? Math.floor((new Date(sell.dt).getTime() - new Date(lot.date).getTime()) / 86400000)
        : 0;

      results.push({
        amid: sell.amid,
        atyid: sell.atyid,
        sellDt: sell.dt,
        buyDt: lot.date,
        qty: mq,
        buyPrice: lot.costPerUnit,
        sellPrice,
        cost,
        proceeds,
        gain,
        days
      });
    });
  });

  // Get SAM names
  const amids = [...new Set(results.map(r => r.amid))];
  const { data: samRows } = await s.from('sam').select('amid, anm').in('amid', amids);
  const samMap = new Map(samRows?.map(r => [r.amid, r.anm]));

  console.log(`FY 2025-26 Matches for pfid=4: ${results.length} lot matches.`);
  
  // Aggregate by asset
  const scripMap: Record<number, { name: string, qty: number, proceeds: number, cost: number, gain: number }> = {};
  results.forEach(r => {
    if (!scripMap[r.amid]) {
      scripMap[r.amid] = { name: samMap.get(r.amid) || `Asset ${r.amid}`, qty: 0, proceeds: 0, cost: 0, gain: 0 };
    }
    scripMap[r.amid].qty += r.qty;
    scripMap[r.amid].proceeds += r.proceeds;
    scripMap[r.amid].cost += r.cost;
    scripMap[r.amid].gain += r.gain;
  });

  console.log('\nSummary by Asset:');
  Object.values(scripMap).forEach(s => {
    console.log(`  ${s.name}: Qty=${s.qty}, SaleAmt=${s.proceeds.toFixed(2)}, Cost=${s.cost.toFixed(2)}, Gain=${s.gain.toFixed(2)}`);
  });
}

run().catch(console.error);
