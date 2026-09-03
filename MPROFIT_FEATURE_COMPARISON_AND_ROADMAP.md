# WealthCore vs. MProfit: Comprehensive Feature Audit, Ease of Work & Roadmap Specification

**Document Version:** 2.0  
**Date:** 2026-09-03  
**Application:** WealthCore (PMS & Accounting Platform)  
**Target Environment:** Local (Port 5173) & Production ([wealthcore-clean.vercel.app](https://wealthcore-clean.vercel.app))

---

## 1. Executive Summary

WealthCore is designed as an integrated **Portfolio Management System (PMS) and Double-Entry Accounting Platform** specifically tailored for Indian family offices, high-net-worth investors, and chartered accountants. 

Historically, investors faced a fragmented tooling problem:
* **PMS Trackers (Value Research, Kuvera, Perfios):** Great at real-time market valuations and XIRR, but completely blind to bank balances, ledger journals, liabilities, and true balance sheets.
* **Accounting Platforms (Tally, Zoho Books):** Excellent at double-entry bookkeeping, but completely incapable of handling FIFO tax lots, Section 112A grandfathering (31-Jan-2018 FMV), daily mutual fund NAVs, or stock splits.
* **MProfit:** The gold standard in India that bridges both worlds into a unified dual-engine.

WealthCore has already successfully replicated and modernized the core accounting engine, multi-member family context, live price syncing, and portfolio holdings. This document outlines the **Ease of Work analysis**, the **complete current feature inventory**, and the **strategic roadmap of pending features** required to match and exceed MProfit.

---

## 2. The MProfit "Ease of Work" Paradigm

Why do Indian investors and CAs find MProfit so easy to work with? It stems from five fundamental pillars:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     THE 5 PILLARS OF MPROFIT EASE                       │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│ 1. Zero Manual  │ 2. Dual Engine  │ 3. Automated    │ 4. Tax & ITR      │
│    Data Entry   │    Bridge       │    Actions      │    Readiness      │
├─────────────────┼─────────────────┼─────────────────┼───────────────────┤
│ 5000+ broker CN │ 1 Trade =       │ Demergers,      │ ITR-2/3 Sched CG  │
│ & CAS PDF auto- │ PMS Lot +       │ Splits & Bonus  │ & Tally XML in    │
│ ingestion       │ Ledger Journal  │ pre-calculated  │ 1-click           │
└─────────────────┴─────────────────┴─────────────────┴───────────────────┘
```

1. **Zero Manual Entry for Transactions:**
   Users never manually punch in buy/sell transactions. A single CAMS/KFintech CAS statement or broker contract note PDF (Zerodha, Kotak, Groww, etc.) is dropped into the app, and it automatically parses contract charges, STT, GST, brokerage, and net rates.
2. **Synchronized PMS & Accounting (The Dual-Engine):**
   When a sell order occurs, MProfit simultaneously:
   * Relieves the oldest FIFO tax lot in the portfolio.
   * Calculates Realized Capital Gain (STCG / LTCG).
   * Posts double-entry journal vouchers to Cash/Bank, Asset Account, and P&L Capital Gains.
3. **Automated Corporate Actions:**
   Events like stock splits (e.g. 1:10), bonus shares (e.g. 1:1), and demergers (e.g. Reliance → Jio Financial Services) are calculated using official cost ratios without requiring manual math from the user.
4. **CA / Audit Friendly:**
   One-click generation of schedules formatted identically to Income Tax Department ITR-2 / ITR-3 requirements, plus XML import into Tally ERP/Prime.
5. **Strict Double-Entry Integrity:**
   The Balance Sheet strictly reflects the closing balances of the underlying ledger accounts, ensuring that Assets match Liabilities & Equity to the exact paisa.

---

## 3. WealthCore Current Capabilities Inventory

WealthCore currently includes the following fully functioning features:

### 3.1 Accounting Engine
* **Chart of Accounts (`acmac1`):** Hierarchical group and ledger structure supporting Assets, Liabilities, Equity, Incomes, and Expenses.
* **Balance Sheet (`BalanceSheet.tsx` & `balanceSheet.ts`):** 
  * Real-time hierarchical drill-down tree.
  * Strict transaction-based ledger closing balances matching both sides to the exact paisa.
  * Direct modal drilldown into transaction vouchers.
* **Profit & Loss Statement (`ProfitLoss.tsx` & `profitLoss.ts`):** Income vs Expense categorization across financial years.
* **Trial Balance (`TrialBalance.tsx`):** Complete debit and credit balancing.
* **General Ledger (`LedgerPage.tsx` & `LedgerDrilldownModal.tsx`):** Running ledger balances with period Opening Balance, Debits (+), Credits (-), and Closing Balance.
* **Year-End Closing Entry:** Automation tool transferring net operational P&L balances to Capital Account.

### 3.2 Portfolio Management (PMS Workspace)
* **Multi-Asset Holdings Table (`HoldingsGrid.tsx`):**
  * Support for 19 asset classes: Stocks, Equity MFs, Debt MFs, SGBs/Physical Gold, Silver, Bonds, NCDs, FDs, PPF, Real Estate, Loans.
  * Quantity, average cost price, invested value, current market price, current value, unrealized gain/loss (₹ and %), and day change.
* **Interactive Drilldowns:**
  * Level 2: Portfolio breakdown modal across family members.
  * Level 3: Transaction history and FIFO open lot view.
  * Level 4: Asset Ledger modal detailing cash flows per security.
* **Multi-Family & Multi-Account Context:**
  * Top-level family switching (e.g. *Pramesh R Shah Family*).
  * Individual member isolation (e.g. *Unnati Shah A/c*, *Pramesh Shah*, *Saahil Shah*, *HUF*).

### 3.3 Pricing & Valuation Engine
* **Automated Price Syncing (`assetMasterService.ts`):**
  * Live and EOD prices via Yahoo Finance and Google Finance.
  * Real-time AMFI daily NAV synchronization for all mutual fund schemes.
  * NSE Bhavcopy archive integration for official EOD closing rates.
  * Fallback to manual price override modal (`PMSPriceModal.tsx`).

### 3.4 Capital Gains & Tax Engine
* **FIFO Tax Lot Accounting:** Matches sells against earliest active buy lots.
* **Indian Tax Regime (Budget 2024 Updated):**
  * Equity STCG @ 20% (< 12 months).
  * Equity LTCG @ 12.5% (> 12 months).
  * Section 112A ₹1,25,000 annual exemption tracker.
  * Grandfathering provisions: Automatic FMV benchmark as of 31-January-2018.

### 3.5 Performance & Analytics
* **XIRR Engine (`xirrEngine.ts`):** Date-exact annualized internal rate of return calculated against all net investment cash flows.

### 3.6 Data Pipeline & Backup Infrastructure
* **MProfit 12-Table SQLite/CSV Importer:** Direct migration utility importing MProfit backups (`ACMAC1`, `SAM`, `BS1`, `Vouchers1`, `Trans1`, `VouchersC1`, `TransC1`, `MPrices`, `SCNOTE1`, `SumTable`, `Portfolios`, `Acc_Pflink`).
* **Cloud Sync:** Supabase cloud database synchronization with offline-capable IndexedDB cache (`wealthcore_state_v27`).
* **Automated Backup Utility (`create_full_backup.cjs`):** Creates timestamped full database snapshots and a complete zipped codebase archive with a single command.

---

## 4. Gap Analysis: Pending Features & Strategic Roadmap

To bridge the remaining distance between WealthCore and MProfit's mature desktop platform, the following features are prioritized for development:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WEALTHCORE ROADMAP PHASES                        │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│ Phase 1: High     │ Phase 2: Medium   │ Phase 3: Advanced               │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│ • Auto Corp Action│ • Multi-Year BS   │ • Direct Broker APIs (Kite/Up)  │
│ • Dividend Auto   │ • Tax-Loss Harvest│ • Section 44AB F&O Turnover     │
│ • Tally & ITR Exp │ • Expanded Parsers│ • Holding Concentration Risk    │
└───────────────────┴───────────────────┴─────────────────────────────────┘
```

### Phase 1: High Priority (Core Workflow Automation)

#### 1. Automated Corporate Actions Master & Repository
* **The Problem in WealthCore:** The modal exists (`PMSCorporateActionModal.tsx`), but users have to look up the demerger/split ratios and calculate cost allocations manually.
* **The MProfit Benchmark:** MProfit contains a pre-built corporate action calendar. When a user holds Reliance on the record date, it prompts: *"Demerger of Jio Financial detected. Ratio 1:1, Cost allocation 9.12%. Apply?"*
* **Implementation Plan:**
  * Create `corporate_actions_master` table in Supabase (`id`, `isin`, `action_type`, `ratio_num`, `ratio_denom`, `cost_factor`, `record_date`, `ex_date`).
  * On PMS load, check if any portfolio holding has unapplied corporate actions based on `record_date`.
  * Auto-adjust tax lot quantities and costs proportionally in `bs1` and post corresponding accounting entries to `trans1`.

#### 2. Automated Dividend Reconciliation
* **The Problem in WealthCore:** Dividends must be added manually or imported via generic vouchers.
* **The MProfit Benchmark:** MProfit tracks declared dividends per share. It checks holdings on record date, computes the expected amount, and generates `Debit Bank / Credit Dividend Income`.
* **Implementation Plan:**
  * Integrate AMFI dividend feed for Mutual Funds and BSE/NSE corporate dividend feed for Equities.
  * Introduce a "Pending Dividends Reconciler" screen showing expected dividends vs. bank credits.
  * 1-click confirmation to post journal entries directly to the linked bank account.

#### 3. Export to Tally XML & ITR Schedule CG Excel
* **The Problem in WealthCore:** Reports can be printed or viewed on screen, but cannot be exported directly into chartered accountant software.
* **The MProfit Benchmark:** 
  * Export to Tally XML (Ledgers + Vouchers) so CAs can import a full year's accounting in 10 seconds.
  * Export to Excel matching the exact columns of Income Tax Return Schedule CG (ITR-2 and ITR-3).
* **Implementation Plan:**
  * Build `tallyExportService.ts` generating standard Tally XML envelope `<ENVELOPE><BODY><DATA><TALLYMESSAGE>...`.
  * Build `itrExportService.ts` generating standard quarterly capital gains tables (Upto 15-Jun, 16-Jun to 15-Sep, 16-Sep to 15-Dec, 16-Dec to 15-Mar, 16-Mar to 31-Mar) for advance tax audit.

---

### Phase 2: Medium Priority (Reporting & Optimization)

#### 4. Side-by-Side Multi-Year Balance Sheet Comparison
* **Current State:** Displays single financial year.
* **MProfit Benchmark:** Displays side-by-side comparative columns (e.g. `FY 2023-24 | FY 2024-25 | FY 2025-26`).
* **Implementation Plan:**
  * Update `getBalanceSheet()` to accept an array of FY ending dates (`['2024-03-31', '2025-03-31', '2026-03-31']`).
  * Render multi-column comparative table with variance percentage.

#### 5. Tax-Loss Harvesting Assistant
* **MProfit Benchmark:** Dedicated screen highlighting all open positions with unrealized short-term or long-term losses that can be booked before March 31 to offset taxable realized gains.
* **Implementation Plan:**
  * Query current realized gains for the active FY (`totalSTCG`, `totalLTCG`).
  * Compare against open positions where `current_price < average_buy_price`.
  * Suggest exact scrips and quantities to sell to reduce tax liability to zero (utilizing the ₹1.25L LTCG threshold).

#### 6. Expanded Broker Contract Note Parsers
* **Current State:** Supports CAS PDF and generic contract notes.
* **MProfit Benchmark:** Native parsing for 500+ broker formats.
* **Implementation Plan:**
  * Add dedicated parser regex rules for Zerodha, Groww, ICICI Direct, Kotak Securities, HDFC Securities, and Motilal Oswal.

---

### Phase 3: Advanced Automation

#### 7. Direct Broker API Sync (OAuth)
* Integrate Zerodha Kite Connect / Upstox API to fetch filled orders daily without manual PDF upload.

#### 8. Section 44AB Derivatives (F&O) Turnover Audit Engine
* Calculate absolute turnover (`Sum of Absolute Profits + Absolute Losses`) for Futures and Options to determine mandatory Tax Audit applicability under Section 44AB.

---

## 5. Technical Blueprint: Core Architecture & Data Flow

```
                     ┌───────────────────────────────┐
                     │     RAW INGESTION ENGINE      │
                     │  • MProfit SQLite / CSV       │
                     │  • CAS PDF / Broker Notes     │
                     │  • Live AMFI / NSE Feeds      │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │    CENTRAL SUPABASE STORAGE   │
                     │  • acmac1 (Chart of Accounts) │
                     │  • vouchers1 / transc1        │
                     │  • bs1 (Portfolio Trades)     │
                     │  • sum_table (Live Balances)  │
                     └───────┬───────────────┬───────┘
                             │               │
               ┌─────────────┴──┐         ┌──┴─────────────┐
               ▼                                           ▼
┌─────────────────────────────┐             ┌─────────────────────────────┐
│      ACCOUNTING ENGINE      │             │         PMS ENGINE          │
│ • Balance Sheet             │             │ • Holdings Grid             │
│ • Profit & Loss             │◄───────────►│ • FIFO Capital Gains        │
│ • General Ledger            │ Synchronize │ • Section 112A / 111A Tax   │
│ • Trial Balance             │  Real-Time  │ • XIRR & Performance        │
└─────────────────────────────┘             └─────────────────────────────┘
               │                                           │
               └─────────────┬─────────────────────────────┘
                             ▼
              ┌─────────────────────────────┐
              │    EXPORT & AUDIT SUITE     │
              │ • ITR-2/3 Schedule CG       │
              │ • Tally XML Voucher Feed    │
              │ • 1-Click Timestamped Backup│
              └─────────────────────────────┘
```

---

## 6. Verification & System Health Metrics

As of **2026-09-03**:
* **Ledger Balance Engine:** Verified strictly against double-entry vouchers (`logic.ts`), eliminating historical duplicate additions.
* **Balance Sheet:** Tested against live database: Total Assets = Total Liabilities & Equity (`₹2,16,11,672.37`).
* **Automated Test Suite:** `npx tsc --noEmit` and `eslint` passing with 0 errors.
* **Backup Integrity:** Validated snapshot `snapshot_2026-09-03` and full app zip archive `wealthcore_full_app_backup_2026-09-03.zip` (12.49 MB).
* **Production Status:** Deployed and actively serving from Vercel edge network at [https://wealthcore-clean.vercel.app](https://wealthcore-clean.vercel.app).
