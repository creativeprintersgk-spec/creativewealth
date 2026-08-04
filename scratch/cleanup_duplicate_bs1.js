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
  const saahilPfid = 1;
  const bhandariAmid = 101556;

  console.log('Deleting duplicate entries with trid in [15944, 15949]...');
  const { data: delData, error: delErr } = await supabase
    .from('bs1')
    .delete()
    .in('trid', [15944, 15945, 15946, 15947, 15948, 15949])
    .select();

  if (delErr) {
    console.error('Error deleting duplicate entries:', delErr);
    return;
  }
  console.log(`Deleted successfully: ${delData?.length || 0} rows.`);

  console.log('\n--- Re-calculating sum_table for amid 101556 ---');
  // Fetch all transactions for this portfolio and asset to update sum_table
  const { data: txs, error: txErr } = await supabase
    .from('bs1')
    .select('*')
    .eq('pfid', saahilPfid)
    .eq('amid', bhandariAmid);

  if (txErr) {
    console.error('Error fetching transactions for recalculation:', txErr);
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
    } else {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      } else {
        amtInvested -= amt;
      }
    }
  });

  if (qty < 0) qty = 0;
  if (amtInvested < 0) amtInvested = 0;

  console.log(`Calculated consolidated holding: Qty = ${qty}, Cost = ${amtInvested.toFixed(2)}`);

  // Fetch current price to update current value
  const { data: priceData } = await supabase
    .from('mprices')
    .select('*')
    .eq('amid', bhandariAmid);
  
  const latestPriceRow = (priceData || []).sort((a, b) => Number(b.row_id) - Number(a.row_id))[0];
  const price = latestPriceRow ? Number(latestPriceRow.currp) || 0 : 0;
  const currv = qty * price;

  console.log(`Latest price: ${price}, Current Value = ${currv}`);

  // Fetch existing sum_table row
  const { data: existingSummary } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', saahilPfid)
    .eq('amid', bhandariAmid);

  const summaryRow = {
    pfolio_id: saahilPfid,
    client_id: 1,
    atty: assetType,
    amid: bhandariAmid,
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
  }
}

run().catch(console.error);
