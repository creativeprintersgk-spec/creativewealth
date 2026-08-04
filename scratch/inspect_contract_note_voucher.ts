import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  // Search for the voucher by narration substring
  const { data: vchList } = await supabase
    .from('vouchersc1')
    .select('*')
    .ilike('narr', '%CNT-25/26-155350961%');
    
  console.log("Vouchers in vouchersc1:", vchList);

  const { data: vchList2 } = await supabase
    .from('vouchers1')
    .select('*')
    .ilike('narr', '%CNT-25/26-155350961%');
    
  console.log("Vouchers in vouchers1:", vchList2);

  const allVch = [...(vchList || []), ...(vchList2 || [])];
  for (const v of allVch) {
    const table = vchList?.includes(v) ? 'transc1' : 'trans1';
    const { data: trans } = await supabase
      .from(table)
      .select('*')
      .eq('vid', v.vid);
      
    console.log(`Transactions for vid ${v.vid} in ${table}:`, trans);
    
    // Find acmac1 ledger names
    if (trans) {
      for (const t of trans) {
        const { data: ledger } = await supabase
          .from('acmac1')
          .select('name')
          .eq('id', t.maid)
          .limit(1);
        console.log(`   maid=${t.maid} (${ledger?.[0]?.name || 'unknown'}), dr=${t.dramt}, cr=${t.cramt}`);
      }
    }

    const { data: bs } = await supabase
      .from('bs1')
      .select('*')
      .eq('acvch', v.vid);
    console.log(`BS1 rows for vid ${v.vid}:`, bs);
    if (bs) {
      for (const b of bs) {
        const { data: asset } = await supabase
          .from('asset_master')
          .select('name')
          .eq('amid', b.amid)
          .limit(1);
        console.log(`   amid=${b.amid} (${asset?.[0]?.name || 'unknown'}), qn=${b.qn}, amt=${b.amt}, trty=${b.trty}, trstr=${b.trstr}`);
      }
    }
  }
}

run().catch(console.error);
