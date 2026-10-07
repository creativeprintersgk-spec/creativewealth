require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  const { data: tc } = await sb.from("transc1").select("*").eq("vid", 400);
  console.log("transc1 VID=400:", tc);

  const { data: vc } = await sb.from("vouchersc1").select("*").eq("vid", 400);
  console.log("vouchersc1 VID=400:", vc);

  const { data: t9631 } = await sb.from("transc1").select("*").eq("dramt", 9631);
  console.log("transc1 dramt=9631:", t9631);

  const { data: t1_9631 } = await sb.from("trans1").select("*").eq("dramt", 9631);
  console.log("trans1 dramt=9631:", t1_9631);
}
check().catch(console.error);
