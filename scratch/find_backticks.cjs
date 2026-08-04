const fs = require('fs');
const lines = fs.readFileSync('src/logic.ts', 'utf8').split('\n');
let count = 0;
lines.forEach((l, i) => {
  const matches = l.match(/`/g);
  if (matches) {
    count += matches.length;
    console.log((i+1) + ': ' + l);
  }
});
console.log('Total backticks:', count);
