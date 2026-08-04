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
  const { data: links } = await supabase.from('acc_pflink').select('*');
  console.log("All Links in acc_pflink:", links);
  
  const { data: portfolios } = await supabase.from('portfolios').select('id, investor_name, pfolio_type');
  console.log("All Portfolios:", portfolios);
}

run().catch(console.error);
