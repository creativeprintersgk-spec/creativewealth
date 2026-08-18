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
  console.log('=== Testing getCapitalGains for pfid 4 in FY 2021-22 ===\n');

  // Fetch all bs1 rows for pfid 4
  const { data: bs1Rows } = await s.from('bs1')
    .select('*')
    .eq('pfid', 4)
    .order('dt', { ascending: true });

  console.log(`bs1 rows for pfid=4: ${bs1Rows?.length}`);

  const buyTrty = new Set([19, 20, 12, 25, 30, 35, 40]);
  const sellTrty = new Set([99, 101]);

  const lotsMap: Record<string, any[]> = {};
  bs1Rows?.filter((t: any) => buyTrty.has(t.trty)).forEach((t: any) => {
    const key = `${t.pfid}_${t.amid}`;
    if (!lotsMap[key]) lotsMap[key] = [];
    const qty = Number(t.qn) || 0;
    lotsMap[key].push({
      date: t.dt,
      qty,
      remaining: qty,
      costPerUnit: qty > 0 ? (Number(t.amt) || 0) / qty : 0,
      trid: t.trid
    });
  });

  console.log('Lots created for pfid=4:', Object.keys(lotsMap).length, 'assets with buy lots.');

  const fromDate = '2021-04-01';
  const toDate = '2022-03-31';

  const allSells = bs1Rows?.filter((t: any) => sellTrty.has(t.trty)) || [];
  console.log(`Total sells for pfid=4: ${allSells.length}`);

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
        dt: sell.dt,
        buyDate: lot.date,
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

  console.log(`\nFY 2021-22 Gains for pfid=4: ${results.length} matches found.`);
  results.forEach(r => {
    console.log(`  amid=${r.amid}, sellDate=${r.dt}, buyDate=${r.buyDate}, qty=${r.qty}, buyPrice=${r.buyPrice.toFixed(2)}, sellPrice=${r.sellPrice.toFixed(2)}, gain=${r.gain.toFixed(2)}, days=${r.days}`);
  });
}

run().catch(console.error);
