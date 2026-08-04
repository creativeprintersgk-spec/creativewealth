import { initDatabase, getStoredEntries, getStoredVouchers, getStoredPortfolios } from '../src/logic.ts';

async function run() {
  await initDatabase();

  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  const allPortfolios = getStoredPortfolios();
  const prameshId = '30';
  const portfolioIds = allPortfolios.filter(p => p.accountId === prameshId).map(p => p.id);

  console.log(`Pramesh Portfolio IDs:`, portfolioIds);

  const kotakEntries = entries.filter(e => e.ledgerId === '48');
  console.log(`Total Kotak Entries: ${kotakEntries.length}`);

  // Count acids of Kotak entries
  const acidCounts: Record<string, number> = {};
  kotakEntries.forEach(e => {
    const acid = e.accountId || 'undefined';
    acidCounts[acid] = (acidCounts[acid] || 0) + 1;
  });
  console.log('Kotak Entries by accountId (e.accountId):', acidCounts);

  // Count against portfolios
  const pfCounts: Record<string, number> = {};
  kotakEntries.forEach(e => {
    const v = vouchers.find(v => v.id === e.voucherId);
    const pfid = v?.portfolioId || 'undefined';
    pfCounts[pfid] = (pfCounts[pfid] || 0) + 1;
  });
  console.log('Kotak Entries by portfolioId (v.portfolioId):', pfCounts);

  // Let's check how many entries match:
  // 1. (e.accountId === '30')
  // 2. (e.accountId === '30' || portfolioIds.includes(v.portfolioId))
  let countDirect = 0;
  let countWithPort = 0;
  kotakEntries.forEach(e => {
    const v = vouchers.find(v => v.id === e.voucherId);
    const vAcid = v?.accountId;
    const vPfid = v?.portfolioId;

    const belongsDirect = (e.accountId === prameshId) || (vAcid === prameshId);
    const belongsWithPort = belongsDirect || (vPfid && portfolioIds.includes(vPfid));

    if (belongsDirect) countDirect++;
    if (belongsWithPort) countWithPort++;
  });

  console.log(`Belongs Direct: ${countDirect}`);
  console.log(`Belongs with Portfolios: ${countWithPort}`);
}

run().catch(console.error);
