const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

if (!c.includes('export function getAccPflink()')) {
  c = c.replace('export function getPortfolios', 'export function getAccPflink() { return state.accPflink; }\nexport function getPortfolios');
  fs.writeFileSync('src/logic.ts', c);
  console.log('Successfully injected getAccPflink');
} else {
  console.log('getAccPflink already exists');
}
