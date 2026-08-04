const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/pages/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldCheck = `    const existingByName = state.acmac1.find((a: any) =>
      !a.is_group &&
      a.acid === acid &&
      a.name && a.name.toLowerCase().trim() === nameLower
    );`;

const newCheck = `    const cleanLedgerName = (n: string) => {
      let cleaned = n.replace(/\\s*\\(?ISIN\\s+[A-Z0-9]{12}\\)?/gi, '');
      cleaned = cleaned.replace(/\\s*\\([A-Z]{2}[A-Z0-9]{10}\\)/gi, '');
      cleaned = cleaned.replace(/\\s*\\(\\d[\\d\\s\\/,-]*\\)/gi, '');
      return cleaned.toLowerCase().trim().replace(/\\s*-\\s*$/, '').trim();
    };
    const cleanedNameLower = cleanLedgerName(name);

    const existingByName = state.acmac1.find((a: any) =>
      !a.is_group &&
      a.acid === acid &&
      a.name && cleanLedgerName(a.name) === cleanedNameLower
    );`;

if (content.includes(oldCheck)) {
  content = content.replace(oldCheck, newCheck);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Patched ensureAssetLedgerExists in ImportPage.tsx (LF)');
} else {
  const crOldCheck = oldCheck.replace(/\n/g, '\r\n');
  const crNewCheck = newCheck.replace(/\n/g, '\r\n');
  if (content.includes(crOldCheck)) {
    content = content.replace(crOldCheck, crNewCheck);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Patched ensureAssetLedgerExists in ImportPage.tsx (CRLF)');
  } else {
    console.log('❌ Could not find oldCheck in ImportPage.tsx');
  }
}
