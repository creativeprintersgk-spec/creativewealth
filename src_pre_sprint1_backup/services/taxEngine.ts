// FinVault / WealthCore — Master Capital Gains Tax Engine
// Updated as per Income Tax Act: Finance Act 2023 (Sec 50AA) & Budget 2024 / Finance Act 2024
// Rules effective for transfers on/after 23-July-2024 & Sec 50AA definition

export type FinVaultAssetCategory =
  | 'LISTED_EQUITY_SHARE'
  | 'EQUITY_ORIENTED_MF'
  | 'LISTED_BOND_NCD'
  | 'GOLD_SILVER_ETF_LISTED'
  | 'UNLISTED_SHARE'
  | 'REAL_ESTATE'
  | 'DEBT_MF_SPECIFIED'
  | 'GOLD_SILVER_FOF_OR_HYBRID_LT65_OR_INTL_MF';

export interface TaxResult {
  gainType: 'Intraday' | 'STCG' | 'LTCG';
  taxRate: number | 'slab';
  holdingDays: number;
  costBasis: number;
  saleProceeds: number;
  gainLoss: number;
  indexationUsed: boolean;
  estimatedTax: number;
  notes?: string;
  realEstateComparison?: {
    optionA_IndexedCost: number;
    optionA_Gain: number;
    optionA_Tax: number;
    optionB_UnindexedCost: number;
    optionB_Gain: number;
    optionB_Tax: number;
    chosenOption: 'Option A (20% with Indexation)' | 'Option B (12.5% without Indexation)';
  };
}

// ─── Cost Inflation Index (CII) ──────────────────────────────────────────────
export const CII_TABLE: Record<number, number> = {
  2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117,
  2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167,
  2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254,
  2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301,
  2021: 317, 2022: 331, 2023: 348, 2024: 363, 2025: 377
};

export function getCII(dateStr: string): number {
  if (!dateStr) return 363;
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11. April is 3
  const fyYear = month >= 3 ? year : year - 1;
  const clampedYear = Math.max(2001, Math.min(2025, fyYear));
  return CII_TABLE[clampedYear] || 363;
}

// ─── Category Classifier ─────────────────────────────────────────────────────
export function classifyAssetCategory(
  atyid: number,
  assetName: string
): FinVaultAssetCategory {
  const cleanName = (assetName || '').toLowerCase().trim();

  // 1. Real Estate (Land & Building)
  if (atyid === 160 || /\b(property|real estate|residential flat|commercial office|plot|land|apartment)\b/i.test(cleanName)) {
    return 'REAL_ESTATE';
  }

  // 2. Listed Gold / Silver / Metal ETFs (Exchange traded)
  if ((atyid === 51 || atyid === 61 || atyid === 75 || atyid === 150 || atyid === 151) &&
      /silver|gold|commodity|metal/i.test(cleanName) &&
      /etf|bees/i.test(cleanName) &&
      !/fof|fund of fund/i.test(cleanName)) {
    return 'GOLD_SILVER_ETF_LISTED';
  }

  // 3. Gold/Silver FoF, Multi-Asset <65% equity, International/Overseas Feeder Funds (Unlisted)
  if (atyid === 75 ||
      ((atyid === 61 || atyid === 62 || atyid === 200) &&
       (/fof|fund of fund|multi asset|international|overseas|feeder|pan european|greater china|nasdaq|us tech/i.test(cleanName)) &&
       !/etf|bees/i.test(cleanName))) {
    return 'GOLD_SILVER_FOF_OR_HYBRID_LT65_OR_INTL_MF';
  }

  // 4. True Debt Mutual Funds (>=65% debt & money market - Sec 50AA)
  const isPureDebt = (
    /\b(liquid|liquidity|overnight|money\s*market|gilt|treasury)\b/i.test(cleanName) ||
    /\b(ultra\s*short|low\s*duration|short\s*duration|short\s*term\s*(debt|bond)?|medium\s*duration|medium\s*term|long\s*duration)\b/i.test(cleanName) ||
    /\b(corporate\s*bond|credit\s*risk|banking\s*(&|and)\s*psu|dynamic\s*bond|floater|floating\s*rate)\b/i.test(cleanName) ||
    /\b(debt\s*hybrid|conservative\s*hybrid|regular\s*savings\s*fund|monthly\s*income\s*plan|mip)\b/i.test(cleanName) ||
    /\b(target\s*maturity|sdl\s*fund|bharat\s*bond|fixed\s*maturity|fmp|interval\s*fund)\b/i.test(cleanName)
  );
  if ((atyid === 61 || atyid === 62 || atyid === 150) && isPureDebt) {
    return 'DEBT_MF_SPECIFIED';
  }

  // 5. Equity-Oriented Mutual Funds (>=65% domestic equity)
  if (atyid === 60 || /\b(contra|flexi|multi\s*cap|large\s*cap|mid\s*cap|small\s*cap|elss|index\s*fund|arbitrage|equity)\b/i.test(cleanName)) {
    return 'EQUITY_ORIENTED_MF';
  }

  // 6. Listed Bonds / NCDs / SGBs
  if (atyid === 40 || atyid === 100 || atyid === 110 || /sovereign gold bond|sgb|ncd|debenture|tax free bond/i.test(cleanName)) {
    return 'LISTED_BOND_NCD';
  }

  // 7. Unlisted Shares
  if (atyid === 190 || atyid === 210 || /unlisted|private limited|esop/i.test(cleanName)) {
    return 'UNLISTED_SHARE';
  }

  // 7.5. Safety net: NO structured equity-allocation/SEBI-category field exists
  // anywhere in asset_master today (only the coarse atyid code), so classification
  // for mutual funds ultimately depends on scheme-name pattern matching above.
  // If a fund is already tagged atyid 61/62 (debt/hybrid, per the import source --
  // see ATYID_TO_CG_CLASS in capitalGainsEngine.ts) but its name didn't match any
  // pattern in step 4, it must NOT be allowed to fall through to the step-8
  // default below. That default (LISTED_EQUITY_SHARE) is meant for individually
  // held shares, not fund units, and previously any unmatched debt/hybrid fund
  // silently got equity's lower rate + Sec 112A exemption instead of the
  // mandatory Sec 50AA slab-rate treatment -- a materially wrong tax outcome
  // driven purely by an AMC's naming convention not matching our regex list.
  // TODO: the durable fix is a `sebi_category` / `equity_allocation_pct` column
  // on asset_master, populated from AMFI scheme master data, used as the PRIMARY
  // signal ahead of any name matching. Until that exists, defaulting an
  // unmatched debt/hybrid-coded fund to DEBT_MF_SPECIFIED errs toward the
  // higher-tax outcome rather than silently under-taxing it.
  if (atyid === 61 || atyid === 62) {
    return 'DEBT_MF_SPECIFIED';
  }

  // 8. Default: Listed Equity Shares
  return 'LISTED_EQUITY_SHARE';
}

// ─── Budget 2024 rate-change cutoff (23-Jul-2024) ────────────────────────────
// STCG on equity/equity-oriented-MF (Sec 111A) went 15% -> 20%, LTCG (Sec 112A)
// went 10% -> 12.5%, and the Sec 112A pooled exemption went ₹1L -> ₹1.25L, all
// effective for TRANSFERS (i.e. the sale date) on/after 23-Jul-2024. A flat
// 20%/12.5% applied to every sale regardless of date would overstate tax on
// any equity sale in Apr-Jul 2024 (and understate the exemption available to it).
const BUDGET_2024_CUTOFF = '2024-07-23';

export function getEquityRates(saleDate: string): { stcgRate: number; ltcgRate: number; exemptionLimit: number } {
  if (saleDate && saleDate < BUDGET_2024_CUTOFF) {
    return { stcgRate: 15, ltcgRate: 10, exemptionLimit: 100000 };
  }
  return { stcgRate: 20, ltcgRate: 12.5, exemptionLimit: 125000 };
}

// ─── Sub-logic 3a: Listed Instruments (365-day threshold) ────────────────────
export function listed_365_logic(
  cost: number,
  proceeds: number,
  purchaseDate: string,
  saleDate: string,
  rateSt: number | 'slab',
  rateLt: number,
  exemption112A: boolean = false
): TaxResult {
  const holdingDays = purchaseDate && saleDate
    ? Math.floor((new Date(saleDate).getTime() - new Date(purchaseDate).getTime()) / 86400000)
    : 0;

  const isLT = holdingDays > 365;
  const gain = proceeds - cost;

  if (!isLT) {
    const rateNum = typeof rateSt === 'number' ? rateSt : 30;
    return {
      gainType: 'STCG',
      taxRate: rateSt,
      holdingDays,
      costBasis: cost,
      saleProceeds: proceeds,
      gainLoss: gain,
      indexationUsed: false,
      estimatedTax: gain > 0 ? gain * (rateNum / 100) : 0
    };
  }

  // LTCG: 12.5% flat without indexation
  return {
    gainType: 'LTCG',
    taxRate: rateLt,
    holdingDays,
    costBasis: cost,
    saleProceeds: proceeds,
    gainLoss: gain,
    indexationUsed: false,
    estimatedTax: gain > 0 ? gain * (rateLt / 100) : 0,
    notes: exemption112A ? 'Eligible for Sec 112A ₹1.25L pooled FY exemption' : undefined
  };
}

// ─── Sub-logic 3b: Unlisted Instruments (730-day threshold) ──────────────────
export function unlisted_730_logic(
  cost: number,
  proceeds: number,
  purchaseDate: string,
  saleDate: string
): TaxResult {
  const holdingDays = purchaseDate && saleDate
    ? Math.floor((new Date(saleDate).getTime() - new Date(purchaseDate).getTime()) / 86400000)
    : 0;

  const isLT = holdingDays > 730;
  const gain = proceeds - cost;

  if (!isLT) {
    return {
      gainType: 'STCG',
      taxRate: 'slab',
      holdingDays,
      costBasis: cost,
      saleProceeds: proceeds,
      gainLoss: gain,
      indexationUsed: false,
      estimatedTax: gain > 0 ? gain * 0.30 : 0
    };
  }

  // LTCG: 12.5% flat without indexation
  return {
    gainType: 'LTCG',
    taxRate: 12.5,
    holdingDays,
    costBasis: cost,
    saleProceeds: proceeds,
    gainLoss: gain,
    indexationUsed: false,
    estimatedTax: gain > 0 ? gain * 0.125 : 0
  };
}

// ─── Sub-logic 3c: Debt Funds (Sec 50AA Specified Mutual Fund) ────────────────
export function debt_specified_mf_logic(
  cost: number,
  proceeds: number,
  purchaseDate: string,
  saleDate: string
): TaxResult {
  const holdingDays = purchaseDate && saleDate
    ? Math.floor((new Date(saleDate).getTime() - new Date(purchaseDate).getTime()) / 86400000)
    : 0;
  const gain = proceeds - cost;

  // Post Finance Act 2023: Acquired on or after 01/04/2023 -> NO LTCG EVER
  if (purchaseDate >= '2023-04-01') {
    return {
      gainType: 'STCG',
      taxRate: 'slab',
      holdingDays,
      costBasis: cost,
      saleProceeds: proceeds,
      gainLoss: gain,
      indexationUsed: false,
      estimatedTax: gain > 0 ? gain * 0.30 : 0,
      notes: 'Sec 50AA: Always STCG at slab rate (Acquired on/after 01-Apr-2023)'
    };
  }

  // Grandfathered Pre-01/04/2023 units: Old 36-month (1095 days) regime
  if (holdingDays <= 1095) {
    return {
      gainType: 'STCG',
      taxRate: 'slab',
      holdingDays,
      costBasis: cost,
      saleProceeds: proceeds,
      gainLoss: gain,
      indexationUsed: false,
      estimatedTax: gain > 0 ? gain * 0.30 : 0,
      notes: 'Grandfathered Debt Fund: Held <= 36 months'
    };
  }

  // Grandfathered LTCG: 20% with indexation
  const ciiBuy = getCII(purchaseDate);
  const ciiSale = getCII(saleDate);
  const indexedCost = cost * (ciiSale / ciiBuy);
  const indexedGain = proceeds - indexedCost;

  return {
    gainType: 'LTCG',
    taxRate: 20,
    holdingDays,
    costBasis: indexedCost,
    saleProceeds: proceeds,
    gainLoss: indexedGain,
    indexationUsed: true,
    estimatedTax: indexedGain > 0 ? indexedGain * 0.20 : 0,
    notes: 'Grandfathered Debt Fund: Held > 36 months, 20% with CII indexation'
  };
}

// ─── Sub-logic 3d: Real Estate (Transitional Dual-Rate Choice) ────────────────
export function real_estate_logic(
  cost: number,
  proceeds: number,
  purchaseDate: string,
  saleDate: string
): TaxResult {
  const holdingDays = purchaseDate && saleDate
    ? Math.floor((new Date(saleDate).getTime() - new Date(purchaseDate).getTime()) / 86400000)
    : 0;

  if (holdingDays <= 730) {
    const gain = proceeds - cost;
    return {
      gainType: 'STCG',
      taxRate: 'slab',
      holdingDays,
      costBasis: cost,
      saleProceeds: proceeds,
      gainLoss: gain,
      indexationUsed: false,
      estimatedTax: gain > 0 ? gain * 0.30 : 0,
      notes: 'Real Estate: Held <= 24 months (STCG at slab rate)'
    };
  }

  // Acquired on or after 23-July-2024: Flat 12.5% only (No indexation option)
  if (purchaseDate >= '2024-07-23') {
    const gain = proceeds - cost;
    return {
      gainType: 'LTCG',
      taxRate: 12.5,
      holdingDays,
      costBasis: cost,
      saleProceeds: proceeds,
      gainLoss: gain,
      indexationUsed: false,
      estimatedTax: gain > 0 ? gain * 0.125 : 0,
      notes: 'Real Estate: Acquired on/after 23-Jul-2024 (12.5% without indexation)'
    };
  }

  // Acquired BEFORE 23-July-2024.
  const ciiBuy = getCII(purchaseDate);
  const ciiSale = getCII(saleDate);
  const indexedCost = cost * (ciiSale / ciiBuy);
  const indexedGain = proceeds - indexedCost;

  // If ALSO sold before 23-July-2024, the Budget 2024 12.5%-no-indexation
  // option did not exist in law on the date of this transfer — old law applies
  // plainly (20% with indexation), not as a "choose the lower" comparison.
  if (saleDate < '2024-07-23') {
    return {
      gainType: 'LTCG',
      taxRate: 20,
      holdingDays,
      costBasis: indexedCost,
      saleProceeds: proceeds,
      gainLoss: indexedGain,
      indexationUsed: true,
      estimatedTax: indexedGain > 0 ? indexedGain * 0.20 : 0,
      notes: 'Real Estate: Sold before 23-Jul-2024 (pre-Budget 2024) — 20% with indexation; the 12.5% no-indexation option was not yet available for this transfer date'
    };
  }

  // Acquired before 23-Jul-2024, SOLD on/after 23-Jul-2024: Taxpayer's Statutory Choice (Pick Lower of Option A or Option B)
  const taxA = indexedGain > 0 ? indexedGain * 0.20 : 0;

  const unindexedGain = proceeds - cost;
  const taxB = unindexedGain > 0 ? unindexedGain * 0.125 : 0;

  const pickOptionA = taxA < taxB;

  return {
    gainType: 'LTCG',
    taxRate: pickOptionA ? 20 : 12.5,
    holdingDays,
    costBasis: pickOptionA ? indexedCost : cost,
    saleProceeds: proceeds,
    gainLoss: pickOptionA ? indexedGain : unindexedGain,
    indexationUsed: pickOptionA,
    estimatedTax: Math.min(taxA, taxB),
    notes: `Real Estate Grandfathered Choice: Lower tax selected (${pickOptionA ? 'Option A: 20% with indexation' : 'Option B: 12.5% flat'})`,
    realEstateComparison: {
      optionA_IndexedCost: indexedCost,
      optionA_Gain: indexedGain,
      optionA_Tax: taxA,
      optionB_UnindexedCost: cost,
      optionB_Gain: unindexedGain,
      optionB_Tax: taxB,
      chosenOption: pickOptionA ? 'Option A (20% with Indexation)' : 'Option B (12.5% without Indexation)'
    }
  };
}

// ─── Master Engine Dispatcher ────────────────────────────────────────────────
export function computeAssetTax(
  atyid: number,
  assetName: string,
  cost: number,
  proceeds: number,
  purchaseDate: string,
  saleDate: string
): TaxResult {
  const category = classifyAssetCategory(atyid, assetName);

  switch (category) {
    case 'DEBT_MF_SPECIFIED':
      return debt_specified_mf_logic(cost, proceeds, purchaseDate, saleDate);

    case 'EQUITY_ORIENTED_MF': {
      const { stcgRate, ltcgRate, exemptionLimit } = getEquityRates(saleDate);
      const res = listed_365_logic(cost, proceeds, purchaseDate, saleDate, stcgRate, ltcgRate, true);
      if (res.gainType === 'LTCG') res.notes = `Eligible for Sec 112A pooled FY exemption (limit for this transfer date: ₹${exemptionLimit.toLocaleString('en-IN')})`;
      return res;
    }

    case 'LISTED_EQUITY_SHARE': {
      const { stcgRate, ltcgRate, exemptionLimit } = getEquityRates(saleDate);
      const res = listed_365_logic(cost, proceeds, purchaseDate, saleDate, stcgRate, ltcgRate, true);
      if (res.gainType === 'LTCG') res.notes = `Eligible for Sec 112A pooled FY exemption (limit for this transfer date: ₹${exemptionLimit.toLocaleString('en-IN')})`;
      return res;
    }

    case 'LISTED_BOND_NCD':
      return listed_365_logic(cost, proceeds, purchaseDate, saleDate, 'slab', 12.5, false);

    case 'GOLD_SILVER_ETF_LISTED':
      return listed_365_logic(cost, proceeds, purchaseDate, saleDate, 'slab', 12.5, false);

    case 'UNLISTED_SHARE':
      return unlisted_730_logic(cost, proceeds, purchaseDate, saleDate);

    case 'REAL_ESTATE':
      return real_estate_logic(cost, proceeds, purchaseDate, saleDate);

    case 'GOLD_SILVER_FOF_OR_HYBRID_LT65_OR_INTL_MF':
      return unlisted_730_logic(cost, proceeds, purchaseDate, saleDate);

    default: {
      const { stcgRate, ltcgRate } = getEquityRates(saleDate);
      return listed_365_logic(cost, proceeds, purchaseDate, saleDate, stcgRate, ltcgRate, false);
    }
  }
}

// ─── Section 112A pooled ₹1.25L (₹1L pre-23-Jul-2024) FY exemption ───────────
// Previously, listed_365_logic only wrote a *note* saying a row was "eligible"
// for the Sec 112A exemption -- estimatedTax was never actually reduced by it,
// so every equity/equity-MF LTCG estimate was overstated by the exemption
// amount. This function nets the exemption against the FY's pooled LTCG total
// per portfolio, then reduces each row's estimatedTax proportionally.
//
// ASSUMPTION (law does not explicitly mandate an ordering): the exemption is
// consumed against the EARLIEST sales in the FY first (chronological, by
// sellDate). This is a common, defensible convention, not a certainty -- if
// your CA/tax filing software uses a different ordering, the FY total exemption
// used and total tax will still match; only which individual trades show as
// "exempted" vs "taxed" could differ.
//
// Call this ONCE on the full results array from getCapitalGains(), after all
// rows have been generated, so every downstream consumer (reports, summaries)
// sees already-corrected tax figures.
export function applySection112AExemption(results: any[]): any[] {
  const getFY = (dateStr: string): string => {
    if (!dateStr) return 'unknown';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-11, April = 3
    const fyStartYear = m >= 3 ? y : y - 1;
    return `${fyStartYear}-${fyStartYear + 1}`;
  };

  // Group eligible rows (Sec 112A LTCG only) by portfolioId + FY
  const groups: Record<string, any[]> = {};
  results.forEach(r => {
    if (r.gainType !== 'LTCG' || typeof r.notes !== 'string' || !r.notes.includes('Sec 112A')) return;
    const key = `${r.portfolioId}_${getFY(r.sellDate)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  Object.values(groups).forEach(rows => {
    // Exemption limit for the FY: if ANY sale in this FY+portfolio group falls
    // before 23-Jul-2024, that portion is only eligible for the old ₹1L limit;
    // CBDT clarified the transition-year (FY2024-25) limit is a single pooled
    // ₹1.25L for the whole FY, so we use ₹1.25L whenever any post-cutoff sale
    // exists in the group, else ₹1L for a FY entirely before the cutoff.
    const anyPostCutoff = rows.some(r => r.sellDate >= '2024-07-23');
    const exemptionLimit = anyPostCutoff ? 125000 : 100000;

    let exemptionRemaining = exemptionLimit;
    rows
      .slice()
      .sort((a, b) => (a.sellDate || '').localeCompare(b.sellDate || ''))
      .forEach(r => {
        const gain = Number(r.gainLoss) || 0;
        if (gain <= 0) return; // losses don't consume exemption and aren't taxed
        const exempted = Math.min(exemptionRemaining, gain);
        exemptionRemaining -= exempted;
        const taxableGain = gain - exempted;
        const rate = typeof r.taxRate === 'number' ? r.taxRate : 0;
        r.estimatedTax = taxableGain > 0 ? taxableGain * (rate / 100) : 0;
        r.notes = exempted > 0
          ? `${(r.notes || '').replace(/Eligible for Sec 112A.*/, '').trim()} ₹${exempted.toLocaleString('en-IN')} of this gain covered by Sec 112A FY exemption (limit ₹${exemptionLimit.toLocaleString('en-IN')}).`.trim()
          : r.notes;
      });
  });

  return results;
}
