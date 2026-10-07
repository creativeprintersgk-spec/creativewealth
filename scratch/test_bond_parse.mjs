import fs from 'fs';

const data = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));

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
    bondCategory: isGsec ? 'gsec' : (isSgb ? 'sgb' : (isNcd ? 'ncd' : 'ncd')),
    faceValue: isGsec ? 100 : (isSgb ? 1 : 1000),
    interestFrequency: isSgb ? 'Half-Yearly' : (isGsec ? 'Half-Yearly' : 'Annual')
  };
}

let parsedCount = 0;
data.forEach(d => {
  if (d.name && d.name.includes('(ISIN ')) {
    const res = parseBondFromTitle(d.name);
    if (res.isin) parsedCount++;
  }
});
console.log('Total bonds with parsed details from title:', parsedCount);
const sample = parseBondFromTitle('Muthoot Fincorp NCD 9.1% 12/02/2032 (ISIN INE549K07HI2)');
console.log('Sample parsed:', sample);
