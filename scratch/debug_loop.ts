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

  const fromDate = '2021-04-01';
  const toDate = '2022-03-31';

  const allSells = allTx?.filter((t: any) => sellTrty.has(t.trty)) || [];

  console.log(`Processing ${allSells.length} sells chronologically...`);

  const matches: any[] = [];
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

      if (isInPeriod) {
        matches.push({
          amid: sell.amid,
          sellDt: sell.dt,
          buyDt: lot.date,
          qty: mq,
          cost: mq * lot.costPerUnit,
          proceeds: mq * sellPrice,
          gain: (mq * sellPrice) - (mq * lot.costPerUnit)
        });
      }
    });
  });

  console.log(`Found ${matches.length} matches in period:`);
  console.log(matches);
}

run().catch(console.error);
