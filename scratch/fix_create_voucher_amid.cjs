const fs = require('fs');
const file = 'src/logic.ts';
let code = fs.readFileSync(file, 'utf-8');

const regex = /let resolvedAmid = ledgerIdNum;\s+if \(ledger\) \{\s+const cleanLedgerName = ledger\.name\.toLowerCase\(\)\.replace\(\/\[\^a\-z0\-9\]\/g, ''\);/;

const replacement = `let resolvedAmid = ledgerIdNum;
          if (ledger) {
            if (ledger.ext_id && ledger.ext_id > 0) {
              resolvedAmid = ledger.ext_id;
            } else if (ledgerIdNum >= 100000 && ledgerIdNum < 800000000) {
              resolvedAmid = ledgerIdNum;
            } else {
              const cleanLedgerName = ledger.name.toLowerCase().replace(/[^a-z0-9]/g, '');`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  
  // Now find the end of this block which is:
  //            if (matchedAsset) {
  //              resolvedAmid = matchedAsset.amid;
  //            }
  //          }
  //          assetLinesInfo.push({ assetLine: line, amid: resolvedAmid });
  const regexEnd = /if \(matchedAsset\) \{\s+resolvedAmid = matchedAsset\.amid;\s+\}\s+\}\s+assetLinesInfo\.push\(\{ assetLine: line, amid: resolvedAmid \}\);/;
  
  const replacementEnd = `if (matchedAsset) {
                resolvedAmid = matchedAsset.amid;
              }
            }
          }
          assetLinesInfo.push({ assetLine: line, amid: resolvedAmid });`;
          
  if (code.match(regexEnd)) {
    code = code.replace(regexEnd, replacementEnd);
    console.log('Replaced end block successfully.');
  } else {
    console.log('Regex end not matched.');
  }
} else {
  console.log('Regex 1 not matched.');
}

fs.writeFileSync(file, code);
