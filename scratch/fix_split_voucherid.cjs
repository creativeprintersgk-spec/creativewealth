const fs = require('fs');

let c = fs.readFileSync('src/logic.ts', 'utf8');

// The WRONG pattern: for split entries (trty=85 split-closed, trty=45 split-open),
// acvch points to the PAIRED split row, NOT to a voucher.
// So we must NEVER use acvch as a voucherId for splits.
// Split trty values: 45 (*Split), 85 (*Split Closed), 40 (Bonus), 47 (Demerger new), 38 (Merger)

const oldVoucherId = "voucherId: t.acvch && Number(t.acvch) > 0 ? String(t.acvch) : `trid_${t.trid}`,";

// For non-voucher transactions (splits, bonus, demergers with cnid=-1 or trty in split range),
// always use trid_ prefix. Only use acvch as voucher ID for regular buy/sell that have accounting vouchers.
const newVoucherId = `voucherId: (t.acvch && Number(t.acvch) > 0 && ![45, 85, 40, 41, 42, 43, 47, 48, 49, 38, 39, 36, 37, 50, 51, 52].includes(t.trty)) ? String(t.acvch) : \`trid_\${t.trid}\`,`;

if (c.includes(oldVoucherId)) {
  c = c.replace(oldVoucherId, newVoucherId);
  fs.writeFileSync('src/logic.ts', c);
  console.log('SUCCESS: Fixed voucherId assignment for split/bonus/corporate action entries.');
} else {
  console.log('ERROR: Could not find target string. Current voucherId lines:');
  const lines = c.split('\n').filter(l => l.includes('voucherId'));
  lines.forEach(l => console.log(' ', l.trim()));
}
