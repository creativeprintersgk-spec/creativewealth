import sqlite3

conn = sqlite3.connect(r'C:\Users\Admin\Desktop\mprTempBackupMPrAPPv10.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print('Tables:', tables)

# Check which table has accounting transactions
for t in tables:
    cur.execute(f'SELECT COUNT(*) FROM {t}')
    cnt = cur.fetchone()[0]
    if cnt > 0:
        print(f'  {t}: {cnt} rows')

conn.close()
