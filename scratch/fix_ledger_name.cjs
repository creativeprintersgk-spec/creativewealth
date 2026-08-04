const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

const target1 = `id: \`asset_\${tx.trid}\`,
              ledgerId: String(tx.amid),
              debit: isBuy ? amount : 0,`;

const rep1 = `id: \`asset_\${tx.trid}\`,
              ledgerId: String(tx.amid),
              ledgerName: state.assetNameMap[tx.amid] || '',
              debit: isBuy ? amount : 0,`;

if (c.includes(target1)) {
  c = c.replace(target1, rep1);
  fs.writeFileSync('src/logic.ts', c);
  console.log("Replaced ledgerName successfully");
} else {
  console.log("Could not find target block");
}
