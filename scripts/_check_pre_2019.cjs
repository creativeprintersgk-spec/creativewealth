require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  const { data: pre2019 } = await sb.from("transc1")
    .select("transid, vid, dt, maid, dramt, cramt, acid")
    .lt("dt", "2019-04-01")
    .neq("dt", "0001-01-01");

  console.log("transc1 entries before 2019-04-01 (excluding 0001):", pre2019?.length);
  pre2019?.forEach(r => console.log(JSON.stringify(r)));

  const { data: t1Pre } = await sb.from("trans1")
    .select("transid, vid, dt, maid, dramt, cramt, acid")
    .lt("dt", "2019-04-01")
    .neq("dt", "0001-01-01");

  console.log("trans1 entries before 2019-04-01 (excluding 0001):", t1Pre?.length);
}
check().catch(console.error);
