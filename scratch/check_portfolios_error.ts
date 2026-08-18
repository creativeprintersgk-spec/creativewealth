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
  const { data, error } = await s.from('portfolios').select('*');
  console.log('portfolios error:', error);
  console.log('portfolios length:', data?.length);
  if (data && data.length > 0) {
    console.log('portfolios sample:', data[0]);
  }
}
run();
