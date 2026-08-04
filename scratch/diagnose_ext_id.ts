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
  console.log("=== DIAGNOSING EXT_ID LINKAGE ===");

  // Fetch some active asset ledgers from acmac1
  const ledgerIds = [501548, 501549, 501842, 500388, 500395];
  const { data: acmacData, error } = await supabase
    .from('acmac1')
    .select('id, name, ext_id, parent_id')
    .in('id', ledgerIds);
  
  if (error) {
    console.error("Error fetching acmac1:", error);
    return;
  }

  acmacData.forEach((r: any) => {
    console.log(`acmac1_id=${r.id} name="${r.name}" ext_id=${r.ext_id} parent_id=${r.parent_id}`);
  });

  // Fetch sam rows with those ext_ids
  const extIds = acmacData.map(r => r.ext_id).filter(Boolean);
  if (extIds.length > 0) {
    const { data: samData } = await supabase.from('sam').select('amid, anm, atyp').in('amid', extIds);
    console.log("\nMatching sam rows for these ext_ids:");
    samData?.forEach((r: any) => {
      console.log(`  amid=${r.amid} atyp=${r.atyp} anm="${r.anm}"`);
    });

    const { data: sumData } = await supabase.from('sum_table').select('sid, atty, amid, qnt, currv, amtinv').in('amid', extIds);
    console.log("\nMatching sum_table rows for these ext_ids:");
    sumData?.forEach((r: any) => {
      console.log(`  sid=${r.sid} atty=${r.atty} amid=${r.amid} qnt=${r.qnt} currv=${r.currv} amtinv=${r.amtinv}`);
    });
  }
}
run();
