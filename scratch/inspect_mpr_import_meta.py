import sqlite3

db_path = r"C:\Users\Admin\Desktop\MPr1022_4_2026\mprTempBackupMPrAPPv10.db"

def inspect_table(c, table_name):
    print(f"\n--- Table: {table_name} ---")
    c.execute(f"PRAGMA table_info({table_name});")
    columns = c.fetchall()
    print("Columns:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    c.execute(f"SELECT * FROM {table_name} LIMIT 5;")
    rows = c.fetchall()
    print("Sample Rows:")
    for r in rows:
        print(f"  {r}")

def main():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    inspect_table(c, "AcLEdgerMappings1")
    inspect_table(c, "IMP_MACRO1")
    inspect_table(c, "TemplateHeader")
    
    conn.close()

if __name__ == "__main__":
    main()
