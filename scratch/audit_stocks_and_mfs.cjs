const fs = require('fs');

async function audit() {
  const st = JSON.parse(fs.readFileSync('public/snapshot/sum_table.json', 'utf8'));
  const am = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));
  const sam = JSON.parse(fs.readFileSync('public/snapshot/sam.json', 'utf8'));
  const amMap = new Map(am.map(a => [a.amid, a]));
  const samMap = new Map(sam.map(s => [s.amid, s]));

  const uniqueAmids = Array.from(new Set(st.filter(s => s.qnt > 0.0001 || s.currv > 0.01).map(s => s.amid)));

  const allAssets = uniqueAmids.map(id => {
    const a = amMap.get(id);
    if (a) return a;
    const s = samMap.get(id);
    if (s) return { amid: s.amid, name: s.anm, asset_type: s.atyp, nse_symbol: s.alias, bse_code: s.exint1, amfi_code: s.exint2, isin: s.extstr };
    return { amid: id, name: 'Asset ' + id, asset_type: 50 };
  });

  const stocksAndMfs = allAssets.filter(a => [50, 60, 61, 62].includes(a.asset_type) || a.amfi_code || a.nse_symbol || a.bse_code);

  console.log(`Checking ${stocksAndMfs.length} stocks and mutual funds...`);

  // We will test using our application's getLivePrice logic!
  // Let's test using tsx to directly import getLivePrice from src/services/assetMasterService
}

audit();
