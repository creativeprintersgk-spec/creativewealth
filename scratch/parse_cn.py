"""
parse_cn.py — Multi-broker Contract Note Parser
Supports: Zerodha, Dhan, RK Global (HTML/CSV), MStock (Mirae Asset)

Usage: python parse_cn.py <pdf_path> <password> [broker_hint]
"""
import sys
import json
import re
import os

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# ─── Helpers ────────────────────────────────────────────────────────────────

def parse_float_safe(s):
    """Parse a number string that may contain commas, unicode minus, spaces."""
    if not s:
        return 0.0
    s = str(s).strip()
    s = s.replace(",", "").replace("\u2212", "-").replace("\u2013", "-")
    try:
        return float(s)
    except ValueError:
        return 0.0


def extract_charge_re(pattern, text):
    """Extract the first number after a label pattern."""
    match = re.search(pattern + r"[^\d]{0,500}?([\d,]+\.\d{2})", text, re.IGNORECASE | re.DOTALL)
    if match:
        return parse_float_safe(match.group(1))
    return 0.0


def normalize_date(s):
    """Convert DD/MM/YYYY or DD-MM-YYYY or DD-MMM-YYYY to YYYY-MM-DD."""
    if not s:
        return ""
    s = s.strip()
    month_map = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "may": "05", "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "oct": "10", "nov": "11", "dec": "12"
    }
    # DD-MMM-YYYY
    m = re.match(r"(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{4})", s)
    if m:
        d, mon, y = m.group(1), m.group(2).lower(), m.group(3)
        return f"{y}-{month_map.get(mon, '01')}-{d.zfill(2)}"
    # DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", s)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    # YYYY-MM-DD already
    m = re.match(r"(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    return s


def detect_broker(text, hint="zerodha"):
    """Auto-detect broker from PDF text."""
    t = text.lower()
    if "zerodha" in t:
        return "zerodha"
    if "dhan.co" in t or "dhanbrokingltd" in t or " dhan " in t:
        return "dhan"
    if "r k global" in t or "rk global" in t or "r.k. global" in t or "rkglobal" in t:
        return "rk_global"
    if "mirae asset" in t or "mstock" in t or "miraeass" in t:
        return "mirae"
    return hint


# ─── Zerodha ────────────────────────────────────────────────────────────────

def parse_zerodha(text, password=""):
    trades = []
    charges = {"stt": 0, "brokerage": 0, "gst": 0, "stamp": 0, "transCharges": 0, "other": 0}
    pan = ""
    cn_date = ""
    cn_no = ""

    # PAN
    pan_m = re.search(r"PAN\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])", text, re.IGNORECASE)
    if pan_m:
        pan = pan_m.group(1).upper()

    # Date — look for "Trade Date" or "Contract Date"
    date_m = re.search(r"(?:Trade\s+Date|Contract\s+Date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})", text, re.IGNORECASE)
    if date_m:
        cn_date = normalize_date(date_m.group(1))

    # CN number
    cn_m = re.search(r"(?:Contract\s+Note\s+No\.?|CN\s+No\.?)\s*[:\-]?\s*([A-Z0-9\/\-]+)", text, re.IGNORECASE)
    if cn_m:
        cn_no = cn_m.group(1).strip()

    # Charges
    charges["stt"] = extract_charge_re(r"Securities\s+transaction\s+tax", text)
    if charges["stt"] == 0:
        charges["stt"] = extract_charge_re(r"\bSTT\b", text)
    charges["brokerage"] = extract_charge_re(r"Taxable\s+value\s+of\s+Supply\s*\(Brokerage\)", text)
    if charges["brokerage"] == 0:
        charges["brokerage"] = extract_charge_re(r"\bBrokerage\b", text)
    charges["stamp"] = extract_charge_re(r"Stamp\s+[Dd]uty", text)
    
    # Mirae splits "Taxable Value of Supply (Exchange..." over multiple lines
    charges["transCharges"] = extract_charge_re(r"Exchange\s+transaction\s+charges", text)
    if charges["transCharges"] == 0:
        charges["transCharges"] = extract_charge_re(r"Taxable\s+Value\s+of\s+Supply\s*\(Exchange", text)

    cgst = extract_charge_re(r"\bCGST\b", text)
    sgst = extract_charge_re(r"\bSGST\b", text)
    igst = extract_charge_re(r"\bIGST\b", text)
    charges["gst"] = cgst + sgst + igst

    sebi = extract_charge_re(r"SEBI\s+Turnover", text)
    ipft = extract_charge_re(r"IPFT\s+CONTRIBUTION", text)
    charges["other"] = sebi + ipft

    # Trades — use token-split approach (immune to spacing variations)
    # Zerodha ISIN summary line token layout (14 tokens):
    # [0]=ISIN  [1]=Name  [2]=buyQty  [3]=buyWap  [4]=0  [5]=buyWap2  [6]=buyVal
    # [7]=sellQty  [8]=sellWap  [9]=sellWap2  [10]=0  [11]=0.00  [12]=totalQty  [13]=netAmt
    # Stock names CAN have multiple words (e.g. "POWER GRID CORP") — so we find where
    # the numbers start and treat everything between ISIN and numbers as the name.
    for line in text.split("\n"):
        line_stripped = line.strip()
        if not re.match(r"\s*IN[A-Z0-9]{10}", line_stripped):
            continue
        tokens = line_stripped.split()
        if len(tokens) < 3:
            continue
        # tokens[0] must be the ISIN
        if not re.match(r"^IN[A-Z0-9]{10}$", tokens[0]):
            continue
        isin = tokens[0]

        # Find where the numeric columns start (first pure-number token after token[0])
        # A number token: digits, dots, commas, and unicode/ascii minus
        def is_number_tok(s):
            s2 = s.replace(",", "").replace("\u2212", "-").replace("(", "-").replace(")", "")
            try:
                float(s2)
                return True
            except ValueError:
                return False

        name_end_idx = 1
        for i in range(1, len(tokens)):
            if is_number_tok(tokens[i]):
                name_end_idx = i
                break
        else:
            continue  # no numbers found — skip

        name = " ".join(tokens[1:name_end_idx])
        nums = [parse_float_safe(t) for t in tokens[name_end_idx:]]

        # We need at least 7 numbers for buyQty..sellQty
        if len(nums) < 7:
            continue

        # Map: nums[0]=buyQty, nums[1]=buyWap, nums[2]=0, nums[3]=buyWap2,
        #       nums[4]=buyVal, nums[5]=sellQty, nums[6]=sellWap, ...
        buy_qty  = nums[0]
        buy_wap  = nums[1]
        buy_val  = nums[4]  # gross buy value
        sell_qty = nums[5] if len(nums) > 5 else 0
        sell_wap = nums[6] if len(nums) > 6 else 0
        # sellVal = sellQty * sellWap (or look for it further along)
        sell_val = abs(nums[9]) if len(nums) > 9 else (sell_qty * sell_wap)

        # Skip header/total rows
        if buy_qty == 0 and sell_qty == 0:
            continue

        trades.append({
            "isin": isin,
            "assetName": name.strip(),
            "buyQty":  buy_qty,
            "buyWap":  buy_wap,
            "buyVal":  buy_val,
            "sellQty": sell_qty,
            "sellWap": sell_wap,
            "sellVal": sell_val,
        })

    # Calculate totals
    total_buy_val = sum(t["buyVal"] for t in trades)
    total_sell_val = sum(t["sellVal"] for t in trades)
    net_trade_val = total_buy_val - total_sell_val
    
    # Attempt to perfectly derive charges from the Final Net Amount
    net_amount_m = re.search(r"Net\s+amount[^\d]{0,500}?([\d,]+\.\d{2})", text, re.IGNORECASE | re.DOTALL)
    if net_amount_m:
        final_net = parse_float_safe(net_amount_m.group(1))
        if net_trade_val >= 0:
            total_charges = final_net - net_trade_val
        else:
            total_charges = abs(net_trade_val) - final_net
            
        charges["other"] = round(total_charges - charges["stt"], 2)
        charges["brokerage"] = 0
        charges["gst"] = 0
        charges["stamp"] = 0
        charges["transCharges"] = 0

    return {
        "status": "success",
        "broker": "zerodha",
        "pan": pan,
        "cnDate": cn_date,
        "cnNo": cn_no,
        "trades": trades,
        "charges": charges,
    }


# ─── Dhan ───────────────────────────────────────────────────────────────────

def parse_dhan(text):
    trades = []
    charges = {"stt": 0, "brokerage": 0, "gst": 0, "stamp": 0, "transCharges": 0, "other": 0}
    pan = ""
    cn_date = ""
    cn_no = ""

    pan_m = re.search(r"PAN\s*(?:No\.?|:)\s*([A-Z]{5}\d{4}[A-Z])", text, re.IGNORECASE)
    if pan_m:
        pan = pan_m.group(1).upper()

    date_m = re.search(r"Trade\s+Date\s*[:\-]?\s*(\d{1,2}[-/\s][A-Za-z]{3}[-/\s]\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})", text, re.IGNORECASE)
    if date_m:
        cn_date = normalize_date(date_m.group(1))

    cn_m = re.search(r"(?:Contract\s+Note\s+No\.?|Trade\s+Confirmation\s+No\.?)\s*[:\-]?\s*([A-Z0-9\/\-]+)", text, re.IGNORECASE)
    if cn_m:
        cn_no = cn_m.group(1).strip()

    def get_last_charge(pat):
        m = re.findall(pat + r"[^\d]{0,500}?([\d,]+\.\d{2})\b", text, re.IGNORECASE | re.DOTALL)
        return float(m[-1].replace(",", "")) if m else 0.0

    charges["brokerage"] = get_last_charge(r"Taxable\s+Value\s+Of\s+Supply\s+\(Brokerage\)")
    charges["stt"] = get_last_charge(r"Securities\s+Transactions?\s+Tax")
    charges["gst"] = get_last_charge(r"CGST.*?Supply") + get_last_charge(r"SGST.*?Supply") + get_last_charge(r"IGST.*?Supply")
    charges["stamp"] = get_last_charge(r"Stamp\s+[Dd]uty")
    charges["transCharges"] = get_last_charge(r"NSE\s+Transaction\s+Charges") + get_last_charge(r"BSE\s+Transaction\s+Charges") + get_last_charge(r"SEBI\s+Fees") + get_last_charge(r"IPFT\s+Contribution")

    # Trade rows — robust token split approach
    for line in text.split("\n"):
        line_stripped = line.strip()
        if not re.search(r"\bIN[A-Z0-9]{10}\b", line_stripped):
            continue
        
        tokens = line_stripped.split()
        isin_idx = -1
        for i, t in enumerate(tokens):
            if re.match(r"^IN[A-Z0-9]{10}$", t):
                isin_idx = i
                break
        if isin_idx == -1:
            continue
            
        isin = tokens[isin_idx]
        
        def is_number_tok(s):
            s2 = s.replace(",", "").replace("\u2212", "-").replace("(", "-").replace(")", "")
            try:
                float(s2)
                return True
            except ValueError:
                return False

        name_end_idx = isin_idx + 1
        for i in range(isin_idx + 1, len(tokens)):
            if is_number_tok(tokens[i]):
                name_end_idx = i
                break
        else:
            continue

        name = " ".join(tokens[isin_idx+1:name_end_idx])
        nums = [parse_float_safe(t) for t in tokens[name_end_idx:] if is_number_tok(t)]


        if len(nums) == 10:
            trades.append({
                "isin": isin,
                "assetName": name.strip(),
                "buyQty": nums[0],
                "buyWap": nums[1],
                "buyVal": nums[3],
                "sellQty": nums[4],
                "sellWap": nums[5],
                "sellVal": nums[7],
            })
        elif len(nums) >= 6:
            net_val = nums[-1]
            if net_val < 0: # BUY
                trades.append({
                    "isin": isin,
                    "assetName": name.strip(),
                    "buyQty": nums[0],
                    "buyWap": nums[1],
                    "buyVal": nums[3],
                    "sellQty": 0,
                    "sellWap": 0,
                    "sellVal": 0,
                })
            else: # SELL
                trades.append({
                    "isin": isin,
                    "assetName": name.strip(),
                    "buyQty": 0,
                    "buyWap": 0,
                    "buyVal": 0,
                    "sellQty": nums[0],
                    "sellWap": nums[1],
                    "sellVal": nums[3],
                })


    return {
        "status": "success",
        "broker": "dhan",
        "pan": pan,
        "cnDate": cn_date,
        "cnNo": cn_no,
        "trades": trades,
        "charges": charges,
    }


# ─── RK Global (HTML) ───────────────────────────────────────────────────────

def parse_rk_global_html(text):
    """Parse RK Global HTML contract note using regex (no DOM deps)."""
    trades_by_isin = {}
    charges = {"stt": 0, "brokerage": 0, "gst": 0, "stamp": 0, "transCharges": 0, "other": 0}
    pan = ""
    cn_date = ""
    cn_no = ""

    # Strip HTML tags for text scanning
    plain = re.sub(r"<[^>]+>", " ", text)
    plain = re.sub(r"&nbsp;", " ", plain)
    plain = re.sub(r"\s+", " ", plain)

    pan_m = re.search(r"PAN\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])", plain, re.IGNORECASE)
    if pan_m:
        pan = pan_m.group(1).upper()

    date_m = re.search(r"(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})", plain)
    if date_m:
        cn_date = normalize_date(date_m.group(1))

    cn_m = re.search(r"Contract\s+Note\s+(?:No\.?|Number)\s*[:\-]?\s*([\w\/\-]+)", plain, re.IGNORECASE)
    if cn_m:
        cn_no = cn_m.group(1).strip()

    # Find table rows with ISIN
    rows = re.findall(
        r"(IN[A-Z0-9]{10}).*?([BS])\s+([\d,]+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)",
        plain, re.IGNORECASE
    )
    for row in rows:
        isin, bs, qty_s, rate_s, val_s = row
        qty = parse_float_safe(qty_s)
        rate = parse_float_safe(rate_s)
        val = parse_float_safe(val_s)

        if isin not in trades_by_isin:
            # Try to find asset name near ISIN
            name_m = re.search(isin + r"\s+([\w\s&\.\-]+?)\s+[BS]", plain)
            name = name_m.group(1).strip() if name_m else isin
            trades_by_isin[isin] = {"isin": isin, "assetName": name,
                                     "buyQty": 0, "buyWap": 0, "buyVal": 0,
                                     "sellQty": 0, "sellWap": 0, "sellVal": 0}
        t = trades_by_isin[isin]
        if bs.upper() == "B":
            t["buyQty"] += qty
            t["buyVal"] += val
            t["buyWap"] = t["buyVal"] / t["buyQty"] if t["buyQty"] else 0
        else:
            t["sellQty"] += qty
            t["sellVal"] += val
            t["sellWap"] = t["sellVal"] / t["sellQty"] if t["sellQty"] else 0

    # Charges
    charges["brokerage"] = extract_charge_re(r"\bBrokerage\b", plain)
    charges["stt"] = extract_charge_re(r"\bSTT\b", plain)
    charges["gst"] = extract_charge_re(r"\bGST\b", plain)
    charges["stamp"] = extract_charge_re(r"Stamp", plain)
    charges["transCharges"] = extract_charge_re(r"Transaction\s+Charges", plain)

    return {
        "status": "success",
        "broker": "rk_global",
        "pan": pan,
        "cnDate": cn_date,
        "cnNo": cn_no,
        "trades": list(trades_by_isin.values()),
        "charges": charges,
    }


def parse_rk_global_csv(text):
    """Parse RK Global CSV tradebook."""
    trades_by_isin = {}
    charges = {"stt": 0, "brokerage": 0, "gst": 0, "stamp": 0, "transCharges": 0, "other": 0}
    lines = text.strip().split("\n")
    if not lines:
        return {"status": "error", "message": "Empty CSV"}

    headers = [h.strip().strip('"').lower().replace(" ", "_") for h in lines[0].split(",")]

    def col(row_parts, *names):
        for name in names:
            for i, h in enumerate(headers):
                if name in h and i < len(row_parts):
                    return row_parts[i].strip().strip('"')
        return ""

    cn_date = ""
    pan = ""

    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(",")
        isin = col(parts, "isin")
        if not isin or not re.match(r"IN[A-Z0-9]{10}", isin):
            continue

        name = col(parts, "scrip", "symbol", "stock")
        bs = col(parts, "buy_sell", "b/s", "side", "buysell").upper()
        qty = parse_float_safe(col(parts, "qty", "quantity"))
        price = parse_float_safe(col(parts, "price", "rate", "avg"))
        val = qty * price if qty and price else parse_float_safe(col(parts, "value", "val", "amount"))
        date_s = col(parts, "trade_date", "date")
        if date_s and not cn_date:
            cn_date = normalize_date(date_s)

        if isin not in trades_by_isin:
            trades_by_isin[isin] = {"isin": isin, "assetName": name,
                                     "buyQty": 0, "buyWap": 0, "buyVal": 0,
                                     "sellQty": 0, "sellWap": 0, "sellVal": 0}
        t = trades_by_isin[isin]
        if "BUY" in bs or bs == "B":
            t["buyQty"] += qty
            t["buyVal"] += val
            t["buyWap"] = t["buyVal"] / t["buyQty"] if t["buyQty"] else 0
        elif "SELL" in bs or bs == "S":
            t["sellQty"] += qty
            t["sellVal"] += val
            t["sellWap"] = t["sellVal"] / t["sellQty"] if t["sellQty"] else 0

    return {
        "status": "success",
        "broker": "rk_global",
        "pan": pan,
        "cnDate": cn_date,
        "cnNo": "",
        "trades": list(trades_by_isin.values()),
        "charges": charges,
    }


# ─── MStock / Mirae Asset ───────────────────────────────────────────────────

def parse_mirae(text):
    trades = []
    charges = {"stt": 0, "brokerage": 0, "gst": 0, "stamp": 0, "transCharges": 0, "other": 0}
    pan = ""
    cn_date = ""
    cn_no = ""

    pan_m = re.search(r"PAN\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])", text, re.IGNORECASE)
    if pan_m:
        pan = pan_m.group(1).upper()

    date_m = re.search(r"Trade\s+Date\s*[:\-]?\s*(?:([A-Za-z]{3})\s+(\d{1,2})|(\d{1,2})[\/\-]([A-Za-z]{3}|\d{1,2}))[\/\-\s]+(\d{4})", text, re.IGNORECASE)
    if date_m:
        if date_m.group(1): # MMM DD YYYY
            cn_date = normalize_date(f"{date_m.group(2)}-{date_m.group(1)}-{date_m.group(5)}")
        else:
            cn_date = normalize_date(f"{date_m.group(3)}-{date_m.group(4)}-{date_m.group(5)}")

    cn_m = re.search(r"(?:Contract\s+Note\s+No\.?|Trade\s+Ref)\s*[:\-]?\s*([A-Z0-9\/\-]+)", text, re.IGNORECASE)
    if cn_m:
        cn_no = cn_m.group(1).strip()

    def get_last_charge(pat):
        m = re.findall(pat + r"[^\d]{0,500}?([\d,]+\.\d{2})\b", text, re.IGNORECASE | re.DOTALL)
        return float(m[-1].replace(",", "")) if m else 0.0

    charges["brokerage"] = get_last_charge(r"\bBrokerage\b")
    charges["stt"] = get_last_charge(r"Securities\s+Transaction\s+Tax")
    charges["gst"] = get_last_charge(r"CGST.*?Amount") + get_last_charge(r"SGST.*?Amount") + get_last_charge(r"IGST.*?Amount")
    charges["stamp"] = get_last_charge(r"Stamp\s+[Dd]uty")
    charges["transCharges"] = get_last_charge(r"Taxable\s+Value\s+of\s+Supply\s+\(Exchange") + get_last_charge(r"SEBI\s+Turnover") + get_last_charge(r"IPFT")

    # Trades — robust token split approach
    for line in text.split("\n"):
        line_stripped = line.strip()
        if not re.search(r"\bIN[A-Z0-9]{10}\b", line_stripped):
            continue
        
        tokens = line_stripped.split()
        isin_idx = -1
        for i, t in enumerate(tokens):
            if re.match(r"^IN[A-Z0-9]{10}$", t):
                isin_idx = i
                break
        if isin_idx == -1:
            continue
            
        isin = tokens[isin_idx]
        
        def is_number_tok(s):
            s2 = s.replace(",", "").replace("\u2212", "-").replace("(", "-").replace(")", "")
            try:
                float(s2)
                return True
            except ValueError:
                return False

        name_end_idx = isin_idx + 1
        for i in range(isin_idx + 1, len(tokens)):
            if is_number_tok(tokens[i]):
                name_end_idx = i
                break
        else:
            continue

        name = " ".join(tokens[isin_idx+1:name_end_idx])
        nums = [parse_float_safe(t) for t in tokens[name_end_idx:] if is_number_tok(t)]


        if len(nums) == 10:
            trades.append({
                "isin": isin,
                "assetName": name.strip(),
                "buyQty": nums[0],
                "buyWap": nums[1],
                "buyVal": nums[3],
                "sellQty": nums[4],
                "sellWap": nums[5],
                "sellVal": nums[7],
            })
        elif len(nums) >= 6:
            net_val = nums[-1]
            if net_val < 0: # BUY
                trades.append({
                    "isin": isin,
                    "assetName": name.strip(),
                    "buyQty": nums[0],
                    "buyWap": nums[1],
                    "buyVal": nums[3],
                    "sellQty": 0,
                    "sellWap": 0,
                    "sellVal": 0,
                })
            else: # SELL
                trades.append({
                    "isin": isin,
                    "assetName": name.strip(),
                    "buyQty": 0,
                    "buyWap": 0,
                    "buyVal": 0,
                    "sellQty": nums[0],
                    "sellWap": nums[1],
                    "sellVal": nums[3],
                })


    final_net = 0.0
    net_amount_m = re.search(r"Net\s+amount[^\d]{0,500}?([\d,]+\.\d{2})", text, re.IGNORECASE | re.DOTALL)
    if net_amount_m:
        try:
            final_net = float(net_amount_m.group(1).replace(",", ""))
        except ValueError:
            pass

    return {
        "status": "success",
        "broker": "mirae",
        "pan": pan,
        "cnDate": cn_date,
        "cnNo": cn_no,
        "trades": trades,
        "charges": charges,
        "finalNet": final_net,
    }


# ─── Main entry point ────────────────────────────────────────────────────────

def run(pdf_path, password, broker_hint="zerodha"):
    ext = os.path.splitext(pdf_path)[1].lower()

    if ext in (".html", ".htm"):
        with open(pdf_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        broker = detect_broker(text, "rk_global")
        return parse_rk_global_html(text)

    if ext == ".csv":
        with open(pdf_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        broker = detect_broker(text, "rk_global")
        return parse_rk_global_csv(text)

    # PDF
    if pdfplumber is None:
        return {"status": "error", "message": "pdfplumber is not installed. Run: pip install pdfplumber"}

    try:
        open_kwargs = {}
        if password:
            open_kwargs["password"] = password
        with pdfplumber.open(pdf_path, **open_kwargs) as pdf:
            text = ""
            for page in pdf.pages:
                extracted = page.extract_text(layout=True)
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        return {"status": "error", "message": f"Could not open PDF: {e}"}

    if not text.strip():
        return {"status": "error", "message": "Could not extract any text from PDF. Wrong password?"}

    broker = detect_broker(text, broker_hint)

    if broker == "zerodha":
        return parse_zerodha(text, password)
    elif broker == "dhan":
        return parse_dhan(text)
    elif broker == "rk_global":
        return parse_rk_global_html(text)
    elif broker == "mirae":
        return parse_mirae(text)
    else:
        # Fallback: try Zerodha parser
        return parse_zerodha(text, password)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "message": "Usage: parse_cn.py <pdf_path> <password> [broker_hint]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    password = sys.argv[2]
    broker_hint = sys.argv[3] if len(sys.argv) > 3 else "zerodha"

    result = run(pdf_path, password, broker_hint)
    print(json.dumps(result))
