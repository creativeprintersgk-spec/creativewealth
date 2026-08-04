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
  console.log("=== CHECKING FOR HOLDINGS WITH ZERO CURRENT VALUE AND POSITIVE QUANTITY ===");
  
  const { data, error } = await supabase
    .from('sum_table')
    .select('*')
    .gt('qnt', 0)
    .eq('currv', 0);

  if (error) {
    console.error("Error fetching sum_table:", error);
    return;
  }

  console.log(`Found ${data?.length || 0} entries with currv=0 and qnt > 0.`);
  
  data?.forEach(r => {
    console.log(`sid=${r.sid} pfolio_id=${r.pfolio_id} atty=${r.atty} amid=${r.amid} qnt=${r.qnt} amtinv=${r.amtinv}`);
  });
}

run().catch(console.error);
