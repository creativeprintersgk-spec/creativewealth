const fs = require('fs');

let c = fs.readFileSync('src/logic.ts', 'utf8');

const updateRegex = /export function getVoucherById\(id: any\) {[\s\S]*?if \(!v\) {\n\s+const tx = state.bs1.find\(\(t: any\) => t.trid === Number\(id\)\);/;

const newUpdate = `export function getVoucherById(id: any) {
  const strId = String(id || '');
  const isExplicitTrid = strId.startsWith('trid_');
  const numericId = isExplicitTrid ? Number(strId.replace('trid_', '')) : Number(id);

  let v;
  let transSrc;

  if (!isExplicitTrid) {
    v = state.vouchersC1.find((v: any) => v.vid === numericId);
    transSrc = state.transC1;
    if (!v) {
      v = state.vouchers1.find((v: any) => v.vid === numericId);
      transSrc = state.trans1;
    }
  }
  
  if (!v) {
    const tx = state.bs1.find((t: any) => t.trid === numericId);`;

c = c.replace(updateRegex, newUpdate);

fs.writeFileSync('src/logic.ts', c);
console.log('Patched getVoucherById successfully.');
