import { supabase } from '../supabase';
import { state, createVoucher, ensureLedgerExists, getStoredPortfolios } from '../logic';

export interface CorporateActionMasterItem {
  id: string;
  isin: string;
  symbol: string;
  company_name: string;
  action_type: 'split' | 'bonus' | 'demerger' | 'merger' | 'buyback';
  ratio_num: number;
  ratio_denom: number;
  cost_factor: number; // e.g. 9.12 for Jio Fin
  record_date: string;
  ex_date: string;
  target_isin?: string;
  target_symbol?: string;
  target_company_name?: string;
  description: string;
}

export interface PendingCorporateAction {
  action: CorporateActionMasterItem;
  affectedPortfolios: {
    portfolioId: number;
    portfolioName: string;
    accountId: number;
    currentQuantity: number;
    parentCostBasis: number;
    expectedTargetQuantity: number;
    allocatedCost: number;
  }[];
}

// Built-in seed corporate actions catalog
export const SEED_CORPORATE_ACTIONS: CorporateActionMasterItem[] = [
  {
    id: 'ca-rel-jio-2023',
    isin: 'INE002A01018',
    symbol: 'RELIANCE',
    company_name: 'Reliance Industries Ltd',
    action_type: 'demerger',
    ratio_num: 1,
    ratio_denom: 1,
    cost_factor: 9.12,
    record_date: '2023-07-20',
    ex_date: '2023-07-20',
    target_isin: 'INE758E01017',
    target_symbol: 'JIOFIN',
    target_company_name: 'Jio Financial Services Ltd',
    description: 'Demerger of Financial Services undertaking into Jio Financial Services (Ratio 1:1, 9.12% Cost Allocation)'
  },
  {
    id: 'ca-tatasteel-split-2022',
    isin: 'INE081A01020',
    symbol: 'TATASTEEL',
    company_name: 'Tata Steel Ltd',
    action_type: 'split',
    ratio_num: 10,
    ratio_denom: 1,
    cost_factor: 100,
    record_date: '2022-07-29',
    ex_date: '2022-07-28',
    target_isin: 'INE081A01020',
    target_symbol: 'TATASTEEL',
    target_company_name: 'Tata Steel Ltd',
    description: 'Subdivision of equity shares from face value of Rs 10 to Rs 1 (Ratio 10:1)'
  },
  {
    id: 'ca-wipro-bonus-2024',
    isin: 'INE075A01022',
    symbol: 'WIPRO',
    company_name: 'Wipro Ltd',
    action_type: 'bonus',
    ratio_num: 1,
    ratio_denom: 1,
    cost_factor: 0,
    record_date: '2024-12-03',
    ex_date: '2024-12-03',
    target_isin: 'INE075A01022',
    target_symbol: 'WIPRO',
    target_company_name: 'Wipro Ltd',
    description: 'Bonus issue of equity shares in the ratio of 1:1'
  },
  {
    id: 'ca-tcs-buyback-2023',
    isin: 'INE467B01029',
    symbol: 'TCS',
    company_name: 'Tata Consultancy Services Ltd',
    action_type: 'buyback',
    ratio_num: 1,
    ratio_denom: 1,
    cost_factor: 100,
    record_date: '2023-11-25',
    ex_date: '2023-11-24',
    target_isin: 'INE467B01029',
    target_symbol: 'TCS',
    target_company_name: 'Tata Consultancy Services Ltd',
    description: 'TCS Buyback at Rs 4,150 per equity share via tender offer'
  }
];

/**
 * Fetch all master corporate actions from Supabase, falling back to seed list
 */
export async function getCorporateActionsMaster(): Promise<CorporateActionMasterItem[]> {
  try {
    const { data, error } = await supabase
      .from('corporate_actions_master')
      .select('*')
      .order('record_date', { ascending: false });

    if (!error && data && data.length > 0) {
      // Merge database records with seed catalog to ensure no missed actions
      const dbIds = new Set(data.map((d: any) => d.isin + '_' + d.action_type + '_' + d.record_date));
      const combined = [...data];
      SEED_CORPORATE_ACTIONS.forEach(seed => {
        const key = seed.isin + '_' + seed.action_type + '_' + seed.record_date;
        if (!dbIds.has(key)) combined.push(seed);
      });
      return combined;
    }
  } catch (err) {
    console.warn('Could not query corporate_actions_master table, using seed list:', err);
  }
  return SEED_CORPORATE_ACTIONS;
}

/**
 * Scans active portfolios to find corporate actions that apply to securities currently held
 * but have not yet been applied.
 */
export async function detectPendingCorporateActions(portfolioIds?: number[]): Promise<PendingCorporateAction[]> {
  const masterActions = await getCorporateActionsMaster();
  const allPortfolios = getStoredPortfolios();
  const targetPfs = portfolioIds && portfolioIds.length > 0
    ? allPortfolios.filter(p => portfolioIds.includes(Number(p.id)))
    : allPortfolios;

  const pendingList: PendingCorporateAction[] = [];

  for (const action of masterActions) {
    const affectedPortfolios: PendingCorporateAction['affectedPortfolios'] = [];

    // Find all assets in asset_master or sam matching this ISIN or symbol
    const matchingAmids = new Set<number>();
    state.assetMaster.forEach((a: any) => {
      if ((a.isin && a.isin.toUpperCase() === action.isin.toUpperCase()) ||
          (a.nse_symbol && a.nse_symbol.toUpperCase() === action.symbol.toUpperCase())) {
        matchingAmids.add(Number(a.amid));
      }
    });

    state.sam.forEach((s: any) => {
      if ((s.isin && s.isin.toUpperCase() === action.isin.toUpperCase()) ||
          (s.anm && s.anm.toUpperCase().includes(action.symbol.toUpperCase()))) {
        matchingAmids.add(Number(s.amid));
      }
    });

    if (matchingAmids.size === 0) continue;

    for (const pf of targetPfs) {
      const pId = Number(pf.id);
      const acidNum = Number(pf.accountId) || 31;

      for (const amid of Array.from(matchingAmids)) {
        // Check if portfolio currently holds this asset
        const holdingRows = state.bs1.filter((t: any) => 
          Number(t.pfid) === pId && 
          Number(t.amid) === amid &&
          (t.dt || '') <= action.record_date
        );

        if (holdingRows.length === 0) continue;

        // Calculate holding quantity on record date
        let netQtyOnRecordDate = 0;
        let totalCostBasis = 0;
        holdingRows.forEach((t: any) => {
          const trty = Number(t.trty);
          const q = Number(t.qn) || 0;
          const amt = Number(t.amt) || 0;
          if ([12, 15, 19, 20, 25, 30, 35, 38, 40, 46, 47].includes(trty)) {
            netQtyOnRecordDate += q;
            totalCostBasis += amt;
          } else if ([99, 101, 150].includes(trty)) {
            netQtyOnRecordDate -= q;
          }
        });

        if (netQtyOnRecordDate <= 0) continue;

        // Check if this action was already processed for this portfolio + asset
        const alreadyApplied = state.bs1.some((t: any) => {
          const isDateMatch = (t.dt || '').slice(0, 10) === action.record_date;
          if (!isDateMatch) return false;
          if (action.action_type === 'demerger' && Number(t.trty) === 46) return true;
          if (action.action_type === 'split' && Number(t.trty) === 45) return true;
          if (action.action_type === 'bonus' && Number(t.trty) === 40) return true;
          return false;
        });

        if (alreadyApplied) continue;

        // Calculate expected target quantity and cost
        const expectedTargetQuantity = Math.floor(netQtyOnRecordDate * (action.ratio_num / action.ratio_denom));
        const allocatedCost = Number(((totalCostBasis * action.cost_factor) / 100).toFixed(2));

        affectedPortfolios.push({
          portfolioId: pId,
          portfolioName: pf.portfolioName || pf.name || `Portfolio ${pId}`,
          accountId: acidNum,
          currentQuantity: netQtyOnRecordDate,
          parentCostBasis: Number(totalCostBasis.toFixed(2)),
          expectedTargetQuantity,
          allocatedCost
        });
      }
    }

    if (affectedPortfolios.length > 0) {
      pendingList.push({ action, affectedPortfolios });
    }
  }

  return pendingList;
}

/**
 * 1-Click execution of corporate action across selected portfolios
 */
export async function applyCorporateActionToPortfolios(
  action: CorporateActionMasterItem,
  portfolioSelections: { portfolioId: number; accountId: number; quantity: number; costBasis: number }[]
): Promise<{ success: boolean; message: string; appliedCount: number }> {
  let appliedCount = 0;

  for (const sel of portfolioSelections) {
    const { portfolioId, accountId, quantity, costBasis } = sel;

    // 1. Resolve parent asset ledger
    const parentLedger = state.acmac1.find((l: any) => 
      !l.is_group && 
      l.acid === accountId && 
      l.name.toLowerCase().includes(action.symbol.toLowerCase())
    ) || await ensureLedgerExists(action.company_name, 'stocks', accountId);

    if (!parentLedger) continue;

    const lines: any[] = [];
    const demergedCost = Number(((costBasis * action.cost_factor) / 100).toFixed(2));
    const targetQty = Math.floor(quantity * (action.ratio_num / action.ratio_denom));

    if (action.action_type === 'demerger') {
      const targetName = action.target_company_name || action.target_symbol || 'Demerged Entity';
      const targetLedger = await ensureLedgerExists(targetName, 'stocks', accountId);

      // Debit new demerged entity
      lines.push({
        ledgerId: targetLedger?.id ?? "",
        debit: demergedCost,
        credit: 0,
        quantity: targetQty,
        price: targetQty > 0 ? Number((demergedCost / targetQty).toFixed(4)) : 0
      });

      // Credit parent company asset ledger (Sprint 1 fix: balanced voucher!)
      lines.push({
        ledgerId: parentLedger.id,
        debit: 0,
        credit: demergedCost,
        quantity: 0,
        price: 0
      });
    } else if (action.action_type === 'bonus') {
      // Bonus: memo/journal entry with quantity > 0 and amount = 0
      lines.push({
        ledgerId: parentLedger.id,
        debit: 0,
        credit: 0,
        quantity: targetQty,
        price: 0
      });
    } else if (action.action_type === 'split') {
      // Split: net additional shares
      const netSplitQty = targetQty - quantity;
      lines.push({
        ledgerId: parentLedger.id,
        debit: 0,
        credit: 0,
        quantity: netSplitQty,
        price: 0
      });
    }

    const voucherData = {
      id: Math.random().toString(36).substring(2, 11),
      date: action.record_date,
      type: action.action_type,
      portfolioId,
      accountId,
      narration: `${action.description} [Auto-Applied from Master Calendar]`,
      lines
    };

    try {
      await createVoucher(voucherData);
      appliedCount++;
    } catch (e: any) {
      console.error(`Failed to apply corporate action for portfolio ${portfolioId}:`, e);
    }
  }

  return {
    success: appliedCount > 0,
    message: `Successfully applied ${action.action_type.toUpperCase()} for ${action.symbol} across ${appliedCount} portfolio(s).`,
    appliedCount
  };
}
