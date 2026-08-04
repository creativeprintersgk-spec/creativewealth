const fs = require('fs');

const code = `
export let state: any = {
`;

const toggleStr = `
export async function togglePortfolioStatus(portfolioId: number, isActive: boolean) {
  await supabase.from('pfolio1').update({ is_active: isActive ? 1 : 0 }).eq('id', portfolioId);
  const pf = state.portfolios.find((p: any) => p.id === portfolioId);
  if (pf) pf.is_active = isActive ? 1 : 0;
}

export function getTransactionAssetDetails(voucherId: string | number): { assetId?: number, assetName?: string, portfolioId?: number } {
  const vid = Number(voucherId);
  const bsEntry = state.bs1.find((b: any) => b.acvch === vid);
  if (bsEntry) {
    const asset = state.assetMaster.find((a: any) => a.amid === bsEntry.amid);
    return { assetId: bsEntry.amid, assetName: asset?.name, portfolioId: bsEntry.pfid };
  }
  return {};
}
`;

const logic = fs.readFileSync('src/logic.ts', 'utf-8');
const logicReplaced = logic.replace('let state: any = {', 'export let state: any = {');

const bulkCodeLines = fs.readFileSync('scratch/append_bulk.cjs', 'utf-8').split('\n');
let bulkCode = bulkCodeLines.slice(3, -2).join('\n');
bulkCode = bulkCode.replace(/\\`/g, '`');
bulkCode = bulkCode.replace(/\\\$/g, '$');

fs.writeFileSync('src/logic.ts', logicReplaced + '\n' + toggleStr + '\n' + bulkCode + '\n');
console.log('Appended successfully');
