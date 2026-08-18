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

async function fixSilver() {
  // Get all Silver (amid=752) bs1 rows in Portfolio 3
  const { data: rows } = await s
    .from('bs1')
    .select('trid,trty,trstr,dt,qn,purpr,amt,acvch')
    .eq('pfid', 3)
    .eq('amid', 752)
    .order('trid');

  console.log('\n=== Silver BS1 rows (amid=752, pfid=3) ===');
  rows?.forEach(r => console.log(
    `  trid=${r.trid}, trty=${r.trty} (${r.trstr}), dt=${r.dt}, qn=${r.qn}, purpr=${r.purpr}, amt=${r.amt}, acvch=${r.acvch}`
  ));

  const buys = rows?.filter(r => r.trty === 20) ?? [];
  const sells = rows?.filter(r => r.trty === 99) ?? [];
  const totalBuyQty = buys.reduce((sum, r) => sum + Number(r.qn || 0), 0);
  const totalSellQty = sells.reduce((sum, r) => sum + Number(r.qn || 0), 0);
  const netQty = totalBuyQty - totalSellQty;
  const totalInvested = buys.reduce((sum, r) => sum + Number(r.amt || 0), 0);
  console.log(`\nTotal Buy Qty: ${totalBuyQty}`);
  console.log(`Total Sell Qty: ${totalSellQty}`);
  console.log(`Net Qty: ${netQty}`);
  console.log(`Total Invested: ${totalInvested}`);

  // Check sum_table
  const { data: sumRow } = await s.from('sum_table').select('*').eq('pfolio_id', 3).eq('amid', 752).single();
  console.log('\nCurrent sum_table Silver:', JSON.stringify(sumRow));

  // Fix sum_table qnt to match actual net qty from bs1
  if (netQty !== sumRow?.qnt) {
    const { error } = await s.from('sum_table')
      .update({ qnt: netQty, amtinv: totalInvested })
      .eq('pfolio_id', 3)
      .eq('amid', 752);
    if (error) {
      console.log('ERROR updating sum_table:', error.message);
    } else {
      console.log(`\n✅ sum_table Silver qnt fixed: ${sumRow?.qnt} → ${netQty}`);
      console.log(`✅ sum_table Silver amtinv fixed: ${sumRow?.amtinv} → ${totalInvested}`);
    }
  } else {
    console.log('\n✅ sum_table qnt already correct:', netQty);
  }

  // Show mprices for Silver
  const { data: prices } = await s.from('mprices').select('*').eq('amid', 752).order('date', { ascending: false }).limit(5);
  console.log('\nmprices Silver (latest 5):', prices?.map(p => `date=${p.date}, currp=${p.currp}, prevp=${p.prevp}`));
}

fixSilver();
