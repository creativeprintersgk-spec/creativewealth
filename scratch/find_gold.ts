import fs from 'fs';

const as1 = JSON.parse(fs.readFileSync('./public/data/as1.json', 'utf8'));
const goldAssets = as1.filter((a: any) => (a.n && a.n.toLowerCase().includes('gold')) || (a.s && a.s.toLowerCase().includes('gold')));
console.log('=== Gold in as1 ===');
goldAssets.forEach((a: any) => {
  console.log(`ID: ${a.id}, Name: "${a.n}", Symbol: "${a.s}", atyid: ${a.atyid}, acid: ${a.acid}`);
});

const am1 = JSON.parse(fs.readFileSync('./public/data/am1.json', 'utf8'));
const goldAm1 = am1.filter((a: any) => (a.n && a.n.toLowerCase().includes('gold')) || (a.s && a.s.toLowerCase().includes('gold')));
console.log('\n=== Gold in am1 ===');
goldAm1.forEach((a: any) => {
  console.log(`amid: ${a.amid}, asid: ${a.asid}, Name: "${a.n}", atyid: ${a.atyid}, acid: ${a.acid}`);
});

// Let's also check all assets that are named "Gold" or "Gold R" exactly or have quantity in bs1
const bs1 = JSON.parse(fs.readFileSync('./public/data/bs1.json', 'utf8'));
const goldBs1 = bs1.filter((b: any) => {
  const as = as1.find((a: any) => a.id === b.asid);
  const am = am1.find((a: any) => a.amid === b.amid);
  const name = as?.n || am?.n || '';
  return name.toLowerCase().includes('gold');
});
console.log('\n=== Gold transactions in bs1 ===');
goldBs1.forEach((b: any) => {
  const as = as1.find((a: any) => a.id === b.asid);
  const am = am1.find((a: any) => a.amid === b.amid);
  console.log(`TRID: ${b.trid}, asid: ${b.asid} (${as?.n}), amid: ${b.amid} (${am?.n}), atyid: ${as?.atyid || am?.atyid}, qn: ${b.qn}`);
});
