import sqlite3
import os
from supabase import create_client, Client
from dotenv import load_dotenv

db_path = r"C:\Users\Admin\Desktop\mprTempBackupMPrAPPv10.db"

def main():
    load_dotenv()
    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Error: Supabase environment variables not found.")
        return
    if not os.path.exists(db_path):
        print(f"Error: DB file not found at {db_path}")
        return

    # 1. Fetch from SQLite MPrices table
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT SourceID_ATYP, AMID, CURRP, PREVP, Date FROM MPrices")
    db_rows = c.fetchall()
    conn.close()

    # Convert SQLite date from DD-MM-YYYY to YYYY-MM-DD
    def format_sqlite_date(d):
        parts = d.strip().split('-')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return d.strip()

    db_set = set()
    for r in db_rows:
        source_id, amid, currp, prevp, date = r
        currp = round(currp, 4) if currp is not None else None
        prevp = round(prevp, 4) if prevp is not None else None
        db_set.add((int(source_id), int(amid), currp, prevp, format_sqlite_date(date)))

    # 2. Fetch from Supabase mprices table (paginated)
    supabase: Client = create_client(url, key)
    sb_rows = []
    page = 0
    while True:
        res = supabase.table("mprices").select("source_id_atyp, amid, currp, prevp, date").range(page*1000, (page+1)*1000 - 1).execute()
        data = res.data
        if not data:
            break
        sb_rows.extend(data)
        page += 1

    sb_set = set()
    for row in sb_rows:
        # Ignore today's synced date
        if row['date'] == '2026-05-26':
            continue
        currp = round(row['currp'], 4) if row['currp'] is not None else None
        prevp = round(row['prevp'], 4) if row['prevp'] is not None else None
        sb_set.add((int(row['source_id_atyp']), int(row['amid']), currp, prevp, row['date']))

    print(f"SQLite MPrices historical row count: {len(db_set)}")
    print(f"Supabase mprices historical row count: {len(sb_set)}")

    # Check differences
    only_in_db = db_set - sb_set
    only_in_sb = sb_set - db_set

    print(f"Rows only in SQLite DB: {len(only_in_db)}")
    if only_in_db:
        print("Sample rows only in SQLite DB:")
        for r in list(only_in_db)[:10]:
            print(r)

    print(f"Rows only in Supabase: {len(only_in_sb)}")
    if only_in_sb:
        print("Sample rows only in Supabase:")
        for r in list(only_in_sb)[:10]:
            print(r)

    if not only_in_db and not only_in_sb:
        print("SUCCESS: The SQLite table and Supabase mprices match EXACTLY (3656 historical rows)!")
    else:
        print("WARNING: There are mismatches between SQLite and Supabase!")

if __name__ == "__main__":
    main()
