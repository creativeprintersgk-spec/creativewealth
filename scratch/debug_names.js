import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: accounts } = await supabase.from('acmac1').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const { data: igm } = await supabase.from('investor_group_members').select('*');
  
  console.log('--- ACCOUNTS ---');
  accounts?.forEach(a => {
    console.log(`Account: id=${a.id}, name="${a.name}", is_group=${a.is_group}, acid=${a.acid}`);
  });

  console.log('\n--- PORTFOLIOS ---');
  portfolios?.forEach(p => {
    console.log(`Portfolio: id=${p.id}, name="${p.portfolioName || p.investor_name}", accountId=${p.accountId}`);
  });
  
  console.log('\n--- GROUP MEMBERS ---');
  igm?.forEach(i => {
    console.log(`GroupMember: pfolio_id=${i.pfolio_id}, client_id=${i.client_id}`);
  });
}

run().catch(console.error);
