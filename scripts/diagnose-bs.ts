import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';

const supabase = createClient(url, key);

async function diagnose() {
  console.log('Querying Supabase directly...');

  // 1. Get Accounts (portfolios with pfolio_type=10)
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const accounts = (portfolios || []).filter(p => p.pfolio_type === 10);
  console.log('Accounts:', accounts.map(a => ({ id: a.id, name: a.investor_name })));

  const unnatiAcc = accounts.find(a => a.investor_name.toLowerCase().includes('unnati')) || accounts[0];
  console.log('\n--- Unnati Account ---', unnatiAcc);
  const acid = unnatiAcc.id;

  // 2. Query acmac1 for this acid
  const { data: acmac1 } = await supabase.from('acmac1').select('*').eq('acid', acid);
  console.log(`acmac1 records for acid ${acid}:`, acmac1?.length);

  // Check for 'Unassigned Broker' or Sundry Creditors
  const sundryCreditorsGroup = acmac1?.find(a => a.name.toLowerCase().includes('sundry creditor') || a.id === 75 || a.parent_id === 75);
  console.log('Sundry Creditors group / ledgers:');
  acmac1?.filter(a => a.parent_id === 75 || a.id === 75 || a.name.toLowerCase().includes('broker') || a.name.toLowerCase().includes('unassigned')).forEach(a => {
    console.log(`  id: ${a.id}, name: "${a.name}", is_group: ${a.is_group}, parent_id: ${a.parent_id}, db_bal: ${a.db_bal}, cr_bal: ${a.cr_bal}`);
  });

  // 3. Query vouchersc1 & vouchers1
  const { data: vouchersc1 } = await supabase.from('vouchersc1').select('*').eq('acid', acid);
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*').eq('acid', acid);
  const allVids = [...(vouchersc1 || []).map(v => v.vid), ...(vouchers1 || []).map(v => v.vid)];

  // 4. Query transc1 & trans1
  const { data: transc1 } = await supabase.from('transc1').select('*').eq('acid', acid);
  const { data: trans1 } = await supabase.from('trans1').select('*').eq('acid', acid);
  const allTrans = [...(transc1 || []), ...(trans1 || [])];
  console.log(`Total transactions for acid ${acid}: transc1=${transc1?.length}, trans1=${trans1?.length}`);

  // Find transactions for "Unassigned Broker" or any maid with balance ~ -9631
  const balanceByMaid: Record<number, { dr: number; cr: number; net: number }> = {};
  allTrans.forEach(t => {
    const maid = Number(t.maid);
    if (!balanceByMaid[maid]) balanceByMaid[maid] = { dr: 0, cr: 0, net: 0 };
    balanceByMaid[maid].dr += Number(t.dramt) || 0;
    balanceByMaid[maid].cr += Number(t.cramt) || 0;
    balanceByMaid[maid].net = balanceByMaid[maid].dr - balanceByMaid[maid].cr;
  });

  console.log('\n--- Ledgers with Net Transactions for Unnati: ---');
  Object.entries(balanceByMaid).forEach(([maidStr, b]) => {
    const maid = Number(maidStr);
    const ledger = acmac1?.find(a => a.id === maid);
    const opDb = Number(ledger?.db_bal) || 0;
    const opCr = Number(ledger?.cr_bal) || 0;
    const totalNet = (b.dr + opDb) - (b.cr + opCr);
    console.log(`Maid ${maid} ("${ledger?.name || 'UNKNOWN'}"): Tx Dr=${b.dr}, Cr=${b.cr}, NetTx=${b.net} | OpDb=${opDb}, OpCr=${opCr} | TotalNet=${totalNet}`);
  });

  // Check total DR and total CR across all ledgers
  let totalDr = 0, totalCr = 0;
  allTrans.forEach(t => {
    totalDr += Number(t.dramt) || 0;
    totalCr += Number(t.cramt) || 0;
  });
  console.log(`\nOverall Tx Sum: Dr=${totalDr.toFixed(2)}, Cr=${totalCr.toFixed(2)}, Diff=${(totalDr - totalCr).toFixed(2)}`);

  // Check opening balance totals
  let opDr = 0, opCr = 0;
  acmac1?.filter(a => !a.is_group).forEach(a => {
    if (a.name === 'Difference in Opening Balances') return;
    opDr += Number(a.db_bal) || 0;
    opCr += Number(a.cr_bal) || 0;
  });
  console.log(`Overall OpBal Sum: Dr=${opDr.toFixed(2)}, Cr=${opCr.toFixed(2)}, Diff=${(opDr - opCr).toFixed(2)}`);

  // Check all P&L entries / groups
  console.log('\n--- P&L / Income / Expense groups & ledgers: ---');
  acmac1?.filter(a => [280, 290].includes(a.special_type_id) || [180, 190, 460, 465, 470, 475, 480, 485, 490].includes(a.id) || a.parent_id === 180).forEach(a => {
    console.log(`  id: ${a.id}, name: "${a.name}", is_group: ${a.is_group}, parent_id: ${a.parent_id}, special_type_id: ${a.special_type_id}`);
  });
}

diagnose();
