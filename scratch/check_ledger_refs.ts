import fs from 'fs';

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const ledgerIds = new Set(db.ledgers.map((l: any) => l.id));
const voucherIds = new Set(db.vouchers.map((v: any) => v.id));
const familyIds = new Set(db.families.map((f: any) => f.id));
const accountIds = new Set(db.accounts.map((a: any) => a.id));
const portfolioIds = new Set(db.portfolios.map((p: any) => p.id));
const groupIds = new Set(db.groups.map((g: any) => g.id));

console.log(`Loaded from db.json:`);
console.log(`- ${db.ledgers.length} ledgers`);
console.log(`- ${db.vouchers.length} vouchers`);
console.log(`- ${db.families.length} families`);
console.log(`- ${db.accounts.length} accounts`);
console.log(`- ${db.portfolios.length} portfolios`);
console.log(`- ${db.groups.length} groups`);
console.log(`- ${db.entries.length} entries`);

let missingLedgerCount = 0;
const missingLedgers = new Set();
let missingVoucherCount = 0;
const missingVouchers = new Set();

for (const entry of db.entries) {
  if (!ledgerIds.has(entry.ledgerId)) {
    missingLedgerCount++;
    missingLedgers.add(entry.ledgerId);
  }
  if (!voucherIds.has(entry.voucherId)) {
    missingVoucherCount++;
    missingVouchers.add(entry.voucherId);
  }
}

console.log(`\n--- Verification Results ---`);
console.log(`Entries with missing ledgerId: ${missingLedgerCount} (${Array.from(missingLedgers).join(', ')})`);
console.log(`Entries with missing voucherId: ${missingVoucherCount} (${Array.from(missingVouchers).join(', ')})`);

let missingFamilyCount = 0;
const missingFamilies = new Set();
for (const acc of db.accounts) {
  if (!familyIds.has(acc.familyId)) {
    missingFamilyCount++;
    missingFamilies.add(acc.familyId);
  }
}
console.log(`Accounts with missing familyId: ${missingFamilyCount} (${Array.from(missingFamilies).join(', ')})`);

let missingAccountCount = 0;
const missingAccounts = new Set();
for (const port of db.portfolios) {
  if (!accountIds.has(port.accountId)) {
    missingAccountCount++;
    missingAccounts.add(port.accountId);
  }
}
console.log(`Portfolios with missing accountId: ${missingAccountCount} (${Array.from(missingAccounts).join(', ')})`);

let missingVoucherAccPort = 0;
for (const v of db.vouchers) {
  if (v.accountId && !accountIds.has(v.accountId)) {
    missingVoucherAccPort++;
    console.log(`Voucher ${v.id} has missing accountId: ${v.accountId}`);
  }
  if (v.portfolioId && !portfolioIds.has(v.portfolioId)) {
    missingVoucherAccPort++;
    console.log(`Voucher ${v.id} has missing portfolioId: ${v.portfolioId}`);
  }
}
console.log(`Vouchers with missing accountId/portfolioId: ${missingVoucherAccPort}`);

