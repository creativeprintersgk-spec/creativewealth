import { state, createVoucher, ensureLedgerExists, getStoredPortfolios } from '../logic';

export interface DividendAnnouncement {
  id: string;
  isin: string;
  symbol: string;
  companyName: string;
  recordDate: string;
  exDate: string;
  dividendPerShare: number; // in INR
  financialYear: string;
  dividendType: 'Interim' | 'Final' | 'Special';
}

export interface DividendReconItem {
  id: string;
  announcementId: string;
  portfolioId: number;
  portfolioName: string;
  accountId: number;
  isin: string;
  symbol: string;
  companyName: string;
  recordDate: string;
  holdingQuantity: number;
  dividendPerShare: number;
  grossAmount: number;
  tdsAmount: number;
  netBankAmount: number;
  bankLedgerId?: string;
  bankLedgerName?: string;
  isReconciled: boolean;
  reconciledVoucherId?: string;
}

// Notable real Indian dividend announcements catalog
export const SAMPLE_DIVIDENDS_CATALOG: DividendAnnouncement[] = [
  {
    id: 'div-tcs-2024-int',
    isin: 'INE467B01029',
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services Ltd',
    recordDate: '2024-10-18',
    exDate: '2024-10-17',
    dividendPerShare: 10.00,
    financialYear: '2024-2025',
    dividendType: 'Interim'
  },
  {
    id: 'div-infy-2024-fin',
    isin: 'INE009A01021',
    symbol: 'INFY',
    companyName: 'Infosys Ltd',
    recordDate: '2024-05-31',
    exDate: '2024-05-31',
    dividendPerShare: 20.00,
    financialYear: '2024-2025',
    dividendType: 'Final'
  },
  {
    id: 'div-itc-2024-fin',
    isin: 'INE154A01025',
    symbol: 'ITC',
    companyName: 'ITC Ltd',
    recordDate: '2024-06-04',
    exDate: '2024-06-04',
    dividendPerShare: 7.50,
    financialYear: '2024-2025',
    dividendType: 'Final'
  },
  {
    id: 'div-hcl-2024-int',
    isin: 'INE860A01027',
    symbol: 'HCLTECH',
    companyName: 'HCL Technologies Ltd',
    recordDate: '2024-07-23',
    exDate: '2024-07-22',
    dividendPerShare: 12.00,
    financialYear: '2024-2025',
    dividendType: 'Interim'
  },
  {
    id: 'div-vedl-2024-int',
    isin: 'INE205A01025',
    symbol: 'VEDL',
    companyName: 'Vedanta Ltd',
    recordDate: '2024-08-03',
    exDate: '2024-08-02',
    dividendPerShare: 4.00,
    financialYear: '2024-2025',
    dividendType: 'Interim'
  }
];

/**
 * Computes expected dividends across portfolios by matching held securities on record dates.
 */
export function computeExpectedDividends(
  selectedPortfolioId?: number,
  selectedFY?: string
): DividendReconItem[] {
  const allPortfolios = getStoredPortfolios();
  const targetPfs = selectedPortfolioId
    ? allPortfolios.filter(p => Number(p.id) === selectedPortfolioId)
    : allPortfolios;

  const results: DividendReconItem[] = [];

  for (const div of SAMPLE_DIVIDENDS_CATALOG) {
    if (selectedFY && div.financialYear !== selectedFY) continue;

    // Find all matching amids for this stock
    const matchingAmids = new Set<number>();
    state.assetMaster.forEach((a: any) => {
      if ((a.isin && a.isin.toUpperCase() === div.isin.toUpperCase()) ||
          (a.nse_symbol && a.nse_symbol.toUpperCase() === div.symbol.toUpperCase())) {
        matchingAmids.add(Number(a.amid));
      }
    });
    state.sam.forEach((s: any) => {
      if ((s.isin && s.isin.toUpperCase() === div.isin.toUpperCase()) ||
          (s.anm && s.anm.toUpperCase().includes(div.symbol.toUpperCase()))) {
        matchingAmids.add(Number(s.amid));
      }
    });

    if (matchingAmids.size === 0) continue;

    for (const pf of targetPfs) {
      const pId = Number(pf.id);
      const acidNum = Number(pf.accountId) || 31;

      for (const amid of Array.from(matchingAmids)) {
        // Query holdings on or before record date
        const txs = state.bs1.filter((t: any) => 
          Number(t.pfid) === pId && 
          Number(t.amid) === amid &&
          (t.dt || '') <= div.recordDate
        );

        let qtyOnRecord = 0;
        txs.forEach((t: any) => {
          const trty = Number(t.trty);
          const q = Number(t.qn) || 0;
          if ([12, 15, 19, 20, 25, 30, 35, 38, 40, 46, 47].includes(trty)) {
            qtyOnRecord += q;
          } else if ([99, 101, 150].includes(trty)) {
            qtyOnRecord -= q;
          }
        });

        if (qtyOnRecord <= 0) continue;

        const grossAmount = Number((qtyOnRecord * div.dividendPerShare).toFixed(2));
        // Default TDS in India: 10% if gross dividend exceeds ₹5,000 for a company in a FY
        const tdsRate = grossAmount >= 5000 ? 0.10 : 0.00;
        const tdsAmount = Number((grossAmount * tdsRate).toFixed(2));
        const netBankAmount = Number((grossAmount - tdsAmount).toFixed(2));

        // Auto-find a primary bank account ledger for this client
        const bankLedger = state.acmac1.find((l: any) => 
          !l.is_group && 
          l.acid === acidNum && 
          (l.parent_id === 60 || l.name.toLowerCase().includes('bank'))
        );

        // Check if already reconciled in bs1 (trty=62) or vouchers
        const existingTx = state.bs1.find((t: any) => 
          Number(t.pfid) === pId && 
          Number(t.amid) === amid &&
          Number(t.trty) === 62 &&
          Math.abs((new Date(t.dt || '').getTime() - new Date(div.recordDate).getTime()) / 86400000) <= 30
        );

        results.push({
          id: `${div.id}_pf${pId}_${amid}`,
          announcementId: div.id,
          portfolioId: pId,
          portfolioName: pf.portfolioName || pf.name || `Portfolio ${pId}`,
          accountId: acidNum,
          isin: div.isin,
          symbol: div.symbol,
          companyName: div.companyName,
          recordDate: div.recordDate,
          holdingQuantity: qtyOnRecord,
          dividendPerShare: div.dividendPerShare,
          grossAmount,
          tdsAmount,
          netBankAmount,
          bankLedgerId: bankLedger ? String(bankLedger.id) : undefined,
          bankLedgerName: bankLedger ? bankLedger.name : undefined,
          isReconciled: !!existingTx,
          reconciledVoucherId: existingTx ? String(existingTx.acvch || existingTx.trid) : undefined
        });
      }
    }
  }

  return results;
}

/**
 * 1-Click post dividend double-entry voucher:
 * Dr Bank (net received)
 * Dr TDS (if applicable)
 * Cr Dividend Income (gross dividend)
 */
export async function postDividendVoucher(
  item: DividendReconItem,
  selectedBankId?: string,
  customTds?: number
): Promise<{ success: boolean; voucherId: string }> {
  const bankId = selectedBankId || item.bankLedgerId;
  if (!bankId) {
    throw new Error(`No Bank Ledger specified for ${item.portfolioName}. Please select a bank account.`);
  }

  const finalTds = typeof customTds === 'number' ? customTds : item.tdsAmount;
  const netReceived = Number((item.grossAmount - finalTds).toFixed(2));

  // 1. Ensure Dividend Income ledger (Group 415 / Income) exists
  const divIncomeLedger = state.acmac1.find((l: any) => 
    !l.is_group && 
    l.acid === item.accountId && 
    (l.name.toLowerCase().includes('dividend') || l.parent_id === 160 || l.id === 415)
  ) || await ensureLedgerExists('Dividend Income', 'dividend', item.accountId);

  if (!divIncomeLedger) {
    throw new Error('Could not find or create Dividend Income ledger');
  }

  // 2. Resolve TDS ledger if needed
  let tdsLedgerId = "";
  if (finalTds > 0) {
    const tdsLedger = state.acmac1.find((l: any) => 
      !l.is_group && 
      l.acid === item.accountId && 
      l.name.toLowerCase().includes('tds')
    ) || await ensureLedgerExists('TDS Receivable', 'tds', item.accountId);
    tdsLedgerId = tdsLedger ? String(tdsLedger.id) : "";
  }

  // 3. Assemble balanced double-entry lines:
  // Dr Bank, Dr TDS, Cr Dividend Income
  const lines: any[] = [
    {
      ledgerId: bankId,
      debit: netReceived,
      credit: 0
    },
    {
      ledgerId: String(divIncomeLedger.id),
      debit: 0,
      credit: item.grossAmount
    }
  ];

  if (finalTds > 0 && tdsLedgerId) {
    lines.push({
      ledgerId: tdsLedgerId,
      debit: finalTds,
      credit: 0
    });
  }

  // Find amid for the security
  const matchedAsset = state.assetMaster.find((a: any) => a.isin === item.isin);
  const amid = matchedAsset?.amid || undefined;

  const voucherData = {
    id: Math.random().toString(36).substring(2, 11),
    date: item.recordDate,
    type: 'dividend',
    portfolioId: item.portfolioId,
    accountId: item.accountId,
    narration: `Dividend Received from ${item.companyName} (${item.symbol}) @ Rs ${item.dividendPerShare}/sh on ${item.holdingQuantity} shares`,
    amount: item.grossAmount,
    quantity: item.holdingQuantity,
    assetId: amid,
    lines
  };

  await createVoucher(voucherData);
  return { success: true, voucherId: String(voucherData.id) };
}
