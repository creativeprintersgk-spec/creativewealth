import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fetchAll(table: string, pkCol: string, filter?: Record<string, any>): Promise<any[]> {
  let query = supabase.from(table).select('*').order(pkCol);
  if (filter) Object.entries(filter).forEach(([k, v]) => { query = (query as any).eq(k, v); });
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await query.range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function run() {
  // Find the Kotak Bank (A/c. No. - 1912581915) from the screenshot
  const { data: acmac1 } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', '%1912581915%');

  console.log('=== Kotak Bank 1912581915 in acmac1 ===');
  const banks = (acmac1 || []);
  banks.forEach((a: any) => {
    console.log(`  id=${a.id}, acid=${a.acid}, name="${a.name}", is_group=${a.is_group}, op_dr=${a.db_bal}, op_cr=${a.cr_bal}`);
  });

  if (banks.length === 0) {
    // Try broader search
    const { data: broader } = await supabase.from('acmac1').select('*').ilike('name', '%1912%');
    console.log('Broader search:');
    (broader || []).forEach((a: any) => {
      console.log(`  id=${a.id}, acid=${a.acid}, name="${a.name}", is_group=${a.is_group}`);
    });
    return;
  }

  // Get the unique ledger IDs (dedup by id+acid)
  const uniqueBanks = banks.filter((a: any, i: number, arr: any[]) =>
    arr.findIndex((b: any) => b.id === a.id && b.acid === a.acid) === i
  );

  for (const bank of uniqueBanks) {
    const MAID = bank.id;
    const ACID = bank.acid;
    const END_DATE = '2026-03-31';

    console.log(`\n=== Checking maid=${MAID} acid=${ACID} "${bank.name}" ===`);

    // Get entries from both tables
    const { data: tc1 } = await supabase.from('transc1').select('*').eq('maid', MAID).eq('acid', ACID);
    const { data: t1 } = await supabase.from('trans1').select('*').eq('maid', MAID).eq('acid', ACID);

    const allEntries = [...(tc1 || []), ...(t1 || [])];
    let dr = 0, cr = 0;
    allEntries.forEach((e: any) => {
      if (e.dt && e.dt <= END_DATE) {
        dr += Number(e.dramt) || 0;
        cr += Number(e.cramt) || 0;
      }
    });
    const opDr = Number(bank.db_bal) || 0;
    const opCr = Number(bank.cr_bal) || 0;

    console.log(`  transc1 entries: ${(tc1 || []).length}`);
    console.log(`  trans1  entries: ${(t1 || []).length}`);
    console.log(`  Period DR=${dr.toFixed(2)}, CR=${cr.toFixed(2)}`);
    console.log(`  acmac1 op_dr=${opDr}, op_cr=${opCr}`);
    console.log(`  Opening (op_dr - op_cr) = ${(opDr - opCr).toFixed(2)}`);
    console.log(`  Closing = opening + DR - CR = ${(opDr - opCr + dr - cr).toFixed(2)}`);
    console.log(`  Transaction-only DR-CR = ${(dr - cr).toFixed(2)}`);

    // Show last few entries
    const sorted = allEntries.filter((e: any) => e.dt && e.dt >= '2025-04-01' && e.dt <= END_DATE)
      .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));
    console.log(`  FY 25-26 entries: ${sorted.length}`);
    sorted.slice(-5).forEach((e: any) => {
      console.log(`    dt=${e.dt}, vid=${e.vid}, dr=${e.dramt}, cr=${e.cramt}, src=${e.maid === MAID ? 'match' : 'NO'}`);
    });
  }
}

run().catch(console.error);
