import Database from 'better-sqlite3';

const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });

const acid = 29;
const endDate = '2026-03-31';

// 1. Get portfolios for Unnati
const pflinks = db.prepare('SELECT * FROM ACC_PFLINK WHERE ACID = ?').all(acid);
const pfids = pflinks.map((p: any) => p.PFID);

// 2. Get all Trans1 for Unnati (or linked portfolios) up to endDate
const vouchers1 = db.prepare('SELECT * FROM Vouchers1 WHERE ACID = ?').all(acid);
const voucherMap: Record<number, any> = {};
vouchers1.forEach((v: any) => { voucherMap[v.VID] = v; });

const trans1 = db.prepare('SELECT * FROM Trans1 WHERE ACID = ?').all(acid);

// Group transactions by MAID (ledger ID)
const transByMaid: Record<number, { debit: number, credit: number, count: number }> = {};
trans1.forEach((t: any) => {
  const v = voucherMap[t.VID];
  const dt = t.DT || v?.DT;
  if (dt && dt > endDate) return;
  const maid = Number(t.MAID);
  if (!transByMaid[maid]) transByMaid[maid] = { debit: 0, credit: 0, count: 0 };
  transByMaid[maid].debit += Number(t.DRAMT) || 0;
  transByMaid[maid].credit += Number(t.CRAMT) || 0;
  transByMaid[maid].count += 1;
});

// Get SAM asset names
const samRows = db.prepare('SELECT AMID, ANM FROM SAM').all();
const samMap: Record<number, string> = {};
samRows.forEach((s: any) => { samMap[s.AMID] = s.ANM; });

// Get ACMA names
const acmaAll = db.prepare('SELECT ID, NAME, PARENT_ID, ACID FROM ACMA1').all();
const acmaMap: Record<number, any> = {};
acmaAll.forEach((a: any) => { if (a.ACID === acid || !acmaMap[a.ID]) acmaMap[a.ID] = a; });

console.log('=== LEDGER BALANCES COMPUTED FROM TRANS1 FOR UNNATI (as on 2026-03-31) ===');
let netTotal = 0;
for (const [maidStr, data] of Object.entries(transByMaid)) {
  const maid = Number(maidStr);
  const net = data.debit - data.credit;
  const name = acmaMap[maid]?.NAME || samMap[maid] || `Unknown (${maid})`;
  const parent = acmaMap[maid]?.PARENT_ID;
  console.log(`MAID ${maid} | Parent ${parent} | ${name.padEnd(45)} | Dr: ${data.debit.toFixed(2).padStart(12)} | Cr: ${data.credit.toFixed(2).padStart(12)} | Net (Dr-Cr): ${net.toFixed(2).padStart(12)}`);
  netTotal += net;
}

console.log(`\nNet Total of all Trans1 (Dr - Cr): ₹${netTotal.toFixed(2)}`);
