
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
  const { data, error } = await supabase.from('families').select('*').limit(1);
  if (error) {
    console.error('Error fetching families:', error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in families:', Object.keys(data[0]));
  } else {
    console.log('No data in families table to check columns.');
  }
}

checkSchema();
