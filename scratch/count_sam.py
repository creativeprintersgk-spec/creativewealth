import sqlite3, os, glob

folder = r'C:\Users\Admin\Desktop\MasterDb'
total_sam = 0
for file in glob.glob(os.path.join(folder, '*.db')):
    try:
        conn = sqlite3.connect(file)
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='SAM';")
        if c.fetchone():
            c.execute("SELECT COUNT(*) FROM SAM")
            count = c.fetchone()[0]
            print(f'{os.path.basename(file)}: SAM count = {count}')
            total_sam += count
        conn.close()
    except Exception as e:
        print('Error:', e)
print(f'Total SAM records across all DBs: {total_sam}')
