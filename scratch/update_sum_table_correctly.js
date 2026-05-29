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
  const correctQty = 2273600;
  const correctAmtinv = 3126634.94;

  console.log('Fetching latest price for Bhandari Hosiery Exports...');
  const { data: priceData } = await supabase
    .from('mprices')
    .select('*')
    .eq('amid', bhandariAmid);
  
  const latestPriceRow = (priceData || []).sort((a, b) => Number(b.row_id) - Number(a.row_id))[0];
  const price = latestPriceRow ? Number(latestPriceRow.currp) || 0 : 0;
  const currv = correctQty * price;

  console.log(`Latest price: ${price}, Calculated Current Value = ${currv}`);

  // Fetch existing sum_table row
  const { data: existingSummary } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', saahilPfid)
    .eq('amid', bhandariAmid);

  if (!existingSummary || existingSummary.length === 0) {
    console.error('No existing sum_table row found to update');
    return;
  }

  const summaryRow = {
    qnt: correctQty,
    amtinv: correctAmtinv,
    currv,
    tgain: 0
  };

  console.log('Updating sum_table with correct matching values...');
  const { data: updRes, error: updErr } = await supabase
    .from('sum_table')
    .update(summaryRow)
    .eq('sid', existingSummary[0].sid)
    .select();

  if (updErr) {
    console.error('Error updating sum_table:', updErr);
  } else {
    console.log('Updated sum_table successfully with matching values:', updRes);
  }
}

run().catch(console.error);
