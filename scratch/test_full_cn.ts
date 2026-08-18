import fs from 'fs';
import { initDatabase, getHoldings, getStoredVouchers, getStoredEntries, getStoredLedgers, state } from '../src/logic.ts';

async function testFullCNState() {
  await initDatabase();
  const holdings = getHoldings([3]);
  console.log(`Saahil Inv total holdings count: ${holdings.length}`);
  const stockHoldings = holdings.filter(h => h.assetType === 50);
  console.log(`Stock holdings count: ${stockHoldings.length}`);
}

testFullCNState().catch(console.error);
