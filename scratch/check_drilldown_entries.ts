import { initDatabase, getStoredEntries, getStoredVouchers, getStoredPortfolios } from '../src/logic.ts';

async function run() {
  await initDatabase();

  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  const allPortfolios = getStoredPortfolios();
  const prameshId = '30';
  const portfolioIds = allPortfolios.filter(p => p.accountId === prameshId).map(p => p.id);

  // Replicate getLedgerWithBalance filtering
  const lid = 48;
  const acidNum = 30;

  // Let's filter like getLedgerWithBalance does:
  // e.maid === lid && e.acid === acidNum
  const rawEntries = entries.filter((e: any) => Number(e.ledgerId) === lid && (!acidNum || Number(e.accountId) === acidNum));
  console.log(`getLedgerWithBalance entries count: ${rawEntries.length}`);

  // Let's see how many are before 2025-04-01
  const beforeEntries = rawEntries.filter(e => e.date < '2025-04-01');
  const inRangeEntries = rawEntries.filter(e => e.date >= '2025-04-01' && e.date <= '2026-03-31');
  const afterEntries = rawEntries.filter(e => e.date > '2026-03-31');

  console.log(`Before: ${beforeEntries.length}`);
  console.log(`InRange: ${inRangeEntries.length}`);
  console.log(`After: ${afterEntries.length}`);

  let beforeDr = 0, beforeCr = 0;
  beforeEntries.forEach(e => {
    beforeDr += e.debit || 0;
    beforeCr += e.credit || 0;
  });
  console.log(`Before: DR=${beforeDr}, CR=${beforeCr}, Net=${beforeDr - beforeCr}`);

  let inRangeDr = 0, inRangeCr = 0;
  inRangeEntries.forEach(e => {
    inRangeDr += e.debit || 0;
    inRangeCr += e.credit || 0;
  });
  console.log(`InRange: DR=${inRangeDr}, CR=${inRangeCr}, Net=${inRangeDr - inRangeCr}`);

  // Let's print out the total Net of all entries
  let totalDr = 0, totalCr = 0;
  rawEntries.forEach(e => {
    totalDr += e.debit || 0;
    totalCr += e.credit || 0;
  });
  console.log(`Total Net: DR=${totalDr}, CR=${totalCr}, Net=${totalDr - totalCr}`);
}

run().catch(console.error);
