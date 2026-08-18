const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Fix 1: Update sum_table for Aurobindo (amid=102791) in pfid=1 (Saahil Inv)
// bs1 shows: 10 @ 1442.1 + 20 @ 1476.2 + 2 @ 1643.7 = 32 qty, ₹47,232.4
// Current sum_table shows: 30 qty, ₹43,945

async function fix() {
  console.log('=== FIX 1: Aurobindo sum_table ===');
  // Calculate correct values from bs1
  // trid=16277: 10 qty @ 1442.1 = 14421
  // trid=16348: 20 qty @ 1476.2 = 29524
  // trid=17181: 2 qty @ 1643.7 = 3287.4
  // TOTAL: 32 qty, amt = 47232.4
  const correctQty = 32;
  const correctAmt = 14421 + 29524 + 3287.4; // = 47232.4
  const correctAvg = correctAmt / correctQty; // = 1475.9875

  const { error: sumErr } = await supabase
    .from('sum_table')
    .update({
      qnt: correctQty,
      amtinv: correctAmt,
    })
    .eq('pfolio_id', 1)
    .eq('amid', 102791);

  if (sumErr) {
    console.error('sum_table update error:', sumErr.message);
  } else {
    console.log(`✅ Updated sum_table: pfid=1 amid=102791 -> qnt=${correctQty} amtinv=${correctAmt.toFixed(2)}`);
  }

  // Fix 2: Re-create sum_table entries for ALL 20 CN stocks that are missing
  // These stocks were imported into pfid=1 (Saahil Inv) with their respective quantities
  console.log('\n=== FIX 2: Recreate missing sum_table rows for CN stocks ===');

  // Get all bs1 rows for pfid=1 from the CN date
  const { data: cnBs1 } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, qn, purpr, amt, dt, trty')
    .eq('pfid', 1)
    .eq('dt', '2026-08-11')
    .order('amid', { ascending: true });

  console.log(`CN bs1 rows for pfid=1: ${(cnBs1||[]).length}`);
  (cnBs1||[]).forEach(b => console.log(`  amid=${b.amid} qn=${b.qn} purpr=${b.purpr} amt=${b.amt} trty=${b.trty}`));

  // For each CN stock (excluding Aurobindo which was already fixed), check sum_table
  const cnStocksToFix = (cnBs1 || []).filter(b => b.amid !== 102791); // Aurobindo already fixed
  
  for (const row of cnStocksToFix) {
    const { data: existing } = await supabase
      .from('sum_table')
      .select('sid, pfolio_id, amid, qnt, amtinv')
      .eq('pfolio_id', row.pfid)
      .eq('amid', row.amid);
    
    if (!existing || existing.length === 0) {
      // Create new sum_table entry
      const { error } = await supabase
        .from('sum_table')
        .insert({
          pfolio_id: row.pfid,
          amid: row.amid,
          atty: 50,
          qnt: row.qn,
          amtinv: row.amt || (row.qn * row.purpr),
          balpurc: row.purpr || 0,
          sellcnt: 0,
          currv: 0,
          tgain: 0,
          relgain: 0,
          today_amtinv: 0,
          today_quant: 0,
          agentcode: '-1',
          ext_id: -1,
          flag: 0,
        });
      if (error) {
        console.error(`  ❌ Error creating sum_table for amid=${row.amid}:`, error.message);
      } else {
        console.log(`  ✅ Created sum_table: pfid=1 amid=${row.amid} qnt=${row.qn} amtinv=${row.amt || (row.qn * row.purpr)}`);
      }
    } else {
      // Update existing - add the CN qty and amount
      const current = existing[0];
      const newQnt = (current.qnt || 0) + row.qn;
      const newAmtInv = (current.amtinv || 0) + (row.amt || (row.qn * row.purpr));
      const { error } = await supabase
        .from('sum_table')
        .update({ qnt: newQnt, amtinv: newAmtInv })
        .eq('sid', current.sid);
      if (error) {
        console.error(`  ❌ Error updating sum_table for amid=${row.amid}:`, error.message);
      } else {
        console.log(`  ✅ Updated sum_table: pfid=1 amid=${row.amid} qnt: ${current.qnt}→${newQnt} amtinv: ${current.amtinv?.toFixed(2)}→${newAmtInv.toFixed(2)}`);
      }
    }
  }

  // Fix 3: Verify final state
  console.log('\n=== VERIFICATION ===');
  const { data: verifyAuro } = await supabase
    .from('sum_table')
    .select('pfolio_id, amid, qnt, amtinv')
    .eq('pfolio_id', 1)
    .eq('amid', 102791);
  console.log('Aurobindo sum_table now:', JSON.stringify(verifyAuro));

  const { data: verifyCn } = await supabase
    .from('sum_table')
    .select('pfolio_id, amid, qnt, amtinv')
    .eq('pfolio_id', 1)
    .in('amid', [253791, 253886, 254030, 254076, 254119, 254140, 254204,
                 254501, 254634, 254647, 254741, 254761, 255147, 255214, 255274,
                 255475, 255530, 256104, 605726]);
  console.log(`CN stocks in sum_table for pfid=1: ${(verifyCn||[]).length}`);
  (verifyCn||[]).forEach(s => console.log(`  amid=${s.amid} qnt=${s.qnt} amtinv=${s.amtinv?.toFixed(2)}`));
}

fix().catch(console.error);
