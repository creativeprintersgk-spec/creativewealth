import { loadState, getLedgerWithBalance, getStoredLedgers } from '../src/logic';
import { getBalanceSheet } from '../src/services/balanceSheet';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("Loading state...");
  await loadState(supabase);
  console.log("State loaded. Calculating Balance Sheet for acid=31...");
  
  const bs = await getBalanceSheet("2024-04-01", "2025-03-31", "31");
  console.log(`BS Total Assets: ${bs.totalAssets}, Total Liab: ${bs.totalLiabilities}`);
  
  let bsNTPC = 0;
  bs.assets.forEach((g: any) => {
    g.ledgers.forEach((l: any) => {
      if (l.name.includes("NTPC")) bsNTPC = l.balance;
    });
  });
  console.log(`BS Balance for NTPC: ${bsNTPC}`);
  
  const ledgers = getStoredLedgers("31");
  const ntpc = ledgers.find((l: any) => l.name.includes("NTPC"));
  if (ntpc) {
    const lBal = getLedgerWithBalance(ntpc.id, "2024-04-01", "2025-03-31", "31");
    console.log(`Logic.ts Ledger Balance for NTPC (id ${ntpc.id}): OB=${lBal.openingBalance}, CB=${lBal.closingBalance}`);
  }
}
run();
