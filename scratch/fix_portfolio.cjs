const fs = require('fs');
let code = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

// 1. Remove portfolio default select
code = code.replace(/if \(pfs\.length > 0 && !selectedPortfolio\) \{\n\s*setSelectedPortfolio\(String\(pfs\[0\]\.id\)\);\n\s*\}/g, '');
code = code.replace(/if \(pfs\.length > 0\) \{\n\s*setSelectedPortfolio\(String\(pfs\[0\]\.id\)\);\n\s*\}/g, '');

// 2. Fix the broker detection logic case-insensitivity
const oldBrokerDetect = `    const detectedBroker = text.includes('Zerodha Broking') || text.includes('ZERODHA') ? 'zerodha'
      : text.includes('R K Global') || text.includes('RKG') || text.includes('R.K. Global') ? 'rk_global'
      : (text.includes('Dhan') || text.includes('raise.money') || text.includes('RAISE FINANCIAL')) ? 'dhan'
      : text.includes('Mirae Asset') || text.includes('m.Stock') ? 'mirae'
      : broker;`;
const newBrokerDetect = `    const lowerText = text.toLowerCase();
    const detectedBroker = lowerText.includes('zerodha') ? 'zerodha'
      : lowerText.includes('r k global') || lowerText.includes('rkg') ? 'rk_global'
      : lowerText.includes('dhan') || lowerText.includes('raise financial') ? 'dhan'
      : lowerText.includes('mirae') || lowerText.includes('m.stock') || lowerText.includes('mstock') ? 'mirae'
      : broker;`;
code = code.replace(oldBrokerDetect, newBrokerDetect);

// 3. Make sure commit stops if portfolio isn't selected
const oldCommit = `    if (activeTrades.some(t => t.amid === -1 || !t.assetName)) {`;
const newCommit = `    if (activeTrades.some(t => !t.portfolioId)) {
      alert("Please ensure all selected trades have a portfolio assigned!");
      return;
    }

    if (activeTrades.some(t => t.amid === -1 || !t.assetName)) {`;
code = code.replace(oldCommit, newCommit);

fs.writeFileSync('src/pages/ImportPage.tsx', code);
console.log('Fixed');
