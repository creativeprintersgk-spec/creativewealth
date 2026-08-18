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

async function checkAsset353() {
  console.log('=== CHECKING ASSET #353 IN SAM, ACMAC1, SUM_TABLE ===');

  const { data: sam } = await s.from('sam').select('*').eq('amid', 353);
  console.log('SAM for amid=353:', sam);

  const { data: acmac1 } = await s.from('acmac1').select('*').eq('id', 353);
  console.log('ACMAC1 for id=353:', acmac1);

  const { data: sumTable } = await s.from('sum_table').select('*').eq('amid', 353);
  console.log('sum_table for amid=353:', sumTable);

  const { data: assetMaster } = await s.from('asset_master').select('*').eq('amid', 353);
  console.log('asset_master for amid=353:', assetMaster);
}
checkAsset353();
