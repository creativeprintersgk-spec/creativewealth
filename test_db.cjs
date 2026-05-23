const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: f } = await supabase.from('families').select('*');
  const { data: a } = await supabase.from('accounts').select('*');
  console.log('Families:', f);
  console.log('Accounts:', a);
}
run();
