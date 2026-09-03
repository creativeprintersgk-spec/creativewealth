# Next Tasks — 03-Sept-2026: WealthCore Action Plan & Implementation Blueprint

**Document Name:** `next task 3-9-26.md`  
**Created:** 2026-09-03  
**Status:** Approved for Execution  
**Project:** WealthCore (PMS & Accounting Platform)

---

## 1. Executive Summary & Objective

Following the in-depth multi-model codebase audit conducted on September 3, 2026, this document details the exact, prioritized sequence of development tasks required to:
1. **Fix Critical Accounting & Tax Integrity Bugs** identified in the double-entry, corporate action, and FIFO engines.
2. **Implement MProfit "Ease of Work" Features** to eliminate manual data entry, automate corporate actions, and enable seamless Chartered Accountant (CA) exports.
3. **Enhance UI/UX and Reporting** with multi-year comparisons and tax-loss harvesting.

---

## 2. Phase 1: Critical Double-Entry & Tax Integrity Fixes (Sprint 1)

These fixes resolve data integrity issues where numbers or accounting vouchers can be distorted.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASE 1: INTEGRITY BUG FIXES                         │
├───────────────────────┬───────────────────────┬────────────────────────┤
│ Task 1.1: Demerger    │ Task 1.2: CN Sales    │ Task 1.3: Sec 50AA     │
│ Balancing             │ FIFO Sync             │ Debt MF Enforcement    │
├───────────────────────┼───────────────────────┼────────────────────────┤
│ Credit parent cost    │ Deduct prior sales    │ Force STCG for debt    │
│ to keep vouchers      │ before depleting buy  │ funds bought on/after  │
│ strictly balanced     │ lots in ImportPage    │ 01-Apr-2023            │
└───────────────────────┴───────────────────────┴────────────────────────┘
```

### Task 1.1: Fix Unbalanced Demerger Vouchers
* **File:** `src/components/pms/PMSCorporateActionModal.tsx` (Lines 237–247)
* **Problem:** Currently only debits the new demerged entity for `(amount * costAllocationPct) / 100`, but creates zero credit entry for the parent company. This breaks double-entry balance and inflates the Balance Sheet.
* **Implementation:**
  * Add the offsetting credit line to the parent asset's ledger:
    ```typescript
    lines.push({
      ledgerId: assetLedger.id,
      debit: 0,
      credit: (amount * costAllocationPct) / 100,
      quantity: 0
    });
    ```
  * Verify in `VoucherModal` and `BalanceSheet` that total debits strictly equal total credits.

### Task 1.2: Fix Contract Note Sales FIFO Bypass in ImportPage
* **File:** `src/pages/ImportPage.tsx` (Lines 1300–1323)
* **Problem:** In `commitContractNote()`, sell trades loop through raw `buyRows` without checking previously sold lots, leading to double-consumption of historical buy lots and incorrect capital gains.
* **Implementation:**
  * Replace the naive inline loop with the centralized `buildAssetFifoLedger()` engine from `src/logic.ts`.
  * Ensure already exhausted buy lots are properly depleted before costing new sales.

### Task 1.3: Enforce Section 50AA on Post-2023 Debt Mutual Funds in `createVoucher()`
* **File:** `src/logic.ts` (Lines 2473–2475)
* **Problem:** Checks `holdingDays > 1095 ? LTCG : STCG` on debt mutual funds without checking acquisition date. Under the Finance Act 2023, any specified debt fund acquired on/after 01-April-2023 is strictly STCG at slab rate.
* **Implementation:**
  * Check acquisition date: if `firstBuyDate >= '2023-04-01'`, force `gainLedgerId = GAIN_LEDGERS.STCG_DEBT` regardless of holding days.

### Task 1.4: Split Multi-Lot Sales into Separate STCG and LTCG Vouchers
* **File:** `src/logic.ts` (Lines 2456–2461 & 2486–2490)
* **Problem:** When a single sale depletes both old lots (>12 months) and new lots (<12 months), the system stamps the entire sale as LTCG based solely on the earliest lot date.
* **Implementation:**
  * Group consumed lots by tax category (`STCG` vs `LTCG`).
  * Post separate gain/loss ledger lines for each category, accurately reflecting true tax liability.

### Task 1.5: Fix Buyback Cost vs. Capital Gain Allocation
* **File:** `src/components/pms/PMSCorporateActionModal.tsx` (Lines 267–293)
* **Problem:** Credits the asset ledger with the gross tender proceeds instead of cost basis, pushing stock ledger balances negative and failing to recognize capital gains.
* **Implementation:**
  * Look up FIFO cost basis of tendered shares.
  * Credit asset ledger at cost basis, and credit the surplus to Capital Gains / Dividend Income.

---

## 3. Phase 2: MProfit "Ease of Work" Automations (Sprint 2)

Features designed to eliminate manual data entry and save hours of administrative work.

### Task 2.1: Automated Corporate Actions Calendar & Notification Engine
* **Objective:** Remove the need for users to manually look up demerger ratios, bonus dates, or stock split math.
* **Implementation:**
  * Create `corporate_actions_master` in Supabase:
    * Columns: `isin`, `symbol`, `action_type` (split, bonus, demerger), `ratio_num`, `ratio_denom`, `cost_factor`, `record_date`, `ex_date`.
  * Add an automated notification banner in `PMSWorkspace`:
    * *"Reliance Industries demerged Jio Financial on 20-Jul-2023 (Ratio 1:1, Cost 9.12%). Click to apply across all portfolios."*
  * 1-click execution across all family portfolios holding the security.

### Task 2.2: Automated Dividend Reconciliation
* **Objective:** Auto-post dividends into bank accounts based on record-date holding quantities.
* **Implementation:**
  * Query holding quantity on company record dates.
  * Auto-calculate expected dividend = `quantity * dividend_per_share`.
  * Provide a 1-click reconciliation screen:
    * Matches credited bank amounts against expected dividends.
    * Generates `Debit Bank / Credit Dividend Income` journal entries with zero manual typing.

### Task 2.3: Chartered Accountant Export Suite (Tally XML & ITR Schedule CG)
* **Objective:** Allow CAs to import a full financial year's accounting in 10 seconds.
* **Implementation:**
  * **Tally XML Exporter (`src/services/tallyExportService.ts`):**
    * Generates standard `<ENVELOPE>` XML format for Tally Prime / ERP 9 containing all Chart of Accounts ledgers and vouchers.
  * **ITR Schedule CG Excel Exporter (`src/services/itrExportService.ts`):**
    * Exports capital gains broken down by quarters (Upto 15-Jun, 16-Jun to 15-Sep, 16-Sep to 15-Dec, 16-Dec to 15-Mar, 16-Mar to 31-Mar) as required by Schedule CG in ITR-2 and ITR-3.

### Task 2.4: Expanded Broker Contract Note Profiles
* **Objective:** One-click drag-and-drop support for major Indian retail brokers.
* **Implementation:**
  * Add native regex parser profiles for:
    * Zerodha (Equity & F&O)
    * Groww
    * ICICI Direct
    * Kotak Securities (Trade Free)
    * HDFC Securities
    * Motilal Oswal

---

## 4. Phase 3: Reporting & UI/UX Polish (Sprint 3)

### Task 3.1: Side-by-Side Multi-Year Balance Sheet Comparison
* **Objective:** Enable multi-year historical auditing on one screen.
* **Implementation:**
  * Extend `getBalanceSheet()` to accept multiple FY ending dates (`['2024-03-31', '2025-03-31', '2026-03-31']`).
  * Add multi-column view with year-over-year variance in `BalanceSheet.tsx`.

### Task 3.2: Fix TopNavbar Legacy 20MB Clipboard Backup Freeze
* **File:** `src/TopNavbar.tsx` (Lines 36–45)
* **Problem:** Copies 20+ MB raw JSON to the clipboard, freezing browser tabs on large databases.
* **Implementation:**
  * Change "Backup" button to navigate directly to `/backup` or trigger a background file download.

### Task 3.3: Tax-Loss Harvesting Assistant
* **Objective:** Identify unrealized loss positions before March 31 to offset taxable gains.
* **Implementation:**
  * Create `/tax-loss-harvesting` page or modal.
  * Query current realized gains for the year (`totalSTCG`, `totalLTCG`).
  * Scan portfolio for open positions where `current_price < average_buy_price`.
  * Suggest exact scrips and quantities to sell to reduce tax liability to zero (utilizing the ₹1.25L Section 112A threshold).

---

## 5. Execution Roadmap & Timeline

| Sprint | Target Focus | Estimated Duration | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | Double-Entry & Tax Integrity | 2–3 Days | Demerger fix, CN sales FIFO fix, Sec 50AA debt fix, Multi-lot sale tax split. |
| **Sprint 2** | MProfit Automation & CA Export | 3–4 Days | Tally XML export, ITR-2/3 Excel export, Corporate actions master table, Dividend reconciler. |
| **Sprint 3** | Reporting & Ease-of-Work Polish | 2–3 Days | Multi-year Balance Sheet comparison, Tax-loss harvesting tool, TopNavbar cleanup. |

---

## 6. Verification & Quality Assurance Protocol

Every fix and feature must pass:
1. **Double-Entry Balance Verification:** Total Assets == Total Liabilities + Equity to the exact paisa on `balanceSheet.ts`.
2. **TypeScript Compilation:** `npx tsc -b` passes with zero errors.
3. **Automated Browser Testing:** Playwright / browser subagent visual verification across both Desktop and Live Vercel deployment.
4. **Code Review Audit:** Proactive verification to guarantee no regressions before delivery.
