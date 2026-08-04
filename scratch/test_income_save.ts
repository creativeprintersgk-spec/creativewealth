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

async function safeFetch(table: string, max = 50000): Promise<any[]> {
  try {
    let all: any[] = [];
    const pkMap: Record<string, string> = {
      bs1: 'trid',
      transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
      acmac1: 'id', sam: 'amid', asset_master: 'amid',
      sum_table: 'sid', mprices: 'amid'
    };
    let page = 0;
    const size = 1000;
    while (all.length < max) {
      const { data, error } = await supabase
        .from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
      if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      page++;
    }
    return all;
  } catch (e) {
    console.warn(`⚠️ ${table}:`, e);
    return [];
  }
}

async function run() {
  console.log("Fetching tables...");
  const [portfoliosRaw, accPflink, acmac1] = await Promise.all([
    safeFetch('portfolios'),
    safeFetch('acc_pflink'),
    safeFetch('acmac1')
  ]);

  const portfolioIds = ["2"];
  const assetId = "101856";

  const portfolios = portfoliosRaw
    .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
    .map(p => {
      const link = accPflink.find((l: any) => l.pfid === p.id);
      const accountId = link ? String(link.acid) : null;
      return {
        ...p,
        id: String(p.id),
        portfolioName: p.investor_name || p.full_name || `Portfolio ${p.id}`,
        accountId,
      };
    });

  const port = portfolios.find(p => p.id === portfolioIds[0]);
  console.log("Selected portfolio:", port);

  const accountId = port ? port.accountId : undefined;
  console.log("Resolved accountId:", accountId);

  const parsed = accountId && accountId !== 'undefined' ? Number(accountId) : null;
  const acidNum = parsed && !isNaN(parsed) ? parsed : null;
  console.log("Resolved acidNum:", acidNum);

  // Deduplicate acmac1
  const uniqueAcmac1: any[] = [];
  const seenAcmac = new Set();
  for (const a of acmac1) {
    if (a.name === 'Difference in Opening Balances') continue;
    const key = `${a.id}_${a.acid}_${a.is_group}`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      uniqueAcmac1.push(a);
    }
  }

  const ledgers = uniqueAcmac1
    .filter((a: any) => !a.is_group && (!acidNum || a.acid === acidNum))
    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      amid: a.id >= 100000 ? a.id : undefined,
      acid: a.acid
    }));
  
  console.log(`Resolved ledgers count:`, ledgers.length);

  const groups = uniqueAcmac1
    .filter((a: any) => a.is_group && (!acidNum || a.acid === acidNum))
    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      parent: a.parent_id ? String(a.parent_id) : undefined,
      specialTypeId: a.special_type_id
    }));

  console.log(`Resolved groups count:`, groups.length);

  let bankLedgerId = ""; // user choice
  let finalBankId = bankLedgerId;
  if (!finalBankId) {
    const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank'));
    console.log("Found bankLedger by name:", bankLedger);
    finalBankId = bankLedger?.id ?? "";
  }

  let tdsLedger = ledgers.find(l => l.name.toLowerCase() === 'tds') || 
                  ledgers.find(l => l.name.toLowerCase().includes('tds'));
  console.log("Found tdsLedger by name:", tdsLedger);
  const finalTdsId = tdsLedger?.id ?? "";

  const divIncomeLedger = ledgers.find(l => l.name.toLowerCase().includes('dividend')) || 
                         ledgers.find(l => {
                           const g = groups.find(g => String(g.id) === String(l.groupId));
                           return g && (g.name.toLowerCase().includes('dividend') || g.name.toLowerCase().includes('income'));
                         }) ||
                         ledgers[0];
  console.log("Found divIncomeLedger by name:", divIncomeLedger);

  // Let's print bank accounts found in ledgers
  const bankAccounts = ledgers.filter((l: any) => {
    const g = groups.find((g: any) => String(g.id) === String(l.groupId));
    if (!g) return false;
    const gIdStr = String(g.id);
    const gNameLower = (g.name || '').toLowerCase();
    return (
      gIdStr === '60' ||
      gIdStr === 'bank' ||
      gIdStr === 'cash' ||
      gNameLower.includes('bank') ||
      gNameLower.includes('cash')
    );
  });
  console.log("Bank/Cash accounts in ledgers filter:", bankAccounts);
}

run().catch(console.error);
