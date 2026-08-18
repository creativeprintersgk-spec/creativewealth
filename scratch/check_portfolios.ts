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

async function checkPortfolios() {
  const { data } = await s.from('portfolios').select('id, full_name, investor_name');
  console.log('Portfolios count:', data?.length);
  if (data) {
    for (const p of data) {
      console.log(`ID: ${p.id}`.padEnd(10), `Name: ${p.full_name || p.investor_name}`);
    }
  }
}
checkPortfolios();
