import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

function mapHeaderToColumn(header: string): string {
  const col = header.trim().replace(/^\uFEFF/, "");
  
  if (col === "ID") return "id";
  if (col === "ClientID") return "client_id";
  if (col === "InvestorName") return "investor_name";
  if (col === "IsGroup") return "is_group";
  if (col === "FullName") return "full_name";
  if (col === "InvestorAddr") return "investor_addr";
  if (col === "PinCode") return "pin_code";
  if (col === "ExitStatus") return "exit_status";
  if (col === "RiskProfile") return "risk_profile";
  if (col === "ViewSettings") return "view_settings";
  if (col === "PFolioType") return "pfolio_type";
  if (col === "ExtID") return "ext_id";
  if (col === "InvestorGroupID") return "investor_group_id";
  if (col === "PFolioID") return "pfolio_id";
  if (col === "ExtSrcID") return "ext_src_id";
  
  if (col === "PFID") return "pfid";
  if (col === "ACID") return "acid";
  if (col === "IsOpBalToBeRecalc") return "is_op_bal_to_be_recalc";
  if (col === "ActionFlag") return "action_flag";
  if (col === "ParentID") return "parent_id";
  if (col === "ParentExtID") return "parent_ext_id";
  if (col === "DispSeqno") return "disp_seqno";
  if (col === "Descr") return "descr";
  if (col === "Flags") return "flags";
  if (col === "CLID") return "clid";
  if (col === "IsItLedger") return "is_it_ledger";
  if (col === "SpecialTypeID") return "special_type_id";
  if (col === "CrBal") return "cr_bal";
  if (col === "DbBal") return "db_bal";
  if (col === "TreeNode") return "tree_node";
  
  return col
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function parseValue(key: string, val: string): any {
  const cleanVal = val.trim();
  if (cleanVal === "") return null;
  
  if (["is_group", "is_it_ledger", "is_op_bal_to_be_recalc", "is_currv_manual"].includes(key)) {
    return (cleanVal === "1" || cleanVal.toLowerCase() === "true") ? 1 : 0;
  }
  return cleanVal;
}

async function run() {
  const db = await open({
    filename: 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db',
    driver: sqlite3.Database
  });

  const sqliteRows = await db.all("SELECT * FROM ACMAC1");
  const columns = await db.all("PRAGMA table_info(ACMAC1)");
  const colNames = columns.map(c => c.name);

  const supabaseRows = sqliteRows.map(row => {
    const obj: any = {};
    colNames.forEach(col => {
      const mappedCol = mapHeaderToColumn(col);
      obj[mappedCol] = parseValue(mappedCol, String(row[col] ?? ''));
    });
    return obj;
  });

  console.log(`Attempting to insert ${supabaseRows.length} rows in batches of 500...`);
  
  const batchSize = 500;
  for (let i = 0; i < supabaseRows.length; i += batchSize) {
    let currentBatch = supabaseRows.slice(i, i + batchSize);
    console.log(`Inserting batch ${i} to ${i + batchSize}...`);
    while (true) {
      const { error } = await supabase.from('acmac1').upsert(currentBatch);
      if (error) {
        const match = error.message.match(/Could not find the ['"]?(.*?)['"]? column/i);
        if (match && match[1]) {
          const badCol = match[1].toLowerCase();
          console.log(`Stripping unknown column: ${badCol}`);
          currentBatch = currentBatch.map(r => {
            const newR = { ...r };
            delete newR[badCol];
            return newR;
          });
          continue; // retry
        } else {
          console.error("SUPABASE ERROR in batch", i, ":", error);
          process.exit(1);
        }
      } else {
        break;
      }
    }
  }
  console.log("Success!");
}

run();
