const fs = require('fs');
let code = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

const oldLoop = `    for (const line of lines) {
      const trimmed = line.trim();`;
const newLoop = `    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();`;

const oldIsin = `      const isinMatch = trimmed.match(/\\b(IN[A-Z0-9]{10})\\b/i);
      const isin = isinMatch ? isinMatch[1].toUpperCase() : '';`;

const newIsin = `      const isinMatch = trimmed.match(/\\b(IN[A-Z0-9]{10})\\b/i);
      let isin = isinMatch ? isinMatch[1].toUpperCase() : '';
      if (!isin) {
        for (let k = 1; k <= 3; k++) {
          const nextLine = lines[i + k];
          if (nextLine) {
            const nextIsinMatch = nextLine.match(/\\b(IN[A-Z0-9]{10})\\b/i);
            if (nextIsinMatch) {
              isin = nextIsinMatch[1].toUpperCase();
              break;
            }
          }
        }
      }`;

code = code.replace(oldLoop, newLoop);
code = code.replace(oldIsin, newIsin);
fs.writeFileSync('src/pages/ImportPage.tsx', code);
console.log('Fixed ISIN');
