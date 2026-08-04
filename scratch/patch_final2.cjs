const fs = require('fs');
let logic = fs.readFileSync('src/logic.ts', 'utf8');

const targetStr = `    const qty = Number(s.qnt) || 0;
    const currv = Number(s.currv) || 0;
    const tgain = Number(s.tgain) || 0;
    const fallbackCurr = qty > 0 ? currv / qty : 0;
    const fallbackPrev = qty > 0 ? fallbackCurr - (tgain / qty) : fallbackCurr;

    const currPrice = price.curr || fallbackCurr;
    const prevPrice = price.prev || fallbackPrev;

    if (!map[amid]) {`;

const replStr = `    const bs1Transactions = state.bs1.filter((b: any) => 
      Number(b.pfid) === s.pfolio_id && Number(b.amid) === amid
    );

    let calculatedQty = 0;
    let totalBuyQty = 0;
    let totalBuyAmt = 0;

    bs1Transactions.forEach((b: any) => {
      const type = Number(b.trty);
      const q = Number(b.qn) || 0;
      const amt = Number(b.amt) || 0;
      if (q > 0) {
        if ([20, 40, 45, 21, 22, 23, 25, 26].includes(type)) {
          calculatedQty += q;
          totalBuyQty += q;
          totalBuyAmt += amt;
        } else if ([101, 85, 10, 11, 12, 13].includes(type)) {
          calculatedQty -= q;
        }
      }
    });

    const qty = bs1Transactions.length > 0 ? calculatedQty : (Number(s.qnt) || 0);

    const currv = Number(s.currv) || 0;
    const tgain = Number(s.tgain) || 0;
    const fallbackCurr = qty > 0 ? currv / qty : 0;
    const fallbackPrev = qty > 0 ? fallbackCurr - (tgain / qty) : fallbackCurr;

    const currPrice = price.curr || fallbackCurr;
    const prevPrice = price.prev || fallbackPrev;

    const avgPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0;
    const inv = qty * avgPrice;

    if (!map[amid]) {`;

if (logic.includes(targetStr)) {
  logic = logic.replace(targetStr, replStr);
  console.log("Patched calc logic.");
} else {
  console.log("Could not find calc target.");
}

const targetStr2 = `    const h = map[amid];
    const qtyRow = Number(s.qnt) || 0;
    const inv = Number(s.amtinv) || 0;
    h.quantity += qtyRow;
    h.amtInvested += inv;
    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
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

const replStr2 = `    const h = map[amid];
    const qtyRow = Number(s.qnt) || 0;
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

if (logic.includes(targetStr2)) {
  logic = logic.replace(targetStr2, replStr2);
  console.log("Patched assign logic.");
} else {
  console.log("Could not find assign target.");
}

fs.writeFileSync('src/logic.ts', logic, 'utf8');
