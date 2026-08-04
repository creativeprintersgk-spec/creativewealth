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
  console.log("=== SEARCHING FOR 14075.25 OR 35 OR 402.15 IN DATABASE ===");

  console.log("\n--- Searching transc1 ---");
  const { data: tc1 } = await supabase
    .from('transc1')
    .select('*')
    .or('dramt.eq.14075.25,cramt.eq.14075.25');
  console.log("transc1 matching 14075.25:", tc1);

  console.log("\n--- Searching trans1 ---");
  const { data: t1 } = await supabase
    .from('trans1')
    .select('*')
    .or('dramt.eq.14075.25,cramt.eq.14075.25');
  console.log("trans1 matching 14075.25:", t1);

  console.log("\n--- Searching bs1 ---");
  const { data: bs1 } = await supabase
    .from('bs1')
    .select('*')
    .eq('amt', 14075.25);
  console.log("bs1 matching 14075.25:", bs1);

  console.log("\n--- Searching sum_table ---");
  const { data: sum } = await supabase
    .from('sum_table')
    .select('*')
    .or('amtinv.eq.14075.25,currv.eq.14075.25');
  console.log("sum_table matching 14075.25:", sum);

  console.log("\n--- Searching all entries with Qty=35 ---");
  const { data: bs1Qty } = await supabase
    .from('bs1')
    .select('trid,pfid,amid,trstr,qn,amt,dt,acvch')
    .eq('qn', 35);
  console.log("bs1 with Qty=35:", bs1Qty);
}

run().catch(console.error);
