import sqlite3
import json

db_path = "C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db"
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Tables found:", tables)
except Exception as e:
    print("Error:", e)
