const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

const oldRegex = /const qty = Number\(s\.qnt\) \|\| 0;\s+const currv = Number\(s\.currv\) \|\| 0;\s+const tgain = Number\(s\.tgain\) \|\| 0;\s+const fallbackCurr = qty > 0 \? currv \/ qty : 0;\s+const fallbackPrev = qty > 0 \? fallbackCurr - \(tgain \/ qty\) : fallbackCurr;\s+const currPrice = price\.curr \|\| fallbackCurr;\s+const prevPrice = price\.prev \|\| fallbackPrev;\s+\/\/ Calculate Average Cost from bs1\s+const bs1Transactions = state\.bs1\.filter\(\(b: any\) => \s+Number\(b\.pfid\) === s\.pfolio_id && Number\(b\.amid\) === amid\s+\);\s+let totalBuyQty = 0;\s+let totalBuyAmt = 0;\s+bs1Transactions\.forEach\(\(b: any\) => \{\s+const type = Number\(b\.trty\);\s+\/\/ Types that increase cost basis \(101: opening, 20: buy, 21: bonus\/split, 22: reinvestment, 23: merger\)\s+if \(\[101, 20, 21, 22, 23, 25, 26\]\.includes\(type\)\) \{\s+totalBuyQty \+= Number\(b\.qn\) \|\| 0;\s+totalBuyAmt \+= Number\(b\.amt\) \|\| 0;\s+\}\s+\}\);\s+const avgPrice = totalBuyQty > 0 \? totalBuyAmt \/ totalBuyQty : 0;\s+const inv = qty \* avgPrice;/g;

const newBlock = `    // Get all transactions for this portfolio and asset
    const bs1Transactions = state.bs1.filter((b: any) => 
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
    });

    // Fallback to sum_table if no bs1 transactions found, otherwise use calculated exact qty
    const qty = bs1Transactions.length > 0 ? calculatedQty : (Number(s.qnt) || 0);

    const currv = Number(s.currv) || 0;
    const tgain = Number(s.tgain) || 0;
    const fallbackCurr = qty > 0 ? currv / qty : 0;
    const fallbackPrev = qty > 0 ? fallbackCurr - (tgain / qty) : fallbackCurr;

    const currPrice = price.curr || fallbackCurr;
    const prevPrice = price.prev || fallbackPrev;
    
    const avgPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0;
    const inv = qty * avgPrice;`;

c = c.replace(oldRegex, newBlock);

fs.writeFileSync('src/logic.ts', c);
