import fs from 'fs';
import { initDatabase, state, getAssetName } from '../src/logic.ts';

const isinDict: Record<string, string> = JSON.parse(fs.readFileSync('./src/services/isinDictionary.json', 'utf8'));
const isinToAmid: Record<string, number> = {};
for (const [amid, isin] of Object.entries(isinDict)) {
  isinToAmid[isin] = Number(amid);
}

async function testMatching() {
  await initDatabase();

  const isins = [
    { isin: "INE404A01024", symbol: "ABSLAMC" },
    { isin: "INE463V01026", symbol: "ANANDRATHI" },
    { isin: "INE406A01037", symbol: "AUROPHARMA" },
    { isin: "INE084A01016", symbol: "BANKINDIA" },
    { isin: "INE257A01026", symbol: "BHEL" },
    { isin: "INE029A01011", symbol: "BPCL" },
    { isin: "INE476A01022", symbol: "CANBK" },
    { isin: "INE522F01014", symbol: "COALINDIA" },
    { isin: "INE481Y01014", symbol: "GICRE" },
    { isin: "INE548A01028", symbol: "HFCL" },
    { isin: "INE094A01015", symbol: "HINDPETRO" },
    { isin: "INE121J01017", symbol: "INDUSTOWER" },
    { isin: "INE242A01010", symbol: "IOC" },
    { isin: "INE0FS801015", symbol: "MSUMI" },
    { isin: "INE470Y01017", symbol: "NIACL" },
    { isin: "INE0NDH25011", symbol: "NXST" },
    { isin: "INE213A01029", symbol: "ONGC" },
    { isin: "INE020B01018", symbol: "RECLTD" },
    { isin: "INE777K01022", symbol: "RRKABEL" },
    { isin: "INE075A01022", symbol: "WIPRO" }
  ];

  console.log('=== MATCHING RESULTS ===');
  for (const item of isins) {
    // 1. Check isinToAmid
    let amid = isinToAmid[item.isin];
    let name = amid ? getAssetName(amid) : '';
    
    // 2. Check assetMaster by nse_symbol
    if (!amid) {
      const am = state.assetMaster.find((a: any) => a.nse_symbol && a.nse_symbol.toUpperCase().trim() === item.symbol.toUpperCase().trim());
      if (am) {
        amid = am.amid;
        name = am.name;
      }
    }

    console.log(`${item.symbol} (${item.isin}): amid=${amid || 'NOT FOUND'}, name="${name}"`);
  }
}

testMatching().catch(console.error);
