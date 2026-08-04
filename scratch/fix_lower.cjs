const fs = require('fs');
let code = fs.readFileSync('src/logic.ts', 'utf-8');
code = code.replace(/assetName\.toLowerCase\(\)/g, "String(assetName || '').toLowerCase()");
code = code.replace(/l\.name\.toLowerCase\(\)/g, "String(l.name || '').toLowerCase()");
code = code.replace(/ledgerObj\.name\.toLowerCase\(\)/g, "String(ledgerObj.name || '').toLowerCase()");
code = code.replace(/groupId\.toLowerCase\(\)/g, "String(groupId || '').toLowerCase()");
code = code.replace(/a\.name\.toLowerCase\(\)/g, "String(a.name || '').toLowerCase()");
code = code.replace(/name\.toLowerCase\(\)/g, "String(name || '').toLowerCase()");
fs.writeFileSync('src/logic.ts', code);
