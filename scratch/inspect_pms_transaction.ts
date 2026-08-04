import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== Querying bs1 for 2025-12-29 ===");
  const { data: bsList } = await supabase
    .from('bs1')
    .select('*')
    .eq('dt', '2025-12-29');

  console.log("Found bs1 rows on 2025-12-29:", bsList?.length);
  if (bsList) {
    for (const b of bsList) {
      // Find asset name
      const { data: asset } = await supabase
        .from('asset_master')
        .select('name')
        .eq('amid', b.amid)
        .limit(1);
        
      // Find voucher details
      const { data: vch } = await supabase
        .from('vouchersc1')
        .select('*')
        .eq('vid', b.acvch)
        .limit(1);
        
      console.log(`bs1 row: trid=${b.trid}, pfid=${b.pfid}, amid=${b.amid} (${asset?.[0]?.name}), qn=${b.qn}, amt=${b.amt}, trty=${b.trty}, trstr=${b.trstr}, acvch=${b.acvch}`);
      if (vch?.[0]) {
        console.log(`   Voucher narr: "${vch[0].narr}", vchno: "${vch[0].vchno || ''}"`);
      }
    }
  }

  console.log("\n=== Querying vouchersc1 containing '156221775' or '14420' ===");
  const { data: vchList1 } = await supabase
    .from('vouchersc1')
    .select('*')
    .ilike('narr', '%156221775%');
  console.log("vouchersc1 matching '156221775':", vchList1);

  const { data: vchList2 } = await supabase
    .from('vouchersc1')
    .select('*')
    .ilike('narr', '%14420%');
  console.log("vouchersc1 matching '14420':", vchList2);
}

run().catch(console.error);
