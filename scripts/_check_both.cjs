require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  const { data: t1 } = await sb.from("trans1").select("maid,dramt,cramt,acid").eq("acid", 29);
  const { data: tc1 } = await sb.from("transc1").select("maid,dramt,cramt,acid").eq("acid", 29);

  function getSum(rows, maid) {
    let dr = 0, cr = 0;
    for (const r of rows) {
      if (r.maid === maid) {
        dr += Number(r.dramt) || 0;
        cr += Number(r.cramt) || 0;
      }
    }
    return { dr, cr, net: dr - cr };
  }

  for (const maid of [11, 13, 100001, 100002]) {
    const s1 = getSum(t1, maid);
    const sc = getSum(tc1, maid);
    console.log(`MAID ${maid}:`);
    console.log(`  trans1 : DR=${s1.dr.toFixed(2)}, CR=${s1.cr.toFixed(2)}, NET=${s1.net.toFixed(2)}`);
    console.log(`  transc1: DR=${sc.dr.toFixed(2)}, CR=${sc.cr.toFixed(2)}, NET=${sc.net.toFixed(2)}`);
    console.log(`  COMBINED (dr-cr): ${(s1.net + sc.net).toFixed(2)}`);
  }
}
check().catch(console.error);
