const fs = require('fs');
const path = require('path');
const file = path.join('c:', 'Users', 'Admin', 'Desktop', 'wealthcore-clean', 'src', 'pages', 'ImportPage.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /return nextId;\s*\};\s*if \(t\.type === "Buy"\) \{/;

const newStr = `return nextId;
    };

  const commitContractNote = async () => {
    setIsImporting(true);
    setOverallMessage("Committing contract note trades to ledger...");
    try {
      const selectedTrades = cnTrades.filter((t: any) => t.selected && t.amid !== -1 && t.date);
      if (selectedTrades.length === 0) throw new Error("No valid trades selected.");

      const grouped = selectedTrades.reduce((acc: any, t: any) => {
        const pf = portfolios.find((p: any) => String(p.id) === String(topPortfolioId));
        const pId = pf ? String(pf.id) : String(t.portfolioId || topPortfolioId || 1);
        const groupDate = topCnDate || t.date;
        const key = \`\${pId}_\${groupDate}\`;
        if (!acc[key]) acc[key] = { pId, groupDate, tradesInGroup: [] };
        acc[key].tradesInGroup.push(t);
        return acc;
      }, {});

      const numGroups = Object.keys(grouped).length;

      for (const key of Object.keys(grouped)) {
        const { pId, groupDate, tradesInGroup } = grouped[key];
        const mappedLines: any[] = [];
        
        const groupCharges = {
          stt: cnCharges.stt / numGroups,
          brokerage: cnCharges.brokerage / numGroups,
          gst: cnCharges.gst / numGroups,
          stamp: cnCharges.stamp / numGroups,
          transCharges: cnCharges.transCharges / numGroups,
          other: cnCharges.other / numGroups
        };

        let totalBuys = 0;
        let totalSells = 0;

        for (const t of tradesInGroup) {
          const ledgerId = await ensureAssetLedgerExists(t.amid, t.assetName, pId, 50);
          const gross = t.quantity * t.price;

          if (t.type === "Buy") {`;

if (regex.test(content)) {
  content = content.replace(regex, newStr);
  fs.writeFileSync(file, content);
  console.log('Fixed ImportPage.tsx (Regex)');
} else {
  console.log('Target string not found via regex!');
}
