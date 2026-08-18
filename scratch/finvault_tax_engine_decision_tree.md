# FinVault — Capital Gains Tax Engine: Master Decision Tree

**Basis:** Income Tax Act as amended by Finance Act 2023 (Sec 50AA introduced) and Budget 2024 (rates/holding periods revised, effective for transfers on/after 23 July 2024; Sec 50AA definition narrowed effective 1 April 2025).

**Scope:** Domestic listed equity, equity-oriented MFs, listed bonds/NCDs, unlisted shares, real estate, debt-oriented MFs (Specified Mutual Funds), Gold/Silver ETFs & FoFs, international funds, hybrid/multi-asset funds.

---

## 1. Top-level classification logic

```
function classify_gain(asset):
    if asset.category == "DEBT_MF_SPECIFIED":
        return debt_specified_mf_logic(asset)
    elif asset.category == "EQUITY_ORIENTED_MF":
        return listed_365_logic(asset, rate_st=0.20, rate_lt=0.125, exemption_112A=True)
    elif asset.category == "LISTED_EQUITY_SHARE":
        return listed_365_logic(asset, rate_st=0.20, rate_lt=0.125, exemption_112A=True)
    elif asset.category == "LISTED_BOND_NCD":
        return listed_365_logic(asset, rate_st="slab", rate_lt=0.125, exemption_112A=False)
    elif asset.category == "GOLD_SILVER_ETF_LISTED":
        return listed_365_logic(asset, rate_st="slab", rate_lt=0.125, exemption_112A=False)
    elif asset.category == "UNLISTED_SHARE":
        return unlisted_730_logic(asset, rate_st="slab", rate_lt=0.125)
    elif asset.category == "REAL_ESTATE":
        return real_estate_logic(asset)  # special dual-rate transitional rule
    elif asset.category == "GOLD_SILVER_FOF_OR_HYBRID_LT65_OR_INTL_MF":
        return unlisted_730_logic(asset, rate_st="slab", rate_lt=0.125)
    else:
        raise UnclassifiedAssetError(asset)
```

---

## 2. Category definitions (map your existing codes here)

| FinVault Category | Old Codes | Definition |
|---|---|---|
| `LISTED_EQUITY_SHARE` | 10, 12, 50, 51 | Shares of domestic companies listed on a recognized stock exchange, STT paid |
| `EQUITY_ORIENTED_MF` | 60 | Fund/ETF with ≥65% in domestic listed equity |
| `LISTED_BOND_NCD` | 40, 100, 110 | Listed bonds/NCDs/debentures traded on exchange |
| `UNLISTED_SHARE` | 190 | Private company shares, ESOPs pre-listing, etc. |
| `REAL_ESTATE` | 160, 210 | Land, residential/commercial property |
| `DEBT_MF_SPECIFIED` | 61, 150 | Fund with ≥65% in debt & money market instruments (Sec 50AA, post-Apr-2025 definition) |
| `GOLD_SILVER_ETF_LISTED` | *(new — split out of 62)* | Exchange-traded Gold/Silver ETF (e.g. Gold BeES, Silver ETF) |
| `GOLD_SILVER_FOF_OR_HYBRID_LT65_OR_INTL_MF` | 62, 75, 151 | Non-listed: Gold/Silver FoFs, multi-asset funds with <65% domestic equity, international/feeder funds, FoFs generally |

> **Critical engine change:** code `62` currently lumped Gold ETFs with Gold FoFs and other "specified" funds under one 36-month rule. Split it: **listed instruments (ETFs) → new `GOLD_SILVER_ETF_LISTED` category with 365-day threshold**; **unlisted (FoFs, multi-asset <65%, international) stay in the 730-day bucket.**

---

## 3. Sub-logic functions

### 3a. Listed instruments — 365-day threshold
```
function listed_365_logic(asset, rate_st, rate_lt, exemption_112A):
    holding_days = asset.sale_date - asset.purchase_date
    if holding_days <= 365:
        gain_type = "STCG"
        tax_rate = rate_st   # "slab" or flat %, apply Sec 111A only if equity/equity-MF
    else:
        gain_type = "LTCG"
        tax_rate = rate_lt   # 12.5%, no indexation (post 23-Jul-2024)
        if exemption_112A:
            gain = max(0, gain - pooled_112A_exemption_remaining(fy))  # ₹1.25L per FY, pooled across ALL 112A assets
    return TaxResult(gain_type, tax_rate, indexation=False)
```
**Note:** the ₹1.25L exemption under Sec 112A is a **single pooled bucket per PAN per FY** across all equity shares + equity-oriented MFs/ETFs — never per-asset, never per-transaction. Engine must maintain a running FY-level exemption ledger, not apply it per trade.

### 3b. Unlisted instruments — 730-day threshold
```
function unlisted_730_logic(asset, rate_st, rate_lt):
    holding_days = asset.sale_date - asset.purchase_date
    if holding_days <= 730:
        gain_type = "STCG"
        tax_rate = "slab"
    else:
        gain_type = "LTCG"
        tax_rate = 0.125   # flat, no indexation, no exemption threshold
    return TaxResult(gain_type, tax_rate, indexation=False)
```

### 3c. Debt Fund (Specified MF, Sec 50AA) — acquisition-date branch
```
function debt_specified_mf_logic(asset):
    if asset.purchase_date >= "2023-04-01":
        # Post Finance Act 2023: NO LTCG EVER, regardless of holding period
        return TaxResult("STCG", tax_rate="slab", indexation=False)
    else:
        # Grandfathered pre-01/04/2023 units — old 36-month regime survives
        holding_days = asset.sale_date - asset.purchase_date
        if holding_days <= 1095:
            return TaxResult("STCG", tax_rate="slab", indexation=False)
        else:
            return TaxResult("LTCG", tax_rate=0.20, indexation=True)
```
**This is the one your current engine gets wrong by defaulting everything to 1095 days.** Only pre-April-2023 debt fund purchases get the 36-month/20%/indexation treatment. Anything bought on or after 1 April 2023 is STCG-at-slab forever — there is no LTCG exit for these units at all.

### 3d. Real estate — transitional dual-rate choice
```
function real_estate_logic(asset):
    holding_days = asset.sale_date - asset.purchase_date
    if holding_days <= 730:
        return TaxResult("STCG", tax_rate="slab", indexation=False)
    else:
        if asset.purchase_date < "2024-07-23":
            # Taxpayer's choice — engine should compute BOTH and pick lower tax
            option_a = compute_tax(gain_with_indexation(asset), rate=0.20)
            option_b = compute_tax(gain_without_indexation(asset), rate=0.125)
            return min(option_a, option_b, key=lambda x: x.tax_payable)
        else:
            # Acquired on/after 23-Jul-2024: no indexation option, flat 12.5% only
            return TaxResult("LTCG", tax_rate=0.125, indexation=False)
```
This is the one case in the whole engine where the *lower of two computations* must be surfaced to the user, not a single deterministic rate — flag this in the UI as "compare indexation vs flat rate" for pre-23-Jul-2024 property.

---

## 4. Summary table — final corrected mapping

| Category | Holding Threshold | STCG Rate | LTCG Rate | Indexation | ₹1.25L Exemption |
|---|---|---|---|---|---|
| Listed Equity Shares | 365 days | 20% | 12.5% | No | Yes (pooled) |
| Equity-Oriented MF/ETF | 365 days | 20% | 12.5% | No | Yes (pooled) |
| Listed Bonds/NCDs | 365 days | Slab | 12.5% | No | No |
| **Gold/Silver ETF (listed)** | **365 days** | **Slab** | **12.5%** | **No** | **No** |
| Unlisted Shares | 730 days | Slab | 12.5% | No | No |
| Real Estate (bought ≥23/07/2024) | 730 days | Slab | 12.5% | No | No |
| Real Estate (bought <23/07/2024) | 730 days | Slab | **Better of 20%+indexation OR 12.5% flat** | Conditional | No |
| **Gold/Silver FoF, Multi-Asset <65% equity, Intl MF** | **730 days** | **Slab** | **12.5%** | **No** | **No** |
| Debt MF, purchased ≥01/04/2023 | N/A | Slab | **No LTCG exists** | No | No |
| Debt MF, purchased <01/04/2023 (grandfathered) | 1095 days | Slab | 20% | **Yes** | No |

---

## 5. Engine implementation checklist

- [ ] Split existing code `62` into two distinct categories: listed Gold/Silver ETFs (365-day) vs. unlisted Gold/Silver FoFs & multi-asset/international funds (730-day)
- [ ] Add acquisition-date conditional branch to the debt MF (`61`, `150`) logic — do not apply a flat 1095-day rule to all debt fund lots
- [ ] Build a per-PAN, per-FY running ledger for the Sec 112A ₹1.25L exemption pool — must aggregate across every listed equity share + equity-oriented MF/ETF sale in that FY before computing tax, not per-lot
- [ ] Real estate LTCG needs a "compute both, return lower" branch for pre-23-Jul-2024 acquisitions — flag this as a UI comparison, not a silent auto-pick, so the client/advisor can sanity-check
- [ ] For multi-asset/hybrid funds, store the fund's **trailing 12-month average domestic equity allocation** as fund metadata (refreshed periodically) rather than hardcoding a scheme as "equity" or "non-equity" — some funds can drift across the 65% line over time
- [ ] Add a data validation check: any `DEBT_MF_SPECIFIED` lot with `purchase_date >= 2023-04-01` should never show `gain_type = "LTCG"` in output — treat this as an engine assertion/sanity check, not just a rate lookup

Want me to also draft the FMV/grandfathering (31-Jan-2018) branch as a separate module, since that only applies to pre-2018 equity holdings and is a distinct code path from everything above?

