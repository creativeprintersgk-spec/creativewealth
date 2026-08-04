import { supabase } from '../src/supabase';

async function fetchAll(table: string) {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(page * size, (page + 1) * size - 1);
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

async function main() {
  console.log("Inspecting Opening Entries (vid = 0) in trans1...");

  const [acmac1, trans1] = await Promise.all([
    fetchAll('acmac1'),
    fetchAll('trans1')
  ]);

  const ledgerMap = new Map<number, any>();
  acmac1.forEach((a: any) => ledgerMap.set(Number(a.id), a));

  const vid0 = trans1.filter((t: any) => Number(t.vid) === 0);
  console.log(`Found ${vid0.length} trans1 rows with vid = 0.`);

  const acids = Array.from(new Set(vid0.map((t: any) => Number(t.acid))));
  
  for (const acid of acids) {
    const acidEntries = vid0.filter((t: any) => Number(t.acid) === acid);
    const dr = acidEntries.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
    const cr = acidEntries.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
    
    console.log(`\nAccount Owner ID: ${acid}`);
    console.log(`  Total Debits:  ₹${dr.toFixed(2)}`);
    console.log(`  Total Credits: ₹${cr.toFixed(2)}`);
    console.log(`  Discrepancy:   ₹${(dr - cr).toFixed(2)}`);

    console.log("  Entries list:");
    acidEntries.forEach(e => {
      const ledg = ledgerMap.get(Number(e.maid));
      console.log(`    - transid=${e.transid}, maid=${e.maid} (${ledg?.name || 'Unknown'}), DR=${e.dramt}, CR=${e.cramt}`);
    });
  }
}

main().catch(console.error);
