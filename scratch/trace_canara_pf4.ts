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
  const pArr = [1, 2, 4, 35, 40];
  const { data: allTx } = await s.from('bs1')
    .select('*')
    .in('pfid', pArr)
    .eq('amid', 104471)
    .order('dt', { ascending: true });

  console.log(`Fetched ${allTx?.length} transactions for amid=104471 across portfolios:`, pArr);

  const fromDate = '2025-04-01';
  const toDate = '2026-03-31';

  // Group by pfid
  const byPf: Record<number, any[]> = {};
  allTx?.forEach(t => {
    if (!byPf[t.pfid]) byPf[t.pfid] = [];
    byPf[t.pfid].push(t);
  });

  Object.entries(byPf).forEach(([pfid, txList]) => {
    console.log(`\n--- Portfolio ${pfid} ---`);
    const deliveryLots: any[] = [];

    txList.forEach(t => {
      const dt = t.dt || '';
      const trty = Number(t.trty);
      const qn = Number(t.qn) || 0;
      const amt = Number(t.amt) || 0;

      if (trty === 85) {
        const inflow = txList.find(x => x.dt === dt && Number(x.trty) === 45);
        if (inflow && qn > 0) {
          const inQty = Number(inflow.qn) || 0;
          const ratio = inQty / qn;
          console.log(`  [SPLIT 85/45 on ${dt}] Ratio: ${ratio}. Adjusting ${deliveryLots.length} open lots.`);
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

      if (isBuy && qn > 0) {
        const cpu = trty === 40 ? 0 : amt / qn;
        deliveryLots.push({ date: dt, qty: qn, remaining: qn, costPerUnit: cpu });
        console.log(`  [BUY ${dt}] trty=${trty}, Qty=${qn}, Amt=${amt}, CPU=${cpu.toFixed(2)}`);
      } else if (isSell && qn > 0) {
        let sellQty = qn;
        const sellPrice = amt / qn;
        console.log(`  [SELL ${dt}] trty=${trty}, Qty=${qn}, Amt=${amt}, SP=${sellPrice.toFixed(2)}`);

        deliveryLots.forEach(lot => {
          if (sellQty <= 0 || lot.remaining <= 0) return;
          const mq = Math.min(sellQty, lot.remaining);
          lot.remaining -= mq;
          sellQty -= mq;

          const cost = mq * lot.costPerUnit;
          const proceeds = mq * sellPrice;
          const gain = proceeds - cost;
          const days = lot.date && dt
            ? Math.floor((new Date(dt).getTime() - new Date(lot.date).getTime()) / 86400000)
            : 0;

          if (dt >= fromDate && dt <= toDate) {
            console.log(`    >>> MATCH IN FY 25-26: Qty=${mq}, SP=${sellPrice.toFixed(2)}, SaleAmt=${proceeds.toFixed(2)}, PurDate=${lot.date}, PP=${lot.costPerUnit.toFixed(2)}, Cost=${cost.toFixed(2)}, Gain=${gain.toFixed(2)}, Days=${days} (${days>=365?'LTCG':'STCG'})`);
          } else {
            console.log(`    (Match outside FY 25-26 on ${dt}: Qty=${mq}, Gain=${gain.toFixed(2)})`);
          }
        });
      }
    });
  });
}

run().catch(console.error);
