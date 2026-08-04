const fs = require('fs');

let c = fs.readFileSync('src/logic.ts', 'utf8');

c = c.replace(
  /voucherId: String\(t\.trid\),/g,
  "voucherId: t.acvch && Number(t.acvch) > 0 ? String(t.acvch) : `trid_${t.trid}`,"
);

fs.writeFileSync('src/logic.ts', c);
console.log('Patched getAssetTransactions successfully.');
