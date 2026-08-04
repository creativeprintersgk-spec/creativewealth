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
  console.log("=== CHECKING BS1 FOR NTPC IN IMPORT VOUCHER ===");
  const { data: byVoucher, error: err1 } = await supabase
    .from('bs1')
    .select('*')
    .eq('acvch', 13352);
  console.log("bs1 rows for acvch = 13352:", byVoucher || err1);

  const { data: byAmid, error: err2 } = await supabase
    .from('bs1')
    .select('*')
    .in('amid', [503134, 503135]);
  console.log("bs1 rows for amid in [503134, 503135]:", byAmid || err2);
}

run();
