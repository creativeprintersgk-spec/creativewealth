const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

// Patch getAssetTransactions signature and filter
const getAssetTarget = `export function getAssetTransactions(portfolioIds: number[], amid: number, startDate?: string, endDate?: string) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  let runningCost = 0;

  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid)`;

const getAssetRepl = `export function getAssetTransactions(portfolioIds: number[], amid: number, startDate?: string, endDate?: string, sidFilter?: number) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  let runningCost = 0;

  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid && (sidFilter === undefined || t.sid === sidFilter))`;

if (c.includes(getAssetTarget)) {
  c = c.replace(getAssetTarget, getAssetRepl);
  console.log('Patched getAssetTransactions signature');
} else {
  console.log('Failed to find getAssetTransactions target');
}

// Patch getHoldings
const holdTarget = `  // 1. Filter sum_table dynamically calculating true quantity to hide 0-qty assets
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid);
    const trueQty = ledger.closingQty;
    // Do NOT overwrite s.qnt here, otherwise we duplicate the quantity across folios
    return Math.abs(trueQty) > 0.0001;
  });`;

const holdRepl = `  // 1. Filter sum_table dynamically calculating true quantity PER FOLIO (sid) to perfectly sync out-of-date MProfit exports
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid, undefined, undefined, s.sid);
    const trueQty = ledger.closingQty;
    const trueInvested = ledger.closingCost;
    
    // Safely overwrite because we are calculating per-folio (sid) exactly!
    s.qnt = trueQty;
    s.amtinv = trueInvested;
    
    return Math.abs(trueQty) > 0.0001;
  });`;

if (c.includes(holdTarget)) {
  c = c.replace(holdTarget, holdRepl);
  console.log('Patched getHoldings per-folio sync');
} else {
  console.log('Failed to find getHoldings target');
}

fs.writeFileSync('src/logic.ts', c);
