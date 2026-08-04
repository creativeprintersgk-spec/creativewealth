const fs = require('fs');

let logic = fs.readFileSync('src/logic.ts', 'utf8');

// The git checkout restored logic.ts. Did the patch from the previous turn get lost?
// Let's re-apply the patch to fix quantity calculation and correctly assign it!
const oldLogicStr = `    const h = map[amid];
    const qtyRow = Number(s.qnt) || 0;
    const invAmount = inv;
    h.quantity += qtyRow;
    h.amtInvested += invAmount;
    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
    const ex = h.portfolioSplits.find(sp => sp.portfolioId === s.pfolio_id);
    if (ex) { 
      ex.quantity += qtyRow; 
      ex.amtInvested += invAmount; 
      ex.currentValue = ex.quantity * currPrice; 
    }
    else {
      h.portfolioSplits.push({
        portfolioId: s.pfolio_id,
        portfolioName: port?.investor_name || \`Portfolio \${s.pfolio_id}\`,
        quantity: qtyRow, 
        amtInvested: invAmount, 
        currentValue: qtyRow * currPrice
      });
    }`;

const newLogicStr = `    const h = map[amid];
    const qtyRow = Number(s.qnt) || 0;
    // If the calculated qty matches the summary exported qty precisely, use the MProfit amtinv.
    // This fixes cases where MProfit handles partial sells with complex FIFO logic.
    // If it doesn't match (or fallback), we use our avg price calculation \`inv\`.
    const invAmount = (qty === qtyRow) ? (Number(s.amtinv) || inv) : inv;
    h.quantity += qty;
    h.amtInvested += invAmount;
    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
    const ex = h.portfolioSplits.find(sp => sp.portfolioId === s.pfolio_id);
    if (ex) { 
      ex.quantity += qty; 
      ex.amtInvested += invAmount; 
      ex.currentValue = ex.quantity * currPrice; 
    }
    else {
      h.portfolioSplits.push({
        portfolioId: s.pfolio_id,
        portfolioName: port?.investor_name || \`Portfolio \${s.pfolio_id}\`,
        quantity: qty, 
        amtInvested: invAmount, 
        currentValue: qty * currPrice
      });
    }`;

if (logic.includes(oldLogicStr)) {
  logic = logic.replace(oldLogicStr, newLogicStr);
  console.log("Patched logic.ts assignments.");
} else {
  console.log("Could not find old logic string. Maybe logic.ts didn't have qtyRow?");
}

// Since git checkout reverted logic.ts, the first patch from task 4398 might be gone. Let's check and re-apply if needed.
if (!logic.includes('calculatedQty')) {
  console.log("calculatedQty not found, re-applying previous fix!");
  const oldCalcStr = `    const bs1Transactions = state.bs1.filter((b: any) => 
      Number(b.pfid) === s.pfolio_id && Number(b.amid) === amid
    );

    let totalBuyQty = 0;
    let totalBuyAmt = 0;

    bs1Transactions.forEach((b: any) => {
      const type = Number(b.trty);
      // Types that increase cost basis (101: opening, 20: buy, 21: bonus/split, 22: reinvestment, 23: merger)
      if ([101, 20, 21, 22, 23, 25, 26].includes(type)) {
        totalBuyQty += Number(b.qn) || 0;
        totalBuyAmt += Number(b.amt) || 0;
      }
    });

    const qty = Number(s.qnt) || 0;`;

  const newCalcStr = `    const bs1Transactions = state.bs1.filter((b: any) => 
      Number(b.pfid) === s.pfolio_id && Number(b.amid) === amid
    );

    // Calculate precise current quantity and average cost from bs1
    let calculatedQty = 0;
    let totalBuyQty = 0;
    let totalBuyAmt = 0;

    bs1Transactions.forEach((b: any) => {
      const type = Number(b.trty);
      const q = Number(b.qn) || 0;
      const amt = Number(b.amt) || 0;
      if (q > 0) {
        // Additions
        if ([20, 40, 45, 21, 22, 23, 25, 26].includes(type)) {
          calculatedQty += q;
          totalBuyQty += q;
          totalBuyAmt += amt;
        }
        // Subtractions (101=Sell, 85=Split Closed, 10=Sell, 11=Split Closed)
        else if ([101, 85, 10, 11, 12, 13].includes(type)) {
          calculatedQty -= q;
        }
      }
    });

    // Fallback to sum_table if no bs1 transactions found, otherwise use calculated exact qty
    const qty = bs1Transactions.length > 0 ? calculatedQty : (Number(s.qnt) || 0);`;
  
  // Actually regex to find it since whitespaces might differ
  const regexOldCalc = /const bs1Transactions[\s\S]*?const qty = Number\(s\.qnt\) \|\| 0;/;
  if (regexOldCalc.test(logic)) {
    logic = logic.replace(regexOldCalc, newCalcStr);
    console.log("Patched logic.ts calculations.");
  }
}
fs.writeFileSync('src/logic.ts', logic, 'utf8');

let workspace = fs.readFileSync('src/pages/PMSWorkspace.tsx', 'utf8');
const wsTarget = `<HoldingsGrid data={holdings} onHoldingClick={setSelectedHolding} groupByCategory={activeAssetType === 'all'} categoryLabels={CATEGORY_LABELS} onDataChange={setEnrichedHoldings} />`;
const wsRepl = `<HoldingsGrid sortBy={sortMode as any} data={holdings} onHoldingClick={setSelectedHolding} groupByCategory={activeAssetType === 'all'} categoryLabels={CATEGORY_LABELS} onDataChange={setEnrichedHoldings} />`;
if (workspace.includes(wsTarget)) {
  workspace = workspace.replace(wsTarget, wsRepl);
  fs.writeFileSync('src/pages/PMSWorkspace.tsx', workspace, 'utf8');
  console.log("Patched PMSWorkspace.tsx");
}

let grid = fs.readFileSync('src/components/pms/HoldingsGrid.tsx', 'utf8');
const gridTarget = `export default function HoldingsGrid({ \n  data, \n  onHoldingClick, \n  groupByCategory = false, \n  categoryLabels = {}, \n  onDataChange,\n  areAllExpanded,\n  sortBy = 'value'\n}: Props) {`;
const gridRepl = `export default function HoldingsGrid({ \n  data, \n  onHoldingClick, \n  groupByCategory = false, \n  categoryLabels = {}, \n  onDataChange,\n  areAllExpanded,\n  sortBy = 'currentValue' as any\n}: Props) {`;
if (grid.includes(gridTarget)) {
  grid = grid.replace(gridTarget, gridRepl);
} else {
  // Let's do a more robust regex patch for grid
  grid = grid.replace(/sortBy = 'value'/g, "sortBy = 'currentValue'");
}
fs.writeFileSync('src/components/pms/HoldingsGrid.tsx', grid, 'utf8');
console.log("Patched HoldingsGrid.tsx");

