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
  const [transc1, trans1] = await Promise.all([
    fetchAll('transc1'),
    fetchAll('trans1')
  ]);

  const acid = 29;
  const dateLimit = '2026-03-31';

  // Capital (transc1) <= 2026-03-31
  const c1 = transc1.filter((t: any) => Number(t.acid) === acid && (!t.dt || t.dt <= dateLimit));
  const c1Dr = c1.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
  const c1Cr = c1.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
  console.log(`As of ${dateLimit}:`);
  console.log(`  Capital (transc1): Dr=${c1Dr.toFixed(2)}, Cr=${c1Cr.toFixed(2)}, Diff=${(c1Dr - c1Cr).toFixed(2)}`);

  // Trading (trans1) <= 2026-03-31
  const t1 = trans1.filter((t: any) => Number(t.acid) === acid && (!t.dt || t.dt <= dateLimit));
  const t1Dr = t1.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
  const t1Cr = t1.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
  console.log(`  Trading (trans1):  Dr=${t1Dr.toFixed(2)}, Cr=${t1Cr.toFixed(2)}, Diff=${(t1Dr - t1Cr).toFixed(2)}`);
  
  console.log(`  Total combined:    Dr=${(c1Dr + t1Dr).toFixed(2)}, Cr=${(c1Cr + t1Cr).toFixed(2)}, Diff=${(c1Dr + t1Dr - (c1Cr + t1Cr)).toFixed(2)}`);
}

main().catch(console.error);
