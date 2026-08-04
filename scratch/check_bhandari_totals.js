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
  const saahilAcid = 31;
  const saahilPfids = [1, 13, 11, 12, 38];
  const bhandariAmid = 101556;
  const bhandariLedgerId = 500589; // Saahil's Bhandari ledger

  console.log(`Checking Bhandari Hosiery Exports totals for Saahil Shah (acid = ${saahilAcid}, pfids = ${saahilPfids.join(',')})...\n`);

  // 1. CALCULATE AS PER BALANCE SHEET (double entry transactions)
  const { data: trans1 } = await supabase.from('trans1').select('*').eq('maid', bhandariLedgerId);
  const { data: transc1 } = await supabase.from('transc1').select('*').eq('maid', bhandariLedgerId);

  const allBsEntries = [
    ...(trans1 || []).map(e => ({ ...e, table: 'trans1' })),
    ...(transc1 || []).map(e => ({ ...e, table: 'transc1' }))
  ].filter(e => e.acid === saahilAcid);

  let bsDrAmt = 0;
  let bsCrAmt = 0;
  allBsEntries.forEach(e => {
    bsDrAmt += Number(e.dramt) || 0;
    bsCrAmt += Number(e.cramt) || 0;
  });

  const bsNetAmt = bsDrAmt - bsCrAmt;

  console.log('--- 1. Balance Sheet Ledger (Acmac1 ID 500589) ---');
  console.log(`Total Debit Amount:  ${bsDrAmt.toFixed(2)}`);
  console.log(`Total Credit Amount: ${bsCrAmt.toFixed(2)}`);
  console.log(`Net Ledger Amount (Value):  ${bsNetAmt.toFixed(2)}`);

  // 2. CALCULATE AS PER PMS (Portfolio Transactions in bs1)
  const { data: bs1 } = await supabase.from('bs1').select('*').eq('amid', bhandariAmid).in('pfid', saahilPfids);

  let pmsQty = 0;
  let pmsAmt = 0;

  console.log('\n--- 2. PMS Portfolio Transactions (bs1) details ---');
  (bs1 || []).forEach(tx => {
    const qty = Number(tx.qn) || 0;
    const amt = Number(tx.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(tx.trty);
    
    if (isBuy) {
      pmsQty += qty;
      pmsAmt += amt;
      console.log(`  [Buy]  Date: ${tx.dt}, Qty: ${qty}, Price: ${tx.purpr}, Amt: ${amt.toFixed(2)}, pfid: ${tx.pfid}, trid: ${tx.trid}`);
    } else {
      pmsQty -= qty;
      pmsAmt -= amt;
      console.log(`  [Sell] Date: ${tx.dt}, Qty: ${qty}, Price: ${tx.purpr}, Amt: ${amt.toFixed(2)}, pfid: ${tx.pfid}, trid: ${tx.trid}`);
    }
  });

  console.log(`\nPMS Net Quantity (calculated): ${pmsQty}`);
  console.log(`PMS Net Invested Cost (calculated): ${pmsAmt.toFixed(2)}`);

  // 3. CHECK HOLDINGS SUMMARY (sum_table)
  const { data: sumTable } = await supabase.from('sum_table').select('*').eq('amid', bhandariAmid).in('pfolio_id', saahilPfids);
  console.log('\n--- 3. PMS Holdings Summary (sum_table) ---');
  (sumTable || []).forEach(row => {
    console.log(`  Portfolio ID: ${row.pfolio_id}, Qty (qnt): ${row.qnt}, Invested Cost (amtinv): ${row.amtinv}, Current Value (currv): ${row.currv}`);
  });
}

run().catch(console.error);
