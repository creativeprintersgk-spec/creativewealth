const fs = require('fs');

async function checkMfs() {
  const st = JSON.parse(fs.readFileSync('public/snapshot/sum_table.json', 'utf8'));
  const am = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));
  const sam = JSON.parse(fs.readFileSync('public/snapshot/sam.json', 'utf8'));
  const amMap = new Map(am.map(a => [a.amid, a]));
  const samMap = new Map(sam.map(s => [s.amid, s]));

  const activeAmids = Array.from(new Set(st.filter(s => s.qnt > 0.0001 || s.currv > 0.01).map(s => s.amid)));

  const mfAssets = activeAmids.map(id => {
    const a = amMap.get(id);
    if (a) return a;
    const s = samMap.get(id);
    if (s) return { amid: s.amid, name: s.anm, asset_type: s.atyp, amfi_code: s.exint2 };
    return null;
  }).filter(Boolean).filter(a => [60, 61, 62].includes(a.asset_type) || a.amfi_code || a.name.toLowerCase().includes('fund') || a.name.toLowerCase().includes('fof'));

  console.log(`Total MF assets found: ${mfAssets.length}`);
  
  for (const m of mfAssets) {
    let amfi = m.amfi_code;
    let nav = null;
    if (amfi) {
      try {
        const res = await fetch(`http://localhost:5173/api/mfapi/mf/${amfi}`);
        const data = await res.json();
        nav = data?.data?.[0]?.nav;
      } catch (e) {}
    }
    console.log(`[AMID: ${m.amid}] "${m.name}" | AMFI: ${amfi} | Live NAV: ${nav || 'MISSING'}`);
  }
}

checkMfs().catch(console.error);
