
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

async function syncGroups() {
  const newGroups = [
    { id: 'stcg_equity', name: 'STCG Listed Equity (20%)', parent_id: 'capital_gains', type: 'INCOME' },
    { id: 'ltcg_equity', name: 'LTCG Listed Equity (12.5%)', parent_id: 'capital_gains', type: 'INCOME' },
    { id: 'stcg_debt', name: 'STCG Debt/Other', parent_id: 'capital_gains', type: 'INCOME' },
    { id: 'ltcg_debt', name: 'LTCG Debt/Other', parent_id: 'capital_gains', type: 'INCOME' },
  ];

  console.log('🚀 Syncing new groups to Supabase...');
  
  for (const group of newGroups) {
    const { error } = await supabase.from('groups').upsert(group);
    if (error) {
      console.error(`Error inserting group ${group.id}:`, error.message);
    } else {
      console.log(`✅ Group ${group.id} synced successfully.`);
    }
  }
}

syncGroups();
