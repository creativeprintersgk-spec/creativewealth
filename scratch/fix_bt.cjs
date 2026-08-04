const fs = require('fs');
let code = fs.readFileSync('src/logic.ts', 'utf-8');
code = code.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/logic.ts', code);
