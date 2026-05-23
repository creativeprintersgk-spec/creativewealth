import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const { data: accounts } = await supabase.from('accounts').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');

  console.log('--- ACCOUNTS ---');
  accounts?.forEach(a => {
    console.log(`Account ID: ${a.id}, Name: ${a.account_name}, Family ID: ${a.family_id}`);
  });

  console.log('\n--- PORTFOLIOS ---');
  portfolios?.forEach(p => {
    console.log(`Portfolio ID: ${p.id}, Name: ${p.portfolio_name}, Account ID: ${p.account_id}`);
  });
}

check().catch(console.error);
