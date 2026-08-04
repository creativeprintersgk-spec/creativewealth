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
  console.log("=== SIMULATING CREATE VOUCHER FOR NTPC ===");
  
  // Load necessary state
  const { data: assetMaster } = await supabase.from('asset_master').select('*');
  const { data: sam } = await supabase.from('sam').select('*');
  const { data: acmac1 } = await supabase.from('acmac1').select('*');
  
  const mappedLines = [
    {
      ledgerId: 503134,
      debit: 14075.25,
      credit: 0,
      quantity: 35,
      price: 402.15
    },
    { ledgerId: 650, debit: 14, credit: 0 },
    { ledgerId: 144, debit: 0.01, credit: 0 },
    { ledgerId: 651, debit: 0.08, credit: 0 },
    { ledgerId: 653, debit: 2, credit: 0 },
    { ledgerId: 654, debit: 0.02, credit: 0 },
    { ledgerId: 665, debit: 0.43, credit: 0 }
  ];

  const data = {
    accountId: 0, // as passed when selectedBrokerLedger is ""
    portfolioId: 1,
    date: '2026-06-03',
    narration: 'Daily trades CN (Broker) - Saahil Inv No: CNT-26/27-31957379',
    type: 'journal',
    lines: mappedLines
  };

  const assetLines = (data.lines || []).filter((l: any) => 
    Number(l.ledgerId) >= 100000 || 
    acmac1.some((a: any) => String(a.id) === String(l.ledgerId) && [200050, 200051, 200061, 200062].includes(Number(a.parent_id)))
  );
  
  console.log("Found asset lines count:", assetLines.length);
  console.log("Asset lines details:", assetLines);

  const assetLinesInfo: Array<{ assetLine?: any; amid: number }> = [];
  
  for (const line of assetLines) {
    const ledgerIdNum = Number(line.ledgerId);
    const ledger = acmac1.find((l: any) => l.id === ledgerIdNum);
    let resolvedAmid = ledgerIdNum;
    if (ledger) {
      const cleanLedgerName = ledger.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedAsset = assetMaster.find((a: any) => {
        const cleanAssetName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
      }) || sam.find((s: any) => {
        const cleanAssetName = s.anm.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
      });
      if (matchedAsset) {
        resolvedAmid = matchedAsset.amid;
        console.log(`Matched! resolvedAmid resolved to: ${resolvedAmid} (${matchedAsset.name || matchedAsset.anm})`);
      } else {
        console.log("No match found for ledger name:", ledger.name);
      }
    } else {
      console.log(`Ledger ${ledgerIdNum} not found in acmac1 state!`);
    }
    assetLinesInfo.push({ assetLine: line, amid: resolvedAmid });
  }

  console.log("assetLinesInfo:", assetLinesInfo);

  // Check if bsRows would be created
  const bsRows: any[] = [];
  for (const info of assetLinesInfo) {
    const { assetLine, amid } = info;
    const isBuy = assetLine ? (Number(assetLine.debit) > 0) : true;
    const qty = assetLine ? (Number(assetLine.quantity) || 0) : 0;
    const price = assetLine ? (Number(assetLine.price) || 0) : 0;
    let amt = assetLine ? (Number(assetLine.debit) || Number(assetLine.credit) || 0) : 0;
    
    const asset = assetMaster.find((a: any) => a.amid === amid);
    const atyid = asset ? asset.asset_type : 50;

    let trty = isBuy ? 20 : 101; // Sell trade type is 101 in MProfit
    let trstr = isBuy ? 'Buy' : 'Sell';

    const bsRow = {
      trid: 999999, // dummy
      pfid: 1,
      amid,
      atyid,
      sid: -1,
      cnid: -1,
      trty,
      trstr,
      acvch: 13352,
      dt: data.date,
      qn: qty,
      purpr: price,
      brkg: 0,
      netpr: price,
      amt,
      chrgs: 0,
      narr: data.narration || '',
      extstr: null
    };
    bsRows.push(bsRow);
  }

  console.log("Resulting bsRows:", bsRows);
}

run();
