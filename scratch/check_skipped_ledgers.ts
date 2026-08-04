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
  console.log("Checking for skipped ledgers in Balance Sheet calculation for Unnati Shah (acid = 29)...");

  const [acmac1, trans1, transc1] = await Promise.all([
    fetchAll('acmac1'),
    fetchAll('trans1'),
    fetchAll('transc1')
  ]);

  const acid = 29;

  // Groups and ledgers for this acid
  const groups = acmac1.filter((a: any) => a.is_group && Number(a.acid) === acid);
  const ledgers = acmac1.filter((a: any) => !a.is_group && Number(a.acid) === acid);

  const groupIds = new Set(groups.map((g: any) => String(g.id)));

  console.log(`Groups for Unnati Shah: ${groups.length}`);
  console.log(`Ledgers for Unnati Shah: ${ledgers.length}`);

  // Find if any ledger has a groupId NOT in groupIds
  const skippedLedgers = ledgers.filter((l: any) => !groupIds.has(String(l.parent_id)));
  console.log(`Ledgers with parent_id not in Unnati's groups: ${skippedLedgers.length}`);

  skippedLedgers.forEach(l => {
    // Check if it has transactions
    const count1 = trans1.filter((t: any) => Number(t.maid) === Number(l.id)).length;
    const countc = transc1.filter((t: any) => Number(t.maid) === Number(l.id)).length;
    console.log(`  - Ledger: ${l.name} (id=${l.id}, parent_id=${l.parent_id}), trans1 entries=${count1}, transc1 entries=${countc}`);
  });
}

main().catch(console.error);
