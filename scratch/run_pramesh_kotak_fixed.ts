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

async function safeFetch(table: string, pkCol = 'id'): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(pkCol)
      .range(page * size, (page + 1) * size - 1);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

import { initDatabase, getStoredPortfolios, getStoredLedgers, getStoredEntries, getStoredVouchers } from '../src/logic.ts';

async function run() {
  console.log("Initializing database check for Pramesh Shah...");
  await initDatabase();
  
  const portfolios = getStoredPortfolios();
  const uniqueAcmac1 = getStoredLedgers(); // this returns deduplicated ledgers
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  
  // Find Pramesh Shah (HUF) or Pramesh Shah
  const prameshAccounts = uniqueAcmac1.filter(a => a.name && a.name.toLowerCase().includes('pramesh') && a.groupId === 'capital_account');
  console.log("Pramesh Accounts found in COA:");
  prameshAccounts.forEach(a => console.log(`  acid=${a.acid} name="${a.name}" id=${a.id}`));

  // Let's analyze Kotak bank ledger for acid=30 (Pramesh Shah (HUF)) and acid=31 (Pramesh Shah)
  const targetAcids = [30, 31];

  for (const acidNum of targetAcids) {
    console.log(`\n=================== ANALYZING ACID ${acidNum} ===================`);
    
    // Ledgers for this acid
    const ledgersForAcid = uniqueAcmac1.filter(a => a.acid === acidNum);
    const kotakLedger = ledgersForAcid.find(l => l.name.toLowerCase().includes('kotak'));
    if (!kotakLedger) {
      console.log(`No Kotak bank ledger for acid ${acidNum}`);
      continue;
    }
    console.log(`Kotak Bank Ledger: ID=${kotakLedger.id} name="${kotakLedger.name}"`);

    // 1. Get portfolio IDs
    const portfolioIds = portfolios.filter(p => Number(p.accountId) === acidNum).map(p => Number(p.id));
    console.log(`Linked Portfolios: ${portfolioIds.join(', ')}`);

    // 2. Calculate balance sheet balance
    const voucherMap: Record<string, any> = {};
    vouchers.forEach(v => voucherMap[v.id] = v);

    let bsDebit = 0, bsCredit = 0;
    const bsMatchedEntries: any[] = [];
    entries.forEach(e => {
      if (e.ledgerId === kotakLedger.id) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        if (entryDate && entryDate <= '2026-03-31') {
          const belongsToAccount = (Number(entryAcid) === acidNum) || (entryPfid && portfolioIds.includes(Number(entryPfid)));
          if (belongsToAccount) {
            bsDebit += e.debit || 0;
            bsCredit += e.credit || 0;
            bsMatchedEntries.push({ e, v });
          }
        }
      }
    });

    console.log(`Balance Sheet (up to 2026-03-31):`);
    console.log(`  DR Sum = ${bsDebit}`);
    console.log(`  CR Sum = ${bsCredit}`);
    console.log(`  Net Balance = ${bsDebit - bsCredit}`);

    // Let's calculate getLedgerWithBalance (FY 2025-04-01 to 2026-03-31)
    // opening balance = entries before 2025-04-01
    let opDebit = 0, opCredit = 0;
    let fyDebit = 0, fyCredit = 0;

    const directEntries = entries.filter(e => e.ledgerId === kotakLedger.id && Number(e.accountId) === acidNum);

    directEntries.forEach(e => {
      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const dr = e.debit || 0;
      const cr = e.credit || 0;

      if (entryDate < '2025-04-01') {
        opDebit += dr;
        opCredit += cr;
      } else if (entryDate <= '2026-03-31') {
        fyDebit += dr;
        fyCredit += cr;
      }
    });

    const opBal = opDebit - opCredit;
    const fyNet = fyDebit - fyCredit;
    console.log(`Ledger Drilldown (FY 25-26):`);
    console.log(`  Opening Balance (before 2025-04-01) = ${opBal} (DR=${opDebit}, CR=${opCredit})`);
    console.log(`  FY Activity: DR=${fyDebit}, CR=${fyCredit}, Net=${fyNet}`);
    console.log(`  Closing Balance (at 2026-03-31) = ${opBal + fyNet}`);

    console.log(`Comparison:`);
    console.log(`  Entries in BS logic: ${bsMatchedEntries.length}`);
    console.log(`  Entries in Drilldown logic: ${directEntries.filter(e => {
      const v = voucherMap[e.voucherId];
      const dt = e.date || v?.date;
      return dt && dt <= '2026-03-31';
    }).length}`);
  }
}

run().catch(console.error);
