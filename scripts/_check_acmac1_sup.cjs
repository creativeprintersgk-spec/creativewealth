require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: rows } = await sb.from("acmac1").select("id, acid, name, parent_id, db_bal, cr_bal").eq("name", "Dharampur House Deposit");
  console.log("Dharampur House Deposit in Supabase:", rows);

  const { data: jew } = await sb.from("acmac1").select("id, acid, name, parent_id, db_bal, cr_bal").eq("name", "Jewellery");
  console.log("Jewellery in Supabase:", jew);
}
run();
