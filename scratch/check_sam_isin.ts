import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('sam').select('*').limit(10);
  if (error) console.error(error);
  else {
    console.log("SAM row 0:", data[0]);
    // Find any row that has an ISIN-like string (starts with IN)
    const { data: isinData } = await supabase.from('sam').select('*').ilike('extstr', 'IN%').limit(2);
    console.log("extstr starts with IN:", isinData);
    
    // Check if there is an isin column
    console.log("Keys in sam:", Object.keys(data[0]));
  }
}
run();
