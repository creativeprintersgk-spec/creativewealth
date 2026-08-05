require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  console.log('Inserting correct prices manually');
  const { data, error } = await s.from('mprices').upsert([
    { source_id_atyp: 50, amid: 103391, currp: 42.50, prevp: 39.5, date: '2026-08-05' },
    { source_id_atyp: 50, amid: 102791, currp: 1581.60, prevp: 1554.7, date: '2026-08-05' }
  ]);
  console.log('Done', error);
}
run();
