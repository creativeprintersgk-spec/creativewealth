import type { VoucherType } from "./voucherValidation";

/**
 * Represents a tax lot for FIFO/LIFO/HIFO calculations.
 * Each purchase transaction should create a TaxLot entry.
 * When a portion of the lot is sold, the lot quantity is reduced.
 * When the lot is fully sold, it can be marked as closed.
 */
export interface TaxLot {
  id: string;
  transactionId: string; // Voucher ID that created the lot (buy transaction)
  portfolioId: string;
  assetId: string; // Ledger ID representing the asset
  purchaseDate: string; // ISO date string
  quantity: number; // Remaining quantity in the lot
  costPerUnit: number; // Cost per unit (including charges)
  costTotal: number; // quantity * costPerUnit
  // Optional sale fields - filled when the lot (or part of it) is sold
  saleDate?: string;
  salePrice?: number;
  saleProceeds?: number;
  gain?: number;
  isClosed?: boolean;
}

/** Generate the next voucher number for a given type and financial year */
export function getNextVoucherNo(
  type: VoucherType,
  fy: string,
  existingVouchers: { id: string; type: string; fy?: string; date: string }[]
): string {
  const prefix = {
    receipt: "RCPT",
    payment: "PAY",
    journal: "JRN",
    contra: "CON",
  }[type] || "VCH";

  const vouchersInFY = existingVouchers.filter((v) => {
    // Use FY from voucher if present, otherwise derive from date
    const vFY = v.fy || (() => {
      const d = new Date(v.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    })();
    return v.type === type && vFY === fy;
  });

  const nextNum = vouchersInFY.length + 1;
  return `${prefix}-${nextNum.toString().padStart(4, "0")}`;
}

/**
 * Calculate capital gains for a sale of a particular asset in a portfolio.
 * Implements FIFO by default - iterate tax lots ordered by purchase date.
 * Returns Short-Term CG, Long-Term CG, holding period (max days among lots used) and total cost basis.
 */
export function calculateCapitalGains(
  assetId: string,
  portfolioId: string,
  saleDate: string,
  salePrice: number,
  quantity: number,
  taxLots: TaxLot[]
): { stcg: number; ltcg: number; holdingPeriodDays: number; costBasis: number } {
  // Filter relevant, open lots and sort by purchase date (FIFO)
  const sortedLots = taxLots
    .filter((lot) => lot.assetId === assetId && lot.portfolioId === portfolioId && !lot.isClosed)
    .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

  let remainingQty = quantity;
  let totalCostBasis = 0;
  let stcg = 0;
  let ltcg = 0;
  let maxHoldingDays = 0;

  for (const lot of sortedLots) {
    if (remainingQty <= 0) break;
    const sellQty = Math.min(remainingQty, lot.quantity);
    const costBasis = sellQty * lot.costPerUnit;
    const gain = (salePrice - lot.costPerUnit) * sellQty;
    const daysHeld = Math.floor(
      (new Date(saleDate).getTime() - new Date(lot.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    totalCostBasis += costBasis;
    remainingQty -= sellQty;
    if (daysHeld > 365) {
      ltcg += gain;
    } else {
      stcg += gain;
    }
    if (daysHeld > maxHoldingDays) maxHoldingDays = daysHeld;
    // Update lot quantity - in a real implementation this would be persisted
    lot.quantity -= sellQty;
    if (lot.quantity === 0) lot.isClosed = true;
  }

  return { stcg, ltcg, holdingPeriodDays: maxHoldingDays, costBasis: totalCostBasis };
}

/**
 * Apply Indian Budget 2024 tax rules to the profit calculated by `calculateCapitalGains`.
 * Returns the taxable amounts for STCG, LTCG and the overall tax liability.
 */
export function applyTaxRules(
  assetType: string,
  holdingPeriodDays: number,
  profit: number
): { stcgAmount: number; ltcgAmount: number; taxLiability: number } {
  const isEquity =
    assetType.includes("equity") || assetType.includes("stock") || assetType.includes("mf_equity");
  const isLongTerm = holdingPeriodDays > 365; // 12 months

  let stcgAmount = 0;
  let ltcgAmount = 0;
  let taxLiability = 0;

  if (profit <= 0) {
    return { stcgAmount: 0, ltcgAmount: 0, taxLiability: 0 };
  }

  if (isEquity) {
    if (isLongTerm) {
      // LTCG: 12.5% above 1.25L exemption
      const exemption = 125000;
      const taxableLTCG = Math.max(0, profit - exemption);
      ltcgAmount = taxableLTCG * 0.125;
      taxLiability = ltcgAmount;
    } else {
      // STCG: 20%
      stcgAmount = profit * 0.2;
      taxLiability = stcgAmount;
    }
  } else {
    // Non-equity assets - simplified slab (30% for demo). Real logic would depend on income slab.
    stcgAmount = profit * 0.3; // STCG
    ltcgAmount = profit * 0.2; // LTCG (simplified)
    taxLiability = isLongTerm ? ltcgAmount : stcgAmount;
  }

  return { stcgAmount, ltcgAmount, taxLiability };
}