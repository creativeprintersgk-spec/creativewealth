
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

async function checkGroups() {
  const { data, error } = await supabase.from('groups').select('id, name');
  if (error) {
    console.error('Error fetching groups:', error.message);
    return;
  }
  console.log('Current Groups in Supabase:', data.map(g => g.id));
  
  const targetGroups = ['stcg_equity', 'ltcg_equity', 'stcg_debt', 'ltcg_debt'];
  const missing = targetGroups.filter(id => !data.some(g => g.id === id));
  
  if (missing.length > 0) {
    console.log('MISSING GROUPS:', missing);
  } else {
    console.log('All capital gains groups are present.');
  }
}

checkGroups();
