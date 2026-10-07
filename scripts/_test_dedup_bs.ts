import { initDatabase, state, getStoredLedgers, getStoredGroups, getStoredEntries, getStoredVouchers, getStoredPortfolios } from '../src/logic.ts';

// Test what happens when we dedup ledgers properly
async function run() {
  await initDatabase();
  const accountId = '29';
  const endDate = '2026-03-31';

  // 1. Get ledgers for this account
  const accountLedgers = getStoredLedgers(accountId);
  const seenLids = new Set<string>();
  const ledgersToInclude: any[] = [];

  accountLedgers.forEach((l: any) => {
    const lidStr = String(l.id);
    if (!seenLids.has(lidStr)) {
      seenLids.add(lidStr);
      ledgersToInclude.push(l);
    }
  });

  console.log(`Deduplicated account ledgers for ${accountId}: ${ledgersToInclude.length}`);
  const dh = ledgersToInclude.filter(l => l.name.includes("Dharampur"));
  console.log("Dharampur count in ledgersToInclude:", dh.length);
  const jw = ledgersToInclude.filter(l => l.name.includes("Jewellery"));
  console.log("Jewellery count in ledgersToInclude:", jw.length);
}
run();
