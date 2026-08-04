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
  console.log("=== COUNTING INCOME/EXPENSE MATCHES FOR UNNATI SHAH ===");

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

  // Get groups to see if they are INCOME or EXPENSE
  const groups = acmac.filter((a: any) => a.is_group && a.acid === 29);
  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => String(g.id) === groupId);
    while (current) {
      if (current.special_type_id === 280 || current.id === 155) return "INCOME";
      if (current.special_type_id === 290 || current.id === 160) return "EXPENSE";
      current = groups.find((g: any) => String(g.id) === String(current.parent_id));
    }
    return "OTHER";
  };

  const ledgers = getStoredLedgers(accountId);
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();

  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => (voucherMap[v.id] = v));

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id);

  console.log("Unnati Shah portfolios:", portfolioIds);

  let matchLedgerCount = 0;
  let inPeriodCount = 0;
  let belongsToAccountCount = 0;
  let fullyMatchingCount = 0;

  ledgers.forEach((l: any) => {
    const type = getGroupType(l.groupId);
    if (type !== 'INCOME' && type !== 'EXPENSE') return; // only income / expense
    
    entries.forEach((e: any) => {
      if (e.ledgerId === l.id) {
        matchLedgerCount++;
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        const isDateOk = entryDate && entryDate >= startDate && entryDate <= endDate;
        if (isDateOk) {
          inPeriodCount++;
        }

        const belongsToAccount =
          (entryAcid === accountId) ||
          (entryPfid && portfolioIds?.includes(entryPfid));
        
        if (belongsToAccount) {
          belongsToAccountCount++;
        }

        if (isDateOk && belongsToAccount) {
          fullyMatchingCount++;
          if (fullyMatchingCount <= 5) {
            console.log(`Fully matching entry sample: transid=${e.id}, date=${entryDate}, ledger=${l.name} (${l.id}, type=${type}), debit=${e.debit}, credit=${e.credit}`);
          }
        }
      }
    });
  });

  console.log(`\nResults:`);
  console.log(`- Entries matching income/expense ledger IDs: ${matchLedgerCount}`);
  console.log(`- Entries in period: ${inPeriodCount}`);
  console.log(`- Entries belonging to Unnati Shah account: ${belongsToAccountCount}`);
  console.log(`- Entries matching BOTH period and account: ${fullyMatchingCount}`);
}

run();
