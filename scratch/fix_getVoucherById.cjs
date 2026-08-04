const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

const oldFuncStart = `export function getVoucherById(id: any) {
  let v = state.vouchersC1.find((v: any) => v.vid === Number(id));
  let transSrc = state.transC1;
  if (!v) {
    v = state.vouchers1.find((v: any) => v.vid === Number(id));
    transSrc = state.trans1;
  }`;

const newFuncStart = `export function getVoucherById(id: any) {
  let numericId = Number(id);
  if (typeof id === 'string') {
    if (id.startsWith('trid_') || id.startsWith('c_') || id.startsWith('t_')) {
      numericId = Number(id.split('_')[1]);
    } else {
      const match = id.match(/\\d+/);
      if (match) numericId = Number(match[0]);
    }
  }

  let v = state.vouchersC1.find((v: any) => v.vid === numericId);
  let transSrc = state.transC1;
  if (!v) {
    v = state.vouchers1.find((v: any) => v.vid === numericId);
    transSrc = state.trans1;
  }`;

// We also need to fix `Number(id)` usages further down in `getVoucherById`
// Let's replace `Number(id)` with `numericId` everywhere inside `getVoucherById`
let funcCode = c.substring(c.indexOf('export function getVoucherById('));
let nextFuncIdx = funcCode.indexOf('export function', 10);
if (nextFuncIdx === -1) nextFuncIdx = funcCode.length;
let oldFuncCode = funcCode.substring(0, nextFuncIdx);

let newFuncCode = oldFuncCode.replace(/Number\(id\)/g, 'numericId');
newFuncCode = newFuncCode.replace(
  `export function getVoucherById(id: any) {\n  let v = state.vouchersC1.find((v: any) => v.vid === numericId);\n  let transSrc = state.transC1;\n  if (!v) {\n    v = state.vouchers1.find((v: any) => v.vid === numericId);\n    transSrc = state.trans1;\n  }`,
  newFuncStart
);

c = c.replace(oldFuncCode, newFuncCode);
fs.writeFileSync('src/logic.ts', c);
console.log('SUCCESS: Fixed getVoucherById to parse trid_ prefixes correctly');
