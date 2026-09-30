import os
import subprocess
import json
import tempfile

def test_csv_parsing():
    print("Testing broker tradebook CSV parsing...")

    # 1. Groww CSV
    groww_csv = """Contract Note No,Trade Date,Settlement No,Client Code,Order No,Trade No,Trade Time,ISIN,Symbol,Exchange,Segment,Type,Quantity,Gross Rate,Brokerage,Net Rate,Closing Rate,Net Total
CN-GRW-101,15-09-2024,2024100,CL123,ORD1,TR1,10:00:00,INE002A01018,RELIANCE,NSE,EQ,BUY,10,2500.00,0.00,2500.00,2500.00,25000.00
CN-GRW-101,15-09-2024,2024100,CL123,ORD2,TR2,10:05:00,INE009A01021,INFY,NSE,EQ,SELL,5,1500.00,0.00,1500.00,1500.00,7500.00
Brokerage: 20.00
Securities Transaction Tax: 25.00
GST: 4.50
Stamp Duty: 3.00
Exchange Transaction Charges: 2.10
"""
    with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write(groww_csv)
        groww_path = f.name

    try:
        res = subprocess.run(['python', 'scripts/parse_cn.py', groww_path, '', 'groww'], capture_output=True, text=True)
        assert res.returncode == 0, f"Groww failed: {res.stderr}"
        data = json.loads(res.stdout)
        assert data['status'] == 'ok', f"Status not ok: {data}"
        assert data['broker'] == 'groww', f"Expected groww, got {data['broker']}"
        assert len(data['trades']) == 2, f"Expected 2 trades, got {len(data['trades'])}"
        assert data['trades'][0]['isin'] == 'INE002A01018'
        assert data['trades'][0]['buyQty'] == 10
        assert data['trades'][1]['isin'] == 'INE009A01021'
        assert data['trades'][1]['sellQty'] == 5
        assert data['charges']['stt'] == 25.0
        print("  [OK] Groww CSV parsed successfully!")
    finally:
        os.remove(groww_path)

    # 2. ICICI Direct CSV
    icici_csv = """Stock Symbol,Company Name,ISIN,Action,Quantity,Trade Price,Trade Value,Trade Date,Order Ref No
TCS,TATA CONSULTANCY SERVICES,INE467B01029,Buy,20,3800.00,76000.00,18-09-2024,123456
HDFCBANK,HDFC BANK LIMITED,INE040A01034,Sell,15,1600.00,24000.00,18-09-2024,123457
"""
    with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write(icici_csv)
        icici_path = f.name

    try:
        res = subprocess.run(['python', 'scripts/parse_cn.py', icici_path, '', 'icici'], capture_output=True, text=True)
        assert res.returncode == 0, f"ICICI failed: {res.stderr}"
        data = json.loads(res.stdout)
        assert data['status'] == 'ok'
        assert data['broker'] == 'icici'
        assert len(data['trades']) == 2
        assert data['trades'][0]['assetName'] == 'TCS'
        assert data['trades'][0]['buyQty'] == 20
        assert data['trades'][1]['assetName'] == 'HDFCBANK'
        assert data['trades'][1]['sellQty'] == 15
        print("  [OK] ICICI Direct CSV parsed successfully!")
    finally:
        os.remove(icici_path)

    # 3. Kotak Securities CSV
    kotak_csv = """Symbol,Security Name,ISIN,Buy/Sell,Quantity,Trade Price,Trade Value,Trade Date,Order Number
ITC,ITC LTD,INE154A01025,B,50,450.00,22500.00,20-09-2024,KOT100
"""
    with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write(kotak_csv)
        kotak_path = f.name

    try:
        res = subprocess.run(['python', 'scripts/parse_cn.py', kotak_path, '', 'kotak'], capture_output=True, text=True)
        assert res.returncode == 0, f"Kotak failed: {res.stderr}"
        data = json.loads(res.stdout)
        assert data['status'] == 'ok'
        assert data['broker'] == 'kotak'
        assert len(data['trades']) == 1
        assert data['trades'][0]['assetName'] == 'ITC'
        assert data['trades'][0]['buyQty'] == 50
        print("  [OK] Kotak Securities CSV parsed successfully!")
    finally:
        os.remove(kotak_path)

    # 4. HDFC Securities CSV
    hdfc_csv = """Symbol,ISIN,Exchange,Transaction Type,Quantity,Price,Trade Value,Trade Date,Order No
SBIN,INE062A01020,NSE,BUY,100,780.00,78000.00,22-09-2024,HDFC999
"""
    with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write(hdfc_csv)
        hdfc_path = f.name

    try:
        res = subprocess.run(['python', 'scripts/parse_cn.py', hdfc_path, '', 'hdfc'], capture_output=True, text=True)
        assert res.returncode == 0, f"HDFC failed: {res.stderr}"
        data = json.loads(res.stdout)
        assert data['status'] == 'ok'
        assert data['broker'] == 'hdfc'
        assert len(data['trades']) == 1
        assert data['trades'][0]['assetName'] == 'SBIN'
        assert data['trades'][0]['buyQty'] == 100
        print("  [OK] HDFC Securities CSV parsed successfully!")
    finally:
        os.remove(hdfc_path)

    # 5. Motilal Oswal CSV / Text
    motilal_csv = """Symbol,ISIN,Buy/Sell,Quantity,Trade Price,Net Total,Trade Date
TATAMOTORS,INE155A01022,BUY,30,950.00,28500.00,25-09-2024
Securities Transaction Tax: 28.50
Brokerage: 15.00
GST: 2.70
Stamp Duty: 4.20
"""
    with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write(motilal_csv)
        motilal_path = f.name

    try:
        res = subprocess.run(['python', 'scripts/parse_cn.py', motilal_path, '', 'motilal'], capture_output=True, text=True)
        assert res.returncode == 0, f"Motilal failed: {res.stderr}"
        data = json.loads(res.stdout)
        assert data['status'] == 'ok'
        assert data['broker'] == 'motilal'
        assert len(data['trades']) == 1
        assert data['trades'][0]['assetName'] == 'TATAMOTORS'
        assert data['trades'][0]['buyQty'] == 30
        assert data['charges']['stt'] == 28.50
        print("  [OK] Motilal Oswal parsed successfully!")
    finally:
        os.remove(motilal_path)

    print("\nALL 5 BROKER CONTRACT NOTE / TRADEBOOK PARSERS VERIFIED 100%!")

if __name__ == '__main__':
    test_csv_parsing()
