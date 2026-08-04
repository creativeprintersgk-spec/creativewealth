import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase.from('acmac1').select('*').ilike('name', '%interest%');
  if (error) console.error(error);
  else {
    fs.writeFileSync('scratch/interest.json', JSON.stringify(data.map(d => ({ 
      name: d.name, 
      special_type_id: d.special_type_id, 
      parent_id: d.parent_id, 
      is_group: d.is_group 
    })), null, 2));
  }
}
run();
