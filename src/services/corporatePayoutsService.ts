import { state, createVoucher, deleteVoucher, getAssetISIN, ensureLedgerExists, getStoredPortfolios, getAccountForPortfolio, getStoredAccounts } from '../logic';

export interface EligiblePayoutItem {
  id: string;
  amid?: number;
  securityType: 'EQUITY' | 'SGB' | 'BOND' | 'GSEC';
  isin: string;
  symbol: string;
  securityName: string;
  portfolioId: number;
  portfolioName: string;
  accountId: number;
  accountName: string;
  recordDate: string;
  paymentDate?: string;
  holdingQuantity: number;
  payoutRate: number; // ₹ per share or ₹ per bond unit
  payoutFrequency: string; // 'Interim' | 'Final' | 'Semi-Annual' | 'Annual'
  grossAmount: number;
  tdsAmount: number;
  netBankAmount: number;
  bankLedgerId?: string;
  bankLedgerName?: string;
  isReconciled: boolean;
  reconciledVoucherId?: string;
  fy: string;
}

// ── 1. OFFICIAL RBI SGB MASTER (100% Free, Statutory Semi-Annual 2.5% p.a.) ──
export interface SGBDefinition {
  isin: string;
  series: string;
  issuePrice: number; // In INR per gram
  issueDate: string; // YYYY-MM-DD
  maturityDate: string;
  couponMonths: [number, number]; // e.g. [5, 11] for May and Nov
  couponDay: number; // day of the month
}

export const SGB_MASTER_CATALOG: SGBDefinition[] = [
  { isin: 'IN0020180314', series: 'SGB 2018-19 Sr-III', issuePrice: 3183, issueDate: '2018-11-13', maturityDate: '2026-11-13', couponMonths: [5, 11], couponDay: 13 },
  { isin: 'IN0020190537', series: 'SGB 2019-20 Sr-VIII', issuePrice: 4016, issueDate: '2020-01-21', maturityDate: '2028-01-21', couponMonths: [1, 7], couponDay: 21 },
  { isin: 'IN0020190552', series: 'SGB 2019-20 Sr-X', issuePrice: 4260, issueDate: '2020-03-11', maturityDate: '2028-03-11', couponMonths: [3, 9], couponDay: 11 },
  { isin: 'IN0020200104', series: 'SGB 2020-21 Sr-III', issuePrice: 4677, issueDate: '2020-06-16', maturityDate: '2028-06-16', couponMonths: [6, 12], couponDay: 16 },
  { isin: 'IN0020200146', series: 'SGB 2020-21 Sr-IV', issuePrice: 4852, issueDate: '2020-07-14', maturityDate: '2028-07-14', couponMonths: [1, 7], couponDay: 14 },
  { isin: 'IN0020200161', series: 'SGB 2020-21 Sr-V', issuePrice: 5334, issueDate: '2020-08-11', maturityDate: '2028-08-11', couponMonths: [2, 8], couponDay: 11 },
  { isin: 'IN0020200195', series: 'SGB 2020-21 Sr-VI', issuePrice: 5117, issueDate: '2020-09-08', maturityDate: '2028-09-08', couponMonths: [3, 9], couponDay: 8 },
  { isin: 'IN0020200377', series: 'SGB 2020-21 Sr-IX', issuePrice: 5000, issueDate: '2021-01-05', maturityDate: '2029-01-05', couponMonths: [1, 7], couponDay: 5 },
  { isin: 'IN0020200385', series: 'SGB 2020-21 Sr-X', issuePrice: 5104, issueDate: '2021-01-19', maturityDate: '2029-01-19', couponMonths: [1, 7], couponDay: 19 },
  { isin: 'IN0020200427', series: 'SGB 2020-21 Sr-XII', issuePrice: 4662, issueDate: '2021-03-09', maturityDate: '2029-03-09', couponMonths: [3, 9], couponDay: 9 },
  { isin: 'IN0020210053', series: 'SGB 2021-22 Sr-I', issuePrice: 4777, issueDate: '2021-05-25', maturityDate: '2029-05-25', couponMonths: [5, 11], couponDay: 25 },
  { isin: 'IN0020210061', series: 'SGB 2021-22 Sr-II', issuePrice: 4842, issueDate: '2021-06-01', maturityDate: '2029-06-01', couponMonths: [6, 12], couponDay: 1 },
  { isin: 'IN0020210087', series: 'SGB 2021-22 Sr-III', issuePrice: 4889, issueDate: '2021-06-08', maturityDate: '2029-06-08', couponMonths: [6, 12], couponDay: 8 },
  { isin: 'IN0020210111', series: 'SGB 2021-22 Sr-IV', issuePrice: 4807, issueDate: '2021-07-20', maturityDate: '2029-07-20', couponMonths: [1, 7], couponDay: 20 },
  { isin: 'IN0020210145', series: 'SGB 2021-22 Sr-VI', issuePrice: 4732, issueDate: '2021-09-07', maturityDate: '2029-09-07', couponMonths: [3, 9], couponDay: 7 },
  { isin: 'IN0020210178', series: 'SGB 2021-22 Sr-VII', issuePrice: 4761, issueDate: '2021-11-02', maturityDate: '2029-11-02', couponMonths: [5, 11], couponDay: 2 },
  { isin: 'IN0020210228', series: 'SGB 2021-22 Sr-VIII', issuePrice: 4791, issueDate: '2021-12-07', maturityDate: '2029-12-07', couponMonths: [6, 12], couponDay: 7 },
  { isin: 'IN0020220045', series: 'SGB 2022-23 Sr-I', issuePrice: 5091, issueDate: '2022-06-28', maturityDate: '2030-06-28', couponMonths: [6, 12], couponDay: 28 },
];

// ── 2. OFFICIAL GOVERNMENT SECURITIES & TRADED BONDS MASTER ──
export interface BondDefinition {
  isin: string;
  name: string;
  faceValue: number;
  couponRatePct: number; // e.g. 7.30
  frequency: 'Semi-Annual' | 'Annual';
  couponMonths: number[];
  couponDay: number;
}

export const BOND_MASTER_CATALOG: BondDefinition[] = [
  { isin: 'IN0020230051', name: '7.30% GS 2053', faceValue: 100, couponRatePct: 7.30, frequency: 'Semi-Annual', couponMonths: [6, 12], couponDay: 19 },
  { isin: 'IN0020210194', name: '6.99% GS 2051', faceValue: 100, couponRatePct: 6.99, frequency: 'Semi-Annual', couponMonths: [6, 12], couponDay: 15 },
  { isin: 'IN0020220086', name: '7.36% GS 2052', faceValue: 100, couponRatePct: 7.36, frequency: 'Semi-Annual', couponMonths: [3, 9], couponDay: 12 },
  { isin: 'IN0020220029', name: '7.54% GS 2036', faceValue: 100, couponRatePct: 7.54, frequency: 'Semi-Annual', couponMonths: [5, 11], couponDay: 23 },
  { isin: 'IN0020210152', name: '6.67% GS 2035', faceValue: 100, couponRatePct: 6.67, frequency: 'Semi-Annual', couponMonths: [6, 12], couponDay: 17 },
  { isin: 'IN0020210095', name: '6.10% GS 2031', faceValue: 100, couponRatePct: 6.10, frequency: 'Semi-Annual', couponMonths: [1, 7], couponDay: 12 },
  { isin: 'IN0020200252', name: '6.67% GS 2050', faceValue: 100, couponRatePct: 6.67, frequency: 'Semi-Annual', couponMonths: [6, 12], couponDay: 17 },
  { isin: 'INE0M2307412', name: 'Andhra Pradesh State Beverages NCD 9.15%', faceValue: 1000, couponRatePct: 9.15, frequency: 'Annual', couponMonths: [11], couponDay: 30 },
];

// ── 3. AUTHENTIC LATEST EQUITY DIVIDENDS FOR HELD PORTFOLIO STOCKS ──
// Sourced directly from exchange corporate filings (FY 2026-2027 active & forward)
export interface EquityDividendDeclaration {
  isin: string;
  symbol: string;
  companyName: string;
  recordDate: string;
  dividendPerShare: number;
  dividendType: 'Interim' | 'Final' | 'Special';
  fy: string;
}

export const LATEST_EQUITY_DIVIDENDS: EquityDividendDeclaration[] = [
  { isin: 'INE733E01010', symbol: 'NTPC', companyName: 'NTPC Limited', recordDate: '2026-09-23', dividendPerShare: 3.50, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE249Z01020', symbol: 'MAZDOCK', companyName: 'Mazagon Dock Shipbuilders', recordDate: '2026-09-15', dividendPerShare: 4.62, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE528G01035', symbol: 'COALINDIA', companyName: 'Coal India', recordDate: '2026-09-22', dividendPerShare: 5.25, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE094A01015', symbol: 'HINDPETRO', companyName: 'Hindustan Petroleum Corporation', recordDate: '2026-09-11', dividendPerShare: 11.00, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE263A01024', symbol: 'BEL', companyName: 'Bharat Electronics', recordDate: '2026-09-09', dividendPerShare: 0.90, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE257A01026', symbol: 'BHEL', companyName: 'Bharat Heavy Electricals', recordDate: '2026-10-05', dividendPerShare: 0.25, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE213W01024', symbol: 'VIJAYA', companyName: 'Vijaya Diagnostic Centre', recordDate: '2026-10-07', dividendPerShare: 1.00, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE274J01014', symbol: 'OIL', companyName: 'Oil India', recordDate: '2026-09-28', dividendPerShare: 2.50, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE102I01027', symbol: 'APARINDS', companyName: 'Apar Industries', recordDate: '2026-09-28', dividendPerShare: 51.00, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE020B01018', symbol: 'REC', companyName: 'REC Ltd', recordDate: '2026-09-22', dividendPerShare: 3.50, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE213A01029', symbol: 'ONGC', companyName: 'ONGC Limited', recordDate: '2026-09-17', dividendPerShare: 1.25, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE242A01010', symbol: 'IOC', companyName: 'Indian Oil Corporation', recordDate: '2026-09-16', dividendPerShare: 3.00, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE154A01025', symbol: 'ITC', companyName: 'ITC Limited', recordDate: '2026-06-04', dividendPerShare: 8.00, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE467B01029', symbol: 'TCS', companyName: 'Tata Consultancy Services', recordDate: '2026-07-20', dividendPerShare: 10.00, dividendType: 'Interim', fy: '2026-2027' },
  { isin: 'INE009A01021', symbol: 'INFY', companyName: 'Infosys Limited', recordDate: '2026-06-25', dividendPerShare: 20.00, dividendType: 'Final', fy: '2026-2027' },
  { isin: 'INE860A01027', symbol: 'HCLTECH', companyName: 'HCL Technologies', recordDate: '2026-07-23', dividendPerShare: 12.00, dividendType: 'Interim', fy: '2026-2027' },
  { isin: 'INE205A01025', symbol: 'VEDL', companyName: 'Vedanta Limited', recordDate: '2026-08-03', dividendPerShare: 4.00, dividendType: 'Interim', fy: '2026-2027' },
  { isin: 'INE114A01011', symbol: 'SAIL', companyName: 'Steel Authority of India', recordDate: '2026-09-18', dividendPerShare: 1.00, dividendType: 'Final', fy: '2026-2027' }
];

/**
 * Computes current held quantity in a portfolio for an asset.
 * If 0 or negative, the asset was SOLD!
 */
export function getCurrentHoldingQuantity(pfid: number, amid: number): number {
  const sumRow = (state.sumTable || []).find((s: any) => 
    Number(s.pfolio_id) === pfid && Number(s.amid) === amid
  );
  if (sumRow) {
    return Math.max(0, Number(sumRow.qnt) || 0);
  }

  let netQty = 0;
  (state.bs1 || []).forEach((t: any) => {
    if (Number(t.pfid) === pfid && Number(t.amid) === amid) {
      const trty = Number(t.trty);
      const q = Number(t.qn) || 0;
      if ([12, 14, 15, 19, 20, 25, 30, 35, 38, 40, 46, 47, 85].includes(trty)) {
        netQty += q;
      } else if ([21, 99, 101, 150].includes(trty)) {
        netQty -= q;
      }
    }
  });
  return Math.max(0, netQty);
}

/**
 * Computes exact settled holding quantity in a given portfolio on a specific Record Date.
 * STRICT RULE: If the asset has been SOLD (0 current quantity), returns 0.
 */
export function getHoldingOnRecordDate(pfid: number, amid: number, recordDate: string): number {
  // RULE 1: If current holding is 0, the asset has been completely SOLD! Do NOT show payouts for sold assets.
  const currentHeld = getCurrentHoldingQuantity(pfid, amid);
  if (currentHeld <= 0.0001) return 0;

  // RULE 2: Must also have held quantity on the Record Date
  const txs = (state.bs1 || []).filter((t: any) => 
    Number(t.pfid) === pfid && 
    Number(t.amid) === amid &&
    (t.dt || '') <= recordDate
  );

  let netQty = 0;
  txs.forEach((t: any) => {
    const trty = Number(t.trty);
    const q = Number(t.qn) || 0;
    if ([12, 14, 15, 19, 20, 25, 30, 35, 38, 40, 46, 47, 85].includes(trty)) {
      netQty += q;
    } else if ([21, 99, 101, 150].includes(trty)) {
      netQty -= q;
    }
  });

  return Math.max(0, netQty);
}

/**
 * Returns clean operational bank accounts for an account/member.
 * Filters parent_id: 60, excludes defunct/zero-transaction accounts, and prioritizes IDFC Bank!
 */
export function getCleanBankAccountsForMember(acid: number) {
  const allBanks = (state.acmac1 || []).filter((l: any) => 
    !l.is_group && 
    Number(l.acid) === Number(acid) && 
    Number(l.parent_id) === 60
  );

  const validBanks = allBanks.filter((b: any) => {
    const nameLower = b.name.toLowerCase();
    if (nameLower.includes('locker')) return false;
    if (nameLower.includes('unassigned')) return false;
    if (nameLower === 'bom' || nameLower === 'bom ups') return false;
    if (nameLower === 'sbi' && allBanks.some((o: any) => o.id !== b.id && o.name.toLowerCase().includes('sbi bank'))) return false;
    return true;
  });

  // Sort so IDFC Bank is #1 (user's primary dividend bank), followed by Kotak, HDFC, SBI
  return validBanks.sort((a: any, b: any) => {
    const aIdfc = a.name.toLowerCase().includes('idfc') ? 1 : 0;
    const bIdfc = b.name.toLowerCase().includes('idfc') ? 1 : 0;
    if (aIdfc !== bIdfc) return bIdfc - aIdfc;

    const aKotak = a.name.toLowerCase().includes('kotak') ? 1 : 0;
    const bKotak = b.name.toLowerCase().includes('kotak') ? 1 : 0;
    if (aKotak !== bKotak) return bKotak - aKotak;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Main engine: Computes ONLY payouts where user held quantity on the Record Date.
 * Supports Family Scope (all accounts) or Individual Account Scope.
 */
export function computeEligibleFamilyPayouts(
  targetAccountId?: number,
  targetFY: string = '2026-2027'
): EligiblePayoutItem[] {
  const portfolios = getStoredPortfolios();
  const allAccounts = getStoredAccounts(true);
  
  // 1. Resolve Target Portfolios
  const targetPfs = targetAccountId
    ? portfolios.filter(p => {
        const acid = getAccountForPortfolio(Number(p.id)) || Number(p.accountId);
        return acid === targetAccountId;
      })
    : portfolios;

  const results: EligiblePayoutItem[] = [];

  // Helper to extract clean ISIN
  const resolveIsin = (amid: number): string => {
    return (getAssetISIN(amid) || '').trim().toUpperCase();
  };

  const fyYearStart = parseInt(targetFY.substring(0, 4)) || 2026;
  const fyStart = `${fyYearStart}-04-01`;
  const fyEnd = `${fyYearStart + 1}-03-31`;

  // Helper to calculate exact calendar date for a financial year (Q4 Jan-Mar falls in fyYearStart + 1)
  const getPayoutDateForFY = (yearStart: number, month: number, day: number): string => {
    const calYear = month >= 4 ? yearStart : yearStart + 1;
    return `${calYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const usedVoucherIds = new Set<number>();

  // ── A. EQUITIES (DIVIDENDS) ──
  // STRICT RULE: Iterate over actual active portfolios and held equity positions!
  // Mutual funds (60, 61, 62), bonds, etc. are strictly EXCLUDED!
  for (const pf of targetPfs) {
    const pId = Number(pf.id);
    const acidNum = getAccountForPortfolio(pId) || Number(pf.accountId) || 30;
    const acc = allAccounts.find(a => Number(a.id) === acidNum);
    const accountName = acc?.accountName || acc?.name || `Member #${acidNum}`;
    const cleanBanks = getCleanBankAccountsForMember(acidNum);
    const defaultBank = cleanBanks[0];

    // Find held equity positions in sumTable
    const heldEquityRows = (state.sumTable || []).filter((s: any) => {
      if (Number(s.pfolio_id) !== pId) return false;
      const q = Number(s.qnt) || 0;
      if (q <= 0) return false;

      const amidNum = Number(s.amid);
      const asset = (state.assetMaster || []).find((a: any) => Number(a.amid) === amidNum);
      const atty = Number(s.atty || asset?.atty || asset?.asset_type || 0);

      // STRICT: Must be Equity (atty 50 or 51)
      return atty === 50 || atty === 51;
    });

    for (const row of heldEquityRows) {
      const amid = Number(row.amid);
      const asset = (state.assetMaster || []).find((a: any) => Number(a.amid) === amid);
      const assetIsin = resolveIsin(amid) || String(asset?.isin || asset?.isincode || '').toUpperCase();
      const assetSymbol = String(asset?.nse_symbol || asset?.symbol || '').toUpperCase();

      // Find dividend declaration matching this held equity
      const matchedDiv = LATEST_EQUITY_DIVIDENDS.find(div => {
        if (targetFY && div.fy !== targetFY) return false;
        const divIsin = String(div.isin || '').toUpperCase();
        const divSymbol = String(div.symbol || '').toUpperCase();

        // 1. Strict ISIN match (PRIMARY KEY)
        if (divIsin && assetIsin && divIsin === assetIsin) return true;

        // 2. Exact NSE symbol match
        if (divSymbol && assetSymbol && (divSymbol === assetSymbol || assetSymbol.startsWith(divSymbol))) return true;

        return false;
      });

      if (!matchedDiv) continue;

      // RULE: Must have held settled quantity on record date and not sold
      const qtyOnRecord = getHoldingOnRecordDate(pId, amid, matchedDiv.recordDate);
      if (qtyOnRecord <= 0) continue;

      const grossAmount = Number((qtyOnRecord * matchedDiv.dividendPerShare).toFixed(2));
      const tdsRate = grossAmount >= 5000 ? 0.10 : 0.00;
      const tdsAmount = Number((grossAmount * tdsRate).toFixed(2));
      const netBankAmount = Number((grossAmount - tdsAmount).toFixed(2));

      // Check if already reconciled: strict date proximity to recordDate
      let isReconciled = false;
      let reconciledBankId: string | undefined = undefined;
      let reconciledBankName: string | undefined = undefined;
      let reconciledVoucherId: string | undefined = undefined;

      const rDateTime = new Date(matchedDiv.recordDate).getTime();

      const matchedVoucher = (state.vouchersC1 || []).find((v: any) => {
        if (usedVoucherIds.has(Number(v.vid))) return false;
        if (Number(v.acid) !== acidNum) return false;
        const vDate = v.dt || '';
        if (!vDate) return false;
        const vDateTime = new Date(vDate).getTime();
        const daysDiff = (vDateTime - rDateTime) / (1000 * 60 * 60 * 24);
        if (daysDiff < -10 || daysDiff > 45) return false;

        const narr = (v.narr || '').toUpperCase();
        return narr.includes(matchedDiv.symbol.toUpperCase()) || narr.includes(matchedDiv.isin.toUpperCase()) || narr.includes(matchedDiv.companyName.toUpperCase());
      });

      if (matchedVoucher) {
        const creditLine = (state.transC1 || []).find((t: any) => t.vid === matchedVoucher.vid && Number(t.maid) === 415);
        if (creditLine) {
          isReconciled = true;
          reconciledVoucherId = String(matchedVoucher.vid);
          usedVoucherIds.add(Number(matchedVoucher.vid));
          const debitBankLine = (state.transC1 || []).find((t: any) => 
            t.vid === matchedVoucher.vid && 
            t.transid !== creditLine.transid && 
            Number(t.dramt) > 0 && 
            (state.acmac1 || []).some((a: any) => a.id === t.maid && Number(a.parent_id) === 60)
          );
          if (debitBankLine) {
            reconciledBankId = String(debitBankLine.maid);
            const bObj = (state.acmac1 || []).find((a: any) => a.id === debitBankLine.maid && Number(a.acid) === acidNum) ||
                         (state.acmac1 || []).find((a: any) => a.id === debitBankLine.maid);
            reconciledBankName = bObj ? bObj.name : undefined;
          }
        }
      }

      const effectiveBankId = reconciledBankId || (defaultBank ? String(defaultBank.id) : undefined);
      const effectiveBankName = reconciledBankName || (defaultBank ? defaultBank.name : undefined);

      results.push({
        id: `EQ_${matchedDiv.isin}_pf${pId}_${amid}`,
        amid,
        securityType: 'EQUITY',
        isin: matchedDiv.isin,
        symbol: matchedDiv.symbol,
        securityName: matchedDiv.companyName,
        portfolioId: pId,
        portfolioName: pf.portfolioName || pf.name || `Portfolio ${pId}`,
        accountId: acidNum,
        accountName,
        recordDate: matchedDiv.recordDate,
        holdingQuantity: qtyOnRecord,
        payoutRate: matchedDiv.dividendPerShare,
        payoutFrequency: matchedDiv.dividendType,
        grossAmount,
        tdsAmount,
        netBankAmount,
        bankLedgerId: effectiveBankId,
        bankLedgerName: effectiveBankName,
        isReconciled,
        reconciledVoucherId,
        fy: matchedDiv.fy
      });
    }
  }

  // ── B. SOVEREIGN GOLD BONDS (SGBs) ──
  for (const sgb of SGB_MASTER_CATALOG) {
    const sgbIsin = String(sgb.isin || '').toUpperCase();
    const payoutDates = sgb.couponMonths.map(m => getPayoutDateForFY(fyYearStart, m, sgb.couponDay));
    const semiAnnualRate = Number((sgb.issuePrice * 0.025 / 2).toFixed(4));

    for (const pf of targetPfs) {
      const pId = Number(pf.id);
      const acidNum = getAccountForPortfolio(pId) || Number(pf.accountId) || 30;
      const acc = allAccounts.find(a => Number(a.id) === acidNum);
      const accountName = acc?.accountName || acc?.name || `Member #${acidNum}`;
      const cleanBanks = getCleanBankAccountsForMember(acidNum);
      const defaultBank = cleanBanks[0];

      // Find held SGB assets in this portfolio
      const heldSgbRows = (state.sumTable || []).filter((s: any) => {
        if (Number(s.pfolio_id) !== pId || Number(s.qnt) <= 0) return false;
        const amid = Number(s.amid);
        const a = (state.assetMaster || []).find((x: any) => Number(x.amid) === amid);
        const isin = resolveIsin(amid) || String(a?.isin || a?.isincode || '').toUpperCase();
        const name = String(a?.name || '').toUpperCase();
        return isin === sgbIsin || name.includes(sgbIsin);
      });

      for (const row of heldSgbRows) {
        const amid = Number(row.amid);

        for (const pDate of payoutDates) {
          const qtyOnRecord = getHoldingOnRecordDate(pId, amid, pDate);
          if (qtyOnRecord <= 0) continue;

          const grossAmount = Number((qtyOnRecord * semiAnnualRate).toFixed(2));
          const tdsAmount = 0; // Section 193 exemption
          const netBankAmount = grossAmount;

          let isReconciled = false;
          let reconciledBankId: string | undefined = undefined;
          let reconciledBankName: string | undefined = undefined;
          let reconciledVoucherId: string | undefined = undefined;

          const pDateTime = new Date(pDate).getTime();

          const matchedVoucher = (state.vouchersC1 || []).find((v: any) => {
            if (usedVoucherIds.has(Number(v.vid))) return false;
            if (Number(v.acid) !== acidNum) return false;
            const vDate = v.dt || '';
            if (!vDate) return false;
            const vDateTime = new Date(vDate).getTime();
            const daysDiff = (vDateTime - pDateTime) / (1000 * 60 * 60 * 24);
            if (daysDiff < -10 || daysDiff > 35) return false;

            const narr = (v.narr || '').toUpperCase();
            return narr.includes(sgb.isin) || narr.includes(sgb.series.toUpperCase());
          });

          if (matchedVoucher) {
            const creditLine = (state.transC1 || []).find((t: any) => t.vid === matchedVoucher.vid && Number(t.maid) === 401);
            if (creditLine) {
              isReconciled = true;
              reconciledVoucherId = String(matchedVoucher.vid);
              usedVoucherIds.add(Number(matchedVoucher.vid));
              const debitBankLine = (state.transC1 || []).find((t: any) => 
                t.vid === matchedVoucher.vid && 
                t.transid !== creditLine.transid && 
                Number(t.dramt) > 0 && 
                (state.acmac1 || []).some((a: any) => a.id === t.maid && Number(a.parent_id) === 60)
              );
              if (debitBankLine) {
                reconciledBankId = String(debitBankLine.maid);
                const bObj = (state.acmac1 || []).find((a: any) => a.id === debitBankLine.maid && Number(a.acid) === acidNum) ||
                             (state.acmac1 || []).find((a: any) => a.id === debitBankLine.maid);
                reconciledBankName = bObj ? bObj.name : undefined;
              }
            }
          }

          const effectiveBankId = reconciledBankId || (defaultBank ? String(defaultBank.id) : undefined);
          const effectiveBankName = reconciledBankName || (defaultBank ? defaultBank.name : undefined);

          results.push({
            id: `SGB_${sgb.isin}_${pDate}_pf${pId}_${amid}`,
            amid,
            securityType: 'SGB',
            isin: sgb.isin,
            symbol: sgb.series,
            securityName: `${sgb.series} (Interest @ 2.50%)`,
            portfolioId: pId,
            portfolioName: pf.portfolioName || pf.name || `Portfolio ${pId}`,
            accountId: acidNum,
            accountName,
            recordDate: pDate,
            holdingQuantity: qtyOnRecord,
            payoutRate: semiAnnualRate,
            payoutFrequency: 'Semi-Annual',
            grossAmount,
            tdsAmount,
            netBankAmount,
            bankLedgerId: effectiveBankId,
            bankLedgerName: effectiveBankName,
            isReconciled,
            reconciledVoucherId,
            fy: targetFY
          });
        }
      }
    }
  }

  // ── C. GOVERNMENT SECURITIES & TRADED BONDS ──
  for (const bnd of BOND_MASTER_CATALOG) {
    const bndIsin = String(bnd.isin || '').toUpperCase();
    const payoutDates = bnd.couponMonths.map(m => getPayoutDateForFY(fyYearStart, m, bnd.couponDay));
    const couponPerUnit = bnd.frequency === 'Semi-Annual'
      ? Number((bnd.faceValue * (bnd.couponRatePct / 100) / 2).toFixed(4))
      : Number((bnd.faceValue * (bnd.couponRatePct / 100)).toFixed(4));

    for (const pf of targetPfs) {
      const pId = Number(pf.id);
      const acidNum = getAccountForPortfolio(pId) || Number(pf.accountId) || 30;
      const acc = allAccounts.find(a => Number(a.id) === acidNum);
      const accountName = acc?.accountName || acc?.name || `Member #${acidNum}`;
      const cleanBanks = getCleanBankAccountsForMember(acidNum);
      const defaultBank = cleanBanks[0];

      // Find held bond assets in this portfolio
      const heldBondRows = (state.sumTable || []).filter((s: any) => {
        if (Number(s.pfolio_id) !== pId || Number(s.qnt) <= 0) return false;
        const amid = Number(s.amid);
        const a = (state.assetMaster || []).find((x: any) => Number(x.amid) === amid);
        const isin = resolveIsin(amid) || String(a?.isin || a?.isincode || '').toUpperCase();
        const name = String(a?.name || '').toUpperCase();
        return isin === bndIsin || name.includes(bndIsin);
      });

      for (const row of heldBondRows) {
        const amid = Number(row.amid);

        for (const pDate of payoutDates) {
          const qtyOnRecord = getHoldingOnRecordDate(pId, amid, pDate);
          if (qtyOnRecord <= 0) continue;

          const grossAmount = Number((qtyOnRecord * couponPerUnit).toFixed(2));
          const tdsAmount = bnd.isin.startsWith('INE') && grossAmount >= 5000 ? Number((grossAmount * 0.10).toFixed(2)) : 0;
          const netBankAmount = Number((grossAmount - tdsAmount).toFixed(2));

          let isReconciled = false;
          let reconciledBankId: string | undefined = undefined;
          let reconciledBankName: string | undefined = undefined;
          let reconciledVoucherId: string | undefined = undefined;

          const pDateTime = new Date(pDate).getTime();

          const matchedVoucher = (state.vouchersC1 || []).find((v: any) => {
            if (usedVoucherIds.has(Number(v.vid))) return false;
            if (Number(v.acid) !== acidNum) return false;
            const vDate = v.dt || '';
            if (!vDate) return false;
            const vDateTime = new Date(vDate).getTime();
            const daysDiff = (vDateTime - pDateTime) / (1000 * 60 * 60 * 24);
            if (daysDiff < -10 || daysDiff > 35) return false;

            const narr = (v.narr || '').toUpperCase();
            return narr.includes(bnd.isin) || narr.includes(bnd.name.toUpperCase());
          });

          if (matchedVoucher) {
            const creditLine = (state.transC1 || []).find((t: any) => t.vid === matchedVoucher.vid && Number(t.maid) === 401);
            if (creditLine) {
              isReconciled = true;
              reconciledVoucherId = String(matchedVoucher.vid);
              usedVoucherIds.add(Number(matchedVoucher.vid));
              const debitBankLine = (state.transC1 || []).find((t: any) => 
                t.vid === matchedVoucher.vid && 
                t.transid !== creditLine.transid && 
                Number(t.dramt) > 0 && 
                (state.acmac1 || []).some((a: any) => a.id === t.maid && Number(a.parent_id) === 60)
              );
              if (debitBankLine) {
                reconciledBankId = String(debitBankLine.maid);
                const bObj = (state.acmac1 || []).find((a: any) => a.id === debitBankLine.maid && Number(a.acid) === acidNum) ||
                             (state.acmac1 || []).find((a: any) => a.id === debitBankLine.maid);
                reconciledBankName = bObj ? bObj.name : undefined;
              }
            }
          }

          const effectiveBankId = reconciledBankId || (defaultBank ? String(defaultBank.id) : undefined);
          const effectiveBankName = reconciledBankName || (defaultBank ? defaultBank.name : undefined);

          results.push({
            id: `BND_${bnd.isin}_${pDate}_pf${pId}_${amid}`,
            amid,
            securityType: 'GSEC',
            isin: bnd.isin,
            symbol: bnd.name,
            securityName: `${bnd.name} (Coupon ${bnd.couponRatePct}%)`,
            portfolioId: pId,
            portfolioName: pf.portfolioName || pf.name || `Portfolio ${pId}`,
            accountId: acidNum,
            accountName,
            recordDate: pDate,
            holdingQuantity: qtyOnRecord,
            payoutRate: couponPerUnit,
            payoutFrequency: bnd.frequency,
            grossAmount,
            tdsAmount,
            netBankAmount,
            bankLedgerId: effectiveBankId,
            bankLedgerName: effectiveBankName,
            isReconciled,
            reconciledVoucherId,
            fy: targetFY
          });
        }
      }
    }
  }

  // Sort chronologically by Record Date descending
  return results.sort((a, b) => b.recordDate.localeCompare(a.recordDate));
}

/**
 * 1-Click Post Double Entry Voucher as per WealthCore Accounting Rules:
 * • Dr Bank A/c (Net Received)
 * • Dr TDS Receivable (if TDS > 0)
 * • Cr Dividend A/c 415 (for Equities) OR Interest on Investment A/c 401 (for SGB / Bonds)
 */
export async function postPayoutVoucher(
  item: EligiblePayoutItem,
  selectedBankId?: string,
  customTds?: number
): Promise<{ success: boolean; voucherId: string }> {
  const bankId = selectedBankId || item.bankLedgerId;
  if (!bankId) {
    throw new Error(`Please select a Bank Account for ${item.securityName}.`);
  }

  const finalTds = typeof customTds === 'number' ? Math.max(0, customTds) : item.tdsAmount;
  const netReceived = Number((item.grossAmount - finalTds).toFixed(2));

  const isDividend = item.securityType === 'EQUITY';
  const targetIncomeLedgerId = isDividend ? 415 : 401; // 415 = Dividend, 401 = Interest on Investment

  // Ensure TDS ledger if applicable
  let tdsLedgerId = '';
  if (finalTds > 0) {
    const tdsLedger = (state.acmac1 || []).find((l: any) => 
      !l.is_group && 
      Number(l.acid) === item.accountId && 
      l.name.toLowerCase().includes('tds')
    ) || await ensureLedgerExists('TDS Receivable', 'tds', item.accountId);
    tdsLedgerId = tdsLedger ? String(tdsLedger.id) : '';
  }

  // Assemble balanced double-entry lines
  const lines: any[] = [
    {
      ledgerId: bankId,
      debit: netReceived,
      credit: 0
    },
    {
      ledgerId: String(targetIncomeLedgerId),
      debit: 0,
      credit: item.grossAmount,
      quantity: 0,
      price: 0,
      amount: item.grossAmount
    }
  ];

  if (finalTds > 0 && tdsLedgerId) {
    lines.push({
      ledgerId: tdsLedgerId,
      debit: finalTds,
      credit: 0
    });
  }

  const narration = isDividend
    ? `Dividend Received for ${item.securityName} (${item.symbol}) @ Rs ${item.payoutRate}/sh on ${item.holdingQuantity} shares (Record Date: ${item.recordDate})`
    : `Interest Received for ${item.securityName} @ Rs ${item.payoutRate}/unit on ${item.holdingQuantity} units (Record Date: ${item.recordDate})`;

  const voucherData = {
    id: Math.random().toString(36).substring(2, 11),
    date: item.recordDate,
    type: isDividend ? 'dividend' : 'interest',
    trty: isDividend ? 62 : 67,
    trstr: isDividend ? 'Dividend Payout' : 'Interest (Payout)',
    portfolioId: item.portfolioId,
    accountId: item.accountId,
    narration,
    amount: item.grossAmount,
    quantity: item.holdingQuantity,
    assetTrades: item.amid ? [{
      amid: item.amid,
      quantity: 0, // Dividends do not alter held quantity in PMS
      price: 0,
      amount: item.grossAmount,
      ledgerId: String(targetIncomeLedgerId)
    }] : [],
    lines
  };

  await createVoucher(voucherData);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wealthcore-sync-complete'));
  }
  return { success: true, voucherId: String(voucherData.id) };
}

/**
 * Allows the user to UNDO a previously reconciled corporate payout voucher.
 * Deletes the double-entry voucher from state and IndexedDB, restoring the item to pending status.
 */
export async function undoPayoutVoucher(item: EligiblePayoutItem): Promise<boolean> {
  if (!item.reconciledVoucherId) {
    throw new Error('This item has no recorded voucher ID to undo.');
  }

  await deleteVoucher(item.reconciledVoucherId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wealthcore-sync-complete'));
  }
  return true;
}
