import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  // Fetch all relevant tables
  const [{ data: acmac1 }, { data: transc1 }, { data: trans1 }] = await Promise.all([
    supabase.from('acmac1').select('*'),
    supabase.from('transc1').select('*'),
    supabase.from('trans1').select('*'),
  ]);

  const allLedgers = (acmac1 || []).filter((a: any) => !a.is_group);

  // Find bank ledgers by name
  const bankKeywords = ['hdfc', 'kotak', 'sbi', 'state bank'];
  const bankLedgers = allLedgers.filter((l: any) =>
    bankKeywords.some(k => (l.name || '').toLowerCase().includes(k))
  );

  console.log(`\n=== BANK LEDGERS IN ACMAC1 ===`);
  bankLedgers.forEach((l: any) => {
    console.log(`  ID=${l.id} | ACID=${l.acid} | Name="${l.name}" | op_dr=${l.db_bal || 0} | op_cr=${l.cr_bal || 0}`);
  });

  const bankMaids = new Set(bankLedgers.map((l: any) => l.id));

  console.log(`\n=== ENTRIES IN TRANSC1 for bank maids ===`);
  let c1Entries = (transc1 || []).filter((e: any) => bankMaids.has(e.maid));
  console.log(`  Count: ${c1Entries.length}`);
  // Group by maid
  const c1ByMaid: Record<number, any[]> = {};
  c1Entries.forEach((e: any) => {
    if (!c1ByMaid[e.maid]) c1ByMaid[e.maid] = [];
    c1ByMaid[e.maid].push(e);
  });
  Object.entries(c1ByMaid).forEach(([maid, entries]) => {
    const ledger = bankLedgers.find((l: any) => l.id == maid);
    const totalDr = entries.reduce((s: number, e: any) => s + (Number(e.dramt) || 0), 0);
    const totalCr = entries.reduce((s: number, e: any) => s + (Number(e.cramt) || 0), 0);
    console.log(`  maid=${maid} "${ledger?.name}" -> ${entries.length} entries, DR=${totalDr.toFixed(2)}, CR=${totalCr.toFixed(2)}`);
  });

  console.log(`\n=== ENTRIES IN TRANS1 for bank maids ===`);
  let t1Entries = (trans1 || []).filter((e: any) => bankMaids.has(e.maid));
  console.log(`  Count: ${t1Entries.length}`);
  const t1ByMaid: Record<number, any[]> = {};
  t1Entries.forEach((e: any) => {
    if (!t1ByMaid[e.maid]) t1ByMaid[e.maid] = [];
    t1ByMaid[e.maid].push(e);
  });
  Object.entries(t1ByMaid).forEach(([maid, entries]) => {
    const ledger = bankLedgers.find((l: any) => l.id == maid);
    const totalDr = entries.reduce((s: number, e: any) => s + (Number(e.dramt) || 0), 0);
    const totalCr = entries.reduce((s: number, e: any) => s + (Number(e.cramt) || 0), 0);
    console.log(`  maid=${maid} "${ledger?.name}" -> ${entries.length} entries, DR=${totalDr.toFixed(2)}, CR=${totalCr.toFixed(2)}`);
  });

  // Check for overlap (same transid in both tables)
  console.log(`\n=== OVERLAP CHECK (same transid in both tables) ===`);
  const c1Ids = new Set((transc1 || []).map((e: any) => e.transid));
  const t1Ids = new Set((trans1 || []).map((e: any) => e.transid));
  let overlap = 0;
  t1Ids.forEach(id => { if (c1Ids.has(id)) overlap++; });
  console.log(`  transc1 total entries: ${c1Ids.size}`);
  console.log(`  trans1  total entries: ${t1Ids.size}`);
  console.log(`  Overlapping transids: ${overlap}`);
  console.log(`  UNIQUE to transc1 only: ${c1Ids.size - overlap}`);
  console.log(`  UNIQUE to trans1 only: ${t1Ids.size - overlap}`);

  // After dedup (taking c1 first), what gets lost?
  console.log(`\n=== BANK ENTRIES LOST BY DEDUP (in trans1 but NOT in transc1) ===`);
  const lostBankEntries = t1Entries.filter((e: any) => !c1Ids.has(e.transid));
  const lostByMaid: Record<number, any[]> = {};
  lostBankEntries.forEach((e: any) => {
    if (!lostByMaid[e.maid]) lostByMaid[e.maid] = [];
    lostByMaid[e.maid].push(e);
  });
  if (lostBankEntries.length === 0) {
    console.log('  None lost - all trans1 bank entries exist in transc1 already.');
  } else {
    Object.entries(lostByMaid).forEach(([maid, entries]) => {
      const ledger = bankLedgers.find((l: any) => l.id == maid);
      const totalDr = entries.reduce((s: number, e: any) => s + (Number(e.dramt) || 0), 0);
      const totalCr = entries.reduce((s: number, e: any) => s + (Number(e.cramt) || 0), 0);
      console.log(`  *** LOST maid=${maid} "${ledger?.name}" -> ${entries.length} entries, DR=${totalDr.toFixed(2)}, CR=${totalCr.toFixed(2)}`);
    });
  }
}

run().catch(console.error);
