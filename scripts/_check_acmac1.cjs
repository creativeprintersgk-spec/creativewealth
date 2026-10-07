require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function check() {
  const { data: rows } = await sb.from("acmac1").select("*").in("id", [11, 13, 16, 17, 230, 100001, 100002]);
  console.log("Found:", rows?.length, "rows");
  rows?.forEach(r => console.log(`  ID=${r.id}, NAME="${r.name}", ACID=${r.acid}, IS_GROUP=${r.is_group}, PARENT=${r.parent_id}`));
}
check().catch(console.error);
