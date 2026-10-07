import sqlite3
conn = sqlite3.connect(r'C:\Users\Admin\Desktop\mprTempBackupMPrAPPv10.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
key = ['Trans1','TransC1','Vouchers1','VouchersC1','ACMA1','SAM','BS1']
print("ALL tables:", len(tables))
for t in tables:
    if any(k.lower() == t.lower() for k in key):
        cur.execute(f'SELECT COUNT(*) FROM [{t}]')
        print(f'  {t}: {cur.fetchone()[0]} rows')
conn.close()
