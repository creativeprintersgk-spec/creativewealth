import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const saahilPfid = 1;
  const bhandariAmid = 101556;
  const atyid = 50; // Stocks

  // 1. Fetch next trid for bs1
  const { data: maxTridRow, error: maxTridErr } = await supabase
    .from('bs1')
    .select('trid')
    .order('trid', { ascending: false })
    .limit(1);
    
  if (maxTridErr) {
    console.error('Error fetching max trid:', maxTridErr);
    return;
  }
  
  let currentTrid = maxTridRow && maxTridRow.length > 0 ? Number(maxTridRow[0].trid) + 1 : 1;

  console.log(`Starting trid for new bs1 entries: ${currentTrid}`);

  const missingEntries = [
    {
      trid: currentTrid++,
      pfid: saahilPfid,
      amid: bhandariAmid,
      atyid,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      acvch: 5008,
      dt: '2025-06-18',
      qn: 250,
      purpr: 5.35,
      brkg: 0,
      netpr: 5.35,
      amt: 1337.50,
      chrgs: 0,
      narr: 'BUY 250 Bhandari Hosiery Exports @ 5.35'
    },
    {
      trid: currentTrid++,
      pfid: saahilPfid,
      amid: bhandariAmid,
      atyid,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      acvch: 5009,
      dt: '2025-06-24',
      qn: 250,
      purpr: 5.38,
      brkg: 0,
      netpr: 5.38,
      amt: 1345.00,
      chrgs: 0,
      narr: 'BUY 250 Bhandari Hosiery Exports @ 5.38'
    },
    {
      trid: currentTrid++,
      pfid: saahilPfid,
      amid: bhandariAmid,
      atyid,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      acvch: 10480,
      dt: '2026-05-28',
      qn: 20000,
      purpr: 1.25,
      brkg: 0,
      netpr: 1.25,
      amt: 25000.00,
      chrgs: 0,
      narr: 'BUY 20000 Bhandari Hosiery Exports @ 1.25'
    },
    {
      trid: currentTrid++,
      pfid: saahilPfid,
      amid: bhandariAmid,
      atyid,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      acvch: 10481,
      dt: '2026-05-28',
      qn: 250,
      purpr: 5.38,
      brkg: 0,
      netpr: 5.38,
      amt: 1345.00,
      chrgs: 0,
      narr: 'BUY 250 Bhandari Hosiery Exports @ 5.38'
    },
    {
      trid: currentTrid++,
      pfid: saahilPfid,
      amid: bhandariAmid,
      atyid,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      acvch: 10482,
      dt: '2026-05-28',
      qn: 250,
      purpr: 5.38,
      brkg: 0,
      netpr: 5.38,
      amt: 1345.00,
      chrgs: 0,
      narr: 'BUY 250 Bhandari Hosiery Exports @ 5.38'
    },
    {
      trid: currentTrid++,
      pfid: saahilPfid,
      amid: bhandariAmid,
      atyid,
      sid: -1,
      cnid: -1,
      trty: 20,
      trstr: 'Buy',
      acvch: 10483,
      dt: '2026-05-29',
      qn: 200000,
      purpr: 0.015,
      brkg: 0,
      netpr: 0.015,
      amt: 3000.00,
      chrgs: 0,
      narr: 'BUY 200000 Bhandari Hosiery Exports @ 1.5'
    }
  ];

  console.log(`Inserting ${missingEntries.length} entries into bs1...`);
  const { data: insData, error: insErr } = await supabase
    .from('bs1')
    .insert(missingEntries)
    .select();

  if (insErr) {
    console.error('Error inserting into bs1:', insErr);
    return;
  }
  console.log(`Inserted successfully: ${insData?.length || 0} rows.`);

  console.log('\n--- Re-calculating sum_table for amid 101556 ---');
  // Fetch all transactions for this portfolio and asset to update sum_table
  const { data: txs, error: txErr } = await supabase
    .from('bs1')
    .select('*')
    .eq('pfid', saahilPfid)
    .eq('amid', bhandariAmid);

  if (txErr) {
    console.error('Error fetching transactions for recalculation:', txErr);
    return;
  }

  let qty = 0;
  let amtInvested = 0;
  let assetType = 50;

  txs?.forEach((t) => {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    assetType = t.atyid || assetType;

    if (isBuy) {
      qty += q;
      amtInvested += amt;
    } else {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      } else {
        amtInvested -= amt;
      }
    }
  });

  if (qty < 0) qty = 0;
  if (amtInvested < 0) amtInvested = 0;

  console.log(`Calculated consolidated holding: Qty = ${qty}, Cost = ${amtInvested.toFixed(2)}`);

  // Fetch current price to update current value
  const { data: priceData } = await supabase
    .from('mprices')
    .select('*')
    .eq('amid', bhandariAmid);
  
  const latestPriceRow = (priceData || []).sort((a, b) => Number(b.row_id) - Number(a.row_id))[0];
  const price = latestPriceRow ? Number(latestPriceRow.currp) || 0 : 0;
  const currv = qty * price;

  console.log(`Latest price: ${price}, Current Value = ${currv}`);

  // Fetch existing sum_table row
  const { data: existingSummary } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', saahilPfid)
    .eq('amid', bhandariAmid);

  const summaryRow = {
    pfolio_id: saahilPfid,
    client_id: 1,
    atty: assetType,
    amid: bhandariAmid,
    qnt: qty,
    amtinv: amtInvested,
    currv,
    tgain: 0
  };

  if (existingSummary && existingSummary.length > 0) {
    const { data: updRes, error: updErr } = await supabase
      .from('sum_table')
      .update(summaryRow)
      .eq('sid', existingSummary[0].sid)
      .select();

    if (updErr) {
      console.error('Error updating sum_table:', updErr);
    } else {
      console.log('Updated sum_table successfully:', updRes);
    }
  }
}

run().catch(console.error);
