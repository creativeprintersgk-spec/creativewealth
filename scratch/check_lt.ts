import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await s.from('sam').select('amid, name');
  console.log('Total SAM records:', data?.length);
  const matched = (data || []).filter(d => (d.name || '').toLowerCase().includes('l&t') || (d.name || '').toLowerCase().includes('l & t') || (d.name || '').toLowerCase().includes('finance'));
  console.log('Matches:', matched);
}

run();
