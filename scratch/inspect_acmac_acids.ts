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

async function safeFetch(table: string, pkCol = 'id'): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(pkCol)
      .range(page * size, (page + 1) * size - 1);
    
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  console.log("=== ACMAC1 ACIDS INSPECTION ===");

  const portfolios = await safeFetch('portfolios');
  const accounts = portfolios.filter(p => p.pfolio_type === 10);
  const accountMap = new Map(accounts.map(a => [a.id, a.investor_name]));

  const acmac = await safeFetch('acmac1', 'id');
  console.log(`Total acmac1 rows: ${acmac.length}`);

  // Count by acid in acmac1
  const countByAcid: Record<string, number> = {};
  acmac.forEach((a: any) => {
    countByAcid[a.acid] = (countByAcid[a.acid] || 0) + 1;
  });

  console.log("acmac1 rows grouped by acid:");
  for (const [acid, count] of Object.entries(countByAcid)) {
    console.log(`  Acid ${acid} ("${accountMap.get(Number(acid)) || 'Unknown'}"): ${count} rows`);
  }

  // Check details for Unnati Shah (acid = 29)
  const unnatiRows = acmac.filter((a: any) => String(a.acid) === "29");
  console.log(`Unnati Shah rows in acmac1 (total ${unnatiRows.length}):`);
  console.log(unnatiRows.slice(0, 10).map((a: any) => ({
    id: a.id,
    name: a.name,
    is_group: a.is_group,
    parent_id: a.parent_id
  })));
}

run();
