import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

const acid = 29;

for (const id of [11, 13, 16, 17, 26, 97, 114, 79]) {
  const l = acmac1.find((a: any) => a.id === id && a.acid === acid);
  if (!l) continue;
  const t1_rows = trans1.filter((r: any) => r.maid === l.id && r.acid === acid);
  const tc_rows = transC1.filter((r: any) => r.maid === l.id && r.acid === acid);

  const t1_net = t1_rows.reduce((s: number, r: any) => s + (Number(r.dramt)||0) - (Number(r.cramt)||0), 0);
  const tc_net = tc_rows.reduce((s: number, r: any) => s + (Number(r.dramt)||0) - (Number(r.cramt)||0), 0);
  const sum = t1_net + tc_net;
  const acmaNet = (Number(l.db_bal)||0) - (Number(l.cr_bal)||0);

  console.log(`[${l.id}] ${l.name.padEnd(45)}: trans1=${t1_net.toFixed(2).padStart(12)}, transc1=${tc_net.toFixed(2).padStart(12)}, SUM=${sum.toFixed(2).padStart(12)} | ACMA1_NET=${acmaNet.toFixed(2)}`);
}
