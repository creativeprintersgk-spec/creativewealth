import sqlite3

db_path = r"C:\Users\Admin\Desktop\MPr1022_4_2026\mprTempBackupMPrAPPv10.db"

def main():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = c.fetchall()
    print("Tables in MProfit backup DB:")
    for t in tables:
        print(f" - {t[0]}")
    conn.close()

if __name__ == "__main__":
    main()
