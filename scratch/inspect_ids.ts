import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function inspect() {
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const { data: accounts } = await supabase.from('accounts').select('*');
  const { data: families } = await supabase.from('families').select('*');
  const { data: vouchers } = await supabase.from('vouchers').select('id, portfolio_id, account_id, date').limit(10);
  const { data: ledgers } = await supabase.from('ledgers').select('id, name, group_id').limit(10);

  console.log('\n👪 FAMILIES:');
  families?.forEach(f => console.log(`   id=${f.id}  name=${f.name}`));

  console.log('\n👤 ACCOUNTS:');
  accounts?.forEach(a => console.log(`   id=${a.id}  family_id=${a.family_id}  name=${a.account_name}`));

  console.log('\n💼 PORTFOLIOS:');
  portfolios?.forEach(p => console.log(`   id=${p.id}  account_id=${p.account_id}  name=${p.portfolio_name}`));

  console.log('\n📄 SAMPLE VOUCHERS (first 5):');
  vouchers?.slice(0,5).forEach(v => console.log(`   id=${v.id}  portfolio_id=${v.portfolio_id}  account_id=${v.account_id}  date=${v.date}`));

  // Cross-check
  const portIds = new Set(portfolios?.map(p => p.id) || []);
  const vouchPortIds = new Set(vouchers?.map(v => v.portfolio_id).filter(Boolean) || []);
  const matched = [...vouchPortIds].filter(id => portIds.has(id));
  const unmatched = [...vouchPortIds].filter(id => !portIds.has(id));
  console.log(`\n✅ Voucher portfolio_ids that MATCH portfolios: ${matched.length} (${matched.join(', ')})`);
  console.log(`❌ Voucher portfolio_ids with NO match: ${unmatched.length} (${unmatched.join(', ')})`);

  console.log('\n📋 LEDGER IDs (first 10):');
  ledgers?.forEach(l => console.log(`   id=${l.id}  group=${l.group_id}  name=${l.name?.slice(0,40)}`));
}

inspect();
