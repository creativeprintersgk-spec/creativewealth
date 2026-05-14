
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

async function checkSchema() {
  // We can't directly check schema via supabase-js easily without RPC or specialized queries
  // But we can try to fetch one row and check the type of 'id'
  const tables = ['families', 'accounts', 'vouchers'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`❌ Table "${table}" error:`, error.message);
    } else if (data && data.length > 0) {
      const id = data[0].id;
      console.log(`Table "${table}" ID:`, id, "Type:", typeof id);
    } else {
      console.log(`Table "${table}" is empty.`);
    }
  }
}

checkSchema();
