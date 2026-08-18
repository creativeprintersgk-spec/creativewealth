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
  const { data } = await s.from('bs1').select('*').limit(3);
  console.log('bs1 sample row 0 keys:', data ? Object.keys(data[0]) : null);
  console.log('bs1 sample rows:', data);
}

run().catch(console.error);
