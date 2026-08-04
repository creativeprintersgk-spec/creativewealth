const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

const regex = /  return Object\.values\(map\)\.map\(h => \{[\s\S]*?return h;\s*\}\)\.sort\(\(a, b\) => b\.amtInvested - a\.amtInvested\);/;

const rep = `  const result = Object.values(map).map(h => {
    h.avgPrice = h.quantity > 0 ? h.amtInvested / h.quantity : 0;
    h.currentValue = h.quantity * h.currentPrice;
    h.overallGain = h.currentValue > 0 ? h.currentValue - h.amtInvested : 0;
    h.overallGainPct = h.amtInvested > 0 && h.currentValue > 0 ? (h.overallGain / h.amtInvested) * 100 : 0;
    h.todaysGain = h.prevPrice > 0 ? h.quantity * (h.currentPrice - h.prevPrice) : 0;
    h.todaysGainPct = h.prevPrice > 0 ? ((h.currentPrice - h.prevPrice) / h.prevPrice) * 100 : 0;
    return h;
  });

  // Inject pure ledgers as PMS holdings
  state.acmac1.forEach((ledger: any) => {
    if (ledger.is_group) return;
    const atty = groupAttyMap[ledger.parent_id];
    if (!atty) return;

    const links = state.accPflink.filter((l: any) => l.acid === ledger.acid && pSet.has(l.pfid));
    if (links.length === 0) return;

    // Use getLedgerBalance dynamically so it always reflects the true accounting state
    const balance = getLedgerBalance(ledger.id, ledger.acid);
    if (Math.abs(balance) < 0.01) return;

    const syntheticId = -Number(ledger.id);
    const portfolioSplits = links.map((link: any) => {
      const port = state.portfolios.find((p: any) => p.id === link.pfid);
      return {
        portfolioId: link.pfid,
        portfolioName: port?.investor_name || \`Portfolio \${link.pfid}\`,
        folio: 'N.A.',
        quantity: 0,
        amtInvested: balance,
        currentValue: balance
      };
    });

    result.push({
      assetId: syntheticId,
      assetName: ledger.name,
      assetType: atty,
      quantity: 0,
      avgPrice: 0,
      amtInvested: balance,
      currentPrice: 0,
      prevPrice: 0,
      currentValue: balance,
      overallGain: 0,
      overallGainPct: 0,
      todaysGain: 0,
      todaysGainPct: 0,
      portfolioSplits
    });
  });

  return result.sort((a, b) => b.amtInvested - a.amtInvested);`;

if (regex.test(c)) {
  fs.writeFileSync('src/logic.ts', c.replace(regex, rep));
  console.log('Successfully injected pure ledgers into getHoldings');
} else {
  console.log('Regex not found');
}
