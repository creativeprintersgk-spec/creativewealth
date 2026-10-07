import fs from 'fs';
const snapshotDir = 'backups/latest_snapshot';
const sumTable = JSON.parse(fs.readFileSync(`${snapshotDir}/sum_table.json`, 'utf8'));
const bs1 = JSON.parse(fs.readFileSync(`${snapshotDir}/bs1.json`, 'utf8'));

[500776, 500777, 501389, 501714, 776, 777, 1389, 1714].forEach(id => {
  const inSum = sumTable.filter((s: any) => s.amid === id);
  const inBs = bs1.filter((b: any) => b.amid === id);
  console.log(`id ${id}: sumTable=${inSum.length}, bs1=${inBs.length}`);
  if (inSum.length) console.log('  sumTable:', inSum);
  if (inBs.length) console.log('  bs1:', inBs);
});
