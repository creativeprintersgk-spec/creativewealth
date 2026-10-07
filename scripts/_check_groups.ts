import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

const groups = acmac1.filter((a: any) => a.is_group && a.acid === 29);
groups.sort((a: any, b: any) => a.id - b.id);

console.log("=== MPROFIT GROUPS FOR ACID 29 ===");
groups.forEach((g: any) => {
  console.log(`[${g.id}] "${g.name}" (Parent: ${g.parent_id}, special_type_id: ${g.special_type_id})`);
});
