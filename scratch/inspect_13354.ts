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
  console.log("=== VOUCHER 13354 IN VOUCHERSC1 ===");
  const { data: v } = await supabase
    .from('vouchersc1')
    .select('*')
    .eq('vid', 13354);
  console.log(v);

  console.log("=== TRANSC1 FOR VID 13354 ===");
  const { data: t } = await supabase
    .from('transc1')
    .select('*')
    .eq('vid', 13354);
  console.log(t);

  console.log("=== BS1 FOR ACVCH 13354 ===");
  const { data: b } = await supabase
    .from('bs1')
    .select('*')
    .eq('acvch', 13354);
  console.log(b);
}

run().catch(console.error);
