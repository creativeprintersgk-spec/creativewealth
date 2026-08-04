import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== CHECKING VOUCHER 13352 ===");
  const { data: voucher, error: vError } = await supabase
    .from('vouchersc1')
    .select('*')
    .eq('vid', 13352)
    .single();
  console.log("Voucher:", voucher || vError);

  const { data: entries, error: eError } = await supabase
    .from('transc1')
    .select('*')
    .eq('vid', 13352);
  console.log("Entries:", entries || eError);
}

run();
