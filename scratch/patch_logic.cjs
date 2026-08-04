const fs = require('fs');
let code = fs.readFileSync('src/logic.ts', 'utf8');

code = code.replace(
  'const v = state.vouchersC1.find((v: any) => v.vid === e.vid);',
  'const v = state.vouchersC1.find((v: any) => v.vid === e.vid) || (state as any).vouchers1?.find((v: any) => v.vid === e.vid);'
);

const replace2Target = `        const vtypMap: Record<number, string> = { 2: 'payment', 4: 'receipt', 5: 'journal', 14: 'purchase', 15: 'sale' };
        transactions.push({
          date: e.dt || v?.dt, voucherId: e.vid,
          voucherType: v?.vtyp ? vtypMap[v.vtyp] || 'journal' : 'journal',
          narration: v?.narr || '',
          debit: dr, credit: cr, balance: runningBalance,
          againstLedger: againstName || '-'
        });`;

const replace2With = `        const vtypMap: Record<number, string> = { 2: 'payment', 4: 'receipt', 5: 'journal', 14: 'purchase', 15: 'sale' };
        const finalVtyp = e.vtyp || v?.vtyp;
        transactions.push({
          date: e.dt || v?.dt, voucherId: e.vid,
          voucherType: finalVtyp ? vtypMap[finalVtyp] || 'journal' : 'journal',
          narration: e.narr || v?.narr || '',
          debit: dr, credit: cr, balance: runningBalance,
          againstLedger: againstName || '-'
        });`;

code = code.replace(replace2Target, replace2With);
fs.writeFileSync('src/logic.ts', code);
console.log('logic.ts patched');
