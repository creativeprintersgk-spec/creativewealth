import fs from 'fs';
import { getLivePrice } from '../src/services/assetMasterService';

async function run() {
  const st = JSON.parse(fs.readFileSync('public/snapshot/sum_table.json', 'utf8'));
  const am = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));
  const sam = JSON.parse(fs.readFileSync('public/snapshot/sam.json', 'utf8'));
  const amMap = new Map<number, any>(am.map((a: any) => [a.amid, a]));
  const samMap = new Map<number, any>(sam.map((s: any) => [s.amid, s]));
  const uniqueAmids = Array.from(new Set(st.filter((s: any) => s.qnt > 0 || s.currv > 0).map((s: any) => s.amid))) as number[];

  const assets = uniqueAmids.map(id => {
    const a = amMap.get(id);
    if (a) return a;
    const s = samMap.get(id);
    if (s) return { amid: s.amid, name: s.anm, asset_type: s.atyp, nse_symbol: s.alias, bse_code: s.exint1, amfi_code: s.exint2, isin: s.extstr };
    return null;
  }).filter(Boolean);

  console.log(`Checking ${assets.length} assets...`);
  const success: any[] = [];
  const failed: any[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      const price = await getLivePrice(asset);
      if (price && price.price > 0) {
        success.push({ amid: asset.amid, name: asset.name, price: price.price, change: price.change, source: price.source });
      } else {
        failed.push({
          amid: asset.amid,
          name: asset.name,
          type: asset.asset_type,
          nse: asset.nse_symbol,
          bse: asset.bse_code,
          ticker: asset.ticker,
          isin: asset.isin,
          amfi: asset.amfi_code
        });
      }
    } catch (e) {
      failed.push({ amid: asset.amid, name: asset.name, type: asset.asset_type, error: String(e) });
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Success: ${success.length} / ${assets.length}`);
  console.log(`Failed: ${failed.length} / ${assets.length}\n`);

  console.log(`=== FAILED ASSETS (${failed.length}) ===`);
  failed.forEach((f, idx) => {
    console.log(`${idx + 1}. [AMID: ${f.amid}] [Type: ${f.type}] "${f.name}" | NSE: ${f.nse} | BSE: ${f.bse} | ISIN: ${f.isin} | Ticker: ${f.ticker}`);
  });
}

run().catch(console.error);
