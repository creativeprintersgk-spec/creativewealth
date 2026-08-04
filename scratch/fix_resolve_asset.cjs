const fs = require('fs');
const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(/const matched = resolveAsset\(symbol, isin\);/g, 'const matched = await resolveAssetAsync(symbol, isin);');
code = code.replace(/const matched = resolveAsset\(name\);/g, 'const matched = await resolveAssetAsync(name);');

fs.writeFileSync(file, code);
console.log('Replaced resolveAsset with resolveAssetAsync');
