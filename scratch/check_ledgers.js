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
  const { data: ledgers } = await supabase
    .from('acmac1')
    .select('*')
    .eq('acid', 29);
  
  console.log(`Found ${ledgers?.length} ledgers for acid=29:`);
  
  const filtered = ledgers?.filter(l => {
    const n = (l.name || '').toLowerCase();
    return n.includes('bank') || n.includes('cash') || n.includes('div') || n.includes('zero') || n.includes('tds') || l.parent_id === 60 || l.parent_id === '60';
  });

  filtered?.forEach(l => {
    console.log(`  ID: ${l.id}, Name: ${l.name}, ParentID: ${l.parent_id}, is_group: ${l.is_group}`);
  });
}

run().catch(console.error);
