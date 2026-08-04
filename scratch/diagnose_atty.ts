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
  console.log("=== DIAGNOSING ALL UNIQUE ATTY CODES (PAGINATED) ===");
  
  let allSumRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('sum_table')
      .select('atty, qnt, amid, pfolio_id')
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

  console.log("Total rows loaded from sum_table:", allSumRows.length);
  const activeHoldings = allSumRows.filter((r: any) => Number(r.qnt) > 0.0001);
  console.log("Total active holdings (qnt > 0.0001):", activeHoldings.length);

  // Fetch all active amids from sam
  const activeAmids = Array.from(new Set(activeHoldings.map((r: any) => r.amid)));
  
  let allSamRows: any[] = [];
  for (let i = 0; i < activeAmids.length; i += 100) {
    const chunk = activeAmids.slice(i, i + 100);
    const { data } = await supabase.from('sam').select('amid, anm, atyp').in('amid', chunk);
    if (data) allSamRows = allSamRows.concat(data);
  }
  const samMap = new Map(allSamRows.map((r: any) => [r.amid, r]));

  const attyCounts: Record<number, number> = {};
  const attySamples: Record<number, string[]> = {};

  activeHoldings.forEach((r: any) => {
    const code = Number(r.atty);
    attyCounts[code] = (attyCounts[code] || 0) + 1;

    if (!attySamples[code]) attySamples[code] = [];
    const sam = samMap.get(r.amid);
    const name = sam ? sam.anm : `Unknown Asset ${r.amid}`;
    if (attySamples[code].length < 3 && !attySamples[code].includes(name)) {
      attySamples[code].push(name);
    }
  });

  console.log("\nActive Asset Types in sum_table (qnt > 0):");
  Object.keys(attyCounts).map(Number).sort((a,b)=>a-b).forEach((code) => {
    console.log(`Code ${code}: Count = ${attyCounts[code]}`);
    console.log(`  Samples: [${attySamples[code].join(', ')}]`);
  });
}

run();
