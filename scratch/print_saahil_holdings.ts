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
  console.log("=== SAAHIL INV HOLDINGS IN SUM_TABLE ===");

  // Load portfolios
  const { data: portfolios } = await supabase.from('portfolios').select('id, investor_name, full_name');
  const saahilPort = portfolios?.find(p => p.investor_name === 'Saahil Inv' || p.id === 1);
  console.log("Saahil Portfolio:", saahilPort);

  if (!saahilPort) return;
  const pfolio_id = saahilPort.id;

  // Load all acmac1 to get names and parent groups
  let allAcmac: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('acmac1')
      .select('id, name, parent_id, is_group, acid, db_bal, cr_bal')
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

  // Load acc_pflink
  const { data: pfLinks } = await supabase.from('acc_pflink').select('pfid, acid');
  const pfToAcid = new Map(pfLinks?.map(l => [l.pfid, l.acid]));
  const acid = pfToAcid.get(pfolio_id);
  console.log("Saahil Portfolio Account ID (acid):", acid);

  // Load sum_table for Saahil Portfolio
  const { data: sumRows, error } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', pfolio_id);
  
  if (error) {
    console.error("Error fetching sum_table:", error);
    return;
  }

  // Fetch all active amids from sam
  const activeAmids = sumRows.map(r => r.amid);
  let allSamRows: any[] = [];
  for (let i = 0; i < activeAmids.length; i += 100) {
    const chunk = activeAmids.slice(i, i + 100);
    const { data } = await supabase.from('sam').select('amid, anm, atyp').in('amid', chunk);
    if (data) allSamRows = allSamRows.concat(data);
  }
  const samMap = new Map(allSamRows.map((r: any) => [r.amid, r]));

  console.log(`\nTotal rows in sum_table for Saahil Inv: ${sumRows.length}`);
  
  // Dynamic Grouping Map
  const groupAttyMap: Record<number, number> = {
    200050: 50, 200051: 50, 200061: 60, 200062: 61, 200058: 200,
    200141: 70, 200140: 80, 200066: 190, 200095: 90, 200040: 100,
    200070: 110, 200115: 120, 200120: 130, 200135: 140, 200075: 150,
    200077: 151, 200155: 170, 200150: 160, 200145: 180, 200160: 210,
    200195: 220
  };

  const results: any[] = [];

  sumRows.forEach((s: any) => {
    const qty = Number(s.qnt) || 0;
    const currv = Number(s.currv) || 0;
    const amtinv = Number(s.amtinv) || 0;
    const active = qty > 0.0001 || currv > 0.01 || amtinv > 0.01;
    if (!active) return;

    const sam = samMap.get(s.amid);
    const assetName = sam ? sam.anm : `Asset ${s.amid}`;
    const cleanAssetName = assetName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Resolve atty
    let resolvedAtty = s.atty;
    let matchedLedger = null;
    let matchedLedgers = ledgers.filter((l: any) => {
      if (acid && l.acid !== acid) return false;
      const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
    });

    if (matchedLedgers.length === 0) {
      matchedLedgers = ledgers.filter((l: any) => {
        const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
      });
    }

    if (matchedLedgers.length === 1) {
      matchedLedger = matchedLedgers[0];
    } else if (matchedLedgers.length > 1) {
      matchedLedger = matchedLedgers.find((l: any) => {
        const bal = (Number(l.db_bal) || 0) - (Number(l.cr_bal) || 0);
        return Math.abs(bal) > 0.01;
      }) || matchedLedgers[0];
    }

    let parentGroupName = 'Unknown Group';
    if (matchedLedger && matchedLedger.parent_id) {
      const parentId = Number(matchedLedger.parent_id);
      parentGroupName = groupMap.get(parentId) || `Group ${parentId}`;
      if (groupAttyMap[parentId] !== undefined) {
        resolvedAtty = groupAttyMap[parentId];
      }
    }

    results.push({
      amid: s.amid,
      name: assetName,
      qty,
      amtinv,
      currv,
      rawAtty: s.atty,
      resolvedAtty,
      ledgerName: matchedLedger?.name || 'N/A',
      parentGroup: parentGroupName
    });
  });

  // Print grouped results
  const categories: Record<number, any[]> = {};
  results.forEach(r => {
    if (!categories[r.resolvedAtty]) categories[r.resolvedAtty] = [];
    categories[r.resolvedAtty].push(r);
  });

  console.log("\nGrouped Active Holdings for Saahil Inv:");
  Object.keys(categories).map(Number).sort((a,b)=>a-b).forEach(cat => {
    const items = categories[cat];
    const invested = items.reduce((sum, i) => sum + i.amtinv, 0);
    const current = items.reduce((sum, i) => sum + i.currv, 0);
    console.log(`\nCategory ${cat} (Invested: ${invested.toFixed(2)}, Current Value: ${current.toFixed(2)}):`);
    items.forEach(i => {
      console.log(`  - name="${i.name}" qty=${i.qty} amtinv=${i.amtinv} currv=${i.currv} resolvedAtty=${i.resolvedAtty} parentGroup="${i.parentGroup}"`);
    });
  });
}

run();
