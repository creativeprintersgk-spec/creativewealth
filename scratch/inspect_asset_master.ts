import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const amids = [230, 401, 407, 615, 205, 621];
  const { data, error } = await supabase
    .from('asset_master')
    .select('*')
    .in('amid', amids);
  
  if (error) {
    console.error('Error fetching from asset_master:', error);
  } else {
    console.log('Results from asset_master:', data);
  }
}

check().catch(console.error);
