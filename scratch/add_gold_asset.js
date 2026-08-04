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
  const { data: maxAsset } = await supabase
    .from('asset_master')
    .select('amid')
    .order('amid', { ascending: false })
    .limit(1);
    
  const newAmid = maxAsset && maxAsset[0] ? maxAsset[0].amid + 1 : 100000;

  const { data, error } = await supabase.from('asset_master').insert({
    amid: newAmid,
    name: 'Gold',
    asset_type: 60, // Commodity/Other
    asset_type_name: 'Commodities',
    exchange_group: 'MCX',
    nse_symbol: 'GOLD'
  });

  if (error) {
    console.error('Failed to add Gold to asset_master:', error);
  } else {
    console.log('Successfully added Gold to asset_master with amid:', newAmid);
  }
}

run();
