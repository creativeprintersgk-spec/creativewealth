/**
 * Fix 2: Update the old RLINFRA BUY journal entries (acid=30)
 * to use the new correct ledger maid=503140 (RLINFRA, acid=30)
 * instead of maid=255486 (Krisha's RLINFRA, acid=36).
 * 
 * The sell repair already uses maid=503140. The buys must match.
 * After this fix:
 *   maid=503140 (RLINFRA, acid=30): Dr 151,017.20 - Cr 151,017.20 = 0 (fully sold ✓)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('=== Updating old RLINFRA buy entries (acid=30) ===\n');

  // Find all transc1 entries with maid=255486, acid=30, dramt>0 (the buys)
  const { data: buyEntries } = await supabase.from('transc1')
    .select('transid,vid,maid,dramt,cramt,acid,dt')
    .eq('maid', 255486)
    .eq('acid', 30)
    .gt('dramt', 0);

  console.log('Buy entries to update:');
  for (const e of buyEntries || []) {
    console.log('  transid=' + e.transid + ' vid=' + e.vid + ' Dr=' + e.dramt + ' dt=' + e.dt);
  }

  if (!buyEntries || buyEntries.length === 0) {
    console.log('No buy entries found. Nothing to update.');
    return;
  }

  // Update all of them to maid=503140
  const transids = buyEntries.map(e => e.transid);
  const { error } = await supabase.from('transc1')
    .update({ maid: 503140 })
    .in('transid', transids);

  if (error) {
    console.error('❌ Update failed:', error.message);
    return;
  }

  console.log('\n✅ Updated ' + transids.length + ' entries from maid=255486 to maid=503140');

  // Verify final balance for maid=503140 acid=30
  const { data: check } = await supabase.from('transc1')
    .select('dramt,cramt')
    .eq('maid', 503140)
    .eq('acid', 30);

  let dr = 0, cr = 0;
  for (const l of check || []) { dr += Number(l.dramt); cr += Number(l.cramt); }
  console.log('\nFinal maid=503140 (RLINFRA acid=30): Dr=' + dr.toFixed(2) + ' Cr=' + cr.toFixed(2) + ' Net=' + (dr-cr).toFixed(2));
  console.log(Math.abs(dr-cr) < 0.01 ? '✅ ZERO BALANCE — Reliance Infrastructure fully sold!' : '⚠️  Balance not zero: ' + (dr-cr).toFixed(2));

  // Also verify maid=255486 acid=30 is now clean
  const { data: old } = await supabase.from('transc1')
    .select('dramt,cramt')
    .eq('maid', 255486)
    .eq('acid', 30);
  let dr2 = 0, cr2 = 0;
  for (const l of old || []) { dr2 += Number(l.dramt); cr2 += Number(l.cramt); }
  console.log('Old maid=255486 (acid=30): Dr=' + dr2.toFixed(2) + ' Cr=' + cr2.toFixed(2) + ' (should be 0,0)');
}

run().catch(console.error);
