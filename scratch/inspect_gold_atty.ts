import { initDatabase, getHoldings, getStoredLedgers, resolveAssetType } from '../src/logic.ts';

async function test() {
  await initDatabase();
  const allHoldings = getHoldings([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  const goldHoldings = allHoldings.filter(h => h.assetName.toLowerCase().includes('gold') || h.assetType === 150 || h.assetType === 151 || h.assetType === 75 || h.assetType === 77);
  console.log('=== Holdings matching Gold / Silver ===');
  goldHoldings.forEach(h => {
    console.log(`amid: ${h.amid}, Name: "${h.assetName}", assetType: ${h.assetType} (${h.assetTypeName}), qty: ${h.quantity}, inv: ${h.amtInvested}, val: ${h.currentValue}`);
  });
}

test().catch(console.error);
