import pandas as pd
import urllib.request
import json
import csv

SUPABASE_URL = "https://ajjeoijjsklgkioxqkrb.supabase.co/rest/v1"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI"

def update_asset(amid, name, nse_symbol, isin):
    url = f"{SUPABASE_URL}/asset_master?amid=eq.{amid}"
    data = {"name": name}
    if pd.notna(nse_symbol) and str(nse_symbol).strip():
        data["nse_symbol"] = str(nse_symbol).strip()
    if pd.notna(isin) and str(isin).strip():
        data["isin"] = str(isin).strip()
        
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }, method="PATCH")
    try:
        with urllib.request.urlopen(req) as response:
            return response.status in [200, 204]
    except Exception as e:
        print(f"Error updating AMID {amid}: {e}")
        return False

def main():
    # 1. Read Excel mapping
    excel_path = r"C:\Users\Admin\Desktop\WealthCore_AMID_ISIN_Master.xlsx"
    df = pd.read_excel(excel_path, header=2)
    
    updated_count = 0
    mapped_amids = set()
    mapped_with_isin = set()
    
    for idx, row in df.iterrows():
        amid = row['MProfit AMID']
        if pd.isna(amid) or not str(amid).strip().isdigit(): continue
        amid = int(amid)
        
        name = row['Correct Full Name (NSE/BSE/AMFI)']
        nse_symbol = row['NSE Symbol']
        isin = row['ISIN']
        
        # We only update if ISIN or NSE Symbol is provided
        has_isin = pd.notna(isin) and str(isin).strip()
        has_nse = pd.notna(nse_symbol) and str(nse_symbol).strip()
        
        mapped_amids.add(str(amid))
        if has_isin:
            mapped_with_isin.add(str(amid))
        
        if has_isin or has_nse:
            success = update_asset(amid, name, nse_symbol, isin)
            if success:
                updated_count += 1
                
    print(f"Successfully updated {updated_count} assets with ISINs/NSE Symbols in the database.")
    
    # 2. Check SumTable for active assets without ISIN
    sum_file = "scratch/mprofit_csv/SumTable.csv"
    active_amids = set()
    with open(sum_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                qnt = float(row.get('QNT', 0))
                amtinv = float(row.get('AMTINV', 0))
                if qnt > 0.001 or amtinv > 0.01:
                    active_amids.add(row['AMID'])
            except:
                pass

    missing_amids = []
    # Find active amids that were NOT mapped with an ISIN in the Excel file
    for amid in active_amids:
        if amid not in mapped_with_isin:
            missing_amids.append(amid)
            
    if missing_amids:
        # Fetch names for missing AMIDs
        missing_str = ",".join(missing_amids)
        url = f"{SUPABASE_URL}/asset_master?amid=in.({missing_str})&select=amid,name"
        req = urllib.request.Request(url, headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}"
        })
        try:
            with urllib.request.urlopen(req) as response:
                missing_details = json.loads(response.read().decode())
                print(f"\n--- {len(missing_details)} Active Assets Still Missing ISINs ---")
                for d in missing_details:
                    print(f"AMID: {d['amid']} | Name: {d['name']}")
        except Exception as e:
            print(f"Could not fetch names for missing AMIDs: {e}")
    else:
        print("\nAll active assets have ISINs mapped!")

if __name__ == "__main__":
    main()
