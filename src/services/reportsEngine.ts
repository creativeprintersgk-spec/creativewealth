import { getHoldings, state, getAssetName } from '../logic';

// Map UI filter labels to numeric assetType codes (from logic.ts resolvedAtty)
const ASSET_TYPE_FILTER_MAP: Record<string, number[]> = {
  'Stocks & ETFs':          [10, 12, 50, 51],
  'Mutual Funds (Equity)': [60],
  'Mutual Funds (Debt)':   [61, 62],
  'Mutual Funds':          [60, 61, 62, 63, 200],
  'Private Equity':        [190],
  'Traded Bonds':          [100],
  'NCDs':                  [110],
  'Gold':                  [150, 151],
  'NPS / ULIP':            [95, 80],
  'Fixed Deposits':        [90],
  'PPF / EPF':             [120, 130, 140],
  'Properties':            [160],
};

// Map atty/resolvedAtty numeric codes to human-readable asset class names
const ATTY_CLASS_MAP: Record<number, string> = {
  50: 'Stocks & ETFs',
  51: 'Stocks & ETFs',
  60: 'Mutual Funds (Equity)',
  61: 'Mutual Funds (Debt)',
  62: 'Mutual Funds (Liquid/Debt)',
  63: 'Mutual Funds',
  66: 'Private Equity',
  70: 'NCD / Debentures',
  95: 'NPS / ULIP',
  75: 'Gold',
  80: 'Insurance',
  81: 'Insurance',
  90: 'Fixed Deposits',
  100: 'Traded Bonds',
  110: 'NCD / Debentures',
  120: 'PPF / EPF',
  130: 'Post Office',
  140: 'PPF / EPF',
  150: 'Gold',
  151: 'Silver / Jewellery',
  160: 'Properties',
  190: 'Private Equity',
  200: 'Mutual Funds (Special)',
  210: 'AIF',
  220: 'Loans Given',
};

// Helper to filter holdings by asset type
const filterByAssetType = (holdings: any[], assetTypes: string[]) => {
  if (assetTypes.includes('All Assets')) return holdings;
  const allowedCodes = assetTypes.flatMap(t => ASSET_TYPE_FILTER_MAP[t] || []);
  return holdings.filter(h => allowedCodes.includes(Number(h.assetType)));
};

export const generatePortfolioSummary = (portfolioIds: string[], assetTypes: string[], startDate?: string, endDate?: string) => {
  const numericPortIds = portfolioIds.map(Number);
  const holdings = getHoldings(numericPortIds, undefined, false);
  const individual = holdings.filter((h: any) => !h.isGroup);
  const filtered = filterByAssetType(individual, assetTypes);

  const groupedData: Record<string, {
    assetClass: string;
    totalInvested: number;
    currentValue: number;
    overallGain: number;
    todaysGain: number;
    assets: any[];
  }> = {};

  filtered.forEach((h: any) => {
    const attyCode = Number(h.assetType);
    const typeName = ATTY_CLASS_MAP[attyCode] || 'Other';

    if (!groupedData[typeName]) {
      groupedData[typeName] = { assetClass: typeName, totalInvested: 0, currentValue: 0, overallGain: 0, todaysGain: 0, assets: [] };
    }

    // Fallback: if no live price, use invested amount as current value
    const currVal = (h.currentValue && h.currentValue > 0) ? h.currentValue : (h.amtInvested || 0);
    const overallGain = (h.overallGain) || (currVal - (h.amtInvested || 0));
    const todaysGain = h.todaysGain || 0;

    groupedData[typeName].totalInvested += (h.amtInvested || 0);
    groupedData[typeName].currentValue  += currVal;
    groupedData[typeName].overallGain   += overallGain;
    groupedData[typeName].todaysGain    += todaysGain;

    const overallGainPct = h.amtInvested > 0 ? (overallGain / h.amtInvested) * 100 : 0;
    const todaysGainPct  = currVal > 0 ? (todaysGain / (currVal - todaysGain || 1)) * 100 : 0;

    groupedData[typeName].assets.push({
      name:            h.assetName || `Asset ${h.amid}`,
      folio:           '',
      qty:             h.quantity || 0,
      avgPrice:        h.avgPrice || 0,
      amtInvested:     h.amtInvested || 0,
      currPrice:       h.currentPrice || h.avgPrice || 0,
      todaysGainValue: todaysGain,
      todaysGainPct:   todaysGainPct,
      overallGainValue: overallGain,
      overallGainPct:  overallGainPct,
      currentValue:    currVal,
    });
  });

  // Sort groups and assets
  return Object.values(groupedData).sort((a, b) => a.assetClass.localeCompare(b.assetClass));
};

export const generatePnLDetailed = (portfolioIds: string[], assetTypes: string[], startDate?: string, endDate?: string) => {
  const numericPortIds = portfolioIds.map(Number);
  const holdings = getHoldings(numericPortIds, undefined, false);
  const filtered = filterByAssetType(holdings.filter((h: any) => !h.isGroup), assetTypes);

  return filtered.map((h: any) => {
    const currVal = (h.currentValue && h.currentValue > 0) ? h.currentValue : (h.amtInvested || 0);
    return {
      assetName:      h.assetName,
      assetClass:     ATTY_CLASS_MAP[Number(h.assetType)] || 'Other',
      quantity:       h.quantity || 0,
      averagePrice:   h.avgPrice,
      investedAmount: h.amtInvested,
      currentPrice:   h.currentPrice || h.avgPrice,
      currentValue:   currVal,
      unrealisedGain: currVal - (h.amtInvested || 0),
      gainPct:        h.amtInvested > 0 ? ((currVal - h.amtInvested) / h.amtInvested) * 100 : 0,
      todaysGain:     h.todaysGain || 0,
    };
  });
};

export const generateTransactionReport = (portfolioIds: string[], assetTypes: string[], startDate?: string, endDate?: string) => {
  const pSet = new Set(portfolioIds.map(Number));
  
  // Fetch all transactions for these portfolios
  const txs = state.bs1.filter((t: any) => pSet.has(t.pfid));
  
  // Sort chronologically to compute accurate running balance quantity per asset per portfolio
  txs.sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));
  
  const runningBalances: Record<string, number> = {};
  
  const mappedTxs = txs.map((t: any) => {
    const key = `${t.pfid}_${t.amid}`;
    const qty = Number(t.qn) || 0;
    const trty = Number(t.trty);
    
    // Add/Sub criteria matching standard stock ledger behavior
    const isAdd = [19, 20, 12, 25, 30, 35, 36, 37, 38, 39, 40, 45, 46, 47, 48, 49].includes(trty);
    const isSub = [99, 101].includes(trty);
    
    if (isAdd) {
      runningBalances[key] = (runningBalances[key] || 0) + qty;
    } else if (isSub) {
      runningBalances[key] = (runningBalances[key] || 0) - qty;
    }
    
    const balQty = runningBalances[key] || 0;
    
    const trtyNames: Record<number, string> = {
      19: 'Buy',
      20: 'Buy',
      99: 'Sell',
      101: 'Buyback',
      12: 'Rights',
      25: 'Bonus',
      30: 'Split',
      35: 'Merger',
      40: 'Demerger',
      45: 'Bonus/Split',
      62: 'Dividend Payout',
      85: 'Dividend'
    };
    
    const price = qty > 0 ? (Number(t.amt) || 0) / qty : 0;
    
    return {
      date: t.dt,
      transType: trtyNames[trty] || `Other (${trty})`,
      assetName: getAssetName(t.amid) || `Asset ${t.amid}`,
      quantity: qty,
      price: price,
      brokerage: Number(t.brkg) || 0,
      amount: Number(t.amt) || 0,
      balQty: balQty,
      atyid: Number(t.atyid)
    };
  });
  
  // Filter by selected asset types
  let filtered = mappedTxs;
  if (!assetTypes.includes('All Assets')) {
    const allowedAtyids = assetTypes.flatMap(t => ASSET_TYPE_FILTER_MAP[t] || []);
    filtered = mappedTxs.filter(t => allowedAtyids.includes(t.atyid));
  }
  
  // Filter by date range
  if (startDate) {
    filtered = filtered.filter(t => t.date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(t => t.date <= endDate);
  }
  
  // Sort reverse-chronologically for reporting (latest first)
  return filtered.sort((a, b) => b.date.localeCompare(a.date));
};

export const generateAssetAllocationReport = (portfolioIds: string[], assetTypes: string[]) => {
  const numericPortIds = portfolioIds.map(Number);
  const holdings = getHoldings(numericPortIds, undefined, false);
  
  let totalValuation = 0;
  const allocations: Record<string, number> = {};
  
  for (const h of holdings) {
    const cls = ATTY_CLASS_MAP[h.assetType] || 'Other Assets';
    const isAllowed = assetTypes.includes('All Assets') || assetTypes.includes(cls);
    if (!isAllowed) continue;
    
    const val = h.currentValue || (h.quantity * (h.currentPrice || h.avgPrice || 0));
    if (val > 0) {
      allocations[cls] = (allocations[cls] || 0) + val;
      totalValuation += val;
    }
  }
  
  const rows = Object.entries(allocations).map(([cls, val]) => ({
    'Asset Class': cls,
    'Valuation': val,
    'Allocation %': ((val / totalValuation) * 100).toFixed(2) + '%'
  })).sort((a, b) => b.Valuation - a.Valuation);
  
  return rows;
};

export const generateIncomeReport = (portfolioIds: string[], startDate?: string, endDate?: string) => {
  const numericPortIds = portfolioIds.map(Number);
  const pSet = new Set(numericPortIds);
  const txs = state.bs1.filter((t: any) => pSet.has(t.pfid) && [25, 26, 45, 46].includes(Number(t.trty))); // Dividend and Interest TRTYs
  
  return txs.map((t: any) => ({
    'Date': t.dt?.substring(0, 10),
    'Asset': getAssetName(t.amid) || 'Unknown',
    'Type': [25, 45].includes(Number(t.trty)) ? 'Dividend' : 'Interest',
    'Amount': Number(t.amt) || 0
  })).filter(t => {
    if (startDate && t.Date < startDate) return false;
    if (endDate && t.Date > endDate) return false;
    return true;
  });
};

export const generate80CReport = (portfolioIds: string[], startDate?: string, endDate?: string) => {
  const numericPortIds = portfolioIds.map(Number);
  const pSet = new Set(numericPortIds);
  const txs = state.bs1.filter((t: any) => pSet.has(t.pfid) && [19, 20].includes(Number(t.trty))); // Buy transactions
  
  return txs.filter((t: any) => {
    const name = (getAssetName(t.amid) || '').toLowerCase();
    const is80C = name.includes('elss') || name.includes('tax saver') || name.includes('ppf') || name.includes('epf') || name.includes('nps');
    if (!is80C) return false;
    if (startDate && t.dt < startDate) return false;
    if (endDate && t.dt > endDate) return false;
    return true;
  }).map((t: any) => ({
    'Date': t.dt?.substring(0, 10),
    'Asset': getAssetName(t.amid) || 'Unknown',
    'Type': '80C Investment',
    'Amount Invested': Number(t.amt) || 0
  }));
};
