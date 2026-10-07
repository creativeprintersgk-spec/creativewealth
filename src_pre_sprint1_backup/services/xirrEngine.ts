// ─── XIRR Calculation Engine ────────────────────────────────────────────────
// Computes annualised return (XIRR) at three levels:
//   - Per-asset:   xirrForAsset(pfid, amid)
//   - Per-portfolio: xirrForPortfolio(pfid)
//   - Family/account-group rollup: xirrForFamily(seedIds)  (uses the same
//     accPflink expansion as the Capital Gains report, via expandPortfolioFamily)
//
// DESIGN DECISIONS (confirmed with the user before building):
//
// 1. Dividends: a REAL cash dividend (trty=62, "Dividend Payout" -- money
//    actually paid out to the investor) counts as a positive cash inflow on
//    its payout date. A REINVESTED dividend (trty=35) does NOT get a separate
//    inflow -- it's already recorded as a buy transaction, and the cash never
//    left the portfolio, so adding both would double-count the same rupee.
//    This mirrors standard industry practice (MProfit and most portfolio
//    trackers follow the same rule).
//
// 2. Corporate actions with no cash movement (bonus=40, split=45,
//    merger-inflow=38, merger-outflow=45, demerger=46/47) are EXCLUDED from
//    the cash-flow series entirely. Their economic effect (change in
//    quantity/value) is captured automatically in the final current-value
//    cash flow -- adding them as separate flows would be double-counting.
//
// 3. Currently-held positions: valued at latest available market price as
//    the final ("as of today") cash flow -- standard XIRR practice.
//
// 4. Quantity source: current remaining quantity for the final cash flow is
//    computed via buildAssetFifoLedger() -- the SAME, already-verified FIFO
//    engine used by getCapitalGains() -- rather than sum_table's `qnt` field.
//    sum_table (maintained by syncPortfolioStats in logic.ts) uses a
//    DIFFERENT, average-cost-based quantity computation that was found during
//    this build to mishandle trty=45 rows (it unconditionally treats them as
//    a quantity ADD, which is wrong for the merger-outflow leg introduced in
//    the Step 6/7 fixes -- see the audit notes). Building XIRR on the FIFO
//    engine keeps it self-consistent with Capital Gains rather than
//    inheriting that separate, less-trusted source. The sum_table bug itself
//    is flagged, not fixed, here -- it affects the Holdings page display
//    independently of XIRR and needs its own dedicated look.

import { state, buildAssetFifoLedger, expandPortfolioFamily, getAssetName } from '../logic.ts';

export interface XIRRCashFlow {
  date: string;
  amount: number; // negative = money invested (outflow from investor's pocket), positive = money received
  type: 'buy' | 'sell' | 'dividend' | 'current_value';
  amid?: number;
}

export interface XIRRResult {
  rate: number | null; // annualised XIRR as a percentage (e.g. 14.3 for 14.3%), or null if it could not be computed
  cashFlows: XIRRCashFlow[];
  currentValue: number;
  totalInvested: number;
  totalReceived: number; // sells + dividends, excludes current_value
  converged: boolean;
  notes?: string;
}

// Real cash-movement transaction types only.
const XIRR_CASH_BUY_TRTY = new Set([12, 15, 19, 20, 25, 30]); // excludes 35 (Div Reinvest) -- see design note 1 above
const XIRR_CASH_SELL_TRTY = new Set([99, 101, 150]);
const XIRR_DIVIDEND_TRTY = 62;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Computes the FIFO-derived current open quantity and a fallback cost-based
 * price for one asset within a set of portfolios, as of asOfDate. Mirrors the
 * fixed-income fallback logic in getHoldings() (logic.ts) so XIRR's implied
 * "current value" doesn't silently diverge from what the Holdings page shows
 * for assets with no live market price.
 */
function getCurrentValueForAsset(pfidSet: Set<number>, amid: number, asOfDate: string): number {
  const assetTx = state.bs1
    .filter((t: any) => pfidSet.has(Number(t.pfid)) && Number(t.amid) === amid && (t.dt || '') <= asOfDate)
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));
  if (assetTx.length === 0) return 0;

  const { openLots } = buildAssetFifoLedger(assetTx, '0001-01-01', asOfDate, new Map(), {});
  const qty = openLots.reduce((s: number, l: any) => s + (l.remaining || 0), 0);
  if (qty <= 0.0001) return 0;

  const priceInfo = state.priceMap?.[amid] || { curr: 0 };
  let price = priceInfo.curr || 0;
  if (price === 0) {
    // No live price available (e.g. FD/bond/private asset) -- fall back to
    // weighted average remaining cost, same idea as getHoldings' fixed-income
    // fallback, so XIRR doesn't just silently treat the position as worthless.
    const totalCost = openLots.reduce((s: number, l: any) => s + l.remaining * l.costPerUnit, 0);
    price = totalCost / qty;
  }
  return qty * price;
}

/**
 * Builds the full XIRR cash-flow series for a set of portfolios, optionally
 * scoped to a single asset. This is the shared core all three levels
 * (per-asset, per-portfolio, family rollup) call into.
 */
export function getXIRRCashFlows(pfids: (number | string)[], amid?: number, asOfDate?: string): XIRRCashFlow[] {
  const today = asOfDate || todayStr();
  const pfidSet = new Set(pfids.map(Number));

  const relevantTx = state.bs1.filter((t: any) =>
    pfidSet.has(Number(t.pfid)) &&
    (amid === undefined || Number(t.amid) === Number(amid)) &&
    (t.dt || '') <= today
  );

  const flows: XIRRCashFlow[] = [];

  relevantTx.forEach((t: any) => {
    const trty = Number(t.trty);
    const amt = Number(t.amt) || 0;
    const dt = (t.dt || '').slice(0, 10);
    if (!dt || amt === 0) return;

    if (XIRR_CASH_BUY_TRTY.has(trty)) {
      flows.push({ date: dt, amount: -amt, type: 'buy', amid: Number(t.amid) });
    } else if (XIRR_CASH_SELL_TRTY.has(trty)) {
      flows.push({ date: dt, amount: amt, type: 'sell', amid: Number(t.amid) });
    } else if (trty === XIRR_DIVIDEND_TRTY) {
      flows.push({ date: dt, amount: amt, type: 'dividend', amid: Number(t.amid) });
    }
    // Everything else (bonus/split/merger/demerger/div-reinvest) is
    // deliberately excluded -- see design note 2 in the file header.
  });

  // Final cash flow: current value of everything still held, as of today.
  const assetIds = amid !== undefined
    ? [Number(amid)]
    : Array.from(new Set(relevantTx.map((t: any) => Number(t.amid))));

  let currentValue = 0;
  assetIds.forEach(aid => {
    currentValue += getCurrentValueForAsset(pfidSet, aid, today);
  });

  if (currentValue > 0.01) {
    flows.push({ date: today, amount: currentValue, type: 'current_value' });
  }

  return flows.sort((a, b) => a.date.localeCompare(b.date));
}

function xirrNPV(rate: number, flows: XIRRCashFlow[], t0: number): number {
  return flows.reduce((sum, cf) => {
    const days = (new Date(cf.date).getTime() - t0) / 86400000;
    return sum + cf.amount / Math.pow(1 + rate, days / 365);
  }, 0);
}

/**
 * Solves for the annualised rate that makes the NPV of a cash-flow series
 * zero. Newton-Raphson first (fast, usually converges in a handful of
 * iterations); falls back to bisection if Newton-Raphson fails to converge
 * (which can happen for unusual cash-flow patterns -- Newton-Raphson isn't
 * guaranteed to converge for arbitrary cash flows, bisection is more robust
 * but needs a sign change to bracket the root).
 */
function solveXIRR(flows: XIRRCashFlow[]): { rate: number | null; converged: boolean } {
  const t0 = new Date(flows[0].date).getTime();

  let rate = 0.1; // initial guess: 10%
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const npv = xirrNPV(rate, flows, t0);
    const eps = 1e-6;
    const derivative = (xirrNPV(rate + eps, flows, t0) - npv) / eps;
    if (Math.abs(derivative) < 1e-12) break;
    const newRate = rate - npv / derivative;
    if (Math.abs(newRate - rate) < 1e-7) {
      rate = newRate;
      converged = true;
      break;
    }
    // Guard against runaway rates so a bad step can't send this to +-Infinity
    rate = Math.max(-0.99, Math.min(newRate, 100));
  }

  if (converged) return { rate, converged: true };

  // Bisection fallback: only works if we can bracket a sign change.
  let lo = -0.99, hi = 10;
  let npvLo = xirrNPV(lo, flows, t0);
  let npvHi = xirrNPV(hi, flows, t0);
  if (npvLo * npvHi > 0) {
    return { rate: null, converged: false };
  }
  let mid = rate;
  for (let i = 0; i < 200; i++) {
    mid = (lo + hi) / 2;
    const npvMid = xirrNPV(mid, flows, t0);
    if (Math.abs(npvMid) < 1e-6) break;
    if (npvLo * npvMid < 0) { hi = mid; npvHi = npvMid; } else { lo = mid; npvLo = npvMid; }
  }
  return { rate: mid, converged: true };
}

/**
 * Core XIRR computation for an arbitrary set of portfolios, optionally scoped
 * to one asset. Used directly by xirrForFamily(), and wrapped by
 * xirrForPortfolio()/xirrForAsset() for the other two levels.
 */
export function computeXIRR(pfids: (number | string)[], amid?: number, asOfDate?: string): XIRRResult {
  const cashFlows = getXIRRCashFlows(pfids, amid, asOfDate);

  const totalInvested = cashFlows.filter(f => f.amount < 0).reduce((s, f) => s - f.amount, 0);
  const totalReceived = cashFlows.filter(f => f.amount > 0 && f.type !== 'current_value').reduce((s, f) => s + f.amount, 0);
  const currentValue = cashFlows.filter(f => f.type === 'current_value').reduce((s, f) => s + f.amount, 0);

  if (cashFlows.length < 2) {
    return {
      rate: null, cashFlows, currentValue, totalInvested, totalReceived, converged: false,
      notes: 'Not enough cash flows to compute XIRR (need at least one investment and one return/current value).'
    };
  }

  const hasPositive = cashFlows.some(f => f.amount > 0);
  const hasNegative = cashFlows.some(f => f.amount < 0);
  if (!hasPositive || !hasNegative) {
    return {
      rate: null, cashFlows, currentValue, totalInvested, totalReceived, converged: false,
      notes: 'XIRR requires at least one invested (negative) and one received/current-value (positive) cash flow.'
    };
  }

  const { rate, converged } = solveXIRR(cashFlows);

  return {
    rate: converged && rate !== null ? rate * 100 : null,
    cashFlows,
    currentValue,
    totalInvested,
    totalReceived,
    converged,
    notes: converged ? undefined : 'XIRR could not converge for this cash-flow pattern (can happen with unusual sequences, e.g. all flows on the same date, or extreme gains/losses).'
  };
}

/** Per-asset XIRR within one portfolio. */
export function xirrForAsset(pfid: number | string, amid: number, asOfDate?: string): XIRRResult {
  return computeXIRR([pfid], amid, asOfDate);
}

/** Per-portfolio XIRR across all assets held in that single portfolio. */
export function xirrForPortfolio(pfid: number | string, asOfDate?: string): XIRRResult {
  return computeXIRR([pfid], undefined, asOfDate);
}

/**
 * Family/account-group rollup XIRR: expands the given seed id(s) via the same
 * accPflink linkage getCapitalGains() uses, then aggregates cash flows across
 * every linked portfolio/account. Two portfolios linked as the same family
 * will always produce the same rollup here as they would in the Capital
 * Gains report's grouping.
 */
export function xirrForFamily(seedIds: (number | string)[], asOfDate?: string): XIRRResult {
  const expanded = expandPortfolioFamily(seedIds);
  return computeXIRR(expanded, undefined, asOfDate);
}

/** Convenience: per-asset name lookup for display, re-exported from logic.ts so callers don't need a second import. */
export { getAssetName };
