require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  // Check ACMA1 for RKSV (100002) in snapshot/supabase
  const { data: acma } = await sb.from("acmac1").select("*").eq("id", 100002);
  console.log("ACMA1 rows for 100002 (RKSV):");
  acma?.forEach(r => console.log(`  ACID=${r.acid}, NAME="${r.name}", DB_BAL=${r.db_bal}, CR_BAL=${r.cr_bal}, NET=${(r.db_bal||0)-(r.cr_bal||0)}`));

  // Check transc1 for 100002
  const { data: tc } = await sb.from("transc1").select("acid, dramt, cramt, dt, narr").eq("maid", 100002);
  console.log("\ntransc1 for 100002 count:", tc?.length);
  const tcByAcid = {};
  tc?.forEach(r => {
    tcByAcid[r.acid] = tcByAcid[r.acid] || { dr: 0, cr: 0 };
    tcByAcid[r.acid].dr += Number(r.dramt) || 0;
    tcByAcid[r.acid].cr += Number(r.cramt) || 0;
  });
  console.log("transc1 by acid:", tcByAcid);

  // Check trans1 for 100002
  const { data: t1 } = await sb.from("trans1").select("acid, dramt, cramt, dt, narr").eq("maid", 100002);
  console.log("\ntrans1 for 100002 count:", t1?.length);
  const t1ByAcid = {};
  t1?.forEach(r => {
    t1ByAcid[r.acid] = t1ByAcid[r.acid] || { dr: 0, cr: 0 };
    t1ByAcid[r.acid].dr += Number(r.dramt) || 0;
    t1ByAcid[r.acid].cr += Number(r.cramt) || 0;
  });
  console.log("trans1 by acid:", t1ByAcid);

  // Total net for each acid:
  for (const acid of [29, 30, 31, 32, 36, 61, 62]) {
    const c = tcByAcid[acid] || { dr: 0, cr: 0 };
    const t = t1ByAcid[acid] || { dr: 0, cr: 0 };
    console.log(`ACID ${acid}: trans1 net=${(t.dr - t.cr).toFixed(2)}, transc1 net=${(c.dr - c.cr).toFixed(2)}, TOTAL=${((t.dr - t.cr) + (c.dr - c.cr)).toFixed(2)}`);
  }
}
check().catch(console.error);
