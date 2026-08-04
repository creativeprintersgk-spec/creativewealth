// delete_old_shares_entries.cjs
// Deletes the 2 orphan credit entries in "OLD Shares" ledger
// Schema: vouchers (header) + entries (line items), ledger IDs are UUIDs
// Entries shown in UI: 2019-04-01 (credit 2000), 2019-04-21 (credit 5000)

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Step 1: Find "OLD Shares" ledger UUID ===\n');

  const { data: ledger, error: ledgerErr } = await supabase
    .from('ledgers')
    .select('id, name')
    .ilike('name', '%old shares%')
    .single();

  if (ledgerErr || !ledger) {
    console.error('Could not find OLD Shares ledger:', ledgerErr?.message);
    // List all ledgers to debug
    const { data: all } = await supabase.from('ledgers').select('id, name').order('name');
    console.log('All ledgers:', JSON.stringify(all, null, 2));
    return;
  }

  console.log(`Found ledger: "${ledger.name}" → ID: ${ledger.id}\n`);

  console.log('=== Step 2: Find entries in this ledger ===\n');

  // Find entries for this ledger, then get their vouchers
  const { data: entryRows, error: entryErr } = await supabase
    .from('entries')
    .select('id, voucher_id, debit, credit, narration')
    .eq('ledger_id', ledger.id);

  if (entryErr) {
    console.error('Error fetching entries:', entryErr.message);
    return;
  }

  console.log(`Found ${entryRows.length} entry rows for this ledger:`);
  console.log(JSON.stringify(entryRows, null, 2));

  if (entryRows.length === 0) return;

  // Get the voucher details (date, type)
  const voucherIds = [...new Set(entryRows.map(e => e.voucher_id))];
  const { data: vouchers, error: vErr } = await supabase
    .from('vouchers')
    .select('id, date, type, narration, fy')
    .in('id', voucherIds)
    .order('date');

  if (vErr) {
    console.error('Error fetching vouchers:', vErr.message);
    return;
  }

  console.log('\nVouchers for these entries:');
  vouchers.forEach(v => {
    const e = entryRows.find(x => x.voucher_id === v.id);
    console.log(`  Voucher ID: ${v.id} | Date: ${v.date} | Type: ${v.type} | FY: ${v.fy} | CR: ${e?.credit} | DR: ${e?.debit}`);
  });

  // Target: FY 2019-20 vouchers (dates 2019-04-01 and 2019-04-21)
  const targetVouchers = vouchers.filter(v =>
    v.date === '2019-04-01' || v.date === '2019-04-21' ||
    (v.fy === '2019-2020' || v.fy === '2019-20')
  );

  if (targetVouchers.length === 0) {
    console.log('\n⚠️  Could not auto-identify target vouchers. Please review above and specify dates.');
    return;
  }

  console.log(`\n=== Step 3: Deleting ${targetVouchers.length} voucher(s) (entries cascade automatically) ===`);
  targetVouchers.forEach(v => console.log(`  → ${v.date} (${v.type})`));

  const deleteIds = targetVouchers.map(v => v.id);
  const { error: delErr } = await supabase
    .from('vouchers')
    .delete()
    .in('id', deleteIds);

  if (delErr) {
    console.error('Delete failed:', delErr.message);
    return;
  }

  console.log('\n✅ Successfully deleted vouchers (and their entries via CASCADE).');

  // Verify remaining
  const { data: remaining } = await supabase
    .from('entries')
    .select('id, voucher_id, credit, debit')
    .eq('ledger_id', ledger.id);

  console.log(`\nRemaining entries for "${ledger.name}": ${remaining?.length ?? 0}`);
  if (remaining?.length) console.log(JSON.stringify(remaining, null, 2));
}

main().catch(console.error);
