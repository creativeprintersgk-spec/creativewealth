const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

// 1. Patch getAssetTransactions signature
const getAssetRegex = /export function getAssetTransactions\([\s\S]*?localeCompare.*?;/;
const getAssetRepl = `export function getAssetTransactions(portfolioIds: number[], amid: number, startDate?: string, endDate?: string, sidFilter?: number) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  let runningCost = 0;

  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid && (sidFilter === undefined || t.sid === sidFilter))
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));`;

if (getAssetRegex.test(c)) {
  c = c.replace(getAssetRegex, getAssetRepl);
  console.log('Patched getAssetTransactions signature');
} else {
  console.log('Failed to find getAssetTransactions target');
}

fs.writeFileSync('src/logic.ts', c);
