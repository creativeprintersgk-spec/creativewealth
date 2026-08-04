const fs = require('fs');
const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(/setCnCharges\(\{ \.\.\.charges, other: 0 \}\);/g, 'setCnCharges(charges);');

fs.writeFileSync(file, code);
console.log('Fixed setCnCharges logic');
