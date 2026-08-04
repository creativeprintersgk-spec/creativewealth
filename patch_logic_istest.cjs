/**
 * Patch logic.ts to add isTest flag support to createVoucher voucherRow.
 * Uses exact string match and replaces only the voucherRow object.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/logic.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The exact voucherRow we want to patch
const OLD_ROW = `  const voucherRow = {
    vid,
    acid,
    dt: data.date,
    narr: data.narration || '',
    vtyp,
    pfid: data.portfolioId ? Number(data.portfolioId) : null,
  };`;

const NEW_ROW = `  // isTest: when data.isTest=true, tags entry with imp_rec_id='TEST' in Supabase
  // This makes it show as orange in the UI — persists across page refreshes
  const voucherRow: any = {
    vid,
    acid,
    dt: data.date,
    narr: data.narration || '',
    vtyp,
    pfid: data.portfolioId ? Number(data.portfolioId) : null,
    ...(data.isTest ? { imp_rec_id: 'TEST' } : {}),
  };`;

if (content.includes(OLD_ROW)) {
  content = content.replace(OLD_ROW, NEW_ROW);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Patched voucherRow in logic.ts with isTest flag');
} else {
  // Try CRLF version
  const OLD_CRLF = OLD_ROW.replace(/\n/g, '\r\n');
  const NEW_CRLF = NEW_ROW.replace(/\n/g, '\r\n');
  if (content.includes(OLD_CRLF)) {
    content = content.replace(OLD_CRLF, NEW_CRLF.replace(/\n/g, '\r\n'));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Patched voucherRow (CRLF) in logic.ts with isTest flag');
  } else {
    console.error('❌ Could not find voucherRow pattern. Showing surrounding context:');
    const i = content.indexOf('const voucherRow');
    if (i >= 0) console.log(JSON.stringify(content.slice(i, i + 300)));
    else console.error('voucherRow not found at all!');
  }
}
