const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

const holdTarget = `  // 1. Filter sum_table dynamically calculating true quantity to hide 0-qty assets
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid);
    const trueQty = ledger.closingQty;
    s.qnt = trueQty;
    return Math.abs(trueQty) > 0.0001;
  });`;

const holdRepl = `  // 1. Filter sum_table dynamically calculating true quantity to hide 0-qty assets
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid);
    const trueQty = ledger.closingQty;
    // Do NOT overwrite s.qnt here, otherwise we duplicate the quantity across folios
    return Math.abs(trueQty) > 0.0001;
  });`;

if (c.includes(holdTarget)) {
  c = c.replace(holdTarget, holdRepl);
  fs.writeFileSync('src/logic.ts', c);
  console.log("Patched successfully");
} else {
  console.log("Failed to patch getHoldings");
}
