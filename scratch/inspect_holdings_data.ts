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
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const { data: ledgers } = await supabase.from('ledgers').select('*');

  console.log(`\n📊 SUMMARY`);
  console.log(`  Portfolios: ${portfolios?.length}`);
  console.log(`  Vouchers:   ${vouchers?.length}`);
  console.log(`  Entries:    ${entries?.length}`);
  console.log(`  Ledgers:    ${ledgers?.length}`);

  const withPortId = vouchers?.filter(v => v.portfolio_id) || [];
  const withoutPortId = vouchers?.filter(v => !v.portfolio_id) || [];
  console.log(`\n🔗 VOUCHERS WITH portfolio_id:    ${withPortId.length}`);
  console.log(`   VOUCHERS WITHOUT portfolio_id:  ${withoutPortId.length}`);

  if (withPortId.length > 0) {
    console.log('\n  Sample vouchers WITH portfolio_id:');
    withPortId.slice(0, 3).forEach(v => console.log(`    id=${v.id} portfolio_id=${v.portfolio_id} date=${v.date}`));
  }

  // Check if any entries are for investment ledgers
  const investmentGroups = ['stocks','mf_equity','mf_debt','fds','aif','pms_aif','private_equity',
    'special_inv_funds','ppf_epf','nps_uup','insurance_asset','gold','silver','property',
    'jewellery','art','traded_bonds','ncd_debentures','deposits_loans','post_office','loans_asset'];
  
  const investmentLedgers = ledgers?.filter(l => investmentGroups.includes(l.group_id)) || [];
  console.log(`\n💼 Investment Ledgers: ${investmentLedgers.length}`);
  investmentLedgers.slice(0, 5).forEach(l => console.log(`    ${l.name} (group: ${l.group_id})`));

  const invLedgerIds = new Set(investmentLedgers.map(l => l.id));
  const investmentEntries = entries?.filter(e => invLedgerIds.has(e.ledger_id)) || [];
  console.log(`\n📝 Entries for Investment Ledgers: ${investmentEntries.length}`);
  investmentEntries.slice(0, 3).forEach(e => console.log(`    entry=${e.id} ledger=${e.ledger_id} debit=${e.debit} qty=${e.quantity}`));
}

inspect();
