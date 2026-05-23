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

async function run() {
  const bs1 = await parseCSV('BS1.csv');
  bs1.sort((a, b) => new Date(a.DT).getTime() - new Date(b.DT).getTime());

  const taxLots: any[] = [];
  const lotsMap = new Map();
  
  // Get ALL existing ledger IDs and portfolio IDs
  const { data: ledgers } = await supabase.from('ledgers').select('id');
  const validLedgers = new Set(ledgers?.map(l => l.id) || []);
  
  const { data: ports } = await supabase.from('portfolios').select('id');
  const validPorts = new Set(ports?.map(p => p.id) || []);

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
    const price = parseFloat(trade.NETPR || trade.PURPR || '0');
    const dt    = trade.DT ? trade.DT.split(' ')[0] : '';
    if (!dt || isNaN(qty) || qty <= 0) continue;

    const trType = (trade.TRSTR || '').trim().toUpperCase();

    if (trType === 'B' || trType === 'BUY') {
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
    } else if (trType === 'S' || trType === 'SELL') {
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

  console.log(`Computed ${taxLots.length} OPEN tax lots from BS1.csv that match existing ledgers`);
  for (let i = 0; i < taxLots.length; i += 500) {
    const batch = taxLots.slice(i, i + 500);
    const { error } = await supabase.from('tax_lots').insert(batch);
    if (error) console.error('Error inserting tax lots', error);
  }
  console.log('Done inserting tax lots!');
}
run();
