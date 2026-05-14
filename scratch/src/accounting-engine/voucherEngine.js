/** Generate the next voucher number for a given type and financial year */
export function getNextVoucherNo(type, fy, existingVouchers) {
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
export function calculateCapitalGains(assetId, portfolioId, saleDate, salePrice, quantity, taxLots) {
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
        if (remainingQty <= 0)
            break;
        const sellQty = Math.min(remainingQty, lot.quantity);
        const costBasis = sellQty * lot.costPerUnit;
        const gain = (salePrice - lot.costPerUnit) * sellQty;
        const daysHeld = Math.floor((new Date(saleDate).getTime() - new Date(lot.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        totalCostBasis += costBasis;
        remainingQty -= sellQty;
        if (daysHeld > 365) {
            ltcg += gain;
        }
        else {
            stcg += gain;
        }
        if (daysHeld > maxHoldingDays)
            maxHoldingDays = daysHeld;
        // Update lot quantity - in a real implementation this would be persisted
        lot.quantity -= sellQty;
        if (lot.quantity === 0)
            lot.isClosed = true;
    }
    return { stcg, ltcg, holdingPeriodDays: maxHoldingDays, costBasis: totalCostBasis };
}
/**
 * Apply Indian Budget 2024 tax rules to the profit calculated by `calculateCapitalGains`.
 * Returns the taxable amounts for STCG, LTCG and the overall tax liability.
 */
export function applyTaxRules(assetType, holdingPeriodDays, profit) {
    const isEquity = assetType.includes("equity") || assetType.includes("stock") || assetType.includes("mf_equity");
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
        }
        else {
            // STCG: 20%
            stcgAmount = profit * 0.2;
            taxLiability = stcgAmount;
        }
    }
    else {
        // Non-equity assets - simplified slab (30% for demo). Real logic would depend on income slab.
        stcgAmount = profit * 0.3; // STCG
        ltcgAmount = profit * 0.2; // LTCG (simplified)
        taxLiability = isLongTerm ? ltcgAmount : stcgAmount;
    }
    return { stcgAmount, ltcgAmount, taxLiability };
}
