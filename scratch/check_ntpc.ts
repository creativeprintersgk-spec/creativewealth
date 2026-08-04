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
  console.log("Searching for NTPC in asset_master...");
  const { data: amData, error: amErr } = await supabase
    .from('asset_master')
    .select('*')
    .or('nse_symbol.eq.NTPC,isin.eq.INE733E01010');
    
  if (amErr) console.error(amErr);
  else console.log("asset_master matches:", amData);

  console.log("Searching for NTPC in sam...");
  const { data: samData, error: samErr } = await supabase
    .from('sam')
    .select('*')
    .or('alias.eq.NTPC,anm.ilike.%ntpc%');
    
  if (samErr) console.error(samErr);
  else console.log("sam matches:", samData);
}

run().catch(console.error);
