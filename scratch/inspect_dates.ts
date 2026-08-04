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

async function run() {
  console.log("=== RUNNING FULL PAGINATED DB INSPECTION ===");

  // 1. Fetch portfolios to map account links
  const portfolios = await safeFetch('portfolios');
  const accounts = portfolios.filter(p => p.pfolio_type === 10);
  console.log("Accounts found:", accounts.map(a => `${a.id}: ${a.investor_name}`));

  const pflinks = await safeFetch('acc_pflink', 'pfid');
  const pfToAcid = new Map();
  pflinks.forEach((l: any) => pfToAcid.set(l.pfid, l.acid));

  // 2. Fetch all vouchers
  console.log("Fetching vouchersc1...");
  const vouchersC1 = await safeFetch('vouchersc1', 'vid');
  console.log("Fetching vouchers1...");
  const vouchers1 = await safeFetch('vouchers1', 'vid');
  const allVouchers = [...vouchersC1, ...vouchers1];
  console.log(`Total vouchers: ${allVouchers.length} (C1: ${vouchersC1.length}, 1: ${vouchers1.length})`);

  // 3. Fetch all entries
  console.log("Fetching transc1...");
  const transC1 = await safeFetch('transc1', 'transid');
  console.log("Fetching trans1...");
  const trans1 = await safeFetch('trans1', 'transid');
  const allEntries = [...transC1, ...trans1];
  console.log(`Total entries: ${allEntries.length} (C1: ${transC1.length}, 1: ${trans1.length})`);

  // Count by account in the period 2025-04-01 to 2026-03-31
  const start = "2025-04-01";
  const end = "2026-03-31";

  // Map vouchers for easy access
  const voucherMap = new Map<number, any>();
  allVouchers.forEach(v => voucherMap.set(v.vid, v));

  console.log("\n=== ENTRIES IN PERIOD 2025-04-01 to 2026-03-31 ===");
  const entriesInPeriod = allEntries.filter((e: any) => {
    const v = voucherMap.get(e.vid);
    const date = e.dt || v?.dt;
    return date && date >= start && date <= end;
  });

  const countByAcc: Record<string, number> = {};
  entriesInPeriod.forEach((e: any) => {
    const v = voucherMap.get(e.vid);
    let resolvedAcid = e.acid || v?.acid;
    if (!resolvedAcid && v?.pfid) {
      resolvedAcid = pfToAcid.get(v.pfid);
    }
    if (resolvedAcid) {
      countByAcc[resolvedAcid] = (countByAcc[resolvedAcid] || 0) + 1;
    }
  });

  console.log("Entries in period grouped by resolved Account ID:");
  for (const [acid, count] of Object.entries(countByAcc)) {
    const acc = accounts.find(a => String(a.id) === acid);
    console.log(`  Account ${acid} ("${acc?.investor_name}"): ${count} entries`);
  }

  // Let's print some entries in period for Unnati Shah (acid = 29)
  const unnatiEntries = entriesInPeriod.filter((e: any) => {
    const v = voucherMap.get(e.vid);
    let resolvedAcid = e.acid || v?.acid;
    if (!resolvedAcid && v?.pfid) {
      resolvedAcid = pfToAcid.get(v.pfid);
    }
    return String(resolvedAcid) === "29";
  });
  console.log(`\nUnnati Shah entries in period (total ${unnatiEntries.length}):`);
  console.log(unnatiEntries.slice(0, 5).map((e: any) => {
    const v = voucherMap.get(e.vid);
    return {
      transid: e.transid,
      vid: e.vid,
      date: e.dt || v?.dt,
      maid: e.maid,
      dramt: e.dramt,
      cramt: e.cramt
    };
  }));
}
run();
