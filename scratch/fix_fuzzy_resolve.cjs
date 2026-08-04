const fs = require('fs');
let code = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

const oldFind = `|| state.assetMaster.find((a: any) => !isFutOpt(a.name) && a.name.toLowerCase().includes(symbol.toLowerCase()))`;
const newFind = `|| state.assetMaster.find((a: any) => !isFutOpt(a.name) && (a.name.toLowerCase().includes(symbol.toLowerCase()) || symbol.toLowerCase().includes(a.name.toLowerCase())))`;
code = code.replace(oldFind, newFind);

const oldSAMFind = `|| state.sam.find((s: any) => !isFutOpt(s.anm) && s.anm.toLowerCase().includes(symbol.toLowerCase()));`;
const newSAMFind = `|| state.sam.find((s: any) => !isFutOpt(s.anm) && (s.anm.toLowerCase().includes(symbol.toLowerCase()) || symbol.toLowerCase().includes(s.anm.toLowerCase())));`;
code = code.replace(oldSAMFind, newSAMFind);

// Let's also expand the ISIN search up to 10 lines instead of 3, just in case!
const oldLoop = `for (let k = 1; k <= 3; k++) {`;
const newLoop = `for (let k = 1; k <= 10; k++) {`;
code = code.replace(oldLoop, newLoop);

// Also make ISIN regex more forgiving just in case there's a space or dot
const oldRegex = `/\\b(IN[A-Z0-9]{10})\\b/i`;
const newRegex = `/\\b(IN[A-Z0-9]{10})\\b/i`; // Actually the regex is fine. Let's just fix the fuzzy matching.

fs.writeFileSync('src/pages/ImportPage.tsx', code);
console.log('Fixed resolveAsset fuzzy matching');
