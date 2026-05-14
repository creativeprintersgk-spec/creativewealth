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

async function inspectEntries() {
  const { data: entries } = await supabase.from('entries').select('*');
  console.log("Total entries:", entries?.length);
  const withQuantity = entries?.filter(e => e.quantity > 0);
  console.log("Entries with quantity:", withQuantity?.length);
  if (withQuantity && withQuantity.length > 0) {
    console.log(withQuantity.slice(0, 3));
  }
}

inspectEntries();
