require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SQLITE_FILE = "C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db";
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const HEADER_MAP = {
  "ID": "id",
  "PARENTID": "parent_id",
  "PARENT_ID": "parent_id",
  "ISGROUP": "is_group",
  "IS_GROUP": "is_group",
  "NAME": "name",
  "DISPSEQNO": "disp_seqno",
  "DISP_SEQNO": "disp_seqno",
  "DESCR": "descr",
  "FLAGS": "flags",
  "ACID": "acid",
  "CLID": "clid",
  "ISITLEDGER": "is_it_ledger",
  "SPECIALTYPEID": "special_type_id",
  "CRBAL": "cr_bal",
  "DBBAL": "db_bal",
  "CR_BAL": "cr_bal",
  "DB_BAL": "db_bal",
  "TREENODE": "tree_node",
  "ADDR": "addr",
  "PAN": "pan",
  "ADDINFO": "addinfo"
};

async function cleanSync() {
  console.log('=== STARTING CLEAN SYNCHRONIZATION FROM MPROFIT BACKUP ===');
  const db = new Database(SQLITE_FILE, { readonly: true });

  const tablesToWipe = [
    'acc_pflink', 'investor_group_members', 'portfolios', 'acmac1',
    'sam', 'bs1', 'sum_table', 'vouchers1', 'vouchersc1', 'trans1', 'transc1',
    'mprices', 'scnote1'
  ];

  console.log('Wiping Supabase tables...');
  for (const t of tablesToWipe) {
    const pk = (t === 'portfolios' || t === 'acmac1') ? 'id' : (t === 'bs1' ? 'trid' : (t === 'trans1' || t === 'transc1' ? 'transid' : (t === 'vouchers1' || t === 'vouchersc1' ? 'vid' : (t === 'sum_table' ? 'sid' : (t === 'mprices' ? 'amid' : (t === 'scnote1' ? 'cnid' : (t === 'acc_pflink' ? 'pfid' : (t === 'investor_group_members' ? 'investor_group_id' : 'amid'))))))));
    const { error } = await supabase.from(t).delete().neq(pk, -999999);
    if (error) console.warn(`Warning deleting ${t}:`, error.message);
  }
  console.log('Tables wiped.');

  // 1. Restore Groups from latest_snapshot
  const snapshotData = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
  const masterGroups = snapshotData.filter(r => r.is_group);
  console.log(`Found ${masterGroups.length} master groups from snapshot.`);

  // 2. Read ACMA1 from SQLite
  const acma1Rows = db.prepare('SELECT * FROM ACMA1').all();
  console.log(`Found ${acma1Rows.length} ledgers from SQLite ACMA1.`);

  const seenAcmac = new Set();
  const allAcmacRows = [];

  // Add groups first
  for (const g of masterGroups) {
    const key = `${g.id}_${g.acid}_true`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      allAcmacRows.push(g);
    }
  }

  // Add ledgers from ACMA1
  for (const r of acma1Rows) {
    const obj = {};
    for (const [k, v] of Object.entries(r)) {
      const mapped = HEADER_MAP[k.toUpperCase()];
      if (mapped) {
        if (mapped === 'is_group') {
          obj[mapped] = false;
        } else if (['id', 'parent_id', 'disp_seqno', 'acid', 'clid', 'special_type_id', 'cr_bal', 'db_bal'].includes(mapped)) {
          const num = parseFloat(v);
          obj[mapped] = isNaN(num) ? 0 : num;
        } else {
          obj[mapped] = v !== null && v !== undefined ? String(v) : null;
        }
      }
    }
    const key = `${obj.id}_${obj.acid}_false`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      allAcmacRows.push(obj);
    }
  }

  console.log(`Inserting ${allAcmacRows.length} unique acmac1 records...`);
  for (let i = 0; i < allAcmacRows.length; i += 500) {
    const chunk = allAcmacRows.slice(i, i + 500);
    const { error } = await supabase.from('acmac1').insert(chunk);
    if (error) console.error('Error inserting acmac1 chunk:', error.message);
  }
  console.log('acmac1 complete.');

  const tableConfigs = [
    { sqlite: 'Portfolios', target: 'portfolios' },
    { sqlite: 'InvestorGroupMembers', target: 'investor_group_members' },
    { sqlite: 'ACC_PFLINK', target: 'acc_pflink' },
    { sqlite: 'SAM', target: 'sam' },
    { sqlite: 'BS1', target: 'bs1' },
    { sqlite: 'SumTable', target: 'sum_table' },
    { sqlite: 'Vouchers1', target: 'vouchers1' },
    { sqlite: 'Trans1', target: 'trans1' },
    { sqlite: 'MPrices', target: 'mprices' },
    { sqlite: 'SCNOTE1', target: 'scnote1' }
  ];

  const mapCol = (k) => {
    const col = k.trim().replace(/^\uFEFF/, "");
    const map = {
      "ID": "id", "ClientID": "client_id", "InvestorName": "investor_name", "IsGroup": "is_group",
      "FullName": "full_name", "InvestorAddr": "investor_addr", "PinCode": "pin_code", "ExitStatus": "exit_status",
      "RiskProfile": "risk_profile", "ViewSettings": "view_settings", "PFolioType": "pfolio_type", "ExtID": "ext_id",
      "InvestorGroupID": "investor_group_id", "PFolioID": "pfolio_id", "ExtSrcID": "ext_src_id", "PFID": "pfid",
      "ACID": "acid", "IsOpBalToBeRecalc": "is_op_bal_to_be_recalc", "ActionFlag": "action_flag", "ParentID": "parent_id",
      "ParentExtID": "parent_ext_id", "DispSeqno": "disp_seqno", "Descr": "descr", "Flags": "flags", "CLID": "clid",
      "IsItLedger": "is_it_ledger", "SpecialTypeID": "special_type_id", "CrBal": "cr_bal", "DbBal": "db_bal",
      "TreeNode": "tree_node", "Addr": "addr", "PAN": "pan", "AddInfo": "addinfo", "AMID": "amid", "ANM": "anm",
      "ATYP": "atyp", "GRP": "grp", "ExInt1": "exint1", "ExtStr": "extstr", "ExInt2": "exint2", "ISR": "isr",
      "Alias": "alias", "TRID": "trid", "ATYID": "atyid", "SID": "sid", "CNID": "cnid", "TRTY": "trty",
      "TRSTR": "trstr", "AcVch": "acvch", "DT": "dt", "QN": "qn", "PurPr": "purpr", "Brkg": "brkg", "NetPr": "netpr",
      "AMT": "amt", "Chrgs": "chrgs", "Narr": "narr", "TmpBalQ": "tmp_balq", "TmpBalA": "tmp_bala", "AccInfo": "accinfo",
      "TaxEtc": "taxetc", "DtOrigin": "dtorigin", "AgentCode": "agentcode", "Qnt": "qnt", "AmtInv": "amtinv",
      "BalPurc": "balpurc", "SellCnt": "sellcnt", "Currv": "currv", "Tgain": "tgain", "IsCurrvManual": "is_currv_manual",
      "Refno": "refno", "Flag": "flag", "Relgain": "relgain", "TodayAmtinv": "today_amtinv", "TodayQuant": "today_quant",
      "Tag": "tag", "VID": "vid", "VTyp": "vtyp", "PMS_TransID": "pms_trans_id", "AcctList": "acctlist",
      "ExtIDSource": "extid_source", "AType": "atype", "ImpRecID": "imp_rec_id", "ChqNo": "chqno", "TransID": "transid",
      "MAID": "maid", "CrAmt": "cramt", "DrAmt": "dramt", "SpecialAccount": "special_account", "SourceID_ATYP": "source_id_atyp",
      "CURRP": "currp", "PREVP": "prevp", "Date": "date", "RowID": "row_id", "ATY": "aty", "BRKRID": "brkrid",
      "CNNUM": "cnnum", "BILLNUM": "billnum", "SERVTAX": "servtax", "STMPCHRGS": "stmpchrgs", "TRANCHRG": "tranchrg",
      "STT": "stt", "OTHCHRG": "othchrg", "AMTDUE": "amtdue", "ISDUE": "isdue", "ISSPEC": "isspec", "CSTR": "cstr",
      "City": "city", "Country": "country", "Phone": "phone", "Mobile": "mobile", "AccLinkID": "acc_link_id"
    };
    return map[col] || col.toLowerCase();
  };

  for (const cfg of tableConfigs) {
    console.log(`\nMigrating ${cfg.sqlite} -> ${cfg.target}...`);
    const rawRows = db.prepare(`SELECT * FROM "${cfg.sqlite}"`).all();
    console.log(`Read ${rawRows.length} rows from SQLite ${cfg.sqlite}`);

    const cleanRows = rawRows.map((r) => {
      const obj = {};
      for (const [k, v] of Object.entries(r)) {
        const mapped = mapCol(k);
        if (mapped === 'is_group') {
          obj[mapped] = v === 1 || v === '1' || v === true;
        } else {
          obj[mapped] = v;
        }
      }
      return obj;
    });

    // Special case for Portfolios: merge Clients table
    if (cfg.target === 'portfolios') {
      try {
        const clientRows = db.prepare('SELECT * FROM "Clients"').all();
        clientRows.forEach(c => {
          const compId = Number(c.ID || c.id) + 1000000;
          cleanRows.push({
            id: compId,
            client_id: c.ID || c.id,
            investor_name: c.NAME || c.name,
            full_name: c.NAME || c.name,
            is_group: true
          });
        });
      } catch (err) {
        console.warn('Could not read Clients:', err);
      }
    }

    for (let i = 0; i < cleanRows.length; i += 500) {
      const chunk = cleanRows.slice(i, i + 500);
      const { error } = await supabase.from(cfg.target).insert(chunk);
      if (error) console.error(`Error inserting chunk into ${cfg.target}:`, error.message);
    }
    console.log(`Finished ${cfg.target}: ${cleanRows.length} rows.`);
  }

  // 3. Restore vouchersc1 and transc1 from latest_snapshot (excluding legacy orphan voucher 400)
  console.log('\nRestoring vouchersc1 from snapshot...');
  const snapVC1 = JSON.parse(fs.readFileSync('backups/latest_snapshot/vouchersc1.json', 'utf8'))
    .filter(v => v.vid !== 400);
  for (let i = 0; i < snapVC1.length; i += 500) {
    const chunk = snapVC1.slice(i, i + 500);
    const { error } = await supabase.from('vouchersc1').insert(chunk);
    if (error) console.error('Error inserting vouchersc1 chunk:', error.message);
  }
  console.log(`Finished vouchersc1: ${snapVC1.length} rows.`);

  console.log('\nRestoring transc1 from snapshot...');
  const snapTC1 = JSON.parse(fs.readFileSync('backups/latest_snapshot/transc1.json', 'utf8'))
    .filter(t => t.vid !== 400);
  for (let i = 0; i < snapTC1.length; i += 500) {
    const chunk = snapTC1.slice(i, i + 500);
    const { error } = await supabase.from('transc1').insert(chunk);
    if (error) console.error('Error inserting transc1 chunk:', error.message);
  }
  console.log(`Finished transc1: ${snapTC1.length} rows.`);

  console.log('\n=== CLEAN SYNC COMPLETE ===');
}

cleanSync().catch(console.error);
