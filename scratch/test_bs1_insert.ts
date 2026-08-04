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
  console.log("=== TESTING DUMMY INSERT INTO BS1 ===");
  const testRow = {
    trid: 999999,
    pfid: 1,
    amid: 503134, // dynamic ledger ID
    atyid: 50,
    sid: -1,
    cnid: -1,
    trty: 20,
    trstr: 'Buy',
    acvch: 13352,
    dt: '2026-06-03',
    qn: 35,
    purpr: 402.15,
    netpr: 402.15,
    amt: 14075.25,
    brkg: 0,
    chrgs: 0
  };

  const { data, error } = await supabase.from('bs1').insert(testRow);
  if (error) {
    console.error("Insert failed with error:", error.message, error);
  } else {
    console.log("Insert succeeded!", data);
    // Cleanup immediately
    await supabase.from('bs1').delete().eq('trid', 999999);
    console.log("Cleanup completed.");
  }
}

run();
