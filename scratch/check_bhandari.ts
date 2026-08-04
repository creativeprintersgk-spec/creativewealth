import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== CHECK INVESTOR_GROUP_MEMBERS ===");

  const { data: sample, error } = await supabase
    .from('investor_group_members')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("investor_group_members sample:", sample);
  }
}

run();
