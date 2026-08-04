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
  console.log("=== SEARCHING SUM_TABLE FOR SPECIFIC AMIDS ===");
  const amids = [501842, 610, 501496, 1496, 501548, 501549, 1548, 1549];
  const { data, error } = await supabase.from('sum_table').select('*').in('amid', amids);
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log(`Matching rows in sum_table: ${data?.length || 0}`);
  data?.forEach((r: any) => {
    console.log(`sid=${r.sid} pfolio_id=${r.pfolio_id} atty=${r.atty} amid=${r.amid} qnt=${r.qnt} currv=${r.currv} amtinv=${r.amtinv}`);
  });
}
run();
