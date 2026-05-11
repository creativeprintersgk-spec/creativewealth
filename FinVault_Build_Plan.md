---
name: FinVault Build Plan
description: Comprehensive step‑by‑step implementation plan for FinVault based on the Master Build Specification v2.0.
type: reference
---

# FinVault Full Implementation Plan
*Document version: 2026‑05‑09*  
*Root folder: `wealthcore-clean/`*  
*Generated from `FinVault_Complete_Master_v2.txt`* 

---
## 1️⃣ Current Status (as of today)
- **UI shells** for all pages listed in Section 1.2 are **present** (checked in the spec).  
  Files modified in the repo (`src/pages/*`, `src/components/pms/*`, etc.) contain the navigation structure and basic components.
- **Backend API routes** (Section 1.3) exist with CRUD endpoints but contain only stub logic.
- **Financial logic** (Section 3) is **missing** – no double‑entry engine, tax calculations, or chart of accounts.
- **Database schema** and migrations have not been created yet.
- **Authentication** is implemented as a simple session‑based system, but OAuth/OTP flows are still pending.
- **Tests, CI, and deployment** are not set up.

---
## 2️⃣ High‑Level Roadmap
| Phase | Goal | Estimated effort | Status |
|------|------|------------------|--------|
| 1 – Database Foundation | Create PostgreSQL schema (users, families, portfolios, accounts, assets, transactions, journal, tax lots, etc.) | 4 days | ⏳ Pending |
| 2 – Auth & Profile | Email/password login, Google OAuth, OTP reset, user profile, FY preference | 3 days | ⏳ Pending |
| 3 – Asset Master | Populate master tables for all 19 asset types, integrate with Supabase storage | 5 days | ⏳ Pending |
| 4 – Transaction Engine | Build UI for voucher entry, auto‑create journal entries, import CSV, audit trail | 6 days | ⏳ Pending |
| 5 – Corporate Actions | Bonus, split, merger, rights, buy‑back, MF‑scheme merge, etc. | 5 days | ⏳ Pending |
| 6 – Holdings & Drill‑down | Holdings view, portfolio breakdown (Level 2), transaction history (Level 3), full contract note (Level 4) | 5 days | ⏳ Pending |
| 7 – Accounting Reports | Balance Summary, General Ledger, Trial Balance, P&L, Cash Flow | 5 days | ⏳ Pending |
| 8 – Capital Gains & Tax | Implement 2024 tax rates, LTCG exemption tracking, grandfathering, lot method (FIFO/LIFO/HIFO) | 4 days | ⏳ Pending |
| 9 – Returns & Performance | XIRR, CAGR, benchmark comparison, Sharpe, Beta, visual charts | 3 days | ⏳ Pending |
|10 – Import Engine | Broker‑specific CSV/Excel import, duplicate detection, mapping UI | 4 days | ⏳ Pending |
|11 – Advanced Reports | Historical holdings snapshot, asset allocation, sector exposure, tax‑loss harvesting suggestions | 3 days | ⏳ Pending |
|12 – UI/UX Polish | Dark mode, responsive layout, Indian number formatting, global search, notifications, accessibility | 4 days | ⏳ Pending |

---
## 3️⃣ Detailed Action Checklist (ordered by dependency)
### Phase 1 – Database Foundation
1. **Create Supabase project** (already done in the spec – add `DATABASE_URL` env var).  
2. Write migration scripts for tables listed in Section 4.1 (users, families, portfolios, groups, accounts, assets, transactions, journal, tax‑lots, etc.).  
3. Set up Supabase client in the backend (`src/services/db.ts`).  
4. Add basic seed data for chart of accounts (Section 3.2).  
5. Verify tables via Supabase UI and write simple sanity tests.

### Phase 2 – Auth & Profile
1. Implement bcrypt password hashing, login, registration endpoints (`auth.ts`).  
2. Add Google OAuth flow using `passport-google-oauth20`.  
3. Build OTP email reset (use Supabase Auth → email → OTP).  
4. Session middleware with inactivity timeout and CSRF protection.  
5. Front‑end pages (`/login`, `/register`, `/profile`) – connect to new endpoints.

### Phase 3 – Asset Master
1. Design `asset_master` table with columns: `isin`, `symbol`, `name`, `exchange`, `type`, `sector`, `face_value`, `current_price`.  
2. Load static data for equities, mutual funds, ETFs, bonds, etc. (CSV imports from public sources).  
3. Add API endpoints for searching assets with type‑ahead.  
4. UI: asset selector component used across transaction forms.

### Phase 4 – Transaction Engine
1. Build voucher UI (tabs: Receipt, Payment, Journal, Contra) – reuse existing `VoucherModal.tsx`.  
2. On voucher submit, call `/transactions` which creates journal entries via double‑entry engine (to be built in Phase 8).  
3. Implement import CSV flow (`scratch/inspect_data.ts`, `scratch/fix_dividend.ts`).  
4. Add audit log table and middleware to record changes.

### Phase 5 – Corporate Actions
1. Define corporate action types in DB.  
2. Write service functions to apply actions to holdings and adjust tax lots.  
3. UI screens for entering actions (bonus, split, rights, etc.).

### Phase 6 – Holdings View & Drill‑down
1. Implement hierarchical holdings table (`HoldingsGrid.tsx`).  
2. Add popup components for Level 2 (portfolio breakdown) and Level 3 (transaction history).  
3. Connect to backend services that query holdings by asset and portfolio.

### Phase 7 – Accounting Reports
1. Balance Summary page – fetch aggregated balances per account, render tree view (`BalanceSummary.tsx`).  
2. General Ledger – paginated list with filters.  
3. Trial Balance, P&L, Cash Flow – use SQL aggregates.

### Phase 8 – Capital Gains & Tax Engine
1. Implement double‑entry engine (core accounting logic) – create `src/logic/accounting.ts`.  
2. Add lot‑method handling (FIFO default, optional LIFO/HIFO).  
3. Tax calculation module (`src/logic/tax.ts`) implementing rules from Section 3.3.  
4. Exemption tracker for LTCG ₹1.25 L per FY.  
5. Unit tests covering buy/sell, dividend, corporate actions.

### Phase 9 – Returns & Performance
1. Compute XIRR, CAGR, compare against benchmarks (Nifty 50, Sensex).  
2. Visual chart component (`PerformanceChart.tsx`).

### Phase 10 – Import Engine
1. Build UI for selecting broker template, uploading file, previewing rows.  
2. Parse CSV/Excel, map columns to internal schema, handle duplicates, partial imports.  
3. Store import metadata in `broker_imports` table.

### Phase 11 – Advanced Reports
1. Historical holdings snapshot – snapshot tables per FY.  
2. Asset allocation, sector exposure, concentration risk reports.  
3. Tax‑loss harvesting suggestions UI.

### Phase 12 – UI/UX Polish
1. Add dark‑mode toggle (use `useColorScheme` hook).  
2. Make layout responsive (mobile breakpoints).  
3. Indian number formatting utilities (`formatIndian.ts`).  
4. Global search component, notification bell, toast system, confirmation dialogs.

---
## 4️⃣ How to Use This Plan
- **Copy the file** `FinVault_Build_Plan.md` into the repo’s root.  
- Each time you finish a checklist item, **tick the corresponding `?`** in the original master document and **commit** the change.  
- When you start a new module, open a fresh Claude chat and attach this plan; the assistant will read the pending items and generate the OpenCode prompt for that phase.
- Keep the plan updated: after completing a phase, add a short note in the *Status* column above and commit the change.

---
## 5️⃣ Storage
The plan is saved at:
```
C:\Users\Admin\Desktop\wealthcore-clean\FinVault_Build_Plan.md
```
You can reference it in future sessions without reopening the master spec.

---
*End of plan.*
