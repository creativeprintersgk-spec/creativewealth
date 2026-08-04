const fs = require('fs');

const code = `
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

const bulkCodeLines = fs.readFileSync('scratch/append_bulk.cjs', 'utf-8').split('\n');
// scratch/append_bulk.cjs has export async function createVouchersBulk... from line 3 to 204
const bulkCode = bulkCodeLines.slice(3, -2).join('\n');

fs.appendFileSync('src/logic.ts', '\n' + code + '\n' + bulkCode + '\n');
console.log('Appended successfully');
