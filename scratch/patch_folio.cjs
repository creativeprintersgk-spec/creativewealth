const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

// 1. Patch getAssetTransactions signature
const getAssetTarget = `export function getAssetTransactions(portfolioIds: number[], amid: number, startDate?: string, endDate?: string) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  let runningCost = 0;

  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid)
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));`;

const getAssetRepl = `export function getAssetTransactions(portfolioIds: number[], amid: number, startDate?: string, endDate?: string, sidFilter?: number) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  let runningCost = 0;

  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid && (sidFilter === undefined || t.sid === sidFilter))
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));`;

if (c.includes(getAssetTarget)) {
  c = c.replace(getAssetTarget, getAssetRepl);
  console.log('Patched getAssetTransactions signature');
} else {
  console.log('Failed to find getAssetTransactions target');
}

// 2. Patch getHoldings dynamically calculating true quantity PER FOLIO (sid)
const holdTarget = `  // 1. Filter sum_table dynamically calculating true quantity to hide 0-qty assets
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid);
    const trueQty = ledger.closingQty;
    // Do NOT overwrite s.qnt here, otherwise we duplicate the quantity across folios
    return Math.abs(trueQty) > 0.0001;
  });`;

const holdRepl = `  // 1. Filter sum_table dynamically calculating true quantity PER FOLIO (sid) to hide 0-qty and sync stale exports
  const rows = state.sumTable.filter((s: any) => {
    if (!pSet.has(s.pfolio_id)) return false;
    const ledger = getAssetTransactions([s.pfolio_id], s.amid, undefined, undefined, s.sid);
    const trueQty = ledger.closingQty;
    const trueInvested = ledger.closingCost;
    
    // We can now safely overwrite s.qnt because we are calculating EXACTLY for this folio!
    s.qnt = trueQty;
    s.amtinv = trueInvested;
    
    return Math.abs(trueQty) > 0.0001;
  });`;

if (c.includes(holdTarget)) {
  c = c.replace(holdTarget, holdRepl);
  console.log('Patched getHoldings sid sync');
} else {
  console.log('Failed to find getHoldings target');
}

// 3. Patch portfolioSplits grouping by folio
const splitTarget = `    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
    const ex = h.portfolioSplits.find(sp => sp.portfolioId === s.pfolio_id);
    if (ex) { 
      ex.quantity += qtyRow; 
      ex.amtInvested += inv; 
      ex.currentValue = ex.quantity * currPrice; 
    }
    else {
      h.portfolioSplits.push({
        portfolioId: s.pfolio_id,
        portfolioName: port?.investor_name || \`Portfolio \${s.pfolio_id}\`,
        quantity: qtyRow, 
        amtInvested: inv, 
        currentValue: qtyRow * currPrice
      });
    }`;

const splitRepl = `    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
    const ex = h.portfolioSplits.find(sp => sp.portfolioId === s.pfolio_id && sp.folio === s.refno);
    if (ex) { 
      ex.quantity += qtyRow; 
      ex.amtInvested += inv; 
      ex.currentValue = ex.quantity * currPrice; 
    }
    else {
      h.portfolioSplits.push({
        portfolioId: s.pfolio_id,
        portfolioName: port?.investor_name || \`Portfolio \${s.pfolio_id}\`,
        folio: s.refno,
        quantity: qtyRow, 
        amtInvested: inv, 
        currentValue: qtyRow * currPrice
      });
    }`;

if (c.includes(splitTarget)) {
  c = c.replace(splitTarget, splitRepl);
  console.log('Patched portfolioSplits folio grouping');
} else {
  console.log('Failed to find portfolioSplits target');
}

fs.writeFileSync('src/logic.ts', c);
