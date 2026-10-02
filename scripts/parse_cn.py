"""
WealthCore - Unified Broker Contract Note & Tradebook Parser
Supports PDF, CSV, and HTML formats for:
- Zerodha Broking
- Groww (Nextbillion Technology)
- ICICI Direct (ICICI Securities)
- Kotak Securities
- HDFC Securities
- Motilal Oswal Financial Services
- Dhan (Moneylicious Securities)
- MStock / Mirae Asset Capital Markets
- R K Global
"""

import sys
import os
import re
import json
import csv
from datetime import datetime

# Regex Helpers
PAN_REGEX = re.compile(r'\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b')
ISIN_REGEX = re.compile(r'\b(IN[E|F|A-Z0-9][A-Z0-9]{9})\b')
DATE_PATTERNS = [
    (re.compile(r'\b(\d{2})[-/](\d{2})[-/](\d{4})\b'), '%d-%m-%Y'),
    (re.compile(r'\b(\d{4})[-/](\d{2})[-/](\d{2})\b'), '%Y-%m-%d'),
    (re.compile(r'\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]+(\d{4})\b', re.IGNORECASE), '%d %b %Y')
]

def clean_num(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').replace('₹', '').replace('Rs.', '').replace('dr', '').replace('cr', '').strip()
    # handle parentheses (123.45) as negative
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]
    try:
        return float(s)
    except:
        return 0.0

def parse_date_str(text):
    for pat, fmt in DATE_PATTERNS:
        m = pat.search(text)
        if m:
            try:
                date_str = m.group(0).replace('/', '-')
                if '%b' in fmt:
                    # e.g. 15 Sep 2024
                    parts = re.split(r'[\s,-]+', date_str)
                    d, m_str, y = parts[0], parts[1][:3].capitalize(), parts[2]
                    dt = datetime.strptime(f"{d} {m_str} {y}", '%d %b %Y')
                elif fmt == '%Y-%m-%d':
                    dt = datetime.strptime(date_str, '%Y-%m-%d')
                else:
                    dt = datetime.strptime(date_str, '%d-%m-%Y')
                return dt.strftime('%Y-%m-%d')
            except:
                pass
    return None

def detect_broker(text, filename=""):
    t = (text + " " + filename).lower()
    if 'nextbillion' in t or 'groww' in t:
        return 'groww'
    if 'icici securities' in t or 'icicidirect' in t or 'icici' in t:
        return 'icici'
    if 'kotak securities' in t or 'kotak' in t:
        return 'kotak'
    if 'hdfc securities' in t or 'hdfcsec' in t or 'hdfc' in t:
        return 'hdfc'
    if 'motilal oswal' in t or 'mofsl' in t or 'motilal' in t:
        return 'motilal'
    if 'moneylicious' in t or 'dhan' in t:
        return 'dhan'
    if 'mirae asset' in t or 'mstock' in t or 'm.stock' in t:
        return 'mirae'
    if 'r k global' in t or 'r.k. global' in t or 'rkglobal' in t:
        return 'rk_global'
    if 'zerodha' in t:
        return 'zerodha'
    return 'zerodha' # default fallback

def extract_pan(text):
    # Try finding PAN after keyword
    kw_match = re.search(r'(?:PAN|Permanent\s+Account\s+Number)[\s:/-]*([A-Z]{5}[0-9]{4}[A-Z]{1})', text, re.IGNORECASE)
    if kw_match:
        return kw_match.group(1).upper()
    # Otherwise find any PAN
    all_pans = PAN_REGEX.findall(text)
    # Ignore common broker PANs if possible, or return first
    if all_pans:
        return all_pans[0].upper()
    return ""

def extract_cn_number(text):
    patterns = [
        r'(?:Contract\s*Note\s*No\.?|CN\s*No\.?|Notice\s*No\.?|Invoice\s*No\.?|Contract\s*No\.?)[\s:/-]*([A-Za-z0-9_/-]{4,30})',
        r'CN[\s:/-]*([A-Za-z0-9_/-]{5,25})'
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            res = m.group(1).strip()
            if len(res) >= 4 and not res.lower().startswith('date'):
                return res
    return f"CN-{datetime.now().strftime('%Y%m%d%H%M')}"

def extract_charges_from_text(text):
    charges = {
        'stt': 0.0,
        'brokerage': 0.0,
        'gst': 0.0,
        'stamp': 0.0,
        'transCharges': 0.0,
        'other': 0.0
    }
    
    # STT
    stt_match = re.search(r'(?:Securities\s+Transaction\s+Tax|S\.?T\.?T\.?)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE)
    if stt_match:
        charges['stt'] = clean_num(stt_match.group(1))

    # Brokerage
    brok_match = re.search(r'(?:Total\s+Brokerage|Taxable\s+Value\s+of\s+Supply\s+\(Brokerage\)|Brokerage)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE)
    if brok_match:
        charges['brokerage'] = clean_num(brok_match.group(1))

    # GST (CGST + SGST + IGST)
    cgst = clean_num((re.search(r'(?:CGST|Central\s+GST)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE) or [None, 0])[1])
    sgst = clean_num((re.search(r'(?:SGST|State\s+GST|UTGST)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE) or [None, 0])[1])
    igst = clean_num((re.search(r'(?:IGST|Integrated\s+GST)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE) or [None, 0])[1])
    total_gst = cgst + sgst + igst
    if total_gst == 0.0:
        gst_match = re.search(r'(?:Total\s+GST|GST)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE)
        if gst_match:
            total_gst = clean_num(gst_match.group(1))
    charges['gst'] = round(total_gst, 2)

    # Stamp Duty
    stamp_match = re.search(r'(?:Stamp\s+Duty|Total\s+Stamp\s+Duty)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE)
    if stamp_match:
        charges['stamp'] = clean_num(stamp_match.group(1))

    # Exchange / Transaction Charges
    trans_match = re.search(r'(?:Exchange\s+Transaction\s+Charges?|Turnover\s+Charges?|Transaction\s+Charges?)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE)
    if trans_match:
        charges['transCharges'] = clean_num(trans_match.group(1))

    # SEBI / Clearing / Other
    sebi = clean_num((re.search(r'(?:SEBI\s+Turnover|SEBI\s+Fees?)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE) or [None, 0])[1])
    clearing = clean_num((re.search(r'(?:Clearing\s+Charges?)[\s:=-]+([0-9,]+\.?[0-9]*)', text, re.IGNORECASE) or [None, 0])[1])
    charges['other'] = round(sebi + clearing, 2)

    return charges

def extract_final_net(text):
    patterns = [
        r'(?:Net\s+amount\s+receivable\s*\/\s*\(payable\)|Net\s+Payable\s*\/\s*\(Receivable\)|Net\s+Amount\s+Payable|Net\s+Payable|Net\s+Amount)[\s:=-]+([0-9,]+\.?[0-9]*)'
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return clean_num(m.group(1))
    return None

def parse_trades_from_lines(lines):
    """
    General regex parser across line buffers to find trade rows with ISIN.
    Standard patterns:
    Line contains ISIN (INE...) and Buy/Sell indicator and Numbers (Qty, Rate, Value).
    """
    trades = []
    
    # We look for lines or consecutive pairs of lines containing an ISIN
    i = 0
    while i < len(lines):
        line = lines[i]
        isin_m = ISIN_REGEX.search(line)
        if isin_m:
            isin = isin_m.group(1).upper()
            
            # Combine current line with previous and next line for context
            context = " ".join(lines[max(0, i-1):min(len(lines), i+3)])
            
            # Check Buy or Sell
            is_buy = False
            is_sell = False
            
            # Look for trade indicators
            if re.search(r'\b(BUY|B)\b', line, re.IGNORECASE):
                # Ensure it's not part of another word
                if re.search(r'(?:\s|^)(BUY|B)(?:\s|$)', line, re.IGNORECASE):
                    is_buy = True
            if re.search(r'\b(SELL|S)\b', line, re.IGNORECASE):
                if re.search(r'(?:\s|^)(SELL|S)(?:\s|$)', line, re.IGNORECASE):
                    is_sell = True
            
            if not is_buy and not is_sell:
                # Look in context
                if 'buy' in context.lower():
                    is_buy = True
                elif 'sell' in context.lower():
                    is_sell = True

            # Extract numbers from line: quantity, price, value
            # Find tokens that look like numbers
            tokens = re.findall(r'[-+]?[0-9,]+\.?[0-9]*', line)
            nums = []
            for tok in tokens:
                n = clean_num(tok)
                if n > 0:
                    nums.append(n)
            
            # Extract stock symbol or name
            # Remove ISIN, dates, order numbers
            cleaned_line = line.replace(isin, ' ')
            words = [w for w in re.findall(r'[A-Za-z0-9&-]+', cleaned_line) if len(w) > 1 and not re.match(r'^\d+$', w) and w.upper() not in ['BUY', 'SELL', 'NSE', 'BSE', 'EQ', 'DELIVERY', 'INTRADAY']]
            symbol = words[0].upper() if words else "STOCK"

            # Interpret quantity and price
            # Typically in CN rows: Qty is an integer (e.g. 10, 100), Rate is a float (e.g. 250.50), Value is Qty * Rate
            qty = 0
            price = 0.0
            val = 0.0

            if len(nums) >= 2:
                # Find integer-like candidate for quantity
                qty_candidates = [n for n in nums if n.is_integer() and n < 1000000]
                if qty_candidates:
                    qty = int(qty_candidates[0])
                    # Rate is likely a non-integer or the other number
                    remaining_nums = [n for n in nums if n != qty]
                    if remaining_nums:
                        price = remaining_nums[0]
                        val = round(qty * price, 2)
                        # Check if any remaining number is close to qty * price
                        for cand in remaining_nums[1:]:
                            if abs(cand - (qty * price)) < 1.0 or abs(cand - (qty * price)) / max(cand, 1) < 0.02:
                                val = cand
                                break
                else:
                    qty = int(nums[0])
                    price = nums[1]
                    val = round(qty * price, 2)

            if qty > 0 and (is_buy or is_sell or len(trades) == 0):
                trades.append({
                    'assetName': symbol,
                    'isin': isin,
                    'buyQty': qty if is_buy or not is_sell else 0,
                    'buyWap': price if is_buy or not is_sell else 0.0,
                    'buyVal': val if is_buy or not is_sell else 0.0,
                    'sellQty': qty if is_sell else 0,
                    'sellWap': price if is_sell else 0.0,
                    'sellVal': val if is_sell else 0.0
                })
        i += 1
    return trades

def parse_pdf(file_path, password="", broker_hint="auto"):
    import pdfplumber
    import pypdf

    full_text = ""
    pages_text = []
    all_tables = []

    # 1. Try opening with pdfplumber
    try:
        with pdfplumber.open(file_path, password=password if password else None) as pdf:
            for page in pdf.pages:
                txt = page.extract_text() or ""
                pages_text.append(txt)
                full_text += "\n" + txt
                tbls = page.extract_tables()
                if tbls:
                    all_tables.extend(tbls)
    except Exception as e:
        err_msg = str(e).lower()
        if 'password' in err_msg or 'encrypted' in err_msg or 'authenticate' in err_msg:
            return {
                'status': 'error',
                'message': 'Password required or incorrect password for PDF.'
            }
        # Fallback to pypdf
        try:
            reader = pypdf.PdfReader(file_path)
            if reader.is_encrypted:
                if password:
                    reader.decrypt(password)
                else:
                    return {'status': 'error', 'message': 'Password required for encrypted PDF.'}
            for page in reader.pages:
                txt = page.extract_text() or ""
                pages_text.append(txt)
                full_text += "\n" + txt
        except Exception as pypdf_err:
            return {
                'status': 'error',
                'message': f"Failed to decrypt/parse PDF: {str(pypdf_err)}"
            }

    detected = broker_hint if broker_hint != 'auto' else detect_broker(full_text, os.path.basename(file_path))
    pan = extract_pan(full_text)
    cn_no = extract_cn_number(full_text)
    cn_date = parse_date_str(full_text) or datetime.now().strftime('%Y-%m-%d')
    charges = extract_charges_from_text(full_text)
    final_net = extract_final_net(full_text)

    # 2. Extract trades from extracted tables first (very accurate for Groww, Zerodha, ICICI, Kotak)
    trades = []
    for table in all_tables:
        if not table or len(table) < 2:
            continue
        header = [str(c or '').lower().replace('\n', ' ').strip() for c in table[0]]
        
        # Check if table looks like a trade table
        has_isin = any('isin' in h for h in header)
        has_qty = any('qty' in h or 'quantity' in h for h in header)
        has_rate = any('rate' in h or 'price' in h for h in header)
        has_trade = any('security' in h or 'symbol' in h or 'order' in h or 'trade' in h or 'contract' in h or 'instrument' in h or 'description' in h for h in header)

        if (has_isin or has_trade) and (has_qty or has_rate):
            # Locate column indices with priority matching
            isin_col = next((i for i, h in enumerate(header) if 'isin' in h), -1)
            name_col = next((i for i, h in enumerate(header) if any(k in h for k in ['security', 'symbol', 'description', 'scrip', 'company', 'instrument', 'contract']) and 'isin' not in h), -1)
            type_col = next((i for i, h in enumerate(header) if h in ['b/s', 'buy/sell', 'type', 'action', 'trans type'] or ((any(k in h for k in ['buy', 'sell', 'b/s', 'type', 'action'])) and not any(k in h for k in ['no', 'time', 'date', 'price', 'rate', 'value', 'total', 'order', 'trade no', 'trade time']))), -1)
            qty_col = next((i for i, h in enumerate(header) if ('qty' in h or 'quantity' in h) and 'closing' not in h), -1)
            rate_col = next((i for i, h in enumerate(header) if any(k in h for k in ['gross rate', 'trade price', 'market rate', 'gross']) and not any(k in h for k in ['closing', 'net total', 'net rate', 'total', 'value'])), -1)
            if rate_col == -1:
                rate_col = next((i for i, h in enumerate(header) if 'price' in h or 'rate' in h), -1)
            val_col = next((i for i, h in enumerate(header) if any(k in h for k in ['net total', 'total', 'value', 'amount']) and 'qty' not in h and 'rate' not in h), -1)

            for row in table[1:]:
                row_str = " ".join([str(c or '') for c in row])
                isin_m = ISIN_REGEX.search(row_str)
                isin_val = isin_m.group(1).upper() if isin_m else (str(row[isin_col]).strip() if isin_col != -1 and isin_col < len(row) else "")
                if not ISIN_REGEX.match(isin_val):
                    isin_val = ""

                qty_val = clean_num(row[qty_col]) if qty_col != -1 and qty_col < len(row) else 0
                rate_val = clean_num(row[rate_col]) if rate_col != -1 and rate_col < len(row) else 0.0
                total_val = clean_num(row[val_col]) if val_col != -1 and val_col < len(row) else round(qty_val * rate_val, 2)
                
                type_str = str(row[type_col]).upper().strip() if type_col != -1 and type_col < len(row) else ""
                is_sell = 'S' in type_str or 'SELL' in type_str
                is_buy = 'B' in type_str or 'BUY' in type_str or not is_sell

                name_val = str(row[name_col]).strip() if name_col != -1 and name_col < len(row) else ""
                if not name_val and isin_val:
                    name_val = isin_val

                # Clean name: take symbol from first line if multiline
                name_val = name_val.split('\n')[0].strip()

                if qty_val > 0:
                    trades.append({
                        'assetName': name_val or 'STOCK',
                        'isin': isin_val,
                        'buyQty': qty_val if is_buy else 0,
                        'buyWap': rate_val if is_buy else 0.0,
                        'buyVal': total_val if is_buy else 0.0,
                        'sellQty': qty_val if is_sell else 0,
                        'sellWap': rate_val if is_sell else 0.0,
                        'sellVal': total_val if is_sell else 0.0
                    })

    # 3. Fallback: Parse trades line-by-line if table extractor returned nothing
    if not trades:
        all_lines = [l.strip() for l in full_text.split('\n') if l.strip()]
        trades = parse_trades_from_lines(all_lines)

    # 4. Consolidate trades by ISIN and Type (Buy / Sell)
    consolidated_map = {}
    for t in trades:
        key = f"{t.get('isin')}_{t.get('assetName')}"
        if key not in consolidated_map:
            consolidated_map[key] = {
                'assetName': t.get('assetName'),
                'isin': t.get('isin'),
                'buyQty': 0,
                'buyVal': 0.0,
                'sellQty': 0,
                'sellVal': 0.0
            }
        c = consolidated_map[key]
        c['buyQty'] += t.get('buyQty', 0)
        c['buyVal'] += t.get('buyVal', 0.0)
        c['sellQty'] += t.get('sellQty', 0)
        c['sellVal'] += t.get('sellVal', 0.0)

    final_trades = []
    for c in consolidated_map.values():
        buy_qty = c['buyQty']
        sell_qty = c['sellQty']
        buy_wap = round(c['buyVal'] / buy_qty, 2) if buy_qty > 0 else 0.0
        sell_wap = round(c['sellVal'] / sell_qty, 2) if sell_qty > 0 else 0.0
        
        final_trades.append({
            'assetName': c['assetName'],
            'isin': c['isin'],
            'buyQty': buy_qty,
            'buyWap': buy_wap,
            'buyVal': round(c['buyVal'], 2),
            'sellQty': sell_qty,
            'sellWap': sell_wap,
            'sellVal': round(c['sellVal'], 2)
        })

    # Fallback net if not extracted directly from PDF
    total_buys = sum(t['buyVal'] for t in final_trades)
    total_sells = sum(t['sellVal'] for t in final_trades)
    total_charges = sum(charges.values())
    calculated_net = round((total_buys + total_charges) - total_sells, 2)

    return {
        'status': 'ok',
        'broker': detected,
        'cnNo': cn_no,
        'cnDate': cn_date,
        'pan': pan,
        'trades': final_trades,
        'charges': charges,
        'finalNet': final_net if final_net is not None else calculated_net
    }

def parse_csv(file_path, broker_hint="auto"):
    """
    Parse CSV tradebooks from Groww, ICICI Direct, Kotak, HDFC, Zerodha, RK Global.
    """
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    lines = [l.strip() for l in content.split('\n') if l.strip()]
    if not lines:
        return {'status': 'error', 'message': 'Empty CSV file'}

    detected = broker_hint if broker_hint != 'auto' else detect_broker(content, os.path.basename(file_path))
    pan = extract_pan(content)
    cn_date = parse_date_str(content) or datetime.now().strftime('%Y-%m-%d')
    cn_no = extract_cn_number(content)
    charges = extract_charges_from_text(content)

    # Find the header row
    header_idx = -1
    for idx, line in enumerate(lines[:15]):
        low = line.lower()
        if ('symbol' in low or 'isin' in low or 'security' in low) and ('qty' in low or 'quantity' in low or 'price' in low or 'rate' in low or 'action' in low or 'type' in low):
            header_idx = idx
            break

    if header_idx == -1:
        header_idx = 0

    reader = csv.reader(lines[header_idx:])
    try:
        header = [h.strip().lower() for h in next(reader)]
    except StopIteration:
        return {'status': 'error', 'message': 'No CSV header found'}

    # Map column headers with strict priority
    isin_col = next((i for i, h in enumerate(header) if 'isin' in h), -1)
    symbol_col = next((i for i, h in enumerate(header) if any(k in h for k in ['symbol', 'stock', 'security', 'script', 'company']) and 'isin' not in h), -1)
    type_col = next((i for i, h in enumerate(header) if h in ['type', 'action', 'b/s', 'buy/sell', 'trade type', 'transaction type'] or (any(k in h for k in ['type', 'action', 'b/s']) and not any(k in h for k in ['no', 'time', 'date', 'order', 'trade no', 'trade time', 'segment', 'exchange']))), -1)
    qty_col = next((i for i, h in enumerate(header) if ('qty' in h or 'quantity' in h) and 'closing' not in h), -1)
    price_col = next((i for i, h in enumerate(header) if any(k in h for k in ['trade price', 'price', 'rate', 'wap']) and not any(k in h for k in ['closing', 'total', 'value', 'amount'])), -1)
    if price_col == -1:
        price_col = next((i for i, h in enumerate(header) if 'price' in h or 'rate' in h), -1)
    val_col = next((i for i, h in enumerate(header) if any(k in h for k in ['trade value', 'value', 'net total', 'total', 'amount']) and 'qty' not in h and 'price' not in h and 'rate' not in h), -1)
    date_col = next((i for i, h in enumerate(header) if 'date' in h), -1)

    trades = []
    for row in reader:
        if not row or len(row) < 3:
            continue
        
        row_str = " ".join(row)
        isin_m = ISIN_REGEX.search(row_str)
        isin = isin_m.group(1).upper() if isin_m else (row[isin_col].strip().upper() if isin_col != -1 and isin_col < len(row) else "")
        symbol = row[symbol_col].strip().upper() if symbol_col != -1 and symbol_col < len(row) else (isin or "STOCK")
        
        type_str = row[type_col].upper().strip() if type_col != -1 and type_col < len(row) else "BUY"
        is_sell = 'SELL' in type_str or type_str == 'S'
        is_buy = 'BUY' in type_str or type_str == 'B' or not is_sell

        qty = clean_num(row[qty_col]) if qty_col != -1 and qty_col < len(row) else 0
        price = clean_num(row[price_col]) if price_col != -1 and price_col < len(row) else 0.0
        val = clean_num(row[val_col]) if val_col != -1 and val_col < len(row) else round(qty * price, 2)

        if date_col != -1 and date_col < len(row) and row[date_col].strip():
            row_date = parse_date_str(row[date_col])
            if row_date:
                cn_date = row_date

        if qty > 0:
            trades.append({
                'assetName': symbol,
                'isin': isin,
                'buyQty': qty if is_buy else 0,
                'buyWap': price if is_buy else 0.0,
                'buyVal': val if is_buy else 0.0,
                'sellQty': qty if is_sell else 0,
                'sellWap': price if is_sell else 0.0,
                'sellVal': val if is_sell else 0.0
            })

    total_buys = sum(t['buyVal'] for t in trades)
    total_sells = sum(t['sellVal'] for t in trades)
    total_charges = sum(charges.values())
    calculated_net = round((total_buys + total_charges) - total_sells, 2)

    return {
        'status': 'ok',
        'broker': detected,
        'cnNo': cn_no,
        'cnDate': cn_date,
        'pan': pan,
        'trades': trades,
        'charges': charges,
        'finalNet': calculated_net
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'status': 'error', 'message': 'No input file provided'}))
        sys.exit(1)

    file_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""
    broker_hint = sys.argv[3].lower() if len(sys.argv) > 3 else "auto"

    if not os.path.exists(file_path):
        print(json.dumps({'status': 'error', 'message': f"File not found: {file_path}"}))
        sys.exit(1)

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == '.pdf':
            result = parse_pdf(file_path, password, broker_hint)
        elif ext in ['.csv', '.txt', '.tsv', '.html', '.htm']:
            result = parse_csv(file_path, broker_hint)
        else:
            # Try PDF first, then CSV
            try:
                result = parse_pdf(file_path, password, broker_hint)
            except:
                result = parse_csv(file_path, broker_hint)

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': f"Error parsing contract note: {str(e)}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()
