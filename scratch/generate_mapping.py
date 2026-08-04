import csv
import urllib.request
import json

SUPABASE_URL = "https://ajjeoijjsklgkioxqkrb.supabase.co/rest/v1"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI"

def query_supabase_exact(amids):
    # Fetch details for the given MProfit AMIDs
    amids_str = ",".join(amids)
    url = f"{SUPABASE_URL}/asset_master?amid=in.({amids_str})&select=amid,name"
    req = urllib.request.Request(url, headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}"
    })
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error querying exact amids: {e}")
        return []

def query_supabase_fuzzy(name_part):
    # Search for global assets (with ISIN)
    url = f"{SUPABASE_URL}/asset_master?name=ilike.%25{urllib.parse.quote(name_part)}%25&isin=not.is.null&select=amid,name,isin,nse_symbol&limit=2"
    req = urllib.request.Request(url, headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}"
    })
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return []

def main():
    sum_file = "scratch/mprofit_csv/SumTable.csv"
    output_file = r"C:\Users\Admin\.gemini\antigravity-ide\brain\8a6feee9-6a19-4ae1-b731-2dd5a081a47b\mprofit_mapping_proposals_v3.csv"
    
    # 1. Get active AMIDs from SumTable
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
                
    active_amids = list(active_amids)
    print(f"Found {len(active_amids)} active assets in portfolios.")
    
    # 2. Fetch their names from DB in chunks of 50
    mprofit_assets = []
    for i in range(0, len(active_amids), 50):
        chunk = active_amids[i:i+50]
        mprofit_assets.extend(query_supabase_exact(chunk))
        
    print(f"Fetched names for {len(mprofit_assets)} assets from database.")

    results = []
    
    for i, asset in enumerate(mprofit_assets):
        amid = str(asset.get('amid'))
        name = asset.get('name')
        
        if not name: continue
        
        parts = name.split()
        if len(parts) > 1:
            search_query = f"{parts[0]} {parts[1]}"
        else:
            search_query = parts[0] if parts else ""
            
        print(f"[{i+1}/{len(mprofit_assets)}] Mapping {name}...")
        
        matches = query_supabase_fuzzy(search_query)
        if not matches and len(parts) > 2:
            matches = query_supabase_fuzzy(parts[0]) # Fallback to first word
            
        if matches:
            best = matches[0]
            confidence = "High" if best['name'].lower() == name.lower() else "Medium"
            results.append({
                "MProfit AMID": amid,
                "Old MProfit Name": name,
                "Proposed New Name (Live)": best.get('name', ''),
                "Proposed ISIN": best.get('isin', ''),
                "Proposed NSE Symbol": best.get('nse_symbol', ''),
                "Confidence": confidence
            })
        else:
            results.append({
                "MProfit AMID": amid,
                "Old MProfit Name": name,
                "Proposed New Name (Live)": "NOT FOUND",
                "Proposed ISIN": "",
                "Proposed NSE Symbol": "",
                "Confidence": "Low"
            })
            
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        if len(results) > 0:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        
    print(f"Successfully generated mapping CSV at: {output_file}")

if __name__ == "__main__":
    main()
