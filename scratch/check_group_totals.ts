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

async function run() {
  console.log("=== CHECK GROUP 18 (Eq Group) TOTALS IN SUM_TABLE ===");

  const memberIds = [64, 40, 4, 35, 1, 67, 2];

  // 1. Fetch acc_pflink
  const { data: pfLinks } = await supabase.from('acc_pflink').select('pfid, acid');
  const pfToAcid = new Map(pfLinks?.map(l => [l.pfid, l.acid]));

  // 2. Fetch all acmac1
  let allAcmac: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('acmac1')
      .select('id, name, parent_id, is_group, acid')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allAcmac = allAcmac.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  const groupMap = new Map(allAcmac.filter(g => g.is_group).map(g => [g.id, g.name]));
  const ledgers = allAcmac.filter(l => !l.is_group);

  // 3. Fetch active holdings for all member portfolios
  let allSumRows: any[] = [];
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('sum_table')
      .select('*')
      .in('pfolio_id', memberIds)
      .order('sid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allSumRows = allSumRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const activeHoldings = allSumRows.filter((r: any) => 
    Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01 || Number(r.amtinv) > 0.01
  );

  // 4. Fetch sam names
  const activeAmids = Array.from(new Set(activeHoldings.map((h: any) => h.amid)));
  let allSamRows: any[] = [];
  for (let i = 0; i < activeAmids.length; i += 100) {
    const chunk = activeAmids.slice(i, i + 100);
    const { data } = await supabase.from('sam').select('amid, anm').in('amid', chunk);
    if (data) allSamRows = allSamRows.concat(data);
  }
  const samMap = new Map(allSamRows.map((r: any) => [r.amid, r.anm]));

  // Dynamic Grouping Map
  const groupAttyMap: Record<number, number> = {
    200050: 50, 200051: 50, 200061: 60, 200062: 61, 200058: 200,
    200141: 70, 200140: 80, 200066: 190, 200095: 90, 200040: 100,
    200070: 110, 200115: 120, 200120: 130, 200135: 140, 200075: 150,
    200077: 151, 200155: 170, 200150: 160, 200145: 180, 200160: 210,
    200195: 220
  };

  const results: any[] = [];
  activeHoldings.forEach((h: any) => {
    const assetName = samMap.get(h.amid) || `Asset ${h.amid}`;
    const acid = pfToAcid.get(h.pfolio_id);
    const cleanAssetName = assetName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Strict startsWith matching
    let matchedLedger = ledgers.find(l => {
      if (l.acid !== acid) return false;
      const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
    });

    if (!matchedLedger) {
      matchedLedger = ledgers.find(l => {
        const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
      });
    }

    let resolvedAtty = h.atty || 0;
    let grpName = 'Default Fallback';
    if (matchedLedger && matchedLedger.parent_id) {
      const parentId = Number(matchedLedger.parent_id);
      grpName = groupMap.get(parentId) || `Group ${parentId}`;
      if (groupAttyMap[parentId] !== undefined) {
        resolvedAtty = groupAttyMap[parentId];
      }
    }

    results.push({
      ...h,
      assetName,
      resolvedAtty,
      grpName
    });
  });

  // Aggregate by resolvedAtty
  const typeTotals: Record<number, { name: string, invested: number, currv: number, count: number }> = {};
  const ASSET_TYPE_MAP: Record<number, string> = {
    50: 'Stocks',
    60: 'Mutual Funds (Equity)',
    61: 'Mutual Funds (Debt)',
    70: 'NPS / ULiP',
    80: 'Insurance',
    90: 'Fixed Deposits',
    100: 'Traded Bonds',
    110: 'NCD / Debentures',
    120: 'Deposits / Loans',
    130: 'PPF / EPF',
    150: 'Gold',
    190: 'Private Equity',
    200: 'Special Inv. Funds',
    210: 'AIF',
    220: 'Loans'
  };

  results.forEach(r => {
    const t = r.resolvedAtty;
    if (!typeTotals[t]) {
      typeTotals[t] = {
        name: ASSET_TYPE_MAP[t] || `Type ${t}`,
        invested: 0,
        currv: 0,
        count: 0
      };
    }
    typeTotals[t].invested += Number(r.amtinv) || 0;
    typeTotals[t].currv += Number(r.currv) || 0;
    typeTotals[t].count++;
  });

  console.log("\nEq Group(G) Category Totals with startsWith matching:");
  let totalInvested = 0;
  let totalCurrv = 0;
  Object.entries(typeTotals).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([t, s]) => {
    console.log(`  Category ${t} (${s.name}): active_holdings=${s.count} invested=${s.invested.toLocaleString('en-IN', {minimumFractionDigits: 2})} currv=${s.currv.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
    totalInvested += s.invested;
    totalCurrv += s.currv;
  });

  console.log(`\nOverall Group Net Worth:`);
  console.log(`  Invested: ${totalInvested.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
  console.log(`  Current Value: ${totalCurrv.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
}
run();
