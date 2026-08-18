import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data } = await s.from('bs1').select('dt, pfid, acid, amid, trty, qn, amt').limit(20);
  console.log('Sample bs1 rows:', data);

  // Check unique date formats or recent dates
  const { data: recent } = await s.from('bs1').select('dt, pfid, amid, trty, qn, amt').order('dt', { ascending: false }).limit(20);
  console.log('\nRecent bs1 rows (descending dt):', recent);
}

run().catch(console.error);
