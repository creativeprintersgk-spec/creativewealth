import { supabase } from '../src/supabase';

async function fetchAll(table: string) {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(page * size, (page + 1) * size - 1);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function main() {
  console.log("Analyzing Unnati Shah's ledger balances and hierarchy...");

  const [acmac1, groupsData, transc1, trans1, vouchersc1, vouchers1, portfolios, accPflink] = await Promise.all([
    fetchAll('acmac1'),
    fetchAll('groups'), // New schema groups table
    fetchAll('transc1'),
    fetchAll('trans1'),
    fetchAll('vouchersc1'),
    fetchAll('vouchers1'),
    fetchAll('portfolios'),
    fetchAll('acc_pflink')
  ]);

  const accountId = 29; // Unnati Shah

  // 1. Get portfolios
  const portfolioIds = accPflink
    .filter((link: any) => Number(link.acid) === accountId)
    .map((link: any) => Number(link.pfid));

  // 2. Filter vouchers
  const unnatiVidsC1 = new Set(
    vouchersc1
      .filter((v: any) => Number(v.acid) === accountId || (v.pfid && portfolioIds.includes(Number(v.pfid))))
      .map((v: any) => Number(v.vid))
  );

  const unnatiVids1 = new Set(
    vouchers1
      .filter((v: any) => Number(v.acid) === accountId || (v.pfid && portfolioIds.includes(Number(v.pfid))))
      .map((v: any) => Number(v.vid))
  );

  // 3. Filter entries
  const unnatiTrans = [
    ...transc1.filter((e: any) => Number(e.acid) === accountId || unnatiVidsC1.has(Number(e.vid))),
    ...trans1.filter((e: any) => Number(e.acid) === accountId || unnatiVids1.has(Number(e.vid)))
  ];

  // 4. Group groups
  // ACMAC1 is used for groups and ledgers.
  // In WealthCore, let's see how groups are retrieved.
  // In services/balanceSheet.ts:
  //   const groups = getStoredGroups(accountId)
  //   const ledgers = getStoredLedgers(accountId)
  // Let's see what getStoredGroups returns.
  // In logic.ts:
  //   getStoredGroups(acid) returns state.acmac1.filter(a => a.is_group && (!acidNum || a.acid === acidNum))
  const groups = acmac1.filter((a: any) => a.is_group && (!a.acid || Number(a.acid) === accountId));
  const ledgers = acmac1.filter((a: any) => !a.is_group && (!a.acid || Number(a.acid) === accountId));

  const groupMap = new Map<number, any>();
  acmac1.forEach((a: any) => {
    groupMap.set(Number(a.id), a);
  });

  const getGroupType = (groupId: number): string => {
    let current = groupMap.get(groupId);
    while (current) {
      const st = Number(current.special_type_id);
      if ([150, 40, 50, 125].includes(st)) return 'ASSET';
      if ([250, 275, 276].includes(st)) return 'LIABILITY';
      if (st === 280) return 'INCOME';
      if (st === 290) return 'EXPENSE';
      current = current.parent_id ? groupMap.get(Number(current.parent_id)) : null;
    }
    return 'UNKNOWN';
  };

  // 5. Calculate balances by ledger ID
  const ledgerBals = new Map<number, { dr: number, cr: number }>();
  unnatiTrans.forEach((e: any) => {
    const maid = Number(e.maid);
    if (!ledgerBals.has(maid)) ledgerBals.set(maid, { dr: 0, cr: 0 });
    const b = ledgerBals.get(maid)!;
    b.dr += Number(e.dramt) || 0;
    b.cr += Number(e.cramt) || 0;
  });

  // Calculate totals by type
  let drTotal = 0, crTotal = 0;
  let typeTotals = {
    ASSET: 0,
    LIABILITY: 0,
    INCOME: 0,
    EXPENSE: 0,
    UNKNOWN: 0
  };

  const ledgerDetails: any[] = [];
  ledgerBals.forEach((b, maid) => {
    const l = groupMap.get(maid);
    const parentId = l ? Number(l.parent_id) : 0;
    const type = getGroupType(parentId);
    const balance = b.dr - b.cr;

    drTotal += b.dr;
    crTotal += b.cr;

    if (type === 'ASSET') typeTotals.ASSET += balance;
    else if (type === 'LIABILITY') typeTotals.LIABILITY += (b.cr - b.dr); // Cr - Dr
    else if (type === 'INCOME') typeTotals.INCOME += (b.cr - b.dr); // Cr - Dr
    else if (type === 'EXPENSE') typeTotals.EXPENSE += balance; // Dr - Cr
    else typeTotals.UNKNOWN += balance;

    ledgerDetails.push({
      maid,
      name: l ? l.name : 'Unknown Ledger',
      parentName: groupMap.get(parentId)?.name || 'Unknown Group',
      parentId,
      type,
      dr: b.dr,
      cr: b.cr,
      bal: balance
    });
  });

  console.log(`\n--- Type Totals (Asset: Dr-Cr, Liability: Cr-Dr, Income: Cr-Dr, Expense: Dr-Cr) ---`);
  console.log(`ASSET:      ${typeTotals.ASSET.toFixed(2)}`);
  console.log(`LIABILITY:  ${typeTotals.LIABILITY.toFixed(2)}`);
  console.log(`INCOME:     ${typeTotals.INCOME.toFixed(2)}`);
  console.log(`EXPENSE:    ${typeTotals.EXPENSE.toFixed(2)}`);
  console.log(`UNKNOWN:    ${typeTotals.UNKNOWN.toFixed(2)}`);

  console.log(`\n--- Combined Math ---`);
  const le = typeTotals.LIABILITY + (typeTotals.INCOME - typeTotals.EXPENSE);
  console.log(`Total Assets: ${typeTotals.ASSET.toFixed(2)}`);
  console.log(`Total Liabilities + Equity (L + I - E): ${le.toFixed(2)}`);
  console.log(`Balance Sheet Difference: ${(typeTotals.ASSET - le).toFixed(2)}`);

  if (Math.abs(typeTotals.UNKNOWN) > 0.01) {
    console.log(`\n--- Ledgers with UNKNOWN Group Type ---`);
    ledgerDetails
      .filter(l => l.type === 'UNKNOWN')
      .forEach(l => {
        console.log(`Ledger ${l.name} (maid=${l.maid}, parent=${l.parentName}, parent_id=${l.parentId}): dr=${l.dr.toFixed(2)}, cr=${l.cr.toFixed(2)}, bal=${l.bal.toFixed(2)}`);
      });
  }
}

main().catch(console.error);
