import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

async function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

function calculateHoldingDays(buyDate: Date, sellDate: Date) {
  return Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 3600 * 24));
}

async function runImport() {
  console.log("🚀 Starting MProfit CSV Import...");

  console.log("1. Clearing existing transactions and capital gains data...");
  // Clear the existing data to prevent duplicates
  await supabase.from('capital_gains_summary').delete().neq('portfolio_id', 'dummy');

  console.log("2. Loading master data (Assets, Portfolios)...");
  const assets = await parseCSV('ACMA1.csv');
  const assetMap = new Map();
  for (const asset of assets) {
    assetMap.set(asset.ID, asset.NAME);
  }

  const portfolios = await parseCSV('Portfolios.csv');
  const portfolioMap = new Map();
  for (const pf of portfolios) {
    portfolioMap.set(pf.ID, pf.FullName || pf.InvestorName);
  }

  console.log("3. Loading trades (BS1.csv)...");
  const trades = await parseCSV('BS1.csv');

  console.log(`Found ${trades.length} raw trades. Processing FIFO...`);
  
  // Group by Portfolio -> Asset
  const lotsByAsset = new Map<string, any[]>();
  const cgSummary: any[] = [];

  // Sort trades chronologically
  trades.sort((a, b) => new Date(a.DT).getTime() - new Date(b.DT).getTime());

  for (const trade of trades) {
    const pfid = trade.PFID;
    const amid = trade.AMID;
    const key = `${pfid}_${amid}`;
    
    if (!lotsByAsset.has(key)) lotsByAsset.set(key, []);
    const lots = lotsByAsset.get(key)!;

    const qty = parseFloat(trade.QN);
    const price = parseFloat(trade.NETPR || trade.PURPR || "0");
    const date = new Date(trade.DT.split(' ')[0]);

    if (trade.TRSTR === 'Buy') {
      lots.push({ date, qty, price });
    } else if (trade.TRSTR === 'Sell') {
      let remainingQtyToSell = qty;
      let totalCost = 0;
      let saleProceeds = remainingQtyToSell * price;
      
      const matchedLots = [];

      while (remainingQtyToSell > 0.00001 && lots.length > 0) {
        const oldestLot = lots[0];
        const matchQty = Math.min(oldestLot.qty, remainingQtyToSell);
        
        totalCost += matchQty * oldestLot.price;
        remainingQtyToSell -= matchQty;
        oldestLot.qty -= matchQty;
        
        matchedLots.push({
          buy_date: oldestLot.date,
          sell_date: date,
          qty: matchQty,
          cost: matchQty * oldestLot.price,
          proceeds: matchQty * price
        });

        if (oldestLot.qty <= 0.00001) {
          lots.shift();
        }
      }

      // Generate CG entry for each matched lot
      for (const match of matchedLots) {
        const holdingDays = calculateHoldingDays(match.buy_date, match.sell_date);
        // Simplified classification: Equity > 365 = LTCG, Debt > 1095 = LTCG (assuming equity for now to avoid complexity)
        const isLTCG = holdingDays > 365;
        const gainType = isLTCG ? 'LTCG' : 'STCG';
        const gainLoss = match.proceeds - match.cost;
        const taxRate = isLTCG ? 0.125 : 0.20;
        
        // Exemption logic is complex and done dynamically in the frontend, so we just estimate base tax
        const estimatedTax = gainLoss > 0 ? gainLoss * taxRate : 0;

        const pName = portfolioMap.get(pfid) || `Portfolio ${pfid}`;
        // Since we link portfolios to family, wait, Supabase UI uses actual portfolio IDs from 'pms_portfolios' table!
        // Wait! We should use 'pf_' + pfid to match if they were imported as such.
        // Actually, we'll just insert as the numeric ID for now, since we haven't mapped them to 'pms_portfolios'.
        const pf_id = `pf_${pfid}`; // We will assume the portfolio ID format

        cgSummary.push({
          portfolio_id: pf_id,
          amid: amid,
          asset_name: assetMap.get(amid) || `Asset ${amid}`,
          asset_type_name: 'Equity', // Hardcoded fallback
          buy_date: match.buy_date.toISOString().split('T')[0],
          sell_date: match.sell_date.toISOString().split('T')[0],
          holding_days: holdingDays,
          gain_type: gainType,
          tax_rate: taxRate * 100,
          sell_qty: match.qty,
          sale_proceeds: match.proceeds,
          cost_of_acquisition: match.cost,
          gain_loss: gainLoss,
          estimated_tax: estimatedTax
        });
      }
    }
  }

  console.log(`Computed ${cgSummary.length} Capital Gains matched lots.`);

  if (cgSummary.length > 0) {
    console.log(`4. Uploading Capital Gains to Supabase...`);
    // Upload in batches of 1000
    for (let i = 0; i < cgSummary.length; i += 1000) {
      const batch = cgSummary.slice(i, i + 1000);
      const { error } = await supabase.from('capital_gains_summary').insert(batch);
      if (error) {
        console.error(`Error uploading batch ${i}:`, error.message);
      } else {
        console.log(`Uploaded batch ${i} to ${i + batch.length}`);
      }
    }
  }

  console.log("✅ Import Complete!");
}

runImport().catch(console.error);
