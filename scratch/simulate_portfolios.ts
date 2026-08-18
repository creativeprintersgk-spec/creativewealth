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
  return col.toLowerCase();
}

function parseValue(key: string, val: string): any {
  const cleanVal = val.trim();
  if (cleanVal === "") return null;
  
  if (["is_group", "is_it_ledger", "is_op_bal_to_be_recalc", "is_currv_manual"].includes(key)) {
    return cleanVal === "1" || cleanVal.toLowerCase() === "true";
  }
  return cleanVal;
}

async function run() {
  const db = await open({
    filename: 'C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db',
    driver: sqlite3.Database
  });

  const sqliteRows = await db.all("SELECT * FROM Portfolios LIMIT 5");
  const columns = await db.all("PRAGMA table_info(Portfolios)");
  const colNames = columns.map(c => c.name);

  const supabaseRows = sqliteRows.map(row => {
    const obj: any = {};
    colNames.forEach(col => {
      const mappedCol = mapHeaderToColumn(col);
      obj[mappedCol] = parseValue(mappedCol, String(row[col] ?? ''));
    });
    return obj;
  });

  console.log("Attempting to insert:", supabaseRows[0]);
  
  const { error } = await supabase.from('portfolios').insert(supabaseRows);
  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("Success!");
  }
}

run();
