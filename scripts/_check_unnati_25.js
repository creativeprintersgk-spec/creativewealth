const fs = require('fs');
const state = JSON.parse(fs.readFileSync('backups/latest_snapshot/db_snapshot.json', 'utf8'));

const trans1 = state.trans1;
const transC1 = state.transC1;
const vmap = {};
state.voucherC1.forEach(v => vmap[v.id] = v);
state.voucher1.forEach(v => vmap[v.id] = v);

const entries = [...trans1, ...transC1].filter(e => String(e.maid) === '407');

console.log('Entries for maid 407 (Unnati Interest on Saving):');
entries.forEach(e => {
  const v = vmap[e.vid];
  if (!v) return;
  // Unnati is acid=29
  const acid = e.acid || v.acid;
  if (acid == 29 && v.dt >= '2025-04-01' && v.dt <= '2026-03-31') {
    console.log(`DT: ${v.dt}, VID: ${e.vid}, DR: ${e.dr}, CR: ${e.cr}`);
  }
});
