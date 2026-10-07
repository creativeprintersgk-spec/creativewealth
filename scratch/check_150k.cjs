const Database = require('better-sqlite3');
const db = new Database('scripts/_old_mprofit_clean.db');
const row1 = db.prepare("SELECT * FROM transc1 WHERE dramt = 150000 OR cramt = 150000").all();
console.log('transc1 150000:', row1);
const row2 = db.prepare("SELECT * FROM trans1 WHERE dramt = 150000 OR cramt = 150000").all();
console.log('trans1 150000:', row2);

const onDate = db.prepare("SELECT * FROM transc1 WHERE dt = '2026-05-28'").all();
console.log('transc1 on 2026-05-28:', onDate);

const onDate2 = db.prepare("SELECT * FROM trans1 WHERE dt = '2026-05-28'").all();
console.log('trans1 on 2026-05-28:', onDate2);

if (onDate.length > 0) {
  const vchs = db.prepare("SELECT * FROM vouchersc1 WHERE vid = ?").all(onDate[0].vid);
  console.log('vouchersc1 for onDate:', vchs);
  const legs = db.prepare("SELECT * FROM transc1 WHERE vid = ?").all(onDate[0].vid);
  console.log('all legs for onDate:', legs);
}
if (onDate2.length > 0) {
  const vchs2 = db.prepare("SELECT * FROM vouchers1 WHERE vid = ?").all(onDate2[0].vid);
  console.log('vouchers1 for onDate2:', vchs2);
  const legs2 = db.prepare("SELECT * FROM trans1 WHERE vid = ?").all(onDate2[0].vid);
  console.log('all legs for onDate2:', legs2);
}
