const fs = require('fs');
const path = require('path');

const csvPath = 'C:\\Users\\Admin\\Desktop\\wealthcore-clean\\scratch\\mprofit_csv\\acmac1.csv';
const content = fs.readFileSync(csvPath, 'utf8');

// Parse lines
const lines = content.split('\n');
const headers = lines[0].split(',');
console.log('Headers:', headers);

const matchingRows = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Quick split by comma (ignoring quoted commas for this basic check, or using a simple parser)
  const cols = line.split(',');
  const parentId = cols[2];
  const name = cols[5];
  const id = cols[0];
  
  if (parentId === '160' || parentId === '170' || parentId === '171' || parentId === '175' || name?.toLowerCase().includes('charge') || name?.toLowerCase().includes('tax') || name?.toLowerCase().includes('brokerage') || name?.toLowerCase().includes('stt')) {
    matchingRows.push({ id, parentId, name });
  }
}

console.log('Expense-related ledgers found in ACMAC1:');
matchingRows.slice(0, 50).forEach(r => console.log(`ID: ${r.id}, ParentID: ${r.parentId}, Name: ${r.name}`));
