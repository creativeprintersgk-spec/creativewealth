import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectData() {
  const { data: entries } = await supabase.from('entries').select('*');
  console.log("Total entries:", entries?.length);
  
  const { data: ledgers } = await supabase.from('ledgers').select('*').limit(1);
  if (ledgers && ledgers.length > 0) {
    console.log("Ledger Sample:", ledgers[0]);
    console.log("Ledger Columns:", Object.keys(ledgers[0]));
  }
}

inspectData();
