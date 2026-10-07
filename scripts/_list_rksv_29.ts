import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

const t1_29 = trans1.filter((t: any) => t.maid === 100002 && t.acid === 29);
let dr = 0, cr = 0;
t1_29.forEach((t: any) => {
  dr += Number(t.dramt) || 0;
  cr += Number(t.cramt) || 0;
});
console.log(`Direct snapshot trans1 for maid=100002, acid=29: count=${t1_29.length}, DR=${dr.toFixed(2)}, CR=${cr.toFixed(2)}, NET=${(dr-cr).toFixed(2)}`);

// Now check state.trans1 in logic.ts
import { state } from '../src/logic.ts';
state.trans1 = trans1.map((e: any) => ({ ...e, _src: 't' }));
const st_29 = state.trans1.filter((t: any) => t.maid === 100002 && t.acid === 29);
let sdr = 0, scr = 0;
st_29.forEach((t: any) => {
  sdr += Number(t.dramt) || 0;
  scr += Number(t.cramt) || 0;
});
console.log(`state.trans1: count=${st_29.length}, DR=${sdr.toFixed(2)}, CR=${scr.toFixed(2)}, NET=${(sdr-scr).toFixed(2)}`);
