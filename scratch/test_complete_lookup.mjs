import fs from 'fs';

const assetMaster = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));

export function parseBondFromTitle(name) {
  if (!name) return null;
  const isinM = name.match(/\b(IN[A-Z0-9]{10})\b/i);
  const couponM = name.match(/(\d+(?:\.\d+)?)\s*%/);
  const dateM = name.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  
  let matDate = null;
  if (dateM) {
    let [_, d, m, y] = dateM;
    if (y.length === 2) y = '20' + y;
    matDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  let cleanName = name.replace(/\s*\(ISIN\s+[A-Z0-9]+\)\s*/i, '').trim();
  const isGsec = /G-Sec|GOI|GS\s*\d{4}/i.test(cleanName);
  const isSgb = /SGB|Gold/i.test(cleanName);
  const isNcd = /NCD|Debenture|BOND/i.test(cleanName);
  
  return {
    cleanName,
    isin: isinM ? isinM[1].toUpperCase() : null,
    couponRate: couponM ? parseFloat(couponM[1]) : undefined,
    maturityDate: matDate || undefined,
    bondCategory: isGsec ? 'gsec' : (isSgb ? 'sgb' : 'ncd'),
    faceValue: isGsec ? 100 : (isSgb ? 1 : 1000),
    interestFrequency: isSgb ? 'Half-Yearly' : (isGsec ? 'Half-Yearly' : 'Annual')
  };
}

const map = {};
assetMaster.forEach(a => {
  let isinVal = a.isin ? String(a.isin).trim().toUpperCase() : null;
  if (!isinVal && a.name) {
    const m = String(a.name).match(/\b(IN[A-Z0-9]{10})\b/i);
    if (m) isinVal = m[1].toUpperCase();
  }
  if (isinVal && isinVal.startsWith('IN')) {
    map[isinVal] = a;
  }
});

const testIsins = [
  'INE549K07HI2', // User's Muthoot Fincorp NCD
  'INE062A08058', // State Bank of India Bonds
  'INE414G07100', // Muthoot Finance NCD
  'INE002A01018', // Reliance Stock
  'INF179K01BE2', // HDFC MF
  'IN0020180314'  // SGB 2018-19 Sr-III
];

console.log('Testing lookups for sample ISINs:');
testIsins.forEach(isin => {
  const match = map[isin];
  if (match) {
    const isBond = [40, 70, 100, 115].includes(match.asset_type) || (match.name && match.name.includes('(ISIN '));
    if (isBond) {
      const p = parseBondFromTitle(match.name);
      console.log(`[BOND] ${isin} ->`, p);
    } else {
      console.log(`[ASSET] ${isin} -> ${match.name} (Type: ${match.asset_type_name || match.asset_type})`);
    }
  } else {
    console.log(`[NOT IN SNAPSHOT] ${isin}`);
  }
});
