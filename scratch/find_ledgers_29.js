import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Querying acmac1 (ledgers/groups) for acid = 29 (filtered)...');
  const { data: ledgers, error: err } = await supabase
    .from('acmac1')
    .select('*')
    .eq('acid', 29);

  if (err) {
    console.error('Error fetching acmac1:', err);
    return;
  }

  console.log('Filtered Ledgers for acid 29:');
  ledgers.forEach(l => {
    const nameLower = l.name.toLowerCase();
    if (
      nameLower.includes('bank') ||
      nameLower.includes('cash') ||
      nameLower.includes('dividend') ||
      nameLower.includes('income') ||
      nameLower.includes('tds')
    ) {
      console.log(`id=${l.id}, name="${l.name}", parent_id=${l.parent_id}, is_group=${l.is_group}`);
    }
  });
}

run().catch(console.error);
