import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function dump() {
  const { data: groups, error } = await supabase.from('groups').select('*');
  if (error) {
    console.error('Error fetching groups:', error);
    return;
  }
  console.log('--- GROUPS ---');
  groups.forEach(g => {
    console.log(`ID: ${g.id}, Name: ${g.name}, Parent: ${g.parent_id}, Type: ${g.type}`);
  });
}

dump().catch(console.error);
