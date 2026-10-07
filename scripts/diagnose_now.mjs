import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const sb = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Fetch all acmac1 including acid=-1
const { data: all } = await sb.from('acmac1').select('id,name,is_group,acid,parent_id,db_bal,cr_bal,special_type_id').order('id');

console.log('Total acmac1 rows:', all?.length);

// Group by acid
const byAcid = {};
(all || []).forEach(r => {
  if (!byAcid[r.acid]) byAcid[r.acid] = [];
  byAcid[r.acid].push(r);
});
console.log('Acids in acmac1:', Object.keys(byAcid).join(', '));
for (const [acid, rows] of Object.entries(byAcid)) {
  const grps = rows.filter(r => r.is_group);
  const leds = rows.filter(r => !r.is_group);
  const nonZeroLeds = leds.filter(r => Math.abs(Number(r.db_bal) - Number(r.cr_bal)) > 0.01);
  console.log(`  acid=${acid}: ${grps.length} groups, ${leds.length} ledgers, ${nonZeroLeds.length} with non-zero balance`);
}

// Check key maid values referenced in trans1
const keyMaids = [97, 13, 407, 621, 111, 121, 16, 84, 27, 72, 64];
console.log('\nKey maid lookups in acmac1:');
for (const maid of keyMaids) {
  const rows = (all || []).filter(r => r.id === maid);
  if (rows.length === 0) {
    console.log(`  maid=${maid}: NOT FOUND`);
  } else {
    rows.forEach(r => console.log(`  maid=${maid} acid=${r.acid} is_group=${r.is_group} parent=${r.parent_id} name="${r.name}"`));
  }
}

// Show Unnati acmac1 ledgers with acid=29
const unnatiLedgers = (all || []).filter(r => r.acid === 29 && !r.is_group);
console.log('\nUnnati (acid=29) ledgers:', unnatiLedgers.map(l => `id=${l.id} "${l.name}" parent=${l.parent_id}`));

// Now simulate what getBalanceSheet does for Unnati
// Step 1: getStoredGroups(29) -> groups for acid=29
const unnatiGroups = (all || []).filter(r => r.acid === 29 && r.is_group);
console.log('\nUnnati groups count:', unnatiGroups.length);

// Step 2: getStoredEntries() -> trans1 + transc1
// We know transc1 = 0. trans1 for acid=29 = 4149 rows
// Step 3: For each entry in trans1, try to find matching ledger
// maid=97 -> NOT in acmac1 for acid=29

// CRITICAL: Check if 97 is a group ID
const maid97all = (all || []).filter(r => r.id === 97);
console.log('\nAll acmac1 with id=97:', maid97all.map(r => `acid=${r.acid} is_group=${r.is_group} name="${r.name}"`));

// Summary of the problem:
// Unnati has acid=29, gets 24 ledgers from acmac1 (all db_bal=0, cr_bal=0)
// trans1 has 4149 rows for acid=29 with maid values like 97, 13, 407, 621...
// Most of these maid values don't exist in acmac1 for acid=29
// The balance sheet ends up blank because no ledger balances are computed

// What's in the original SQLite file?
// Let's check from a different angle: what IS maid=97 in the context of trans1?
const { data: t1_maid97 } = await sb.from('trans1').select('transid,maid,vid,acid,dt,dramt,cramt').eq('maid', 97).limit(5);
console.log('\ntrans1 maid=97 sample:', JSON.stringify(t1_maid97));

// And check vouchers1 for those vid values
if (t1_maid97 && t1_maid97.length > 0) {
  const vid = t1_maid97[0].vid;
  const { data: v1 } = await sb.from('vouchers1').select('*').eq('vid', vid);
  console.log('vouchers1 for vid='+vid+':', JSON.stringify(v1));
}

// The key question: in the ORIGINAL SQLite (mprTempBackupMPrAPPv10.db)
// what is ACMA1.ID=97 for acid=29?
// We need to check the SQLite file directly
