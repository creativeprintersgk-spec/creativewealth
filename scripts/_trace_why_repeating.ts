import { initDatabase, state, getStoredLedgers, getStoredGroups, getStoredEntries, getStoredVouchers, getStoredPortfolios } from '../src/logic.ts';

async function run() {
  await initDatabase();
  const accountId = '29';
  const endDate = '2026-03-31';

  const groups = getStoredGroups(accountId);
  const myLedgers = getStoredLedgers(accountId);
  console.log("myLedgers count for 29:", myLedgers.length);
  const dhInMy = myLedgers.filter((l: any) => l.name.includes("Dharampur"));
  console.log("Dharampur in myLedgers:", dhInMy);

  const allLedgers = [
    ...getStoredLedgers(accountId),
    ...(state.acmac1 || [])
      .filter((a: any) => !a.is_group && a.acid === -1)
      .map((a: any) => ({
        id: String(a.id),
        name: a.name,
        groupId: String(a.parent_id),
        openingBalance: 0,
        acid: -1
      }))
  ];
  console.log("allLedgers count:", allLedgers.length);

  // Now check how many times Dharampur is in ledgersToInclude:
  const seenLids = new Set<string>();
  const ledgersToInclude: any[] = [];
  allLedgers.forEach((l: any) => {
    // Look at this: does seenLids check before pushing?
    // In balanceSheet.ts:
    // seenLids.add(String(l.id));
    // ledgersToInclude.push(l);
    ledgersToInclude.push(l);
  });

  const dhInInc = ledgersToInclude.filter((l: any) => l.name.includes("Dharampur"));
  console.log("Dharampur in ledgersToInclude before entries:", dhInInc.length);

  // Now check entries:
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => voucherMap[v.id] = v);

  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    if (entryDate <= endDate && entryAcid === accountId) {
      // Look at line 238 of balanceSheet.ts
    }
  });

  // Now check why in the browser Dharampur is repeated 7 times!
  // In the browser, what is accountId?
  console.log("state.acmac1 total rows:", state.acmac1.length);
  const allDh = state.acmac1.filter((a: any) => a.name === "Dharampur House Deposit");
  console.log("All Dharampur rows in state.acmac1:", allDh.map((a: any) => ({ id: a.id, acid: a.acid, db: a.db_bal, cr: a.cr_bal })));
}
run();
