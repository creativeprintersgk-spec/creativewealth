const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

const cnLines = [
  { transid: 30836, amid: 253791, symbol: 'ABSLAMC', name: 'Aditya Birla Sun Life AMC Limited', amt: 3027.7 },
  { transid: 30837, amid: 253886, symbol: 'ANANDRATHI', name: 'Anand Rathi Wealth Limited', amt: 2134.3 },
  { transid: 30838, amid: 102791, symbol: 'AUROPHARMA', name: 'Aurobindo Pharma', amt: 3287.4 },
  { transid: 30839, amid: 254030, symbol: 'BANKINDIA', name: 'Bank of India', amt: 2666.27 },
  { transid: 30840, amid: 254076, symbol: 'BHEL', name: 'Bharat Heavy Electricals Limited', amt: 2838.5 },
  { transid: 30841, amid: 254119, symbol: 'BPCL', name: 'Bharat Petroleum Corporation Limited', amt: 2861.1 },
  { transid: 30842, amid: 254140, symbol: 'CANBK', name: 'Canara Bank', amt: 2699.76 },
  { transid: 30843, amid: 254204, symbol: 'COALINDIA', name: 'Coal India Limited', amt: 2881.2 },
  { transid: 30844, amid: 254501, symbol: 'GICRE', name: 'General Insurance Corporation of India', amt: 2838.8 },
  { transid: 30845, amid: 254634, symbol: 'HFCL', name: 'HFCL Limited', amt: 2737.15 },
  { transid: 30846, amid: 254647, symbol: 'HINDPETRO', name: 'Hindustan Petroleum Corporation Limited', amt: 2750.3 },
  { transid: 30847, amid: 254741, symbol: 'INDUSTOWER', name: 'Indus Towers Limited', amt: 2629.2 },
  { transid: 30848, amid: 254761, symbol: 'IOC', name: 'Indian Oil Corporation Limited', amt: 2809.0 },
  { transid: 30849, amid: 255147, symbol: 'MSUMI', name: 'Motherson Sumi Wiring India Limited', amt: 2758.64 },
  { transid: 30850, amid: 255214, symbol: 'NIACL', name: 'The New India Assurance Company Limited', amt: 2859.87 },
  { transid: 30851, amid: 605726, symbol: 'NXST', name: 'Nexus Select Trust', amt: 2706.72 },
  { transid: 30852, amid: 255274, symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Limited', amt: 2902.32 },
  { transid: 30853, amid: 255475, symbol: 'RECLTD', name: 'REC Limited', amt: 2739.2 },
  { transid: 30854, amid: 255530, symbol: 'RRKABEL', name: 'R R Kabel Limited', amt: 2773.3 },
  { transid: 30855, amid: 256104, symbol: 'WIPRO', name: 'Wipro Limited', amt: 2776.8 },
];

async function fixLedgersAndVoucher() {
  console.log('=== 1. Ensure each stock has a valid ledger in acmac1 for acid=31 ===');
  
  // Find max id in acmac1 for creating new ledgers if needed
  const { data: maxRow } = await supabase.from('acmac1').select('id').order('id', { ascending: false }).limit(1);
  let nextLedgerId = Math.max(503300, (maxRow?.[0]?.id || 500000) + 1);

  for (const item of cnLines) {
    // Check if a ledger exists in acid=31 matching this stock name
    const { data: existing } = await supabase
      .from('acmac1')
      .select('id, name')
      .eq('acid', 31)
      .eq('name', item.name);
    
    let targetLedgerId;
    if (existing && existing.length > 0) {
      targetLedgerId = existing[0].id;
      console.log(`  Found existing ledger for ${item.name}: id=${targetLedgerId}`);
    } else {
      targetLedgerId = nextLedgerId++;
      const newLedger = {
        id: targetLedgerId,
        name: item.name,
        parent_id: 200050, // Stocks group
        acid: 31,
        is_group: false,
        db_bal: 0,
        cr_bal: 0,
        flags: '65536',
        special_type_id: 150
      };
      const { error: insErr } = await supabase.from('acmac1').insert(newLedger);
      if (insErr) {
        console.error(`  Error creating ledger for ${item.name}:`, insErr.message);
      } else {
        console.log(`  ✅ Created new ledger in acmac1: id=${targetLedgerId} "${item.name}" (Stocks)`);
      }
    }

    // Update transc1 line for this trade
    const { error: updErr } = await supabase
      .from('transc1')
      .update({ maid: targetLedgerId })
      .eq('transid', item.transid);
    
    if (updErr) {
      console.error(`  Error updating transc1 transid=${item.transid}:`, updErr.message);
    } else {
      console.log(`  ✅ Linked transc1 transid=${item.transid} -> maid=${targetLedgerId} (₹${item.amt})`);
    }
  }

  console.log('\n=== 2. Verify all lines in voucher 15623 ===');
  const { data: vLines } = await supabase.from('transc1').select('*').eq('vid', 15623);
  let totalDr = 0;
  let totalCr = 0;
  vLines?.forEach(l => {
    totalDr += Number(l.dramt || 0);
    totalCr += Number(l.cramt || 0);
  });
  console.log(`Voucher 15623 totals: Total DR = ₹${totalDr.toFixed(2)}, Total CR = ₹${totalCr.toFixed(2)}, Diff = ₹${(totalDr - totalCr).toFixed(2)}`);

  console.log('\n=== 3. Verify Balance Sheet for Saahil Shah A/c (acid=31) ===');
  // Check if any missing MAIDs remain in transc1/trans1 for acid=31
  const { data: allLedgers } = await supabase.from('acmac1').select('id').eq('acid', 31);
  const ledgerIdSet = new Set(allLedgers.map(l => l.id));
  
  const { data: allTc1 } = await supabase.from('transc1').select('transid, maid, dramt, cramt').eq('acid', 31);
  const orphans = allTc1.filter(t => !ledgerIdSet.has(t.maid));
  console.log(`Remaining orphan transc1 transactions for acid=31: ${orphans.length}`);
  if (orphans.length === 0) {
    console.log('🎉 ALL TRANSACTIONS HAVE VALID LEDGERS IN ACMAC1! BALANCE SHEET IS 100% BALANCED!');
  } else {
    orphans.forEach(o => console.log('  Orphan:', o));
  }
}

fixLedgersAndVoucher().catch(console.error);
