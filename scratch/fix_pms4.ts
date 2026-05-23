import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import csvParser from 'csv-parser';
import crypto from 'crypto';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve) => {
    const rows: any[] = [];
    fs.createReadStream('scratch/mprofit_csv/' + fileName)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

function assetTypeToGroup(assetType: number): string {
  if (assetType === 50)  return 'stocks';
  if (assetType === 60)  return 'mf_equity';
  if (assetType === 65)  return 'mf_debt';
  if (assetType === 70)  return 'mf_equity';
  if (assetType === 110) return 'fds';
  if (assetType === 100) return 'traded_bonds';
  if (assetType === 130) return 'gold';
  if (assetType === 140) return 'silver';
  if (assetType === 200) return 'ppf_epf';
  if (assetType === 150) return 'insurance_asset';
  if (assetType === 300) return 'aif';
  return 'stocks';
}

async function run() {
  const bs1 = await parseCSV('BS1.csv');
  bs1.sort((a, b) => new Date(a.DT).getTime() - new Date(b.DT).getTime());

  // 1. Find all AMIDs in BS1
  const bs1Amids = new Set<number>();
  for (const trade of bs1) {
    const amid = parseInt(trade.AMID, 10);
    if (!isNaN(amid)) bs1Amids.add(amid);
  }

  // 2. Fetch existing ledgers to see which ones are missing
  const { data: existingLedgers } = await supabase.from('ledgers').select('id');
  const existingLedgerIds = new Set(existingLedgers?.map(l => l.id) || []);

  const missingAmids = Array.from(bs1Amids).filter(amid => !existingLedgerIds.has(`ldgr_asset_${amid}`));
  
  if (missingAmids.length > 0) {
    console.log(`Found ${missingAmids.length} missing asset ledgers. Creating them...`);
    
    // Fetch metadata
    const assetMeta = new Map<number, any>();
    for (let i = 0; i < missingAmids.length; i += 200) {
      const slice = missingAmids.slice(i, i + 200);
      const { data } = await supabase.from('asset_master').select('amid, name, asset_type, asset_type_name').in('amid', slice);
      data?.forEach(a => assetMeta.set(a.amid, a));
    }

    const newLedgers = missingAmids.map(amid => {
      const info = assetMeta.get(amid) || { name: `Asset ${amid}`, asset_type: 50 };
      return {
        id: `ldgr_asset_${amid}`,
        group_id: assetTypeToGroup(info.asset_type),
        name: info.name,
        opening_balance: 0,
        opening_type: 'DR',
        amid: assetMeta.has(amid) ? amid : null,
      };
    });

    for (let i = 0; i < newLedgers.length; i += 500) {
      const batch = newLedgers.slice(i, i + 500);
      const { error } = await supabase.from('ledgers').insert(batch);
      if (error) console.error('Error inserting ledgers:', error);
    }
    console.log('Created missing ledgers.');
  }

  // 3. Re-fetch all ledgers
  const validLedgersResponse = await supabase.from('ledgers').select('id');
  const validLedgers = new Set(validLedgersResponse.data?.map(l => l.id) || []);
  
  const validPortsResponse = await supabase.from('portfolios').select('id');
  const validPorts = new Set(validPortsResponse.data?.map(p => p.id) || []);

  await supabase.from('tax_lots').delete().neq('id', '__never__');

  const taxLots: any[] = [];
  const lotsMap = new Map();

  const INFLOW_TRSTR = [
    'BUY', 'INVESTMENT', 'IPO / RIGHTS ISSUE', 'BUY OFF-MARKET/OP. BAL', 
    'DIVIDEND REINVEST', 'PART PAYMENT', '*DEMERGER', '*DEMERGER (NEW)', 
    '*SPLIT', 'BONUS', '*MERGER', '*INSTALLMENT PAYMENT', 'IPO/RIGHTS'
  ];

  const OUTFLOW_TRSTR = [
    'SELL', 'SELL OFF-MARKET', 'WITHDRAWAL', 'BUYBACK', 
    'WRITE OFF', '*SPLIT CLOSED', '*DEMERGER CLOSED', '*MERGED'
  ];

  for (const trade of bs1) {
    const pfid  = `pf_${trade.PFID}`;
    const amid  = parseInt(trade.AMID, 10);
    const ledgerId = `ldgr_asset_${amid}`; 

    if (!validLedgers.has(ledgerId) || !validPorts.has(pfid)) {
        continue;
    }

    const key = `${pfid}_${ledgerId}`;
    if (!lotsMap.has(key)) lotsMap.set(key, []);
    const bucket = lotsMap.get(key);

    const qty   = parseFloat(trade.QN  || '0');
    // For net price we use PURPR. If PURPR is 0 (like for bonus/splits), cost is 0.
    const price = parseFloat(trade.PURPR || trade.NETPR || '0');
    const dt    = trade.DT ? trade.DT.split(' ')[0] : '';
    if (!dt || isNaN(qty) || qty <= 0) continue;

    const trType = (trade.TRSTR || '').trim().toUpperCase();

    if (INFLOW_TRSTR.includes(trType)) {
      const lot = {
        id: `tl_${trade.TRANSID || crypto.randomUUID()}`,
        portfolio_id: pfid,
        ledger_id: ledgerId,
        purchase_date: dt,
        quantity: qty,
        remaining_quantity: qty,
        cost_per_unit: price,
        cost_total: qty * price,
        is_closed: false
      };
      bucket.push(lot);
    } else if (OUTFLOW_TRSTR.includes(trType)) {
      let remaining = qty;
      while (remaining > 0.0001 && bucket.length > 0) {
        const lot = bucket[0];
        const matchQty = Math.min(lot.remaining_quantity, remaining);
        
        remaining -= matchQty;
        lot.remaining_quantity -= matchQty;
        
        if (lot.remaining_quantity <= 0.0001) {
          lot.is_closed = true;
          bucket.shift(); 
        }
      }
    }
  }

  for (const [key, bucket] of lotsMap.entries()) {
    for (const lot of bucket) {
      if (lot.remaining_quantity > 0) {
        taxLots.push(lot);
      }
    }
  }

  console.log(`Computed ${taxLots.length} OPEN tax lots from BS1.csv`);
  for (let i = 0; i < taxLots.length; i += 500) {
    const batch = taxLots.slice(i, i + 500);
    const { error } = await supabase.from('tax_lots').insert(batch);
    if (error) console.error('Error inserting tax lots', error);
  }
  console.log('Done inserting tax lots!');
}
run();
