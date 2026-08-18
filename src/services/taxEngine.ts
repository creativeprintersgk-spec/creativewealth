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

  // 8. Default: Listed Equity Shares
  return 'LISTED_EQUITY_SHARE';
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

  // Acquired BEFORE 23-July-2024: Taxpayer's Statutory Choice (Pick Lower of Option A or Option B)
  const ciiBuy = getCII(purchaseDate);
  const ciiSale = getCII(saleDate);
  const indexedCost = cost * (ciiSale / ciiBuy);
  const indexedGain = proceeds - indexedCost;
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

    case 'EQUITY_ORIENTED_MF':
      return listed_365_logic(cost, proceeds, purchaseDate, saleDate, 20, 12.5, true);

    case 'LISTED_EQUITY_SHARE':
      return listed_365_logic(cost, proceeds, purchaseDate, saleDate, 20, 12.5, true);

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

    default:
      return listed_365_logic(cost, proceeds, purchaseDate, saleDate, 20, 12.5, false);
  }
}
