const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

const targetRegex = /  let openingQty = 0;\s*let openingCost = 0;\s*const transactionsWithinPeriod: any\[\] = \[\];\s*allTx\.forEach\(\(t: any\) => \{\s*const qty = Number\(t\.qn\) \|\| 0;\s*const price = Number\(t\.purpr\) \|\| 0;\s*const amount = Number\(t\.amt\) \|\| 0;\s*const isBuy = \[19, 20, 12, 25, 30, 35, 40, 45, 46, 47\]\.includes\(t\.trty\);\s*if \(isBuy\) \{\s*runningQty \+= qty;\s*runningCost \+= amount;\s*\} else \{\s*const prevQty = runningQty;\s*runningQty -= qty;\s*if \(prevQty > 0\) \{\s*runningCost -= \(qty \/ prevQty\) \* runningCost;\s*\} else \{\s*runningCost -= amount;\s*\}\s*\}/;

const replacement = `  let openingQty = 0;
  let openingCost = 0;

  const buyLots: { qty: number; cost: number }[] = [];
  const transactionsWithinPeriod: any[] = [];

  allTx.forEach((t: any) => {
    const qty = Number(t.qn) || 0;
    const price = Number(t.purpr) || 0;
    const amount = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);

    if (isBuy) {
      runningQty += qty;
      runningCost += amount;
      buyLots.push({ qty, cost: amount });
    } else {
      runningQty -= qty;
      let sellQty = qty;
      while (sellQty > 0.0001 && buyLots.length > 0) {
        const lot = buyLots[0];
        if (lot.qty <= sellQty + 0.0001) {
          sellQty -= lot.qty;
          runningCost -= lot.cost;
          buyLots.shift();
        } else {
          const propCost = (sellQty / lot.qty) * lot.cost;
          lot.qty -= sellQty;
          lot.cost -= propCost;
          runningCost -= propCost;
          sellQty = 0;
        }
      }
      if (sellQty > 0.0001) {
        runningCost -= amount;
      }
    }`;

if (targetRegex.test(c)) {
  c = c.replace(targetRegex, replacement);
  fs.writeFileSync('src/logic.ts', c);
  console.log('Successfully patched getAssetTransactions with FIFO logic');
} else {
  console.log('Target regex failed to match');
}
