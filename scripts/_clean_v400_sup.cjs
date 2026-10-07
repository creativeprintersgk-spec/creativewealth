require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function clean() {
  const { error: e1 } = await sb.from("transc1").delete().eq("vid", 400);
  console.log("Delete from transc1 vid=400:", e1 ? e1.message : "SUCCESS");

  const { error: e2 } = await sb.from("vouchersc1").delete().eq("vid", 400);
  console.log("Delete from vouchersc1 vid=400:", e2 ? e2.message : "SUCCESS");
}
clean().catch(console.error);
