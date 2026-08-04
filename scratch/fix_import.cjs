const fs = require('fs');
const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

const badRegex = /if \(lastLine\.credit > 0\) \{\s*lastLine\.credit = Number\(\(lastLine\.credit \+ diff\)\.toFixed\(2\)\);\s*\} else \{\s*narration: `Daily trades CN/;

const correct = `          if (lastLine.credit > 0) {
            lastLine.credit = Number((lastLine.credit + diff).toFixed(2));
          } else {
            lastLine.debit = Number((lastLine.debit - diff).toFixed(2));
          }
        }

        const brokerName = brokerLedgers.find(b => String(b.id) === String(selectedBrokerLedger))?.name || "Broker";
        const currentPf = portfolios.find(p => String(p.id) === String(pId));
        const pName = currentPf?.name || currentPf?.portfolioName || \`Portfolio \${pId}\`;
        const dataPayload = {
          accountId: currentPf?.accountId || 31,
          portfolioId: pId,
          date: groupDate,
          narration: \`Daily trades CN`;

if (badRegex.test(code)) {
  code = code.replace(badRegex, correct);
  fs.writeFileSync(file, code);
  console.log("Fixed botched replace!");
} else {
  console.log("Botched block not found");
}
