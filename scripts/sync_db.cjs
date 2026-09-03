require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const SQLITE_FILE = "C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db";
const BATCH_SIZE = 1000;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const TABLES_TO_SYNC = [
  { sqlite: 'Portfolios', pg: 'portfolios' },
  { sqlite: 'InvestorGroupMembers', pg: 'investor_group_members' },
  { sqlite: 'ACC_PFLINK', pg: 'acc_pflink' },
  { sqlite: 'ACMA1', pg: 'acmac1' },
  { sqlite: 'SAM', pg: 'sam' },
  { sqlite: 'BS1', pg: 'bs1' },
  { sqlite: 'SumTable', pg: 'sum_table' },
  { sqlite: 'Vouchers1', pg: 'vouchers1' },
  { sqlite: 'Trans1', pg: 'trans1' },
  { sqlite: 'MPrices', pg: 'mprices' },
  { sqlite: 'SCNOTE1', pg: 'scnote1' }
];

function normalizeDateToYYYYMMDD(dateStr) {
  if (!dateStr) return "";
  const clean = String(dateStr).trim().split('/').join('-');
  
  if (/[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}/.test(clean)) {
    const parts = clean.split("-");
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  
  if (/[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}/.test(clean)) {
    const parts = clean.split("-");
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }

  return clean.substring(0, 10);
}

const HEADER_MAP = {
  "ID": "id",
  "CLIENTID": "client_id",
  "INVESTORNAME": "investor_name",
  "ISGROUP": "is_group",
  "FULLNAME": "full_name",
  "INVESTORADDR": "investor_addr",
  "PINCODE": "pin_code",
  "EXITSTATUS": "exit_status",
  "RISKPROFILE": "risk_profile",
  "VIEWSETTINGS": "view_settings",
  "PFOLIOTYPE": "pfolio_type",
  "EXTID": "ext_id",
  "INVESTORGROUPID": "investor_group_id",
  "PFOLIOID": "pfolio_id",
  "EXTSRCID": "ext_src_id",
  "PFID": "pfid",
  "ACID": "acid",
  "ISOPBALTOBERECALC": "is_op_bal_to_be_recalc",
  "ACTIONFLAG": "action_flag",
  "PARENTID": "parent_id",
  "PARENTEXTID": "parent_ext_id",
  "PARENT_ID": "parent_id",
  "PARENT_EXTID": "parent_ext_id",
  "DISPSEQNO": "disp_seqno",
  "DISP_SEQNO": "disp_seqno",
  "DESCR": "descr",
  "FLAGS": "flags",
  "CLID": "clid",
  "ISITLEDGER": "is_it_ledger",
  "IS_GROUP": "is_group",
  "SPECIALTYPEID": "special_type_id",
  "CRBAL": "cr_bal",
  "DBBAL": "db_bal",
  "CR_BAL": "cr_bal",
  "DB_BAL": "db_bal",
  "TREENODE": "tree_node",
  "ADDR": "addr",
  "PAN": "pan",
  "ADDINFO": "addinfo",
  "AMID": "amid",
  "ANM": "anm",
  "ATYP": "atyp",
  "GRP": "grp",
  "EXINT1": "exint1",
  "EXTSTR": "extstr",
  "EXINT2": "exint2",
  "ISR": "isr",
  "ALIAS": "alias",
  "TRID": "trid",
  "ATYID": "atyid",
  "SID": "sid",
  "CNID": "cnid",
  "TRTY": "trty",
  "TRSTR": "trstr",
  "ACVCH": "acvch",
  "DT": "dt",
  "QN": "qn",
  "PURPR": "purpr",
  "BRKG": "brkg",
  "NETPR": "netpr",
  "AMT": "amt",
  "CHRGS": "chrgs",
  "NARR": "narr",
  "TMPBALQ": "tmp_balq",
  "TMPBALA": "tmp_bala",
  "ACCINFO": "accinfo",
  "TAXETC": "taxetc",
  "DTORIGIN": "dtorigin",
  "AGENTCODE": "agentcode",
  "QNT": "qnt",
  "AMTINV": "amtinv",
  "BALPURC": "balpurc",
  "SELLCNT": "sellcnt",
  "CURRV": "currv",
  "TGAIN": "tgain",
  "ISCURRVMANUAL": "is_currv_manual",
  "REFNO": "refno",
  "FLAG": "flag",
  "RELGAIN": "relgain",
  "TODAYAMTINV": "today_amtinv",
  "TODAYQUANT": "today_quant",
  "TAG": "tag",
  "VID": "vid",
  "VTYP": "vtyp",
  "PMS_TRANSID": "pms_trans_id",
  "ACCTLIST": "acctlist",
  "EXTIDSOURCE": "extid_source",
  "ATYPE": "atype",
  "IMPRECID": "imp_rec_id",
  "CHQNO": "chqno",
  "TRANSID": "transid",
  "MAID": "maid",
  "CRAMT": "cramt",
  "DRAMT": "dramt",
  "SPECIALACCOUNT": "special_account",
  "SOURCEID_ATYP": "source_id_atyp",
  "CURRP": "currp",
  "PREVP": "prevp",
  "DATE": "date",
  "ROWID": "row_id",
  "ATY": "aty",
  "BRKRID": "brkrid",
  "CNNUM": "cnnum",
  "BILLNUM": "billnum",
  "SERVTAX": "servtax",
  "STMPCHRGS": "stmpchrgs",
  "TRANCHRG": "tranchrg",
  "STT": "stt",
  "OTHCHRG": "othchrg",
  "AMTDUE": "amtdue",
  "ISDUE": "isdue",
  "ISSPEC": "isspec",
  "CSTR": "cstr"
};

function mapHeaderToColumn(header) {
  const col = header.trim().toUpperCase();
  if (HEADER_MAP[col]) return HEADER_MAP[col];

  // Generic fallback if not in map
  return header.trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function parseValue(key, val) {
  if (val === null || val === undefined) return null;
  const cleanVal = String(val).trim();
  if (cleanVal === "") return null;
  
  if (["date", "dt", "dtorigin"].includes(key)) {
    return normalizeDateToYYYYMMDD(cleanVal);
  }

  // ONLY convert to boolean if it's strictly a boolean field.
  // Postgres correctly casts 1/0 integers to boolean automatically if the column is boolean.
  // If the column is smallint (like is_it_ledger), passing true/false causes a crash.
  if (key === "is_group") {
    return cleanVal === "1" || cleanVal.toLowerCase() === "true" || cleanVal === "true" || val === 1 || val === true;
  }
  
  const numericKeys = [
    "id", "client_id", "exit_status", "risk_profile", "view_settings", "pfolio_type", "ext_id",
    "investor_group_id", "pfolio_id", "ext_src_id", "pfid", "acid", "action_flag",
    "parent_id", "parent_ext_id", "disp_seqno", "flags", "clid", "special_type_id", "cr_bal", "db_bal",
    "amid", "atyp", "grp", "exint1", "exint2", "isr",
    "trid", "atyid", "sid", "cnid", "trty", "acvch", "qn", "purpr", "brkg", "netpr", "amt", "chrgs", "tmp_balq", "tmp_bala",
    "qnt", "amtinv", "balpurc", "sellcnt", "currv", "tgain", "relgain", "today_amtinv", "today_quant",
    "vid", "vtyp", "pms_trans_id", "atype", "extid_source", "imp_rec_id",
    "transid", "maid", "cramt", "dramt", "special_account",
    "source_id_atyp", "currp", "prevp", "row_id",
    "aty", "brkrid", "servtax", "stmpchrgs", "tranchrg", "stt", "othchrg", "amtdue"
  ];
  
  if (numericKeys.includes(key)) {
    const parsedNum = parseFloat(cleanVal);
    return isNaN(parsedNum) ? null : parsedNum;
  }
  
  return cleanVal;
}

async function run() {
  console.log(`Connecting to SQLite DB at ${SQLITE_FILE}...`);
  const db = new Database(SQLITE_FILE, { readonly: true });

  console.log("Truncating existing MProfit tables in Supabase...");
  const tableList = TABLES_TO_SYNC.map(t => `public.${t.pg}`).join(', ');
  const truncateCommand = `TRUNCATE TABLE ${tableList} CASCADE;`;
  const { error: truncError } = await supabase.rpc('exec_sql', { query: truncateCommand });
  if (truncError) {
    console.error("Failed to truncate tables:", truncError);
  } else {
    console.log("Successfully wiped old tables.");
  }

  const chunkArray = (array, size) => {
    const chunked = [];
    let index = 0;
    while (index < array.length) {
      chunked.push(array.slice(index, size + index));
      index += size;
    }
    return chunked;
  };

  for (const { sqlite, pg } of TABLES_TO_SYNC) {
    console.log(`\n--- Migrating ${sqlite} -> ${pg} ---`);
    try {
      let rows = db.prepare(`SELECT * FROM "${sqlite}"`).all();
      
      // Merge Clients into portfolios
      if (pg === 'portfolios') {
         const clients = db.prepare(`SELECT * FROM Clients`).all();
         for (const client of clients) {
           rows.push({
             ID: client.ID + 1000000,  // offset to prevent collision
             ClientID: client.ID,
             InvestorName: client.Name,
             FullName: client.Name,
             IsGroup: 1,
             City: client.City,
             PinCode: client.PinCode,
             Country: client.Country,
             Phone: client.Phone,
             Mobile: client.Mobile
           });
         }
      }

      if (pg === 'acmac1') {
        const fs = require('fs');
        const snap = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
        const groups = snap.filter(r => r.is_group);
        for (const g of groups) {
          rows.push({
            ID: g.id,
            ParentID: g.parent_id,
            IsGroup: 1,
            Name: g.name,
            DispSeqno: g.disp_seqno,
            Flags: g.flags,
            ACID: g.acid,
            CLID: g.clid,
            SpecialTypeID: g.special_type_id,
            CrBal: 0,
            DbBal: 0
          });
        }
      }

      console.log(`Found ${rows.length} rows to insert into ${pg}.`);
      if (rows.length === 0) continue;

      let formattedRows = rows.map(row => {
        const formatted = {};
        for (const [key, value] of Object.entries(row)) {
          const mappedKey = mapHeaderToColumn(key);
          if (mappedKey) {
            formatted[mappedKey] = parseValue(mappedKey, value);
          }
        }

        if (pg === 'portfolios') {
          formatted['full_name'] = formatted['full_name'] || row.FullName || row.PortFolioName || row.Name || '';
          if (formatted['is_group'] === undefined) {
             formatted['is_group'] = row.IsGroup === 1 || row.IsGroup === '1' || row.IsGroup === true;
          }
        }
        
        if (pg === 'investor_group_members') {
           if (formatted['investor_group_id']) {
              formatted['investor_group_id'] += 1000000;
           }
        }

        return formatted;
      });

      let success = false;
      while (!success && Object.keys(formattedRows[0]).length > 0) {
        const batches = chunkArray(formattedRows, BATCH_SIZE);
        let totalInserted = 0;
        let batchError = null;

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const { error } = await supabase.from(pg).insert(batch);
          
          if (error) {
            batchError = error;
            break;
          } else {
            totalInserted += batch.length;
            process.stdout.write(`\rInserted ${totalInserted}/${rows.length} rows...`);
          }
        }

        if (batchError) {
          if (batchError.code === 'PGRST204' && batchError.message.includes('Could not find the')) {
            const match = batchError.message.match(/Could not find the '([^']+)' column/);
            if (match && match[1]) {
              const badCol = match[1];
              console.log(`\nFound unknown column '${badCol}' for table ${pg}. Removing it and retrying...`);
              formattedRows = formattedRows.map(r => {
                const newR = { ...r };
                delete newR[badCol];
                return newR;
              });
              continue;
            }
          }
          console.error(`\nError inserting into ${pg}:`, batchError);
          break;
        } else {
          success = true;
          console.log(`\nFinished ${pg}.`);
        }
      }
    } catch (e) {
      console.error(`Skipping table ${sqlite} due to error:`, e.message);
    }
  }

  console.log("\n✅ Database sync complete! You can now use the application with your fresh data.");
}

run().catch(console.error);
