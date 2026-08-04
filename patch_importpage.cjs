const fs = require('fs');

let content = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

const targetStr = `          if (type === 'cn') {
            processCnPdfText(fullText);
          } else {
            // DYNAMICALLY FETCH ISINs BEFORE PARSING`;

const replacementStr = `          if (type === 'cn') {
            processCnPdfText(fullText);
          } else if (type === 'cas') {
            setOverallMessage("Parsing CAS via Python backend...");
            try {
              const res = await fetch('/api/parse-cas', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/pdf',
                  'x-cas-password': decryptionPassword || ''
                },
                body: file
              });
              if (!res.ok) {
                const errText = await res.text();
                throw new Error("CAS Parser backend error: " + errText);
              }
              const casData = await res.json();
              await processCasJsonData(casData);
            } catch (err: any) {
              console.error("CAS Backend Parsing Error:", err);
              // Fallback to pdfjs error to trigger password prompt if it was a password issue
              if (err.message && (err.message.includes('Incorrect Password') || err.message.includes('password'))) {
                throw { name: 'PasswordException' };
              } else {
                setOverallMessage("Error parsing CAS: " + (err.message || String(err)));
              }
            }
          }`;

content = content.replace(targetStr, replacementStr);

const removeStart = content.indexOf('// DYNAMICALLY FETCH ISINs BEFORE PARSING');
const removeEnd = content.indexOf('await processCasPdfText(fullText);\n          }') + 'await processCasPdfText(fullText);\n          }'.length;
if (removeStart > -1 && removeEnd > removeStart) {
   content = content.substring(0, removeStart) + content.substring(removeEnd);
}

fs.writeFileSync('src/pages/ImportPage.tsx', content);
console.log('Patched handlePdfParsing');
