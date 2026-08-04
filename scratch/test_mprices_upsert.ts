import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  console.log('Testing upsert behavior on mprices...');
  const testAmid = 999999;
  const testDate = '2026-05-26';
  
  // First insert
  const { data: ins1, error: err1 } = await sb.from('mprices').upsert({
    amid: testAmid,
    currp: 100,
    prevp: 90,
    date: testDate,
    source_id_atyp: 50
  }).select();
  console.log('Insert 1 result:', ins1, 'Error:', err1);

  // Second insert
  const { data: ins2, error: err2 } = await sb.from('mprices').upsert({
    amid: testAmid,
    currp: 200,
    prevp: 90,
    date: testDate,
    source_id_atyp: 50
  }).select();
  console.log('Insert 2 result:', ins2, 'Error:', err2);

  // Query all rows for testAmid
  const { data: queryRows, error: err3 } = await sb.from('mprices').select('*').eq('amid', testAmid);
  console.log('Query rows after upsert:', queryRows, 'Error:', err3);

  // Clean up
  if (queryRows && queryRows.length > 0) {
    const ids = queryRows.map((r: any) => r.row_id);
    const { error: delErr } = await sb.from('mprices').delete().in('row_id', ids);
    console.log('Cleanup result error:', delErr);
  }
}
main().catch(console.error);
