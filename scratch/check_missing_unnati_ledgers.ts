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
  console.log("Checking for any transactions with missing ledgers for Unnati Shah (acid = 29)...");

  const [acmac1, transc1, trans1] = await Promise.all([
    fetchAll('acmac1'),
    fetchAll('transc1'),
    fetchAll('trans1')
  ]);

  const acid = 29;
  const ledgerIds = new Set(acmac1.filter((a: any) => a.acid === acid).map((a: any) => Number(a.id)));

  const c1Missing = transc1.filter((t: any) => Number(t.acid) === acid && !ledgerIds.has(Number(t.maid)));
  const t1Missing = trans1.filter((t: any) => Number(t.acid) === acid && !ledgerIds.has(Number(t.maid)));

  console.log(`Capital missing ledgers entries: ${c1Missing.length}`);
  c1Missing.forEach(e => {
    console.log(`  - transid=${e.transid}, maid=${e.maid}, DR=${e.dramt}, CR=${e.cramt}`);
  });

  console.log(`Trading missing ledgers entries: ${t1Missing.length}`);
  t1Missing.forEach(e => {
    // Check if the ledger is in acmac1 under a different acid
    const globalLedger = acmac1.find((a: any) => Number(a.id) === Number(e.maid));
    console.log(`  - transid=${e.transid}, maid=${e.maid} (global name: ${globalLedger?.name || 'Unknown'}, global acid: ${globalLedger?.acid}), DR=${e.dramt}, CR=${e.cramt}`);
  });
}

main().catch(console.error);
