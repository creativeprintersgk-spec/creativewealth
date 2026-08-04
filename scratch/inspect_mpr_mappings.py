import sqlite3

db_path = r"C:\Users\Admin\Desktop\MPr1022_4_2026\mprTempBackupMPrAPPv10.db"

def main():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    print("\n--- Table: Mappings ---")
    c.execute("PRAGMA table_info(Mappings);")
    columns = c.fetchall()
    print("Columns:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
        
    c.execute("SELECT * FROM Mappings LIMIT 10;")
    rows = c.fetchall()
    print("Sample Rows:")
    for r in rows:
        print(f"  {r}")
        
    conn.close()

if __name__ == "__main__":
    main()
