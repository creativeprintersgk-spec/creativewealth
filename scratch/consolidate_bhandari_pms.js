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
  const duplicateAmid = 500589;

  console.log('--- 1. Updating bs1 table: amid 500589 -> 101556 ---');
  const { data: bs1Update, error: bs1Err } = await supabase
    .from('bs1')
    .update({ amid: bhandariAmid })
    .eq('amid', duplicateAmid)
    .select();

  if (bs1Err) {
    console.error('Error updating bs1:', bs1Err);
    return;
  }
  console.log(`Updated ${bs1Update?.length || 0} rows in bs1 successfully.`);

  console.log('\n--- 2. Deleting duplicate sum_table entry for amid 500589 ---');
  const { data: delData, error: delErr } = await supabase
    .from('sum_table')
    .delete()
    .eq('pfolio_id', saahilPfid)
    .eq('amid', duplicateAmid)
    .select();

  if (delErr) {
    console.error('Error deleting duplicate from sum_table:', delErr);
    return;
  }
  console.log(`Deleted ${delData?.length || 0} rows from sum_table.`);

  console.log('\n--- 3. Re-calculating sum_table for amid 101556 ---');
  // Fetch all transactions for this portfolio and asset
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

  txs?.forEach((t) => {
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
  
  // Sort mprices by row_id descending to get the latest price
  const latestPriceRow = (priceData || []).sort((a, b) => Number(b.row_id) - Number(a.row_id))[0];
  const price = latestPriceRow ? Number(latestPriceRow.currp) || 0 : 0;
  const currv = qty * price;

  console.log(`Latest price resolved: ${price}, Current Value = ${currv}`);

  // Fetch existing sum_table row for bhandariAmid
  const { data: existingSummary, error: existErr } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', saahilPfid)
    .eq('amid', bhandariAmid);

  if (existErr) {
    console.error('Error querying existing sum_table record:', existErr);
    return;
  }

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
    console.log('Updating existing sum_table record...');
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
    console.log('Inserting new sum_table record...');
    const { data: allSummaries } = await supabase.from('sum_table').select('sid');
    const allSids = (allSummaries || []).map(s => Number(s.sid)).filter(id => !isNaN(id));
    const nextSid = allSids.length > 0 ? Math.max(...allSids) + 1 : 1001;

    const newRow = {
      ...summaryRow,
      sid: nextSid
    };

    const { data: insRes, error: insErr } = await supabase
      .from('sum_table')
      .insert(newRow)
      .select();

    if (insErr) {
      console.error('Error inserting into sum_table:', insErr);
    } else {
      console.log('Inserted into sum_table successfully:', insRes);
    }
  }
}

run().catch(console.error);
