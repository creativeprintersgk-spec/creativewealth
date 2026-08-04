const fs = require('fs');
let code = fs.readFileSync('src/logic.ts', 'utf8');

const target = `    let openingBalance = 0, runningBalance = 0;
    const transactions: any[] = [];
    entries.forEach((e: any) => {`;

const replacement = `    const ledger = state.ledgers.find((l: any) => Number(l.id) === lid && (!acidNum || l.acid === acidNum));
    const ledgerOpBal = ledger ? ledger.openingBalance : 0;
    const ledgerOpType = ledger ? ledger.openingType : 'DR';
    const initialBalance = ledgerOpType === 'CR' ? -ledgerOpBal : ledgerOpBal;
    
    let openingBalance = initialBalance, runningBalance = initialBalance;
    const transactions: any[] = [];
    entries.forEach((e: any) => {`;

code = code.replace(target, replacement);

fs.writeFileSync('src/logic.ts', code);
console.log("Patched getLedgerWithBalance successfully");
