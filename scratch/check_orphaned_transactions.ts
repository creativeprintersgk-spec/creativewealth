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
  console.log("Checking for orphaned transactions (no matching voucher header)...");

  const [transc1, trans1, vouchersc1, vouchers1] = await Promise.all([
    fetchAll('transc1'),
    fetchAll('trans1'),
    fetchAll('vouchersc1'),
    fetchAll('vouchers1')
  ]);

  const vchC1Ids = new Set(vouchersc1.map((v: any) => Number(v.vid)));
  const vch1Ids = new Set(vouchers1.map((v: any) => Number(v.vid)));

  const orphanedC1 = transc1.filter((t: any) => !vchC1Ids.has(Number(t.vid)));
  const orphaned1 = trans1.filter((t: any) => !vch1Ids.has(Number(t.vid)));

  console.log(`Orphaned transc1 entries (no matching vouchersc1): ${orphanedC1.length}`);
  console.log(`Orphaned trans1 entries (no matching vouchers1): ${orphaned1.length}`);

  if (orphaned1.length > 0) {
    console.log("\nSome orphaned trans1 entries:");
    orphaned1.slice(0, 10).forEach(e => {
      console.log(`  - transid=${e.transid}, vid=${e.vid}, acid=${e.acid}, maid=${e.maid}, DR=${e.dramt}, CR=${e.cramt}`);
    });
  }
}

main().catch(console.error);
