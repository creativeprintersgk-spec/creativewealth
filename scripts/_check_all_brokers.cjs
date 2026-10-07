require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  const { data: t1 } = await sb.from("trans1").select("maid, acid, dramt, cramt");
  const { data: tc } = await sb.from("transc1").select("maid, acid, dramt, cramt");

  for (const brokerId of [100001, 100002, 100003, 100004, 100007, 100008]) {
    console.log(`\n=== BROKER ${brokerId} ===`);
    for (const acid of [29, 30, 31, 32, 36]) {
      const t1_rows = t1.filter(r => r.maid === brokerId && r.acid === acid);
      const tc_rows = tc.filter(r => r.maid === brokerId && r.acid === acid);
      if (t1_rows.length === 0 && tc_rows.length === 0) continue;

      const t1_net = t1_rows.reduce((s, r) => s + (Number(r.dramt)||0) - (Number(r.cramt)||0), 0);
      const tc_net = tc_rows.reduce((s, r) => s + (Number(r.dramt)||0) - (Number(r.cramt)||0), 0);
      const total = t1_net + tc_net;
      console.log(`  Acid ${acid}: trans1=${t1_net.toFixed(2)}, transc1=${tc_net.toFixed(2)}, SUM=${total.toFixed(2)}`);
    }
  }
}
check().catch(console.error);
