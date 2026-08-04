const fs = require('fs');

const logicFile = 'src/logic.ts';
let c = fs.readFileSync(logicFile, 'utf8');

const updateStartStr = 'export async function updateVoucher(data: any) {';
const deleteStartStr = 'export async function deleteVoucher(id: any) {';
const syncLiveStartStr = 'export async function syncLivePrices(amids: number[]) {';

const updateStart = c.indexOf(updateStartStr);
const deleteStart = c.indexOf(deleteStartStr);
const syncLiveStart = c.indexOf(syncLiveStartStr);

console.log('Indices:', {updateStart, deleteStart, syncLiveStart});

if (updateStart === -1 || deleteStart === -1 || syncLiveStart === -1) {
  throw new Error('Could not find all anchors in logic.ts');
}

const patch = fs.readFileSync('scratch/patch_logic_update_delete.cjs', 'utf8');
const newUpdateMatches = patch.match(/const newUpdate = `([\s\S]*?)`;\n\nconst newDelete/);
const newDeleteMatches = patch.match(/const newDelete = `([\s\S]*?)`;\n\nc =/);

if (!newUpdateMatches || !newDeleteMatches) {
  throw new Error('Could not extract patches from patch_logic_update_delete.cjs');
}

const newUpdate = newUpdateMatches[1];
const newDelete = newDeleteMatches[1];

// Replace the block from updateStart to syncLiveStart (which includes updateVoucher and deleteVoucher)
c = c.slice(0, updateStart) + newUpdate + '\n\n' + newDelete + '\n\n' + c.slice(syncLiveStart);

fs.writeFileSync(logicFile, c);
console.log('Successfully patched logic.ts without destroying the tail!');
