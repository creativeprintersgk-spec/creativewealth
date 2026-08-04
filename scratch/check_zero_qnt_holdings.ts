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
  console.log("=== CHECKING ZERO QUANTITY HOLDINGS WITH VALUE ===");
  
  let allSumRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('sum_table')
      .select('atty, qnt, currv, amtinv, amid, pfolio_id')
      .order('sid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error("Error fetching page:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allSumRows = allSumRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const zeroQtyActive = allSumRows.filter((r: any) => 
    Number(r.qnt) <= 0.0001 && (Number(r.currv) > 0.01 || Number(r.amtinv) > 0.01)
  );

  console.log(`Total zero-qty active holdings: ${zeroQtyActive.length}`);
  
  // Fetch names
  const amids = Array.from(new Set(zeroQtyActive.map((r: any) => r.amid)));
  let allSamRows: any[] = [];
  for (let i = 0; i < amids.length; i += 100) {
    const chunk = amids.slice(i, i + 100);
    const { data } = await supabase.from('sam').select('amid, anm, atyp').in('amid', chunk);
    if (data) allSamRows = allSamRows.concat(data);
  }
  const samMap = new Map(allSamRows.map((r: any) => [r.amid, r]));

  zeroQtyActive.slice(0, 15).forEach((r: any) => {
    const sam = samMap.get(r.amid);
    const name = sam ? sam.anm : `Unknown Asset ${r.amid}`;
    console.log(`  amid=${r.amid} atyp=${r.atty} qnt=${r.qnt} currv=${r.currv} amtinv=${r.amtinv} name="${name}"`);
  });
}

run();
