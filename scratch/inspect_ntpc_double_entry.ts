import 'dotenv/config';
import { supabase } from '../src/supabase';

async function inspectNtpcDoubleEntry() {
  console.log("=== INSPECTING NTPC ENTRIES IN THE DATABASE ===");

  // NTPC Limited is amid 104519
  const amid = 104519;

  // 1. Fetch all transactions for NTPC from bs1 (holdings)
  const { data: bs1Rows, error: bs1Err } = await supabase
    .from('bs1')
    .select('*')
    .eq('amid', amid);

  if (bs1Err) {
    console.error("Error fetching bs1 rows:", bs1Err.message);
    return;
  }

  console.log(`\n1. Found ${bs1Rows.length} transactions in bs1 (Holdings) for NTPC:`);
  bs1Rows.forEach((r: any) => {
    console.log(`   - trid: ${r.trid}, pfid: ${r.pfid}, qty: ${r.qn}, price: ${r.purpr}, amt: ${r.amt}, date: ${r.dt}, linked voucher (acvch): ${r.acvch}, cnid: ${r.cnid}`);
  });

  // 2. Fetch the linked vouchers and their transactions
  const vids = Array.from(new Set(bs1Rows.map((r: any) => r.acvch).filter(Boolean)));
  if (vids.length === 0) {
    console.log("\n⚠️ No linked vouchers found in bs1 rows.");
    return;
  }

  console.log(`\n2. Querying linked vouchers (vids: ${vids.join(", ")}):`);
  
  for (const vid of vids) {
    const { data: vchRow } = await supabase.from('vouchersc1').select('*').eq('vid', vid).maybeSingle();
    const { data: transRows } = await supabase.from('transc1').select('*').eq('vid', vid);

    console.log(`\n--------------------------------------------------`);
    console.log(`Voucher vid: ${vid}`);
    if (vchRow) {
      console.log(`   - Date: ${vchRow.dt}, Narration: "${vchRow.narr}", pfid: ${vchRow.pfid}, cnid: ${vchRow.cnid}`);
    } else {
      console.log(`   - ⚠️ Voucher NOT FOUND in vouchersc1!`);
    }

    console.log(`   - Ledger Entries (transc1):`);
    if (transRows && transRows.length > 0) {
      for (const t of transRows) {
        // Fetch ledger name
        const { data: ledger } = await supabase.from('acmac1').select('name').eq('id', t.maid).limit(1);
        const ledgerName = ledger?.[0]?.name || `Ledger ${t.maid}`;
        console.log(`     * transid: ${t.transid}, Ledger: ${ledgerName} (id: ${t.maid}), Debit: ${t.dramt}, Credit: ${t.cramt}`);
      }
    } else {
      console.log(`     * No ledger entries found in transc1!`);
    }
  }
}

inspectNtpcDoubleEntry().catch(console.error);
