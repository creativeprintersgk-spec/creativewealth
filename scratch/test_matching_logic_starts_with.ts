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
  console.log("=== TESTING STRICT LEDGER MATCHING (STARTSWITH) ===");

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
  const ledgers = allAcmac.filter(l => !l.is_group);
  const groups = allAcmac.filter(l => l.is_group);
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  // 3. Fetch active holdings for Saahil Inv (portfolio ID 1)
  let allSumRows: any[] = [];
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('sum_table')
      .select('sid, atty, qnt, currv, amtinv, amid, pfolio_id')
      .order('sid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allSumRows = allSumRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  const activeHoldings = allSumRows.filter((r: any) => 
    r.pfolio_id === 1 && (Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01)
  );

  // 4. Fetch sam names
  const activeAmids = activeHoldings.map((h: any) => h.amid);
  let allSamRows: any[] = [];
  for (let i = 0; i < activeAmids.length; i += 100) {
    const chunk = activeAmids.slice(i, i + 100);
    const { data } = await supabase.from('sam').select('amid, anm, atyp').in('amid', chunk);
    if (data) allSamRows = allSamRows.concat(data);
  }
  const samMap = new Map(allSamRows.map((r: any) => [r.amid, r]));

  // Test match rate
  let matchedCount = 0;
  let unmatchedCount = 0;

  activeHoldings.forEach((h: any) => {
    const sam = samMap.get(h.amid);
    const assetName = sam ? sam.anm : `Asset ${h.amid}`;
    const acid = pfToAcid.get(h.pfolio_id);

    // Strict startsWith matching
    const cleanAssetName = assetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
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

    if (matchedLedger) {
      matchedCount++;
      const grp = groupMap.get(matchedLedger.parent_id);
      console.log(`✅ MATCHED: "${assetName}" (atty=${h.atty}) -> ledger="${matchedLedger.name}" group="${grp}" (parent_id=${matchedLedger.parent_id})`);
    } else {
      unmatchedCount++;
      console.log(`❌ UNMATCHED: "${assetName}" (atty=${h.atty}) acid=${acid}`);
    }
  });

  console.log(`\nMatch results for Saahil Inv: Matched = ${matchedCount}, Unmatched = ${unmatchedCount}`);
}
run();
