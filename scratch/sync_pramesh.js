import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const pfid = 4;
  const amid = 101856;

  console.log(`Recalculating sum_table for pfid=${pfid}, amid=${amid}...`);

  // 1. Fetch all transactions
  const { data: txs, error: txErr } = await supabase
    .from('bs1')
    .select('*')
    .eq('pfid', pfid)
    .eq('amid', amid);

  if (txErr) {
    console.error('Error fetching transactions:', txErr);
    return;
  }

  let qty = 0;
  let amtInvested = 0;
  let assetType = 50;

  // Sort by date then trid
  const sortedTxs = [...txs].sort((a, b) => a.dt.localeCompare(b.dt) || Number(a.trid) - Number(b.trid));

  sortedTxs.forEach((t) => {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    assetType = t.atyid || assetType;

    if (isBuy) {
      qty += q;
      amtInvested += amt;
      console.log(`  [Buy] Date: ${t.dt} Qty: ${q} Amt: ${amt} -> total Qty: ${qty}`);
    } else {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      } else {
        amtInvested -= amt;
      }
      console.log(`  [Sell/Other] Date: ${t.dt} Qty: ${q} Amt: ${amt} -> total Qty: ${qty}`);
    }
  });

  if (qty < 0) qty = 0;
  if (amtInvested < 0) amtInvested = 0;

  console.log(`Calculated holding: Qty = ${qty}, Cost = ${amtInvested.toFixed(2)}`);

  // 2. Fetch current price to update current value
  const { data: priceData } = await supabase
    .from('mprices')
    .select('*')
    .eq('amid', amid);
  
  const latestPriceRow = (priceData || []).sort((a, b) => Number(b.row_id) - Number(a.row_id))[0];
  const price = latestPriceRow ? Number(latestPriceRow.currp) || 0 : 0;
  const currv = qty * price;

  console.log(`Latest price: ${price}, Current Value = ${currv}`);

  // 3. Fetch existing sum_table row
  const { data: existingSummary } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', pfid)
    .eq('amid', amid);

  const summaryRow = {
    pfolio_id: pfid,
    client_id: 1,
    atty: assetType,
    amid,
    qnt: qty,
    amtinv: amtInvested,
    currv,
    tgain: 0
  };

  if (existingSummary && existingSummary.length > 0) {
    const { data: updRes, error: updErr } = await supabase
      .from('sum_table')
      .update(summaryRow)
      .eq('sid', existingSummary[0].sid)
      .select();

    if (updErr) {
      console.error('Error updating sum_table:', updErr);
    } else {
      console.log('Updated sum_table successfully:', updRes);
    }
  } else {
    // Insert if missing
    const { data: allSum } = await supabase.from('sum_table').select('sid');
    const allIds = allSum?.map(s => Number(s.sid)).filter(id => !isNaN(id)) || [];
    const nextSid = allIds.length > 0 ? Math.max(...allIds) + 1 : 1001;

    const newRow = { ...summaryRow, sid: nextSid };
    const { data: insRes, error: insErr } = await supabase.from('sum_table').insert(newRow).select();
    if (insErr) {
      console.error('Error inserting into sum_table:', insErr);
    } else {
      console.log('Inserted into sum_table successfully:', insRes);
    }
  }
}

run().catch(console.error);
