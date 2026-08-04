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
  console.log('Fixing voucher 13332 in vouchersc1...');
  
  // 1. Update vouchersc1
  const { data: vUpd, error: vErr } = await supabase
    .from('vouchersc1')
    .update({ acid: 29 })
    .eq('vid', 13332);

  if (vErr) {
    console.error('Error updating vouchersc1:', vErr);
    return;
  }
  console.log('Successfully updated vouchersc1 for vid 13332.');

  // 2. Fetch max transid from transc1
  const { data: trans, error: tErr } = await supabase
    .from('transc1')
    .select('transid')
    .order('transid', { ascending: false })
    .limit(1);

  if (tErr) {
    console.error('Error fetching max transid:', tErr);
    return;
  }

  const baseTransid = trans && trans.length > 0 ? Number(trans[0].transid) : 23000;
  console.log('Base transid found:', baseTransid);

  // 3. Prepare the two entries (Kotak Bank A/c 13 and Dividend Income 415)
  const rows = [
    {
      transid: baseTransid + 1,
      vid: 13332,
      dt: '2026-05-30',
      maid: 13, // Kotak Bank
      cramt: 0,
      dramt: 245000000,
      acid: 29
    },
    {
      transid: baseTransid + 2,
      vid: 13332,
      dt: '2026-05-30',
      maid: 415, // Dividend Income
      cramt: 245000000,
      dramt: 0,
      acid: 29
    }
  ];

  console.log('Inserting double-entry rows into transc1:', rows);
  const { error: insErr } = await supabase
    .from('transc1')
    .insert(rows);

  if (insErr) {
    console.error('Error inserting into transc1:', insErr);
    return;
  }

  console.log('Successfully fixed voucher 13332!');
}

run().catch(console.error);
