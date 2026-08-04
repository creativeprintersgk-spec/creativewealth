import sqlite3, os, glob

folder = r'C:\Users\Admin\Desktop\MasterDb'
for file in glob.glob(os.path.join(folder, '*.db')):
    print(f'\n--- {os.path.basename(file)} ---')
    try:
        conn = sqlite3.connect(file)
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = c.fetchall()
        print('Tables:', [t[0] for t in tables])
        
        # also print first row of the most important looking table
        for t in tables:
            tname = t[0]
            if tname.lower() in ['master', 'stocks', 'amfi', 'bse_master']:
                c.execute(f"SELECT * FROM {tname} LIMIT 1")
                col_names = [description[0] for description in c.description]
                row = c.fetchone()
                print(f"Sample from {tname}:", dict(zip(col_names, row)) if row else None)
        conn.close()
    except Exception as e:
        print('Error:', e)
