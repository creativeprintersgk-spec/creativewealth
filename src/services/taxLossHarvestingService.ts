import {
  state,
  buildAssetFifoLedger,
  getCapitalGains,
  getAssetName,
  getAssetISIN,
  resolveAssetType,
  expandPortfolioFamily,
  ASSET_TYPE_MAP
} from '../logic';

export interface HarvestLot {
  trid?: number;
  pfid: number;
  portfolioName: string;
  amid: number;
  assetName: string;
  isin: string;
  assetType: number;
  assetTypeName: string;
  buyDate: string;
  holdingDays: number;
  term: 'STCL' | 'LTCL';
  remainingQty: number;
  costPerUnit: number;
  currentPrice: number;
  investedVal: number;
  currentVal: number;
  unrealizedLoss: number;
  lossPct: number;
  taxRate: number; // 20% for STCL (Sec 111A), 12.5% for LTCL (Sec 112A)
  potentialTaxSaving: number;
}

export interface HarvestAssetSummary {
  amid: number;
  assetName: string;
  isin: string;
  pfid: number;
  portfolioName: string;
  assetTypeName: string;
  totalHarvestableQty: number;
  avgCost: number;
  currentPrice: number;
  investedVal: number;
  currentVal: number;
  totalLoss: number;
  stclLoss: number;
  ltclLoss: number;
  estimatedTaxSavings: number;
  lots: HarvestLot[];
}

export interface TaxHarvestingOverview {
  // Current FY Realized Capital Gains
  realizedSTCG: number;
  realizedLTCG: number;
  realizedSTCL: number;
  realizedLTCL: number;
  netRealizedSTCG: number;
  netRealizedLTCG: number;
  currentTaxLiability: number;

  // Harvestable Losses
  totalHarvestableLoss: number;
  harvestableSTCL: number;
  harvestableLTCL: number;

  // Potential Tax Savings
  immediateTaxSavings: number;
  carryForwardTaxSavings: number;
  totalTaxSavings: number;

  // Actionable lists
  assets: HarvestAssetSummary[];
  lots: HarvestLot[];
}

/**
 * Scans open FIFO delivery lots across the specified portfolio(s)
 * and compares them with current market prices to identify tax-loss harvesting opportunities.
 */
export function getTaxLossHarvestingData(
  portfolioIds: (number | string)[],
  asOfDate?: string,
  fyStart?: string,
  fyEnd?: string
): TaxHarvestingOverview {
  const today = asOfDate || new Date().toISOString().slice(0, 10);
  const curYear = new Date(today).getFullYear();
  const curMonth = new Date(today).getMonth() + 1;
  const defFyStart = fyStart || (curMonth >= 4 ? `${curYear}-04-01` : `${curYear - 1}-04-01`);
  const defFyEnd = fyEnd || (curMonth >= 4 ? `${curYear + 1}-03-31` : `${curYear}-03-31`);

  const expandedIds = expandPortfolioFamily(portfolioIds);
  const pSet = new Set<number>(expandedIds);

  // 1. Group BS1 transactions by (pfid, amid, sid) for open lot processing
  const allTx = (state.bs1 || [])
    .filter((t: any) => {
      if (!pSet.has(Number(t.pfid))) return false;
      const atyid = Number(t.atyid);
      // Exclude Derivatives / F&O
      if ([30, 80, 81, 82, 83].includes(atyid)) return false;
      return true;
    })
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

  const txByAsset: Record<string, any[]> = {};
  allTx.forEach((t: any) => {
    const isMf = t.atyid === 60 || t.atyid === 61 || t.atyid === 62;
    const sidKey = (isMf && t.sid) ? `_${t.sid}` : '';
    const key = `${t.pfid}_${t.amid}${sidKey}`;
    if (!txByAsset[key]) txByAsset[key] = [];
    txByAsset[key].push(t);
  });

  const openLossLots: HarvestLot[] = [];

  // 2. Compute FIFO open lots for each asset
  Object.values(txByAsset).forEach(txList => {
    const { openLots } = buildAssetFifoLedger(txList, '0001-01-01', today, new Map(), {});

    for (const lot of openLots) {
      if (!lot || lot.remaining <= 0.0001) continue;

      const amid = Number(lot.amid);
      const pfid = Number(lot.pfid);
      const priceObj = state.priceMap[amid] || { curr: 0, prev: 0 };
      const currentPrice = priceObj.curr || 0;

      // Only evaluate if we have a valid market price and it is less than cost basis
      if (currentPrice > 0 && currentPrice < lot.costPerUnit - 0.001) {
        const lossPerUnit = lot.costPerUnit - currentPrice;
        const totalLoss = lossPerUnit * lot.remaining;
        const investedVal = lot.costPerUnit * lot.remaining;
        const currentVal = currentPrice * lot.remaining;
        const lossPct = investedVal > 0 ? (totalLoss / investedVal) * 100 : 0;

        const buyDate = (lot.date || '').slice(0, 10);
        const dBuy = new Date(buyDate).getTime();
        const dToday = new Date(today).getTime();
        const holdingDays = Math.max(0, Math.floor((dToday - dBuy) / (1000 * 60 * 60 * 24)));

        // Listed equity holding period threshold = 365 days (12 months)
        const term: 'STCL' | 'LTCL' = holdingDays < 365 ? 'STCL' : 'LTCL';
        // Under Budget 2024: STCG taxed at 20% (Sec 111A), LTCG at 12.5% (Sec 112A)
        const taxRate = term === 'STCL' ? 20 : 12.5;
        const potentialTaxSaving = (totalLoss * taxRate) / 100;

        const port = (state.portfolios || []).find((p: any) => p.id === pfid);
        const resolvedAty = resolveAssetType(pfid, amid, lot.atyid || 50);

        openLossLots.push({
          trid: lot.trid,
          pfid,
          portfolioName: port?.investor_name || `Portfolio ${pfid}`,
          amid,
          assetName: getAssetName(amid),
          isin: getAssetISIN(amid),
          assetType: resolvedAty,
          assetTypeName: ASSET_TYPE_MAP[resolvedAty] || 'Stocks',
          buyDate,
          holdingDays,
          term,
          remainingQty: lot.remaining,
          costPerUnit: lot.costPerUnit,
          currentPrice,
          investedVal,
          currentVal,
          unrealizedLoss: totalLoss,
          lossPct,
          taxRate,
          potentialTaxSaving
        });
      }
    }
  });

  // Sort lots by highest potential loss first
  openLossLots.sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);

  // 3. Aggregate lots by asset & portfolio
  const assetMap: Record<string, HarvestAssetSummary> = {};
  openLossLots.forEach(lot => {
    const key = `${lot.pfid}_${lot.amid}`;
    if (!assetMap[key]) {
      assetMap[key] = {
        amid: lot.amid,
        assetName: lot.assetName,
        isin: lot.isin,
        pfid: lot.pfid,
        portfolioName: lot.portfolioName,
        assetTypeName: lot.assetTypeName,
        totalHarvestableQty: 0,
        avgCost: 0,
        currentPrice: lot.currentPrice,
        investedVal: 0,
        currentVal: 0,
        totalLoss: 0,
        stclLoss: 0,
        ltclLoss: 0,
        estimatedTaxSavings: 0,
        lots: []
      };
    }
    const summary = assetMap[key];
    summary.totalHarvestableQty += lot.remainingQty;
    summary.investedVal += lot.investedVal;
    summary.currentVal += lot.currentVal;
    summary.totalLoss += lot.unrealizedLoss;
    if (lot.term === 'STCL') {
      summary.stclLoss += lot.unrealizedLoss;
    } else {
      summary.ltclLoss += lot.unrealizedLoss;
    }
    summary.estimatedTaxSavings += lot.potentialTaxSaving;
    summary.lots.push(lot);
  });

  const assetSummaries = Object.values(assetMap).map(a => {
    a.avgCost = a.totalHarvestableQty > 0 ? a.investedVal / a.totalHarvestableQty : 0;
    return a;
  }).sort((a, b) => b.totalLoss - a.totalLoss);

  // 4. Query current FY realized capital gains
  const realizedRows = getCapitalGains(expandedIds, defFyStart, defFyEnd) || [];
  let realizedSTCG = 0;
  let realizedLTCG = 0;
  let realizedSTCL = 0;
  let realizedLTCL = 0;

  realizedRows.forEach((r: any) => {
    const gl = Number(r.gainLoss) || 0;
    const isST = r.gainType === 'STCG' || r.gainType === 'Intraday';
    const isLT = r.gainType === 'LTCG';

    if (isST) {
      if (gl > 0) realizedSTCG += gl;
      else realizedSTCL += Math.abs(gl);
    } else if (isLT) {
      if (gl > 0) realizedLTCG += gl;
      else realizedLTCL += Math.abs(gl);
    }
  });

  const netRealizedSTCG = Math.max(0, realizedSTCG - realizedSTCL);
  const netRealizedLTCG = Math.max(0, realizedLTCG - realizedLTCL);

  // Sec 112A annual exemption: ₹1,25,000 for FY 2024-25+
  const taxableLTCG = Math.max(0, netRealizedLTCG - 125000);
  const currentTaxLiability = (netRealizedSTCG * 0.20) + (taxableLTCG * 0.125);

  // 5. Harvestable totals
  let harvestableSTCL = 0;
  let harvestableLTCL = 0;
  openLossLots.forEach(l => {
    if (l.term === 'STCL') harvestableSTCL += l.unrealizedLoss;
    else harvestableLTCL += l.unrealizedLoss;
  });
  const totalHarvestableLoss = harvestableSTCL + harvestableLTCL;

  // 6. Tax offset calculations
  // STCL can offset both STCG (20%) and LTCG (12.5%).
  // Prioritize offsetting STCG first (20% saving), then taxable LTCG (12.5% saving).
  let remainingSTCL = harvestableSTCL;
  let remainingNetSTCG = netRealizedSTCG;
  let remainingTaxableLTCG = taxableLTCG;

  const stclToStcg = Math.min(remainingSTCL, remainingNetSTCG);
  remainingSTCL -= stclToStcg;
  remainingNetSTCG -= stclToStcg;

  // LTCL can only offset LTCG. Apply LTCL against remaining taxable LTCG first:
  let remainingLTCL = harvestableLTCL;
  const ltclToLtcg = Math.min(remainingLTCL, remainingTaxableLTCG);
  remainingLTCL -= ltclToLtcg;
  remainingTaxableLTCG -= ltclToLtcg;

  // Remaining STCL can also offset any remaining taxable LTCG:
  const stclToLtcg = Math.min(remainingSTCL, remainingTaxableLTCG);
  remainingSTCL -= stclToLtcg;
  remainingTaxableLTCG -= stclToLtcg;

  const immediateTaxSavings = (stclToStcg * 0.20) + (ltclToLtcg * 0.125) + (stclToLtcg * 0.125);
  // Any loss not used immediately can be carried forward for 8 years
  const carryForwardTaxSavings = (remainingSTCL * 0.20) + (remainingLTCL * 0.125);
  const totalTaxSavings = immediateTaxSavings + carryForwardTaxSavings;

  return {
    realizedSTCG,
    realizedLTCG,
    realizedSTCL,
    realizedLTCL,
    netRealizedSTCG,
    netRealizedLTCG,
    currentTaxLiability,
    totalHarvestableLoss,
    harvestableSTCL,
    harvestableLTCL,
    immediateTaxSavings,
    carryForwardTaxSavings,
    totalTaxSavings,
    assets: assetSummaries,
    lots: openLossLots
  };
}

/**
 * Generates CSV content for the tax-loss harvesting recommendation report.
 */
export function exportTaxLossHarvestingCSV(overview: TaxHarvestingOverview): string {
  const headers = [
    'Portfolio',
    'Asset Name',
    'ISIN',
    'Asset Type',
    'Buy Date',
    'Holding Days',
    'Term',
    'Quantity',
    'Cost / Unit (INR)',
    'Current Price (INR)',
    'Invested Value (INR)',
    'Current Value (INR)',
    'Unrealized Loss (INR)',
    'Loss %',
    'Tax Rate %',
    'Potential Tax Saved (INR)'
  ];

  const rows = overview.lots.map(l => [
    `"${l.portfolioName.replace(/"/g, '""')}"`,
    `"${l.assetName.replace(/"/g, '""')}"`,
    `"${l.isin}"`,
    `"${l.assetTypeName}"`,
    l.buyDate,
    l.holdingDays,
    l.term,
    l.remainingQty.toFixed(3),
    l.costPerUnit.toFixed(2),
    l.currentPrice.toFixed(2),
    l.investedVal.toFixed(2),
    l.currentVal.toFixed(2),
    l.unrealizedLoss.toFixed(2),
    l.lossPct.toFixed(2) + '%',
    l.taxRate + '%',
    l.potentialTaxSaving.toFixed(2)
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
