require("dotenv").config();
console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL);
console.log("VITE_SUPABASE_ANON_KEY exists?", !!process.env.VITE_SUPABASE_ANON_KEY);

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function t() {
  const { data, error } = await sb.from("portfolios").select("count");
  console.log("Portfolios test:", data, error);
}
t();
