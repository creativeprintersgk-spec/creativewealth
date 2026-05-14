import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function inspect() {
  const { data: vouchers } = await supabase.from('vouchers').select('*');
  const { data: entries } = await supabase.from('entries').select('*');
  const { data: ledgers } = await supabase.from('ledgers').select('id, name, group_id');

  // Group vouchers by portfolio_id
  const byPortfolio: Record<string, any[]> = {};
  vouchers?.forEach(v => {
    const key = v.portfolio_id || '(none)';
    if (!byPortfolio[key]) byPortfolio[key] = [];
    byPortfolio[key].push(v);
  });

  console.log('\n📊 VOUCHERS BY PORTFOLIO:');
  for (const [pid, pvouchers] of Object.entries(byPortfolio)) {
    console.log(`   portfolio_id=${pid}: ${pvouchers.length} vouchers`);
  }

  // Check if entries for prs EQ portfolio (79dvmya60) exist via account_id
  const prsAccountId = 'zxq2mh8m0';
  const prsPortId = '79dvmya60';
  const prsVouchers = vouchers?.filter(v => v.account_id === prsAccountId || v.portfolio_id === prsPortId) || [];
  console.log(`\n🔍 Vouchers for prs account (${prsAccountId}) or prs EQ portfolio (${prsPortId}): ${prsVouchers.length}`);

  // Show investment ledgers with their IDs
  const investGroups = ['stocks','mf_equity','mf_debt','fds','aif','pms_aif','private_equity',
    'special_inv_funds','ppf_epf','nps_uup','insurance_asset','gold','silver','property',
    'jewellery','art','traded_bonds','ncd_debentures','deposits_loans','post_office','loans_asset'];
  const invLedgers = ledgers?.filter(l => investGroups.includes(l.group_id)) || [];
  console.log(`\n💼 ALL INVESTMENT LEDGERS (${invLedgers.length}):`);
  invLedgers.forEach(l => console.log(`   id=${l.id}  group=${l.group_id}  name=${l.name?.slice(0,50)}`));

  // Check entries for each investment ledger
  const invLedgerIds = new Set(invLedgers.map(l => l.id));
  const invEntries = entries?.filter(e => invLedgerIds.has(e.ledger_id)) || [];
  console.log(`\n📝 Investment entries (${invEntries.length}) - checking voucher links:`);
  invEntries.slice(0, 5).forEach(e => {
    const v = vouchers?.find(v => v.id === e.voucher_id);
    console.log(`   entry=${e.id.slice(0,8)} ledger=${e.ledger_id} debit=${e.debit} qty=${e.quantity} -> voucher portfolio_id=${v?.portfolio_id} account_id=${v?.account_id}`);
  });
}

inspect();
