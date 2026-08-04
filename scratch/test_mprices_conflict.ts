import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  console.log('Testing upsert with onConflict...');
  const testAmid = 999999;
  const testDate = '2026-05-26';

  const { data, error } = await sb.from('mprices').upsert({
    amid: testAmid,
    currp: 150,
    prevp: 90,
    date: testDate,
    source_id_atyp: 50
  }, { onConflict: 'amid,date' }).select();

  console.log('Upsert with onConflict result:', data, 'Error:', error);
}
main().catch(console.error);
