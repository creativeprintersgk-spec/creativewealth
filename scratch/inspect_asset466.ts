import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkAsset466() {
  console.log('=== CHECKING ASSET #466 IN SAM, ACMAC1, SUM_TABLE ===');

  const { data: sam } = await s.from('sam').select('*').eq('amid', 466);
  console.log('SAM for amid=466:', sam);

  const { data: acmac1 } = await s.from('acmac1').select('*').eq('id', 466);
  console.log('ACMAC1 for id=466:', acmac1);

  const { data: sumTable } = await s.from('sum_table').select('*').eq('amid', 466);
  console.log('sum_table for amid=466:', sumTable);
}
checkAsset466();
