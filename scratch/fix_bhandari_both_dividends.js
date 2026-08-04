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
  console.log('Fixing both dividend transactions...');

  // 1. Fix bs1 for vid = 13331 (30/05/26)
  const { data: bsData, error: bsErr } = await supabase
    .from('bs1')
    .update({
      trty: 62,
      trstr: 'Dividend Payout',
      amt: 20000000
    })
    .eq('acvch', 13331)
    .select();

  if (bsErr) console.error('Error updating bs1:', bsErr);
  else console.log('Successfully updated bs1:', bsData);

  // 2. Fix acid to 31 in vouchersc1 for both vids
  const { data: vData, error: vErr } = await supabase
    .from('vouchersc1')
    .update({ acid: 31 })
    .in('vid', [13330, 13331])
    .select();

  if (vErr) console.error('Error updating vouchersc1:', vErr);
  else console.log('Successfully updated vouchersc1:', vData);

  // 3. Fix acid to 31 in transc1 for both vids
  const { data: tData, error: tErr } = await supabase
    .from('transc1')
    .update({ acid: 31 })
    .in('vid', [13330, 13331])
    .select();

  if (tErr) console.error('Error updating transc1:', tErr);
  else console.log('Successfully updated transc1:', tData);
}

run().catch(console.error);
