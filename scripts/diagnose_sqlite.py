import sqlite3, json

USER_DB  = r'C:\Users\Admin\Desktop\mprTempBackupMPrAPPv10.db'
AMFI_DB  = r'C:\ProgramData\MProfit\MasterDb\MPrMasterDbAMFI.db'

conn = sqlite3.connect(USER_DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# The 4 unknown Trans1 maids (SAM.amid equivalent 1389, 1813, 1814, 3111)
# vtyp=6 = portfolio trade (stock/MF buy/sell) → means it has BS1 entry
# vtyp=4 = interest payment → means it's a coupon/dividend journal
# Let's check BS1 for all AMIDs that match these contexts

unknown_trans_maids = [501389, 501813, 501814, 503111]

print("=== Finding identity of 4 unknown Trans1 maids ===")
for tmaid in unknown_trans_maids:
    sam_amid = tmaid - 500000
    print(f"\nTrans1.maid={tmaid} (SAM.amid={sam_amid}):")
    
    # ALL Trans1 entries for this maid
    cur.execute("""
        SELECT t.acid, t.vid, t.maid, t.dramt, t.cramt, t.dt,
               v.vtyp, v.narr, v.dt as vdt
        FROM Trans1 t LEFT JOIN Vouchers1 v ON t.vid=v.vid
        WHERE t.maid=?
        ORDER BY t.dt
    """, (tmaid,))
    rows = cur.fetchall()
    for r in rows:
        print(f"  acid={r['acid']} dt={str(r['dt'])[:10]} vtyp={r['vtyp']} dr={r['dramt']} cr={r['cramt']} narr='{r['narr']}'")

# Now the key fix: Trans1 investment maids in the 500000+ range are DIFFERENT from BS1.AMID
# Trans1.maid = 500000 + user_SAM.amid (for accounting/manual entries)
# BS1.AMID = AMFI code / BSE code (for portfolio trades)
# These are two DIFFERENT systems!

print("\n\n=== ARCHITECTURE CLARITY ===")
print("Trans1 (accounting/journals): uses maid = 500000 + SAM.amid (1-761 range locally)")
print("BS1 (portfolio trades): uses AMID = AMFI code (200000+) or BSE code (100000+)")
print("")
print("The 4 unknown Trans1 maids (501389, 501813, 501814, 503111) are:")
print("  - SAM.amid = 1389, 1813, 1814, 3111")
print("  - These are ABOVE SAM's local 761-entry limit")
print("  - They were created in MProfit AFTER the last local SAM sync")
print("")

# IMPORTANT: Check if these have entries in BS1 with AMFI codes
# If vtyp=6 (trade), then there should be a BS1 entry linking the asset to its portfolio
print("=== For each unknown: check BS1 via portfolio context ===")
for tmaid in unknown_trans_maids:
    sam_amid = tmaid - 500000
    # Get the pfid/acid from Trans1
    cur.execute("SELECT DISTINCT acid FROM Trans1 WHERE maid=?", (tmaid,))
    acids = [r['acid'] for r in cur.fetchall()]
    print(f"\nmaid={tmaid}: linked to acids={acids}")
    for acid in acids:
        # Get portfolios for this acid
        cur.execute("SELECT pfid FROM ACC_PFLINK WHERE ACID=?", (acid,))
        pfids = [r['pfid'] for r in cur.fetchall()]
        # Check BS1 for any entry near the Trans1 date for these portfolios
        cur.execute("""
            SELECT MIN(t.dt) as first_dt, MAX(t.dt) as last_dt FROM Trans1 t
            WHERE t.maid=? AND t.acid=?
        """, (tmaid, acid))
        dates = cur.fetchone()
        print(f"  acid={acid} pfids={pfids} date_range: {dates['first_dt']} to {dates['last_dt']}")
        # Check AMFI master for any MF with name matching context
        if pfids:
            cur.execute("""
                SELECT DISTINCT b.AMID, b.ATYID, b.TRSTR, b.DT, b.AMT
                FROM BS1 b
                WHERE b.PFID IN ({}) AND b.DT BETWEEN '2020-01-01' AND '2020-12-31'
                ORDER BY b.DT
                LIMIT 5
            """.format(','.join('?' * len(pfids))), pfids)
            bs1_rows = cur.fetchall()
            for br in bs1_rows:
                print(f"    BS1: AMID={br['AMID']} ATYID={br['ATYID']} TRSTR={br['TRSTR']} DT={br['DT']} AMT={br['AMT']}")

conn.close()

# Now check AMFI master for amids 1389, 1813, 1814, 3111
conn_amfi = sqlite3.connect(AMFI_DB)
conn_amfi.row_factory = sqlite3.Row
cur_amfi = conn_amfi.cursor()
unknown_sam_amids = [1389, 1813, 1814, 3111]
for amid in unknown_sam_amids:
    cur_amfi.execute("SELECT AMID, ANM, ATYP, EXINT1 FROM SAM WHERE AMID=?", (amid,))
    r = cur_amfi.fetchone()
    if r: print(f"\nAMFI master: AMID={amid} ANM='{r['ANM']}' EXINT1={r['EXINT1']}")
    else: print(f"\nAMFI master: AMID={amid} NOT FOUND")
conn_amfi.close()
