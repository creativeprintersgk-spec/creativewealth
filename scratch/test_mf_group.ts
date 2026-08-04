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
  console.log("=== CHECKING MF AND BOND LEDGERS IN ACMAC1 ===");
  
  // Load active sum_table rows
  let allSumRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('sum_table')
      .select('atty, qnt, currv, amtinv, amid, pfolio_id')
      .order('sid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allSumRows = allSumRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  const activeHoldings = allSumRows.filter((r: any) => 
    Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01
  );

  const activeAmids = activeHoldings.map((h: any) => h.amid);
  console.log(`Active amids: ${activeAmids.length}`);

  // Fetch these from acmac1
  let allAcmac: any[] = [];
  for (let i = 0; i < activeAmids.length; i += 100) {
    const chunk = activeAmids.slice(i, i + 100);
    const { data } = await supabase.from('acmac1').select('id, name, parent_id, is_group').in('id', chunk);
    if (data) allAcmac = allAcmac.concat(data);
  }

  // Fetch all groups to resolve parent names
  const { data: groups } = await supabase.from('acmac1').select('id, name').eq('is_group', true);
  const groupMap = new Map(groups?.map((g: any) => [g.id, g.name]));

  console.log("\nSample active holdings and their acmac1 group:");
  activeHoldings.slice(0, 30).forEach((h: any) => {
    const acmac = allAcmac.find(a => a.id === h.amid && !a.is_group);
    const groupName = acmac ? (groupMap.get(acmac.parent_id) || `Group ${acmac.parent_id}`) : 'NOT FOUND IN ACMAC1';
    console.log(`  amid=${h.amid} atty=${h.atty} qnt=${h.qnt} currv=${h.currv} name="${acmac?.name || `Asset ${h.amid}`}" group="${groupName}" parent_id=${acmac?.parent_id}`);
  });
}
run();
