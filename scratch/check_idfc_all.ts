import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('=== Checking all rows for amid=425762 across all portfolios ===\n');

  const { data: allRows } = await s.from('bs1')
    .select('*')
    .eq('amid', 425762)
    .order('dt', { ascending: true });

  allRows?.forEach((r: any) => {
    console.log(`  trid=${r.trid}, pfid=${r.pfid}, dt=${r.dt}, trty=${r.trty}, qn=${r.qn}, amt=${r.amt}`);
  });
}

run().catch(console.error);
