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
  console.log("Checking total sum of Debits vs Credits for Unnati Shah (acid = 29)...");

  const [transc1, trans1] = await Promise.all([
    fetchAll('transc1'),
    fetchAll('trans1')
  ]);

  const acid = 29;

  // Filter for Unnati Shah
  const c1 = transc1.filter((t: any) => Number(t.acid) === acid);
  const t1 = trans1.filter((t: any) => Number(t.acid) === acid);

  console.log(`Capital (transc1) rows for Unnati Shah: ${c1.length}`);
  const c1Dr = c1.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
  const c1Cr = c1.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
  console.log(`Capital Dr: ${c1Dr.toFixed(2)}, Cr: ${c1Cr.toFixed(2)}, Diff: ${(c1Dr - c1Cr).toFixed(2)}`);

  console.log(`Trading (trans1) rows for Unnati Shah: ${t1.length}`);
  const t1Dr = t1.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
  const t1Cr = t1.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
  console.log(`Trading Dr: ${t1Dr.toFixed(2)}, Cr: ${t1Cr.toFixed(2)}, Diff: ${(t1Dr - t1Cr).toFixed(2)}`);

  console.log(`Combined Dr: ${(c1Dr + t1Dr).toFixed(2)}, Combined Cr: ${(c1Cr + t1Cr).toFixed(2)}, Diff: ${(c1Dr + t1Dr - (c1Cr + t1Cr)).toFixed(2)}`);
}

main().catch(console.error);
