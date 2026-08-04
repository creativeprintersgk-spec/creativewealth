const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

// Patch 1: getHoldings dynamic quantity
const holdTarget = `  // 1. Filter sum_table for active holdings (qnt > 0 or currv > 0 or amtinv > 0)
  const rows = state.sumTable.filter((s: any) => 
    pSet.has(s.pfolio_id) && 
    (Number(s.qnt) > 0.0001 || Number(s.currv) > 0.01 || Number(s.amtinv) > 0.01)
  );`;

const holdRepl = `  // 1. Filter sum_table dynamically calculating true quantity to hide 0-qty assets
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid);
    const trueQty = ledger.closingQty;
    // Overwrite the cached quantity with the dynamically calculated true quantity
    s.qnt = trueQty;
    // Hide the asset if true quantity is 0
    return Math.abs(trueQty) > 0.0001;
  });`;

if (c.includes(holdTarget)) {
  c = c.replace(holdTarget, holdRepl);
  console.log("Patched getHoldings");
} else {
  console.log("Could not find getHoldings target");
}

// Patch 2: getVoucherById STT/Brokerage lines
// Search for the return block
const vchTargetRegex = /return \{\s*id: String\(tx\.trid\),\s*vid: tx\.trid,[\s\S]*?narration: tx\.narr \|\| ''\s*\}\s*\]\s*\};/;

const vchRepl = `const lines = [
            {
              id: \`asset_\${tx.trid}\`,
              ledgerId: String(tx.amid),
              ledgerName: state.assetNameMap[tx.amid] || '',
              debit: isBuy ? amount : 0,
              credit: !isBuy ? amount : 0,
              quantity: qty,
              price: price,
              narration: tx.narr || ''
            }
          ];

          const brkg = Number(tx.brkg) || 0;
          const chrgs = Number(tx.chrgs) || 0;

          if (brkg > 0) {
            lines.push({
              id: \`brkg_\${tx.trid}\`,
              ledgerId: 'brokerage',
              ledgerName: 'Brokerage',
              debit: isBuy ? brkg : 0,
              credit: !isBuy ? brkg : 0,
              quantity: 0, price: 0, narration: ''
            });
          }
          
          if (chrgs > 0) {
            lines.push({
              id: \`stt_\${tx.trid}\`,
              ledgerId: 'stt',
              ledgerName: 'STT',
              debit: isBuy ? chrgs : 0,
              credit: !isBuy ? chrgs : 0,
              quantity: 0, price: 0, narration: ''
            });
          }

          return {
            id: String(tx.trid),
            vid: tx.trid,
            date: tx.dt || '',
            type: isMf ? 'contra' : 'journal',
            narration: tx.narr || '',
            voucherNo: \`BS-\${tx.trid}\`,
            accountId: resolvedAcid ? String(resolvedAcid) : '',
            portfolioId: String(tx.pfid),
            lines
          };`;

if (vchTargetRegex.test(c)) {
  c = c.replace(vchTargetRegex, vchRepl);
  console.log("Patched getVoucherById synthetic lines");
} else {
  console.log("Could not find getVoucherById target");
}

fs.writeFileSync('src/logic.ts', c, 'utf8');
