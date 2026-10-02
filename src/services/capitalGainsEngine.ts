import { getCapitalGains, getAssetISIN, resolveAssetType, getHoldings, state, buildAssetFifoLedger } from '../logic.ts';

export interface CapGainMatch {
  buyDate: string;
  sellDate: string;
  rawBuyDate?: string;
  rawSellDate?: string;
  holdingDays: number;
  quantity: number;
  buyPrice: number;
  buyValue: number;
  sellPrice: number;
  sellValue: number;
  gain: number;
  gainType: 'Intraday' | 'STCG' | 'LTCG';
  isin?: string;
  folio?: string;
  fmvPrice?: number;
  fmvValue?: number;
  caPrice?: number;
}

export interface CapGainScripSummary {
  assetId: string;
  assetName: string;
  folio?: string;
  qtySold: number;
  saleAmt: number;
  acquisitionCost: number;
  intradayGain: number;
  stcg: number;
  ltcg: number;
  matches: CapGainMatch[];
}

export interface CapGainReportData {
  assetClass: string;
  totalBuyValue: number;
  totalSellValue: number;
  totalIntraday: number;
  totalSTCG: number;
  totalLTCG: number;
  assets: CapGainScripSummary[];
}

// Map atyid codes to Capital Gains asset class labels
const ATYID_TO_CG_CLASS: Record<number, string> = {
  10: 'Stocks',
  12: 'Stocks',
  50: 'Stocks',
  51: 'Gold / Commodities',
  60: 'Mutual Funds (Equity)',
  61: 'Mutual Funds (Debt)',
  62: 'Mutual Funds (Debt)',
  75: 'Mutual Funds (Other)',
  40: 'Traded Bonds',
  100: 'Traded Bonds',
  110: 'Traded Bonds',
  70: 'Traded Bonds',
  81: 'Derivatives',
  150: 'Gold / Commodities',
  151: 'Silver / Commodities',
};

export function getAssetCGClass(atyid: number, assetName?: string): string {
  if (assetName && /silver|gold|commodity|metal/i.test(assetName) && /etf|bees/i.test(assetName)) {
    return 'Gold / Commodities'; // Gold and Silver ETFs separated into Commodities
  }
  if (assetName && /\b(fof|fund of funds?|multi\s*asset(\s*fund)?|overseas\s*fund|international\s*fund|global\s*fund)\b/i.test(assetName) && !/etf|bees/i.test(assetName)) {
    return 'Mutual Funds (Other)';
  }
  return ATYID_TO_CG_CLASS[atyid] || 'Other';
}

const filterByAssetTypeString = (atyid: number, allowedTypes: string[], assetName?: string) => {
  const cls = getAssetCGClass(atyid, assetName);
  if (allowedTypes.includes('All Assets')) return true;
  const typeMap: Record<string, string[]> = {
    'Stocks':                 ['Stocks'],
    'Stocks & ETFs':          ['Stocks'],
    'Mutual Funds':           ['Mutual Funds (Equity)', 'Mutual Funds (Debt)', 'Mutual Funds (Other)'],
    'Mutual Funds (Equity)':  ['Mutual Funds (Equity)'],
    'Mutual Funds (Debt)':    ['Mutual Funds (Debt)'],
    'Mutual Funds (Other)':   ['Mutual Funds (Other)'],
    'Gold / Commodities':     ['Gold / Commodities', 'Silver / Commodities'],
    'Traded Bonds':           ['Traded Bonds'],
    'NCDs':                   ['Traded Bonds', 'NCD / Debentures'],
  };
  const allowed = allowedTypes.flatMap(t => typeMap[t] || [t]);
  return allowed.includes(cls);
};

export const generateCapitalGainsDetailed = (
  portfolioIds: string[],
  assetTypes: string[],
  startDate?: string,
  endDate?: string,
  precomputedGains?: any[]
) => {
  const numericPortIds = portfolioIds.map(Number);

  const sDate = (startDate && startDate.length >= 8 && startDate !== 'undefined') ? startDate : '1970-01-01';
  const eDate = (endDate && endDate.length >= 8 && endDate !== 'undefined') ? endDate : '2099-12-31';

  const rawGains = precomputedGains || getCapitalGains(
    numericPortIds,
    sDate,
    eDate
  );

  const groupedData: Record<string, CapGainReportData> = {};
  const scripMaps: Record<string, Map<string, CapGainScripSummary>> = {};

  for (let mi = 0; mi < rawGains.length; mi++) {
    const m = rawGains[mi];
    const atyid = Number(m.assetType) || resolveAssetType(Number(m.portfolioId), Number(m.amid), Number(m.assetType));
    if (!filterByAssetTypeString(atyid, assetTypes, m.assetName)) continue;

    const typeName = getAssetCGClass(atyid, m.assetName);

    if (!groupedData[typeName]) {
      groupedData[typeName] = {
        assetClass: typeName,
        totalBuyValue: 0,
        totalSellValue: 0,
        totalIntraday: 0,
        totalSTCG: 0,
        totalLTCG: 0,
        assets: []
      };
      scripMaps[typeName] = new Map<string, CapGainScripSummary>();
    }

    const buyVal  = m.costBasis    || 0;
    const sellVal = m.saleProceeds || 0;
    const gain    = m.gainLoss     || 0;
    const gainType = m.gainType; // 'Intraday' | 'STCG' | 'LTCG'

    const group = groupedData[typeName];
    group.totalBuyValue  += buyVal;
    group.totalSellValue += sellVal;

    if (gainType === 'Intraday') group.totalIntraday += gain;
    else if (gainType === 'LTCG') group.totalLTCG += gain;
    else group.totalSTCG += gain;

    // Fast O(1) scrip lookup
    const scripKey = `${m.amid}_${m.folio || ''}`;
    let scrip = scripMaps[typeName].get(scripKey);
    if (!scrip) {
      scrip = {
        assetId: String(m.amid),
        assetName: m.assetName || `Asset ${m.amid}`,
        folio: m.folio || '',
        qtySold: 0,
        saleAmt: 0,
        acquisitionCost: 0,
        intradayGain: 0,
        stcg: 0,
        ltcg: 0,
        matches: []
      };
      scripMaps[typeName].set(scripKey, scrip);
      group.assets.push(scrip);
    }

    scrip.qtySold += m.quantity || 0;
    scrip.saleAmt += sellVal;
    scrip.acquisitionCost += buyVal;
    
    if (gainType === 'Intraday') scrip.intradayGain += gain;
    else if (gainType === 'LTCG') scrip.ltcg += gain;
    else scrip.stcg += gain;

    scrip.matches.push({
      buyDate:     m.buyDate  || '',
      sellDate:    m.sellDate || '',
      rawBuyDate:  m.buyDate  || '',
      rawSellDate: m.sellDate || '',
      holdingDays: m.holdingDays || 0,
      quantity:    m.quantity   || 0,
      buyPrice:    m.buyPrice   || 0,
      buyValue:    buyVal,
      sellPrice:   m.sellPrice  || 0,
      sellValue:   sellVal,
      gain:        gain,
      gainType:    gainType,
      isin:        m.isin || getAssetISIN(Number(m.amid || scrip.assetId)) || '',
      folio:       m.folio || scrip.folio || '',
      fmvPrice:    m.fmvPrice || 0,
      fmvValue:    m.fmvValue || 0,
      caPrice:     m.caPrice || m.buyPrice
    });
  }

  // Sort groups and assets alphabetically
  const result = Object.values(groupedData).sort((a, b) => a.assetClass.localeCompare(b.assetClass));
  for (let gi = 0; gi < result.length; gi++) {
    result[gi].assets.sort((a, b) => a.assetName.localeCompare(b.assetName));
  }

  return result;
};

export const generateTaxPlanningReport = (portfolioIds: string[], assetTypes: string[]) => {
  const numericPortIds = portfolioIds.map(Number);
  const holdings = getHoldings(numericPortIds, undefined, false);
  
  const rows: any[] = [];
  
  for (const h of holdings) {
    const cls = getAssetCGClass(h.asset_type, h.name);
    const isAllowed = assetTypes.includes('All Assets') || assetTypes.includes(cls) || assetTypes.includes('All');
    if (!isAllowed) continue;

    const txList = state.bs1.filter((t: any) => 
      t.pfid && numericPortIds.includes(Number(t.pfid)) && 
      Number(t.atyid) === h.asset_type && 
      Number(t.amid) === h.amid
    ).sort((a: any, b: any) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    if (txList.length === 0) continue;

    const { openLots } = buildAssetFifoLedger(txList, '1970-01-01', '2099-12-31', new Map(), {});
    
    for (const lot of openLots) {
      if (lot.remaining <= 0.000001) continue;
      
      const buyDate = new Date(lot.date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - buyDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let threshold = 365;
      if (cls === 'Gold / Commodities' || cls === 'Mutual Funds (Debt)' || cls === 'Mutual Funds (Other)' || cls === 'Real Estate') {
        threshold = 1095;
      } else if (cls === 'Mutual Funds (Other)') {
        threshold = 730;
      }
      
      const isLT = diffDays > threshold;
      const daysToLT = isLT ? 0 : threshold - diffDays;
      
      const currentPrice = h.livePrice || lot.costPerUnit;
      const unrealisedGain = (currentPrice - lot.costPerUnit) * lot.remaining;
      const gainPercent = ((currentPrice - lot.costPerUnit) / lot.costPerUnit) * 100;
      
      rows.push({
        'Asset Class': cls,
        'Asset Name': h.name,
        'Buy Date': lot.date.substring(0, 10),
        'Qty Remaining': lot.remaining,
        'Buy Price': lot.costPerUnit,
        'Current Price': currentPrice,
        'Unrealised Gain': unrealisedGain,
        'Gain %': gainPercent,
        'Days Held': diffDays,
        'Tax Status': isLT ? 'Long Term' : 'Short Term',
        'Days To LTCG': daysToLT
      });
    }
  }
  
  return rows.sort((a, b) => a['Days To LTCG'] - b['Days To LTCG']);
};
