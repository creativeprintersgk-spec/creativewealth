import sqlite3
import os

db_path = r"C:\Users\Admin\Desktop\mprTempBackupMPrAPPv10.db"

def main():
    if not os.path.exists(db_path):
        print(f"Error: File not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in c.fetchall()]

    price_related_columns = ['price', 'rate', 'currp', 'prevp', 'val', 'amt']

    print("Checking tables for price/rate/value columns:")
    for t in tables:
        c.execute(f"PRAGMA table_info(`{t}`)")
        cols = c.fetchall()
        matching_cols = []
        for col in cols:
            col_name = col[1]
            if any(term in col_name.lower() for term in price_related_columns):
                matching_cols.append(col_name)
        
        if matching_cols:
            c.execute(f"SELECT COUNT(*) FROM `{t}`")
            row_count = c.fetchone()[0]
            print(f"  Table: {t} ({row_count} rows)")
            print(f"    Matching columns: {matching_cols}")
            
            # Print sample row if rows exist
            if row_count > 0:
                c.execute(f"SELECT * FROM `{t}` LIMIT 1")
                row = c.fetchone()
                col_names = [col[1] for col in cols]
                print(f"    Sample: {dict(zip(col_names, row))}")
                print()

    conn.close()

if __name__ == "__main__":
    main()
