require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  const tables = ["trans1","transc1","vouchers1","vouchersc1","bs1","sam","acmac1","sum_table","portfolios","scnote1"];
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(t + ": " + (error ? "ERR: " + error.message : count + " rows"));
  }
}
check().catch(console.error);
