import 'dotenv/config';
import { supabase } from '../src/supabase';

async function inspectNtpcLedgers() {
  console.log("=== INSPECTING NTPC LEDGER RECORDS ===");

  // 1. Find all NTPC ledger accounts in acmac1
  const { data: ledgers, error: lErr } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', '%NTPC%');

  if (lErr || !ledgers) {
    console.error("Error fetching ledgers:", lErr?.message);
    return;
  }

  console.log(`Found ${ledgers.length} ledger accounts matching "NTPC" in acmac1:`);
  for (const l of ledgers) {
    console.log(`   - ID: ${l.id}, Name: "${l.name}", acid: ${l.acid}, parent_id: ${l.parent_id}, is_group: ${l.is_group}`);

    // Query all transaction entries in transc1 for this ledger ID
    const { data: txLines } = await supabase
      .from('transc1')
      .select('*')
      .eq('maid', l.id);

    console.log(`     * Found ${txLines?.length || 0} transaction lines in transc1:`);
    txLines?.forEach((tx: any) => {
      console.log(`       -> transid: ${tx.transid}, vid: ${tx.vid}, dt: ${tx.dt}, dramt: ${tx.dramt}, cramt: ${tx.cramt}`);
    });
  }
}

inspectNtpcLedgers().catch(console.error);
