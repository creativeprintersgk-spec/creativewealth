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
  const { data: d1, error: e1 } = await s.from('investor_group_members').select('*').limit(1);
  console.log('investor_group_members:', e1?.message || JSON.stringify(d1));
  const { data: d2, error: e2 } = await s.from('investor_groups').select('*').limit(1);
  console.log('investor_groups:', e2?.message || JSON.stringify(d2));
  
  // Check how logic.ts references this
  // In logic.ts: investorGroupMembers: [] as any[],
  // state.investorGroupMembers = igm from safeFetch('investor_group_members')
}
run();
