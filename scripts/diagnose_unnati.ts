import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function diagnose() {
  const [acmac1Res, vouchers1Res, vouchersC1Res, trans1Res, transC1Res, pflinkRes, samRes] = await Promise.all([
    sb.from('acmac1').select('*'),
    sb.from('vouchers1').select('*'),
    sb.from('vouchersc1').select('*'),
    sb.from('trans1').select('*'),
    sb.from('transc1').select('*'),
    sb.from('acc_pflink').select('*'),
    sb.from('sam').select('*')
  ]);

  const acmac1 = acmac1Res.data || [];
  const vouchers1 = vouchers1Res.data || [];
  const vouchersC1 = vouchersC1Res.data || [];
  const trans1 = trans1Res.data || [];
  const transC1 = transC1Res.data || [];
  const accPflink = pflinkRes.data || [];
  const sam = samRes.data || [];

  console.log(`Loaded: acmac1=${acmac1.length}, vouchers1=${vouchers1.length}, vouchersC1=${vouchersC1.length}, trans1=${trans1.length}, transC1=${transC1.length}`);

  const acid = '29';
  const endDate = '2026-03-31';

  const groups = acmac1.filter((a: any) => a.is_group && String(a.acid) === acid).map((a: any) => ({
    id: String(a.id),
    name: a.name,
    parent: a.parent_id ? String(a.parent_id) : undefined,
    specialTypeId: a.special_type_id
  }));

  const ledgers = acmac1.filter((a: any) => !a.is_group && String(a.acid) === acid).map((a: any) => ({
    id: String(a.id),
    name: a.name,
    groupId: String(a.parent_id),
    openingBalance: Math.abs(Number(a.db_bal || 0) - Number(a.cr_bal || 0)),
    openingType: Number(a.db_bal || 0) >= Number(a.cr_bal || 0) ? 'DR' : 'CR'
  }));

  const voucherMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { voucherMap[`c_${v.vid}`] = { ...v, _src: 'c' }; });
  vouchers1.forEach((v: any) => { voucherMap[`t_${v.vid}`] = { ...v, _src: 't' }; });

  const portfolioIds = accPflink.filter((l: any) => String(l.acid) === acid).map((l: any) => l.pfid);
  console.log('Portfolio IDs for Unnati:', portfolioIds);

  const entries: any[] = [
    ...transC1.map((e: any) => ({ ...e, voucherId: `c_${e.vid}`, ledgerId: String(e.maid) })),
    ...trans1.map((e: any) => ({ ...e, voucherId: `t_${e.vid}`, ledgerId: String(e.maid) }))
  ];

  // Helper to get group type
  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.specialTypeId === 250 || current.specialTypeId === 275 || current.id === '1' || current.id === '64' || current.id === '65') return 'LIABILITY';
      if (current.specialTypeId === 150 || current.id === '2' || current.id === '45' || current.id === '50' || current.id === '55' || current.id === '60') return 'ASSET';
      if (current.id === '155' || current.id === '180') return 'INCOME';
      if (current.id === '160' || current.id === '170' || current.id === '171' || current.id === '175') return 'EXPENSE';
      current = groups.find((g: any) => g.id === current.parent);
    }
    return 'ASSET';
  };

  const calcLedgerBal = (ledgerId: string, groupType: string): number => {
    let debit = 0;
    let credit = 0;
    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(ledgerId)) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.dt || v?.dt;
        const entryAcid = e.acid !== null && e.acid !== undefined ? String(e.acid) : (v?.acid !== null && v?.acid !== undefined ? String(v.acid) : undefined);
        const entryPfid = v?.pfid || e.pfid;

        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        if (!isOpeningBalance && entryDate > endDate) return;

        const belongsToAccount =
          (entryAcid === acid) ||
          (entryPfid && portfolioIds.includes(Number(entryPfid)));
        if (!belongsToAccount) return;

        debit += Number(e.dramt) || 0;
        credit += Number(e.cramt) || 0;
      }
    });
    return groupType === 'ASSET' ? debit - credit : credit - debit;
  };

  console.log('\n--- CALCULATING BALANCES FOR UNNATI SHAH (acid 29) ---');
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const l of ledgers) {
    const grpType = getGroupType(l.groupId);
    const bal = calcLedgerBal(l.id, grpType);
    if (Math.abs(bal) > 0.01) {
      console.log(`[${grpType}] Ledger "${l.name}" (ID: ${l.id}, Parent: ${l.groupId}): ₹${bal.toFixed(2)}`);
      if (grpType === 'ASSET') totalAssets += bal;
      if (grpType === 'LIABILITY') totalLiabilities += bal;
    }
  }

  // Also check entries with ledgerId not in acmac1 ledgers (e.g. security AMID ledgers)
  const seenLids = new Set(ledgers.map(l => String(l.id)));
  const assetLedgerBals: Record<string, number> = {};
  entries.forEach((e: any) => {
    if (!seenLids.has(String(e.ledgerId))) {
      const v = voucherMap[e.voucherId];
      const entryDate = e.dt || v?.dt;
      const entryAcid = e.acid !== null && e.acid !== undefined ? String(e.acid) : (v?.acid !== null && v?.acid !== undefined ? String(v.acid) : undefined);
      const entryPfid = v?.pfid || e.pfid;
      if (entryDate && entryDate > endDate) return;
      const belongs = (entryAcid === acid) || (entryPfid && portfolioIds.includes(Number(entryPfid)));
      if (belongs) {
        const dr = Number(e.dramt) || 0;
        const cr = Number(e.cramt) || 0;
        assetLedgerBals[e.ledgerId] = (assetLedgerBals[e.ledgerId] || 0) + (dr - cr);
      }
    }
  });

  console.log('\n--- SECURITY / AMID LEDGERS (not in acmac1) ---');
  let secTotal = 0;
  for (const [lid, bal] of Object.entries(assetLedgerBals)) {
    if (Math.abs(bal) > 0.01) {
      const s = sam.find((x: any) => String(x.amid) === lid);
      console.log(`Security "${s?.anm || 'Unknown'}" (AMID: ${lid}): ₹${bal.toFixed(2)}`);
      secTotal += bal;
    }
  }
  console.log(`Total security ledger balance: ₹${secTotal.toFixed(2)}`);

  console.log('\n--- SUMMARY ---');
  console.log(`Total Assets: ₹${totalAssets.toFixed(2)} + Securities ₹${secTotal.toFixed(2)} = ₹${(totalAssets + secTotal).toFixed(2)}`);
  console.log(`Total Liabilities: ₹${totalLiabilities.toFixed(2)}`);
  console.log(`Difference: ₹${(totalAssets + secTotal - totalLiabilities).toFixed(2)}`);
}

diagnose();
