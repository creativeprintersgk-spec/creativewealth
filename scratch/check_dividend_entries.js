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
  console.log("Querying Supabase...");

  // Let's find vouchers around 30/05/2026
  const { data: vouchers, error: vErr } = await supabase
    .from('vouchersc1')
    .select('*')
    .eq('dt', '2026-05-30');
  
  if (vErr) {
    console.error("Voucher query error:", vErr);
    return;
  }
  console.log("Found vouchers:", vouchers);

  if (vouchers && vouchers.length > 0) {
    const vids = vouchers.map(v => v.vid);
    const { data: trans, error: tErr } = await supabase
      .from('transc1')
      .select('*')
      .in('vid', vids);
    
    if (tErr) {
      console.error("Trans query error:", tErr);
      return;
    }
    console.log("Found trans entries:", trans);

    // Let's print names of matching ledgers (maid) from acmac1
    const maids = trans.map(t => t.maid);
    const { data: ledgers } = await supabase
      .from('acmac1')
      .select('*')
      .in('id', maids);
    
    console.log("Related COA (acmac1) entries:");
    ledgers?.forEach(l => {
      console.log(`  ID: ${l.id}, Name: ${l.name}, ParentID: ${l.parent_id}, Acid: ${l.acid}`);
    });
  }

  // Let's find the portfolio for Unnati
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('*')
    .ilike('investor_name', '%Unnati%');
  console.log("Unnati Portfolio:", portfolios);
}

run().catch(console.error);
