const txs = [
  { qn: 2850, amt: 331310.06, isBuy: true },
  { qn: 1650, amt: 200111.45, isBuy: true },
  { qn: 1200, amt: 168102.66, isBuy: true },
  { qn: 5700, amt: 799951.03, isBuy: false },
  { qn: 35, amt: 14075.25, isBuy: true }
];

let qty = 0;
let amtInvested = 0;

txs.forEach((t) => {
  const q = Number(t.qn);
  const amt = Number(t.amt);
  if (t.isBuy) {
    qty += q;
    amtInvested += amt;
  } else {
    const prevQty = qty;
    qty -= q;
    if (prevQty > 0) {
      amtInvested -= (q / prevQty) * amtInvested;
    } else {
      amtInvested -= amt;
    }
  }
  console.log(`After Tx: qty=${qty}, amtInvested=${amtInvested}`);
});
