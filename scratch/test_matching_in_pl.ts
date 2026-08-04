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
  console.log("=== SIMULATING PROFIT & LOSS MATCHING ===");

  const portfolios = await safeFetch('portfolios');
  const pflinks = await safeFetch('acc_pflink', 'pfid');
  const acmac = await safeFetch('acmac1', 'id');
  const vouchersC1 = await safeFetch('vouchersc1', 'vid');
  const vouchers1 = await safeFetch('vouchers1', 'vid');
  const transC1 = await safeFetch('transc1', 'transid');
  const trans1 = await safeFetch('trans1', 'transid');

  const allVouchers = [...vouchersC1, ...vouchers1];
  const allEntries = [...transC1, ...trans1];

  const accountId = "29"; // Unnati Shah
  const startDate = "2025-04-01";
  const endDate = "2026-03-31";

  // MOCK LOGIC LAYER GETTERS
  const getStoredPortfolios = () => {
    return portfolios
      .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
      .map(p => {
        const link = pflinks.find((l: any) => l.pfid === p.id);
        const accountId = link ? String(link.acid) : null;
        return {
          id: String(p.id),
          portfolioName: p.investor_name || p.full_name || `Portfolio ${p.id}`,
          accountId
        };
      });
  };

  const getStoredLedgers = (acid: string) => {
    const acidNum = Number(acid);
    const unique = acmac.filter((a: any, index: number, self: any[]) => 
      !a.is_group && a.acid === acidNum && self.findIndex((t: any) => t.id === a.id && !t.is_group) === index
    );
    return unique.map((a: any) => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      acid: a.acid
    }));
  };

  const getStoredVouchers = () => {
    return allVouchers.map((v: any) => ({
      id: String(v.vid),
      date: v.dt || '',
      type: String(v.vtyp || 'journal'),
      narration: v.narr || '',
      portfolioId: v.pfid ? String(v.pfid) : undefined,
      accountId: v.acid ? String(v.acid) : undefined,
    }));
  };

  const getStoredEntries = () => {
    return allEntries.map((e: any) => ({
      id: String(e.transid),
      voucherId: String(e.vid),
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      date: e.dt || '',
      accountId: e.acid ? String(e.acid) : undefined,
    }));
  };

  // EXECUTE CALCULATIONS LIKE IN profitLoss.ts
  const ledgers = getStoredLedgers(accountId);
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();

  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => (voucherMap[v.id] = v));

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id);

  console.log("Unnati Shah portfolioIds:", portfolioIds);
  console.log(`Total ledgers: ${ledgers.length}, Total entries: ${entries.length}`);

  let debugCount = 0;

  ledgers.forEach((l: any) => {
    entries.forEach((e: any) => {
      if (e.ledgerId === l.id) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        // Print details for a few matches to see why they might fail
        if (debugCount < 10) {
          console.log(`\nMatch found for ledger id ${l.id} ("${l.name}"):`);
          console.log(`  Entry Date: "${entryDate}" (Check: ${entryDate >= startDate && entryDate <= endDate})`);
          console.log(`  Entry Acid: "${entryAcid}" vs AccountId: "${accountId}"`);
          console.log(`  Entry Pfid: "${entryPfid}" vs PortfolioIds:`, portfolioIds);
          
          const belongsToAccount =
            (entryAcid === accountId) ||
            (entryPfid && portfolioIds?.includes(entryPfid));
          console.log(`  belongsToAccount: ${belongsToAccount}`);
          debugCount++;
        }
      }
    });
  });
}

run();
