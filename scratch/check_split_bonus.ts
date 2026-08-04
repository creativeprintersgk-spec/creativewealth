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
  console.log("=== CHECKING FOR CORPORATE ACTIONS IN BS1 ===");
  const { data, error } = await supabase
    .from('bs1')
    .select('trid, trty, trstr, qn, purpr, amt, narr')
    .not('trstr', 'in', '("Buy","Sell")')
    .limit(30);

  if (error) {
    console.error("Error:", error);
    return;
  }

  data?.forEach((r: any) => {
    console.log(`trid=${r.trid} trty=${r.trty} trstr="${r.trstr}" qn=${r.qn} purpr=${r.purpr} amt=${r.amt} narr="${r.narr}"`);
  });
}
run();
