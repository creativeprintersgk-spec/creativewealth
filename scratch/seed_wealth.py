"""
WealthCore Seed Script
Populates realistic stock + MF holdings into db.json,
properly linked to actual portfolio IDs from the database.
"""

import json
import uuid
import random
from datetime import date, timedelta

DB_PATH = 'db.json'

with open(DB_PATH, 'r', encoding='utf-8') as f:
    db = json.load(f)

# ── Read real IDs from DB ─────────────────────────────────────────────────────
portfolios = {p['id']: p for p in db.get('portfolios', [])}
print(f"Found {len(portfolios)} portfolios:")
for pid, p in portfolios.items():
    print(f"  {pid}: {p['portfolioName']}")

# Portfolio IDs
ARJIN_EQ     = '0wpdrjsvq'
ARJIN_DEBT   = 'z7hv9y8lm'
PRS_EQ       = '79dvmya60'

# Bank ledger for double-entry (Kotak Bank)
BANK_LEDGER  = 'l20'

# ── Stock Ledgers to create ───────────────────────────────────────────────────
STOCK_LEDGERS = [
    {'id': 'stk_hdfc',    'name': 'HDFC Bank Ltd',              'groupId': 'stocks'},
    {'id': 'stk_tcs',     'name': 'Tata Consultancy Services',   'groupId': 'stocks'},
    {'id': 'stk_reliance','name': 'Reliance Industries Ltd',     'groupId': 'stocks'},
    {'id': 'stk_infosys', 'name': 'Infosys Ltd',                 'groupId': 'stocks'},
    {'id': 'stk_icicibnk','name': 'ICICI Bank Ltd',              'groupId': 'stocks'},
    {'id': 'stk_lt',      'name': 'Larsen & Toubro Ltd',         'groupId': 'stocks'},
    {'id': 'stk_ril',     'name': 'Asian Paints Ltd',            'groupId': 'stocks'},
]

# MF Ledgers already exist: l10–l18. We'll add a few missing ones.
MF_NEW_LEDGERS = [
    {'id': 'mf_parag',  'name': 'Parag Parikh Flexi Cap Fund - Direct Growth', 'groupId': 'mf_equity'},
    {'id': 'mf_axis',   'name': 'Axis Small Cap Fund - Direct Plan - Growth',  'groupId': 'mf_equity'},
]

# ── Merge ledgers (avoid duplicates) ─────────────────────────────────────────
existing_ledger_ids = {l['id'] for l in db.get('ledgers', [])}
new_ledgers = []
for l in STOCK_LEDGERS + MF_NEW_LEDGERS:
    if l['id'] not in existing_ledger_ids:
        new_ledgers.append({
            'id': l['id'],
            'name': l['name'],
            'groupId': l['groupId'],
            'openingBalance': 0,
            'openingType': 'DR'
        })
        print(f"  + Ledger: {l['name']}")

db['ledgers'].extend(new_ledgers)

# ── Helper functions ──────────────────────────────────────────────────────────
def fy(date_str):
    d = date.fromisoformat(date_str)
    y, m = d.year, d.month
    return f"{y}-{y+1}" if m >= 4 else f"{y-1}-{y}"

def random_date(start_str, end_str):
    s = date.fromisoformat(start_str)
    e = date.fromisoformat(end_str)
    return (s + timedelta(days=random.randint(0, (e - s).days))).isoformat()

existing_voucher_ids = {v['id'] for v in db.get('vouchers', [])}
existing_entry_ids   = {e['id'] for e in db.get('entries', [])}

new_vouchers = []
new_entries  = []

def buy(ledger_id, portfolio_id, qty, price, date_str):
    """Record a stock/MF purchase"""
    amount = round(qty * price, 2)
    vid = str(uuid.uuid4())
    eid1 = str(uuid.uuid4())
    eid2 = str(uuid.uuid4())

    new_vouchers.append({
        'id': vid,
        'date': date_str,
        'type': 'payment',
        'narration': f'Purchase of {ledger_id} — {qty} units @ {price:.2f}',
        'voucherNo': f'PUR-{random.randint(1000,9999)}',
        'fy': fy(date_str),
        'portfolioId': portfolio_id
    })
    new_entries.append({
        'id': eid1,
        'voucherId': vid,
        'ledgerId': ledger_id,
        'debit': amount,
        'credit': 0,
        'quantity': qty,
        'price': round(price, 4)
    })
    new_entries.append({
        'id': eid2,
        'voucherId': vid,
        'ledgerId': BANK_LEDGER,
        'debit': 0,
        'credit': amount
    })
    return vid

def sell(ledger_id, portfolio_id, qty, price, date_str):
    """Record a stock/MF sale"""
    amount = round(qty * price, 2)
    vid = str(uuid.uuid4())
    eid1 = str(uuid.uuid4())
    eid2 = str(uuid.uuid4())

    new_vouchers.append({
        'id': vid,
        'date': date_str,
        'type': 'receipt',
        'narration': f'Sale of {ledger_id} — {qty} units @ {price:.2f}',
        'voucherNo': f'SL-{random.randint(1000,9999)}',
        'fy': fy(date_str),
        'portfolioId': portfolio_id
    })
    new_entries.append({
        'id': eid1,
        'voucherId': vid,
        'ledgerId': BANK_LEDGER,
        'debit': amount,
        'credit': 0
    })
    new_entries.append({
        'id': eid2,
        'voucherId': vid,
        'ledgerId': ledger_id,
        'debit': 0,
        'credit': amount,
        'quantity': qty,
        'price': round(price, 4)
    })
    return vid

# ─────────────────────────────────────────────────────────────────────────────
# ARJIN EQ Portfolio — Stock purchases (FY 2024-25, 2025-26)
# ─────────────────────────────────────────────────────────────────────────────
print("\nSeeding Arjin EQ Portfolio (stocks)...")

buy('stk_hdfc',     ARJIN_EQ, 500, 1420.50, '2024-07-15')
buy('stk_hdfc',     ARJIN_EQ, 300, 1390.00, '2024-11-20')
sell('stk_hdfc',    ARJIN_EQ, 200, 1680.00, '2025-02-10')

buy('stk_tcs',      ARJIN_EQ, 150, 3780.00, '2024-08-05')
buy('stk_tcs',      ARJIN_EQ, 100, 3650.00, '2025-01-12')

buy('stk_reliance', ARJIN_EQ, 400, 2870.00, '2024-06-20')
sell('stk_reliance',ARJIN_EQ, 150, 3100.00, '2025-01-08')

buy('stk_infosys',  ARJIN_EQ, 300, 1580.00, '2024-09-03')

# ─────────────────────────────────────────────────────────────────────────────
# PRS EQ Portfolio — Stock purchases
# ─────────────────────────────────────────────────────────────────────────────
print("Seeding PRS EQ Portfolio (stocks)...")

buy('stk_hdfc',     PRS_EQ, 200, 1450.00, '2024-05-10')
buy('stk_icicibnk', PRS_EQ, 600, 1140.00, '2024-07-22')
sell('stk_icicibnk',PRS_EQ, 200, 1290.00, '2025-01-15')

buy('stk_lt',       PRS_EQ, 250, 3250.00, '2024-08-18')
buy('stk_ril',      PRS_EQ, 300, 2900.00, '2024-10-05')
sell('stk_ril',     PRS_EQ, 100, 3180.00, '2025-02-20')

buy('stk_tcs',      PRS_EQ, 100, 3900.00, '2024-12-12')
buy('stk_infosys',  PRS_EQ, 400, 1610.00, '2025-01-25')

# ─────────────────────────────────────────────────────────────────────────────
# ARJIN DEBT Portfolio — MF purchases
# ─────────────────────────────────────────────────────────────────────────────
print("Seeding Arjin Debt Portfolio (MF)...")

buy('mf_parag',  ARJIN_DEBT, 820, 68.50,  '2024-06-01')
buy('mf_parag',  ARJIN_DEBT, 600, 71.20,  '2024-09-15')
sell('mf_parag', ARJIN_DEBT, 300, 78.40,  '2025-01-10')

buy('mf_axis',   ARJIN_DEBT, 1200, 105.00, '2024-07-01')
buy('mf_axis',   ARJIN_DEBT,  800, 112.00, '2024-11-01')

# Also add new MF to Arjin EQ
buy('mf_parag',  ARJIN_EQ, 500, 69.00, '2024-08-10')
buy('mf_axis',   ARJIN_EQ, 400, 109.00, '2025-02-15')

# ─────────────────────────────────────────────────────────────────────────────
# Merge into DB
# ─────────────────────────────────────────────────────────────────────────────
db['vouchers'].extend(new_vouchers)
db['entries'].extend(new_entries)

with open(DB_PATH, 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2, ensure_ascii=False)

print(f"\nDone! Added:")
print(f"  {len(new_ledgers)} new ledgers")
print(f"  {len(new_vouchers)} new vouchers")
print(f"  {len(new_entries)} new entries")
print(f"\nTotal in DB:")
print(f"  Ledgers:  {len(db['ledgers'])}")
print(f"  Vouchers: {len(db['vouchers'])}")
print(f"  Entries:  {len(db['entries'])}")
