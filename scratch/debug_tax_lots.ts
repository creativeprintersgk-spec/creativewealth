import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import csvParser from 'csv-parser';

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

async function debug() {
  console.log("Supabase URL:", process.env.VITE_SUPABASE_URL);

  const ledgersRes = await supabase.from('ledgers').select('id, name');
  console.log("Ledgers error:", ledgersRes.error);
  console.log("Ledgers count:", ledgersRes.data?.length);
  if (ledgersRes.data && ledgersRes.data.length > 0) {
    console.log("Sample ledgers:", ledgersRes.data.slice(0, 5));
  }

  const portsRes = await supabase.from('portfolios').select('id, portfolio_name');
  console.log("Portfolios error:", portsRes.error);
  console.log("Portfolios count:", portsRes.data?.length);
  if (portsRes.data && portsRes.data.length > 0) {
    console.log("Sample portfolios:", portsRes.data.slice(0, 5));
  }

  const bs1 = await parseCSV('BS1.csv');
  console.log("BS1 trades count:", bs1.length);
  if (bs1.length > 0) {
    console.log("Sample BS1 trade:", bs1[0]);
    const trade = bs1[0];
    const pfid  = `pf_${trade.PFID}`;
    const amid  = parseInt(trade.AMID, 10);
    const ledgerId = `ldgr_asset_${amid}`;
    console.log("Checking trade:", {
      PFID: trade.PFID,
      pfid,
      AMID: trade.AMID,
      amid,
      ledgerId,
      ledgerExists: ledgersRes.data?.some(l => l.id === ledgerId),
      portfolioExists: portsRes.data?.some(p => p.id === pfid)
    });
  }
}

debug();
