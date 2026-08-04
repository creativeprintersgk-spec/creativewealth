import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: bsList } = await supabase
    .from('bs1')
    .select('*')
    .eq('dt', '2025-12-26');

  console.log("Found bs1 rows on 2025-12-26:", bsList);
}

run().catch(console.error);
