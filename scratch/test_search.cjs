const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testSearch() {
  const query = '20 Micron';
  let q = supabase
    .from('asset_master')
    .select('*')
    .ilike('name', `%${query.trim()}%`)
    .limit(20);

  const { data, error } = await q;
  console.log('Error:', error);
  console.log('Data:', data);
}

testSearch();
