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
  console.log("=== ALL SUM_TABLE ROWS FOR PFID 1 ===");

  const { data: sumRows } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', 1);

  const { data: assetMaster } = await supabase.from('asset_master').select('*');
  const assetNameMap = new Map(assetMaster?.map(a => [a.amid, a.name]) || []);

  const results = sumRows?.map(r => ({
    sid: r.sid,
    amid: r.amid,
    name: assetNameMap.get(r.amid) || `Asset ${r.amid}`,
    qnt: r.qnt,
    amtinv: r.amtinv
  })) || [];

  console.log(JSON.stringify(results, null, 2));
}

run();
