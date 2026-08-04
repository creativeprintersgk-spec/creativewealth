import sqlite3
import json
import os

db_path = r"C:\Users\Admin\Desktop\mprTempBackupMPrAPPv10.db"
output_path = r"c:\Users\Admin\Desktop\wealthcore-clean\scratch\sqlite_mprices.json"

def main():
    if not os.path.exists(db_path):
        print(f"Error: DB file not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT SourceID_ATYP, AMID, CURRP, PREVP, Date FROM MPrices")
    db_rows = c.fetchall()
    conn.close()

    def format_sqlite_date(d):
        parts = d.strip().split('-')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return d.strip()

    data_to_save = []
    for r in db_rows:
        source_id, amid, currp, prevp, date = r
        data_to_save.append({
            "source_id_atyp": int(source_id),
            "amid": int(amid),
            "currp": float(currp) if currp is not None else None,
            "prevp": float(prevp) if prevp is not None else None,
            "date": format_sqlite_date(date)
        })

    with open(output_path, "w") as f:
        json.dump(data_to_save, f, indent=2)

    print(f"Successfully dumped {len(data_to_save)} rows to {output_path}")

if __name__ == "__main__":
    main()
