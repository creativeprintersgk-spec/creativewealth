import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, CheckCircle, AlertTriangle, ArrowRight, Upload, Play, Database, RefreshCw, ChevronRight, Edit2, Plus, Trash2, Search, CheckSquare, Square } from "lucide-react";
import Papa from 'papaparse';
import { supabase } from "../supabase";
import { useFY } from "../FYContext";
import { useTestMode } from "../contexts/TestModeContext";
import { state, forceRefreshDatabase, getStoredPortfolios, getStoredLedgers, ensureLedgerExists, createVoucher, getStoredVouchers, syncLivePrices, getAssetName } from "../logic";
import isinDictionary from "../services/isinDictionary.json";
import { MfCasTab } from "./MfCasTab";

const isinToAmidMap: Record<string, number> = {};
for (const [amidStr, isinVal] of Object.entries(isinDictionary as Record<string, string>)) {
  if (isinVal) isinToAmidMap[isinVal.toUpperCase().trim()] = Number(amidStr);
}

// Define the 12 MProfit replicated tables and their expected file names
interface TableConfig {
  key: string;
  name: string;
  filePattern: RegExp;
  required: boolean;
  deleteKey: string;
}

const TABLE_CONFIGS: TableConfig[] = [
  { key: 'portfolios', name: 'Portfolios', filePattern: /^portfolios\.csv$/i, required: true, deleteKey: 'id' },
  { key: 'investor_group_members', name: 'Investor Group Members', filePattern: /^investorgroupmembers\.csv$/i, required: false, deleteKey: 'pfolio_id' },
  { key: 'acc_pflink', name: 'Account Portfolio Links', filePattern: /^acc_pflink\.csv|acc_pflnk\.csv$/i, required: true, deleteKey: 'pfid' },
  { key: 'acmac1', name: 'Chart of Accounts (ACMAC1)', filePattern: /^acmac1\.csv$/i, required: true, deleteKey: 'id' },
  { key: 'sam', name: 'Security Asset Master (SAM)', filePattern: /^sam\.csv$/i, required: true, deleteKey: 'amid' },
  { key: 'bs1', name: 'Portfolio Transactions (BS1)', filePattern: /^bs1\.csv$/i, required: true, deleteKey: 'trid' },
  { key: 'sum_table', name: 'Holdings Summary (SumTable)', filePattern: /^sum_?table\.csv$/i, required: true, deleteKey: 'sid' },
  { key: 'vouchersc1', name: 'Capital Vouchers (VouchersC1)', filePattern: /^vouchersc1\.csv$/i, required: true, deleteKey: 'vid' },
  { key: 'vouchers1', name: 'Trading Vouchers (Vouchers1)', filePattern: /^vouchers1\.csv$/i, required: true, deleteKey: 'vid' },
  { key: 'transc1', name: 'Capital Transactions (TransC1)', filePattern: /^transc1\.csv$/i, required: true, deleteKey: 'transid' },
  { key: 'trans1', name: 'Trading Transactions (Trans1)', filePattern: /^trans1\.csv$/i, required: true, deleteKey: 'transid' },
  { key: 'mprices', name: 'Market Prices (MPrices)', filePattern: /^mprices\.csv$/i, required: true, deleteKey: 'row_id' },
  { key: 'scnote1', name: 'Contract Notes (SCNOTE1)', filePattern: /^sc_?note1?\.csv$/i, required: false, deleteKey: 'cnid' },
];

// Helper to normalize any date format (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, DD-MMM-YYYY) to YYYY-MM-DD
function normalizeDateToYYYYMMDD(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.trim().replace(/\//g, "-");
  
  // Format: DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  
  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    const [y, m, d] = clean.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Format: DD-MMM-YYYY (e.g. 03-Jun-2026 or 03-Jun-26)
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };
  const parts = clean.split("-");
  if (parts.length === 3) {
    const d = parts[0];
    const mStr = parts[1].toLowerCase().substring(0, 3);
    let y = parts[2];
    const m = monthNames[mStr];
    if (m) {
      if (y.length === 2) {
        y = Number(y) > 50 ? `19${y}` : `20${y}`;
      }
      return `${y}-${m}-${d.padStart(2, "0")}`;
    }
  }

  return clean.substring(0, 10);
}

// RFC 4180 Compliant CSV Parser
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      result.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (row.length > 0 || currentVal !== "") {
    row.push(currentVal);
    result.push(row);
  }
  return result;
}

// Convert CSV headers to database snake_case column names
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
  if (col === "Addr") return "addr";
  if (col === "PAN") return "pan";
  if (col === "AddInfo") return "addinfo";
  if (col === "AMID") return "amid";
  if (col === "ANM") return "anm";
  if (col === "ATYP") return "atyp";
  if (col === "GRP") return "grp";
  if (col === "ExInt1") return "exint1";
  if (col === "ExtStr") return "extstr";
  if (col === "ExInt2") return "exint2";
  if (col === "ISR") return "isr";
  if (col === "Alias") return "alias";
  if (col === "TRID") return "trid";
  if (col === "ATYID") return "atyid";
  if (col === "SID") return "sid";
  if (col === "CNID") return "cnid";
  if (col === "TRTY") return "trty";
  if (col === "TRSTR") return "trstr";
  if (col === "AcVch") return "acvch";
  if (col === "DT") return "dt";
  if (col === "QN") return "qn";
  if (col === "PurPr") return "purpr";
  if (col === "Brkg") return "brkg";
  if (col === "NetPr") return "netpr";
  if (col === "AMT") return "amt";
  if (col === "Chrgs") return "chrgs";
  if (col === "Narr") return "narr";
  if (col === "TmpBalQ") return "tmp_balq";
  if (col === "TmpBalA") return "tmp_bala";
  if (col === "AccInfo") return "accinfo";
  if (col === "TaxEtc") return "taxetc";
  if (col === "DtOrigin") return "dtorigin";
  if (col === "AgentCode") return "agentcode";
  if (col === "Qnt") return "qnt";
  if (col === "AmtInv") return "amtinv";
  if (col === "BalPurc") return "balpurc";
  if (col === "SellCnt") return "sellcnt";
  if (col === "Currv") return "currv";
  if (col === "Tgain") return "tgain";
  if (col === "IsCurrvManual") return "is_currv_manual";
  if (col === "Refno") return "refno";
  if (col === "Flag") return "flag";
  if (col === "Relgain") return "relgain";
  if (col === "TodayAmtinv") return "today_amtinv";
  if (col === "TodayQuant") return "today_quant";
  if (col === "Tag") return "tag";
  if (col === "VID") return "vid";
  if (col === "VTyp") return "vtyp";
  if (col === "PMS_TransID") return "pms_trans_id";
  if (col === "AcctList") return "acctlist";
  if (col === "ExtIDSource") return "extid_source";
  if (col === "AType") return "atype";
  if (col === "ImpRecID") return "imp_rec_id";
  if (col === "ChqNo") return "chqno";
  if (col === "TransID") return "transid";
  if (col === "MAID") return "maid";
  if (col === "CrAmt") return "cramt";
  if (col === "DrAmt") return "dramt";
  if (col === "SpecialAccount") return "special_account";
  if (col === "SourceID_ATYP") return "source_id_atyp";
  if (col === "CURRP") return "currp";
  if (col === "PREVP") return "prevp";
  if (col === "Date") return "date";
  if (col === "RowID") return "row_id";
  if (col === "ATY") return "aty";
  if (col === "BRKRID") return "brkrid";
  if (col === "CNNUM") return "cnnum";
  if (col === "BILLNUM") return "billnum";
  if (col === "SERVTAX") return "servtax";
  if (col === "STMPCHRGS") return "stmpchrgs";
  if (col === "TRANCHRG") return "tranchrg";
  if (col === "STT") return "stt";
  if (col === "OTHCHRG") return "othchrg";
  if (col === "AMTDUE") return "amtdue";
  if (col === "ISDUE") return "isdue";
  if (col === "ISSPEC") return "isspec";
  if (col === "CSTR") return "cstr";

  return col
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function parseValue(key: string, val: string): any {
  const cleanVal = val.trim();
  if (cleanVal === "") return null;
  if (["date", "dt", "dtorigin"].includes(key)) {
    return normalizeDateToYYYYMMDD(cleanVal);
  }

  if (["is_group", "is_it_ledger", "is_op_bal_to_be_recalc", "is_currv_manual"].includes(key)) {
    return (cleanVal === "1" || cleanVal.toLowerCase() === "true") ? 1 : 0;
  }
  
  const numericKeys = [
    "id", "client_id", "exit_status", "risk_profile", "view_settings", "pfolio_type", "ext_id",
    "investor_group_id", "pfolio_id", "ext_src_id", "pfid", "acid", "action_flag",
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

interface TableStatus {
  status: "idle" | "parsed" | "importing" | "done" | "error";
  rowCount: number;
  progress: number;
  error?: string;
}

// Helper to load sql.js dynamically
const loadSqlJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).initSqlJs) {
      resolve((window as any).initSqlJs);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js";
    script.onload = () => {
      resolve((window as any).initSqlJs);
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

// Helper to load PDF.js dynamically
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      const pdfjs = (window as any)['pdfjs-dist/build/pdf'];
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      (window as any).pdfjsLib = pdfjs;
      resolve(pdfjs);
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

const hashIsinToId = (isin: string): number => {
  let hash = 0;
  for (let i = 0; i < isin.length; i++) {
    const char = isin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const minVal = 800000000;
  const range = 100000000;
  const absHash = Math.abs(hash);
  return minVal + (absHash % range);
};

// ── Error Boundary — prevents blank page on any render crash ─────────────
class ImportPageErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; errorMsg: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: String(error?.message || error || 'Unknown error') };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[ImportPage] Render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px', textAlign: 'center', fontFamily: 'inherit' }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: '#fef2f2', borderRadius: '50%', marginBottom: '20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ color: '#dc2626', fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
            {this.state.errorMsg}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, errorMsg: '' }); window.location.reload(); }}
            style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ImportPageInner() {

  const navigate = useNavigate();
  const { triggerGlobalRefresh } = useFY();
  const { isTestMode } = useTestMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // EMERGENCY CLEANUP FOR CORRUPTED CONTRACT NOTE
  useEffect(() => {
    const cleanup = async () => {
      if (localStorage.getItem('didClearCorruptedData_13371')) return;
      try {
        console.log("RUNNING EMERGENCY DB CLEANUP FOR VOUCHER 13371...");
        // Delete scnote1
        await supabase.from('scnote1').delete().eq('cnnum', 'CNT-26/27-40606020');
        // Delete vouchersc1
        await supabase.from('vouchersc1').delete().eq('vid', 13371);
        
        localStorage.setItem('didClearCorruptedData_13371', 'true');
        
        // Force refresh state from DB
        await forceRefreshDatabase();
        
        alert("Corrupted database entry successfully wiped! The screen will now reload to clear memory.");
        window.location.reload();
      } catch (err) {
        console.error("Cleanup failed:", err);
      }
    };
    cleanup();
  }, []);

  // Global Refresh Key to force refresh selectors
  const [refreshKey, setRefreshKey] = useState(0);

  // Tabs: 'db' | 'contract-note' | 'mf-cas' | 'sql-restore'
  const [activeTab, setActiveTab] = useState<'db' | 'contract-note' | 'mf-cas' | 'sql-restore' | 'db-converter'>('db');

  // SQL Restore States
  const sqlFileInputRef = useRef<HTMLInputElement>(null);
  const [sqlMessage, setSqlMessage] = useState('');
  const [sqlLoading, setSqlLoading] = useState(false);

  const handleSqlRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSqlLoading(true);
    setSqlMessage('Reading SQL file...');
    try {
      let text = await file.text();
      setSqlMessage('Sanitizing SQL to protect asset_master and wipe old MProfit data...');
      
      // Remove any COPY or INSERT commands for asset_master to protect manual mappings
      text = text.replace(/COPY public\.asset_master.*?\n\\\./gs, '');
      text = text.replace(/INSERT INTO public\.asset_master.*?;/g, '');
      text = text.replace(/TRUNCATE TABLE public\.asset_master;/g, '');

      // Wipe ONLY the MProfit tables to prevent duplicate key errors during restore
      const wipeCommand = `
        TRUNCATE TABLE 
          public.portfolios,
          public.investor_group_members,
          public.acc_pflink,
          public.acmac1,
          public.sam,
          public.bs1,
          public.sum_table,
          public.vouchersc1,
          public.vouchers1,
          public.transc1,
          public.trans1,
          public.mprices,
          public.scnote1
        CASCADE;
      `;
      text = wipeCommand + "\n\n" + text;

      setSqlMessage('Executing SQL restore on Supabase server (this may take a minute)...');
      
      const { error } = await supabase.rpc('exec_sql', { query: text });
      
      if (error) {
        console.error("SQL Restore Error:", error);
        setSqlMessage('❌ Error: ' + error.message + ' (Did you create the exec_sql RPC function?)');
      } else {
        setSqlMessage('✅ Database restored successfully! Reloading data...');
        await forceRefreshDatabase();
        setSqlMessage('✅ Data reloaded. Application is now perfectly synced with your SQL backup.');
      }
    } catch (err: any) {
      console.error(err);
      setSqlMessage('❌ Error: ' + err.message);
    }
    setSqlLoading(false);
  };

  // MF CAS Import States
  const [casTrades, setCasTrades] = useState<any[]>([]);
  const [casMessage, setCasMessage] = useState('');
  const [casImporting, setCasImporting] = useState(false);
  const [casImportDone, setCasImportDone] = useState(false);
  const [casImportedVids, setCasImportedVids] = useState<number[]>([]); // track orange highlight
  const [casPortfolioMap, setCasPortfolioMap] = useState<Record<string, string>>({}); // PAN -> portfolioId

  // MProfit DB Import States

  const [mapColumn, setMapColumn] = React.useState<Record<string, string>>({});
  const [topPortfolioId, setTopPortfolioId] = React.useState<string>('');
  const [topCnDate, setTopCnDate] = React.useState<string>('');

  const [sttLedgerId, setSttLedgerId] = React.useState<number | null>(null);
  const [otherLedgerId, setOtherLedgerId] = React.useState<number | null>(null);
  const toggleSelectAllCn = () => {};

  const [stagedFiles, setStagedFiles] = useState<Record<string, { rows: any[]; fileName: string }>>({});
  const hasStaged = Object.keys(stagedFiles).length > 0;
  const missingRequired = TABLE_CONFIGS.filter(t => 
    t.required && !stagedFiles[t.key]
  );
  const [tableStatus, setTableStatus] = useState<Record<string, TableStatus>>(() => {
    const initial: Record<string, TableStatus> = {};
    TABLE_CONFIGS.forEach(t => {
      initial[t.key] = { status: "idle", rowCount: 0, progress: 0 };
    });
    return initial;
  });

  const [isImporting, setIsImporting] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [overallMessage, setOverallMessage] = useState("");
  const [importComplete, setImportComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── File Processing ───────────────────────────────────────────────────────
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.db') || lowerName.endsWith('.sqlite') || lowerName.endsWith('.bak')) {
        try {
          const initSqlJs = await loadSqlJs();
          const SQL = await initSqlJs({
            locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
          });
          const buffer = await file.arrayBuffer();
          
          let db;
          try {
             db = new SQL.Database(new Uint8Array(buffer));
          } catch (e: any) {
             alert(`Could not parse ${file.name} as a SQLite database. Error: ${e.message}. Is this file really a database?`);
             continue;
          }
          
          for (const config of TABLE_CONFIGS) {
            try {
              const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
              if (tablesResult.length > 0) {
                 const allTables = tablesResult[0].values.map((v: any) => v[0] as string);
                 
                 const match = allTables.find((t: string) => config.filePattern.test(t + '.csv'));
                 if (match) {
                    const dataRes = db.exec(`SELECT * FROM "${match}"`);
                    if (dataRes.length > 0) {
                       const columns = dataRes[0].columns;
                       const values = dataRes[0].values;
                       
                       let rows = values.map((row: any) => {
                          const obj: Record<string, any> = {};
                          columns.forEach((col: string, i: number) => {
                           const mappedCol = mapHeaderToColumn(col);
                           obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                          });
                          return obj;
                       });

                       // If parsing acmac1, also check for any missing master ledgers in ACMA1
                       if (config.key === 'acmac1' && allTables.includes('ACMA1')) {
                         try {
                           const acmaRes = db.exec('SELECT * FROM "ACMA1"');
                           if (acmaRes.length > 0) {
                             const acmaCols = acmaRes[0].columns;
                             const existingIds = new Set(rows.map((r: any) => r.id));
                             acmaRes[0].values.forEach((row: any) => {
                               const obj: Record<string, any> = {};
                               acmaCols.forEach((col: string, i: number) => {
                                 const mappedCol = mapHeaderToColumn(col);
                                 obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                               });
                               if (!existingIds.has(obj.id)) {
                                 rows.push(obj);
                               }
                             });
                           }
                         } catch (err) {
                           console.warn('Could not merge ACMA1 into acmac1:', err);
                         }
                       }
                       
                       setStagedFiles(prev => ({ ...prev, [config.key]: { rows, fileName: file.name + ` (${match})` } }));
                       setTableStatus(prev => ({
                         ...prev,
                         [config.key]: { status: 'parsed', rowCount: rows.length, progress: 0 }
                       }));
                       console.log(`Staged ${config.name} from DB: ${rows.length} rows`);
                    }
                 }
              }
            } catch (e) {
              console.error(`Error reading ${config.name} from DB`, e);
            }
          }
        } catch (globalErr: any) {
          alert(`Error initializing database reader: ${globalErr.message}`);
        }
        continue;
      }
      
      if (!file.name.endsWith('.csv')) continue;
      const fileName = file.name.toLowerCase();
      const config = TABLE_CONFIGS.find(t => t.filePattern.test(fileName));
      if (!config) {
        console.warn(`No table config matched file: ${file.name}`);
        continue;
      }
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length < 2) continue; // No data rows
      const headers = parsed[0].map(h => mapHeaderToColumn(h));
      const rows = parsed.slice(1)
        .filter(row => row.some(cell => cell.trim() !== ''))
        .map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            if (h) obj[h] = parseValue(h, row[i] ?? '');
          });
          return obj;
        });
      setStagedFiles(prev => ({ ...prev, [config.key]: { rows, fileName: file.name } }));
      setTableStatus(prev => ({
        ...prev,
        [config.key]: { status: 'parsed', rowCount: rows.length, progress: 0 }
      }));
      console.log(`Staged ${config.name}: ${rows.length} rows`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFiles(e.target.files);
    e.target.value = ''; // Reset input
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const clearStaged = () => {
    setStagedFiles({});
    const initial: Record<string, TableStatus> = {};
    TABLE_CONFIGS.forEach(t => {
      initial[t.key] = { status: "idle", rowCount: 0, progress: 0 };
    });
    setTableStatus(initial);
    setImportComplete(false);
    setOverallProgress(0);
    setOverallMessage("");
  };

  const allowedColumns: Record<string, string[]> = {
    portfolios: [
      'id', 'client_id', 'investor_name', 'is_group', 'full_name', 'investor_addr',
      'city', 'pin_code', 'country', 'phone', 'mobile', 'pan', 'exit_status',
      'risk_profile', 'view_settings', 'pfolio_type', 'ext_id'
    ],
    sam: [
      'amid', 'anm', 'atyp', 'grp', 'exint1', 'extstr', 'exint2', 'isr', 'alias'
    ],
    investor_group_members: [
      'investor_group_id', 'pfolio_id', 'ext_src_id', 'client_id'
    ],
    acc_pflink: [
      'pfid', 'acid', 'is_op_bal_to_be_recalc', 'action_flag', 'client_id'
    ],
    acmac1: [
      'id', 'ext_id', 'parent_id', 'parent_ext_id', 'is_group', 'name', 'disp_seqno',
      'descr', 'flags', 'acid', 'clid', 'is_it_ledger', 'special_type_id', 'cr_bal',
      'db_bal', 'tree_node', 'addr', 'pan', 'addinfo'
    ],
    mprices: [
      'source_id_atyp', 'amid', 'currp', 'prevp', 'date', 'row_id'
    ],
    sum_table: [
      'sid', 'pfolio_id', 'client_id', 'atty', 'amid', 'agentcode', 'qnt', 'amtinv',
      'balpurc', 'sellcnt', 'currv', 'tgain', 'is_currv_manual', 'refno', 'ext_id',
      'flag', 'relgain', 'today_amtinv', 'today_quant', 'tag', 'accinfo'
    ],
    scnote1: [
      'cnid', 'pfid', 'aty', 'brkrid', 'cnnum', 'billnum', 'servtax', 'stmpchrgs',
      'tranchrg', 'stt', 'othchrg', 'amtdue', 'dt', 'isdue', 'isspec', 'cstr'
    ],
    vouchers1: [
      'vid', 'vtyp', 'dt', 'narr', 'pms_trans_id', 'cnid', 'acctlist', 'extid_source',
      'pfid', 'atype', 'sid', 'imp_rec_id', 'chqno', 'acid'
    ],
    vouchersc1: [
      'vid', 'vtyp', 'dt', 'narr', 'pms_trans_id', 'cnid', 'acctlist', 'extid_source',
      'pfid', 'atype', 'sid', 'imp_rec_id', 'chqno', 'acid'
    ],
    trans1: [
      'transid', 'vid', 'vtyp', 'dt', 'maid', 'ext_id', 'cramt', 'dramt', 'special_account',
      'narr', 'acid'
    ],
    transc1: [
      'transid', 'vid', 'vtyp', 'dt', 'maid', 'ext_id', 'cramt', 'dramt', 'special_account',
      'narr', 'acid'
    ],
    bs1: [
      'trid', 'pfid', 'amid', 'atyid', 'sid', 'cnid', 'trty', 'trstr', 'acvch',
      'dt', 'qn', 'purpr', 'brkg', 'netpr', 'amt', 'chrgs', 'narr', 'tmp_balq',
      'tmp_bala', 'accinfo', 'taxetc', 'dtorigin'
    ]
  };

  const startImport = async () => {
    setIsImporting(true);
    setImportComplete(false);
    setOverallMessage("Preparing to import database records...");
    setOverallProgress(0);

    const tablesInOrder = [
      'portfolios', 'sam', 'acmac1', 'acc_pflink', 'investor_group_members',
      'mprices', 'sum_table', 'scnote1', 'vouchers1', 'vouchersc1',
      'trans1', 'transc1', 'bs1'
    ];

    try {
      // Step 1: Wipe tables in reverse order for foreign key safety
      setOverallMessage("Wiping existing database tables...");
      for (let i = tablesInOrder.length - 1; i >= 0; i--) {
        const tableKey = tablesInOrder[i];
        const config = TABLE_CONFIGS.find(t => t.key === tableKey);
        if (!config) continue;
        const delKey = config.deleteKey;
        await supabase.from(tableKey).delete().neq(delKey, -999999);
      }

      // Step 2: Upload staged records in strict dependency order
      const totalTablesToUpload = tablesInOrder.filter(t => stagedFiles[t]).length;
      let completedTables = 0;

      for (const tableKey of tablesInOrder) {
        const fileData = stagedFiles[tableKey];
        const config = TABLE_CONFIGS.find(t => t.key === tableKey);
        if (!fileData || !config) continue;

        const allowedCols = allowedColumns[tableKey] || [];
        const rows = fileData.rows;
        
        setTableStatus(prev => ({
          ...prev,
          [tableKey]: { status: 'importing', rowCount: rows.length, progress: 0 }
        }));
        setOverallMessage(`Uploading ${config.name} (${rows.length.toLocaleString()} rows)...`);

        const cleanRows = rows.map(r => {
          const mapped: Record<string, any> = {};
          for (const [col, val] of Object.entries(r)) {
            if (allowedCols.includes(col)) {
              let finalVal = val;
              if (typeof val === 'string' && val.trim() === '') {
                finalVal = null;
              }
              mapped[col] = finalVal;
            }
          }
          return mapped;
        });

        const batchSize = 500;
        for (let i = 0; i < cleanRows.length; i += batchSize) {
          const batch = cleanRows.slice(i, i + batchSize);
          const { error: insertErr } = await supabase.from(tableKey).insert(batch);
          if (insertErr) {
            console.error(`Error inserting into ${tableKey}:`, insertErr);
            throw new Error(`Failed to upload ${config.name}: ${insertErr.message}`);
          }
          const currentProgress = Math.min(100, Math.round(((i + batch.length) / cleanRows.length) * 100));
          setTableStatus(prev => ({
            ...prev,
            [tableKey]: { status: 'importing', rowCount: rows.length, progress: currentProgress }
          }));
        }

        setTableStatus(prev => ({
          ...prev,
          [tableKey]: { status: 'done', rowCount: rows.length, progress: 100 }
        }));

        completedTables++;
        setOverallProgress(Math.round((completedTables / totalTablesToUpload) * 100));
      }

      setOverallMessage("Refreshing application data...");
      await forceRefreshDatabase();
      triggerGlobalRefresh();
      setImportComplete(true);
      setOverallMessage("✅ All database tables imported successfully!");
    } catch (err: any) {
      console.error("Import failed:", err);
      alert(`Import error: ${err.message}`);
      setOverallMessage(`❌ Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Dropdown options
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [brokerLedgers, setBrokerLedgers] = useState<any[]>([]);

  // Decryption States
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Autocomplete Suggestions State
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);

    // Broker Contract Note States
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [selectedBrokerLedger, setSelectedBrokerLedger] = useState<string>("");
  const [selectedBroker, setSelectedBroker] = useState<string>("zerodha");
  const [cnDate, setCnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cnNo, setCnNo] = useState<string>("");
  const [cnTrades, setCnTrades] = useState<any[]>([]);
  const [hideDuplicatesCn, setHideDuplicatesCn] = useState<boolean>(false);
  const [cnCharges, setCnCharges] = useState({
    stt: 0,
    brokerage: 0,
    gst: 0,
    stamp: 0,
    transCharges: 0,
    other: 0
  });
  const [pdfFinalNet, setPdfFinalNet] = useState<number | null>(null);

  // Initialize DB data for selectors
  useEffect(() => {
    async function loadSelectors() {
      if (!state.initialized) {
        await forceRefreshDatabase();
      }
      
      const ports = getStoredPortfolios();
      setPortfolios(ports);
      if (ports.length > 0) {
        setSelectedPortfolio(String(ports[0].id));
      }
    }
    loadSelectors().catch(console.error);
  }, [refreshKey]);

  // Load broker ledgers dynamically when selectedPortfolio changes or selected broker parser changes
  useEffect(() => {
    if (!selectedPortfolio || portfolios.length === 0) return;
    const pf = portfolios.find(p => String(p.id) === String(selectedPortfolio));
    const acid = pf ? pf.accountId : null;
    if (acid) {
      const ledgers = getStoredLedgers(acid);
      const brokers = ledgers.filter(l => l.groupId === '75' || l.groupId === '90');
      setBrokerLedgers(brokers);
      if (brokers.length > 0) {
        // Try to match the selected broker parser to the ledger name (e.g. Zerodha, RK Global, Mirae)
        const activeParser = selectedBroker.toLowerCase().replace(/[^a-z0-9]/g, "");
        const matchedLedger = brokers.find(b => {
          const nameLower = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (activeParser === 'zerodha') return nameLower.includes('zerodha');
          if (activeParser === 'rkglobal') return nameLower.includes('global') || nameLower.includes('rk');
          if (activeParser === 'mirae') return nameLower.includes('mirae') || nameLower.includes('mstock');
          return nameLower.includes(activeParser);
        });

        if (matchedLedger) {
          setSelectedBrokerLedger(matchedLedger.id);
        } else if (!brokers.some(b => String(b.id) === String(selectedBrokerLedger))) {
          setSelectedBrokerLedger(brokers[0].id);
        }
      } else {
        setSelectedBrokerLedger("");
      }
    }
  }, [selectedPortfolio, portfolios, selectedBroker, refreshKey]);

  // Autocomplete search suggestions finder
  const handleAssetSearch = async (query: string, rowId: number) => {
    setSearchQuery(query);
    setFocusedRowId(rowId);
    
    if (!query || query.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const assetType = 50; // Contract notes is stocks (50)

    // 1. Filter local in-memory holdings first
    const localMatches = state.assetMaster.filter((a: any) => {
      const matchesQuery = a.name.toLowerCase().includes(query.toLowerCase());
      const matchesType = a.asset_type === assetType;
      return matchesQuery && matchesType;
    }).slice(0, 10).map((a: any) => ({ amid: a.amid, name: a.name, asset_type: a.asset_type, isLocal: true }));

    // 2. Query global security asset master in Supabase
    const cleanQuery = query.trim();
    const { data: dbMatches } = await supabase
      .from('asset_master')
      .select('amid, name, asset_type, nse_symbol, isin')
      .or(`name.ilike.%${cleanQuery}%,nse_symbol.ilike.%${cleanQuery}%,isin.ilike.%${cleanQuery}%`)
      .eq('asset_type', assetType)
      .limit(8);
    
    const dbMapped = (dbMatches || []).map((s: any) => ({
      amid: s.amid,
      name: s.name,
      asset_type: s.asset_type,
      isLocal: false
    }));

    // Combine
    const combined = [...localMatches];
    dbMapped.forEach(item => {
      if (!combined.some(c => c.amid === item.amid)) {
        combined.push(item);
      }
    });

    setSearchSuggestions(combined.slice(0, 12));
  };

  const selectAssetSuggestion = (suggestion: any, rowId: number) => {
    setCnTrades(prev => prev.map(t => t.id === rowId ? { ...t, amid: suggestion.amid, assetName: suggestion.name } : t));
    setFocusedRowId(null);
    setSearchSuggestions([]);
  };

  const bs1TradeMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    const normalizeType = (t: string) => {
      const typeLower = (t || '').toLowerCase();
      if (['buy', 'purchase', 'sip', 'dividend reinvest', 'dividend_reinvest', 'reinvest'].includes(typeLower)) return 'buy';
      if (['sell', 'redemption'].includes(typeLower)) return 'sell';
      if (['dividend', 'dividend payout', 'dividend_payout'].includes(typeLower)) return 'dividend';
      return typeLower;
    };
    for (const b of state.bs1 || []) {
      const pfId = String(b.pfid || b.pfolio_id);
      const amid = String(b.amid);
      const date = (b.dt || b.tdate || '').substring(0, 10);
      const key = `${pfId}_${amid}_${date}`;
      if (!map[key]) map[key] = [];
      map[key].push({
        qty: Number(b.qn || b.qty),
        typeStr: normalizeType(b.trstr || b.ttype || '')
      });
    }
    return map;
  }, [state.bs1]);

  // Helper to check for duplicate transactions in Supabase database cache (state.bs1)
  const isDuplicateTrade = (trade: any, portfolioId: number, date: string): boolean => {
    if (trade.amid === -1 || !portfolioId || !date) return false;

    const normalizeType = (t: string) => {
      const typeLower = (t || '').toLowerCase();
      if (['buy', 'purchase', 'sip', 'dividend reinvest', 'dividend_reinvest', 'reinvest'].includes(typeLower)) return 'buy';
      if (['sell', 'redemption'].includes(typeLower)) return 'sell';
      if (['dividend', 'dividend payout', 'dividend_payout'].includes(typeLower)) return 'dividend';
      return typeLower;
    };

    const pfId = String(portfolioId);
    const amid = String(trade.amid);
    const dateStr = date.substring(0, 10);
    const key = `${pfId}_${amid}_${dateStr}`;
    
    const matches = bs1TradeMap[key];
    if (!matches) return false;

    const normTradeType = normalizeType(trade.type);
    const dup = matches.some(m => Math.abs(m.qty - Number(trade.quantity)) < 0.01 && m.typeStr === normTradeType);
    if (dup) console.log('Duplicate trade detected:', key, trade, matches);
    return dup;
  };


  // Dynamic asset mapping creator if missing
  // STRICT RULE: Only looks up/creates ledgers for the EXACT account (acid) of the portfolio.
  // NEVER cross-account: importing Pramesh (acid=30) must NEVER reuse Krisha's (acid=36) ledger.
  // Dynamic asset mapping creator if missing
  // STRICT RULE: Only looks up/creates ledgers for the EXACT account (acid) of the portfolio.
  // NEVER cross-account: importing Pramesh (acid=30) must NEVER reuse Krisha's (acid=36) ledger.
  const ensureAssetLedgerExists = async (amid: number, name: string, portfolioId: number | string, assetType: number): Promise<number> => {
    // Get active account ID for the portfolio — STRICT, no fallback cross-account
    const pf = portfolios.find((p: any) => String(p.id) === String(portfolioId));
    const acid = pf ? Number(pf.accountId) : 31;
    const nameLower = String(name || '').toLowerCase().trim();

    // Step 1: In-memory lookup — EXACT acid match only
    const cleanLedgerName = (n: string) => {
      let cleaned = String(n || '').replace(/\s*\(?ISIN\s+[A-Z0-9]{12}\)?/gi, '');
      cleaned = cleaned.replace(/\s*\([A-Z]{2}[A-Z0-9]{10}\)/gi, '');
      cleaned = cleaned.replace(/\s*\(\d[\d\s\/,-]*\)/gi, '');
      return cleaned.toLowerCase().trim().replace(/\s*-\s*$/, '').trim();
    };
    const cleanedNameLower = cleanLedgerName(name);

    const existingByName = state.acmac1.find((a: any) =>
      !a.is_group &&
      a.acid === acid &&
      a.name && cleanLedgerName(a.name) === cleanedNameLower
    );
    if (existingByName) {
      console.log(`[ensureLedger] Reusing "${existingByName.name}" id=${existingByName.id} acid=${acid}`);
      return Number(existingByName.id);
    }

    // Step 2: DB lookup — EXACT acid match only
    const { data: dbByName } = await supabase.from('acmac1')
      .select('*')
      .ilike('name', name.trim())
      .eq('acid', acid)            // STRICT — same account only, NEVER cross-account
      .eq('is_group', false)
      .limit(1);
    if (dbByName && dbByName.length > 0) {
      console.log(`[ensureLedger] DB found "${dbByName[0].name}" id=${dbByName[0].id} acid=${acid}`);
      state.acmac1.push(dbByName[0]);
      return Number(dbByName[0].id);
    }

    // Step 3: Create a NEW ledger for this exact acid
    const { data: maxIdRow } = await supabase.from('acmac1').select('id').order('id', { ascending: false }).limit(1);
    const nextId = (maxIdRow?.[0]?.id || 500000) + 1;

    const parentId = assetType === 60 ? 200061
      : assetType === 61 ? 200062
      : assetType === 80 ? 400000
      : 200050; // default: Stocks

    const newLedgerRow = {
      id: nextId,
      name: name.trim(),
      parent_id: parentId,
      acid: acid,
      is_group: false,
      db_bal: 0,
      cr_bal: 0,
      flags: '65536',
      special_type_id: 150
    };

    const { error } = await supabase.from('acmac1').insert([newLedgerRow]);

    if (error) {
      console.error('❌ [ensureLedger] Error creating ledger:', error.message);
      throw new Error(`Failed to create ledger for ${name}: ${error.message}`);
    }

    console.log(`[ensureLedger] Created NEW ledger "${name.trim()}" id=${nextId} acid=${acid}`);
    state.acmac1.push(newLedgerRow);

    return nextId;
  };

  const commitContractNote = async () => {
    setIsImporting(true);
    setOverallMessage("Committing contract note trades to ledger...");
    try {
      if (isDuplicateCN) throw new Error(`CN No. ${cnNo} already exists in the database. Delete the existing voucher first before re-importing.`);
      if (!selectedBrokerLedger) throw new Error("Please select a Broker Ledger before committing.");
      
      const selectedTrades = cnTrades.filter((t: any) => t.selected && t.amid !== -1 && t.date);
      if (selectedTrades.length === 0) throw new Error("No valid trades selected.");

      const grouped = selectedTrades.reduce((acc: any, t: any) => {
        const pf = portfolios.find((p: any) => String(p.id) === String(topPortfolioId));
        const pId = pf ? String(pf.id) : String(t.portfolioId || topPortfolioId || 1);
        const groupDate = topCnDate || t.date;
        const key = `${pId}_${groupDate}`;
        if (!acc[key]) acc[key] = { pId, groupDate, tradesInGroup: [] };
        acc[key].tradesInGroup.push(t);
        return acc;
      }, {});

      const numGroups = Object.keys(grouped).length;

      for (const key of Object.keys(grouped)) {
        const { pId, groupDate, tradesInGroup } = grouped[key];
        const mappedLines: any[] = [];
        
        const groupCharges = {
          stt: (cnCharges.stt || 0) / numGroups,
          other: ((cnCharges.brokerage || 0) + (cnCharges.gst || 0) + (cnCharges.stamp || 0) + (cnCharges.transCharges || 0) + (cnCharges.other || 0)) / numGroups
        };

        let totalBuys = 0;
        let totalSells = 0;

        // Helper: buy transaction type codes from bs1
        const isBuyTrty = (trty: number) => [19, 20, 12, 25, 30, 35, 36, 37, 38, 39, 40, 45, 46, 47, 48, 49].includes(trty);

        for (const t of tradesInGroup) {
          const ledgerId = await ensureAssetLedgerExists(t.amid, t.assetName, pId, 50);
          const gross = t.quantity * t.price;

          if (t.type === "Buy") {
            totalBuys += gross;
            mappedLines.push({
              ledgerId,
              amid: t.amid,
              assetName: t.assetName,
              debit: gross,
              credit: 0,
              quantity: t.quantity,
              price: t.price
            });
          } else {
            // SELL: Must credit at COST (not sale price) + separate capital gain entry
            // This matches MProfit double-entry: Cr Stock@Cost + Cr LTCG/STCG@Gain = Dr Broker@Proceeds
            const saleProceeds = gross;

            // FIFO cost from bs1 for this asset in this portfolio
            const buyRows = state.bs1
              .filter((r: any) => Number(r.pfid) === Number(pId) && r.amid === t.amid && isBuyTrty(r.trty))
              .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

            let remainingQty = t.quantity;
            let fifoTotalCost = 0;
            let earliestBuyDate: string | null = null;

            for (const buy of buyRows) {
              if (remainingQty <= 0) break;
              const buyQty = Number(buy.qn) || 0;
              const buyAmt = Number(buy.amt) || 0;
              if (buyQty <= 0) continue;
              const useQty = Math.min(buyQty, remainingQty);
              const unitCost = buyAmt / buyQty;
              fifoTotalCost += useQty * unitCost;
              if (!earliestBuyDate) earliestBuyDate = buy.dt;
              remainingQty -= useQty;
            }

            // Fallback: no buy history → zero gain (cost = proceeds)
            if (fifoTotalCost === 0) fifoTotalCost = saleProceeds;

            const costBasis = Number(fifoTotalCost.toFixed(2));
            const capitalGain = Number((saleProceeds - costBasis).toFixed(2));

            // Determine STCG (id=460) vs LTCG (id=465) by holding period
            const holdingDays = earliestBuyDate
              ? Math.floor((new Date(t.date).getTime() - new Date(earliestBuyDate).getTime()) / 86400000)
              : 0;
            const gainLedgerId = holdingDays >= 365 ? 465 : 460;
            const gainType = holdingDays >= 365 ? 'LTCG' : 'STCG';

            console.log(`[SELL ${t.assetName}] qty=${t.quantity} price=${t.price} proceeds=${saleProceeds} cost=${costBasis} ${gainType}=${capitalGain} held=${holdingDays}d`);

            // Line 1: Cr Stock ledger at COST (removes investment from balance sheet)
            mappedLines.push({
              ledgerId,
              amid: t.amid,
              assetName: t.assetName,
              debit: 0,
              credit: costBasis,
              quantity: t.quantity,
              price: costBasis / t.quantity
            });

            // Line 2: Capital gain/loss line
            if (Math.abs(capitalGain) > 0.01) {
              if (capitalGain > 0) {
                // Profit: Cr STCG/LTCG ledger
                mappedLines.push({ ledgerId: gainLedgerId, debit: 0, credit: capitalGain });
              } else {
                // Loss: Dr STCG/LTCG ledger
                mappedLines.push({ ledgerId: gainLedgerId, debit: Math.abs(capitalGain), credit: 0 });
              }
            }

            totalSells += saleProceeds; // Broker receives full sale proceeds
          }
        }

        // Add proportional charges
        const c = groupCharges;
        const combinedOther = Number((c.other || 0).toFixed(2));
        
        // Find or create STT and Trans. Charges ledgers dynamically
        const pf = portfolios.find((p: any) => String(p.id) === String(pId));
        const acid = pf ? Number(pf.accountId) : 31;
        
        const finalSttLedger = await ensureLedgerExists("STT - Equity", "stt", acid);
        const finalOtherLedger = await ensureLedgerExists("Trans. Charges - Equity", "stt", acid);
        
        const finalSttLedgerId = finalSttLedger ? finalSttLedger.id : 0;
        const finalOtherLedgerId = finalOtherLedger ? finalOtherLedger.id : 0;

        if (c.stt > 0 && finalSttLedgerId) mappedLines.push({ ledgerId: Number(finalSttLedgerId), debit: c.stt, credit: 0 });
        if (combinedOther > 0 && finalOtherLedgerId) mappedLines.push({ ledgerId: Number(finalOtherLedgerId), debit: combinedOther, credit: 0 });

        const sumCharges = c.stt + combinedOther;
        const netPayable = (totalBuys + sumCharges) - totalSells;

        if (netPayable > 0) {
          mappedLines.push({
            ledgerId: Number(selectedBrokerLedger),
            debit: 0,
            credit: Number(netPayable.toFixed(2))
          });
        } else if (netPayable < 0) {
          mappedLines.push({
            ledgerId: Number(selectedBrokerLedger),
            debit: Number(Math.abs(netPayable).toFixed(2)),
            credit: 0
          });
        }

        // Rounding Off check
        const sumDebits = mappedLines.reduce((s, l) => s + (l.debit || 0), 0);
        const sumCredits = mappedLines.reduce((s, l) => s + (l.credit || 0), 0);
        const diff = sumDebits - sumCredits;
        if (Math.abs(diff) > 0 && Math.abs(diff) < 1.0) {
          const lastLine = mappedLines[mappedLines.length - 1];
                    if (lastLine.credit > 0) {
            lastLine.credit = Number((lastLine.credit + diff).toFixed(2));
          } else {
            lastLine.debit = Number((lastLine.debit - diff).toFixed(2));
          }
        }

        const brokerName = brokerLedgers.find(b => String(b.id) === String(selectedBrokerLedger))?.name || "Broker";
        const currentPf = portfolios.find(p => String(p.id) === String(pId));
        const pName = currentPf?.name || currentPf?.portfolioName || `Portfolio ${pId}`;
        const dataPayload = {
          accountId: currentPf?.accountId || 31,
          portfolioId: pId,
          date: groupDate,
          narration: `Daily trades CN (${brokerName}) - ${pName}${cnNo ? ' No: ' + cnNo : ''}`,
          type: "journal",
          lines: mappedLines,
          // Contract note metadata — required for scnote1 header creation
          isContractNote: true,
          cnNo: cnNo || '',
          brokerLedgerId: Number(selectedBrokerLedger),
          cnCharges: groupCharges,
          netPayable: Number(netPayable.toFixed(2))
        };

        console.log(`Commiting contract note voucher for portfolio ${pName}:`, dataPayload);
        await createVoucher({ ...dataPayload, isTest: isTestMode });
      }

      await forceRefreshDatabase();
      setRefreshKey(prev => prev + 1);

      // Auto-trigger live price update for the imported assets
      syncLivePrices(() => {}, true).catch(console.warn);

      setOverallMessage("✅ Contract note trades successfully imported!");
      setCnCharges({
        stt: 0,
        brokerage: 0,
        gst: 0,
        stamp: 0,
        transCharges: 0,
        other: 0
      });
      setCnTrades([]);
      setCnNo("");
    } catch (err: any) {
      alert(`Failed to commit trades: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  
  // Inline styles
  const tabStyle = (active: boolean) => ({
    padding: "12px 24px",
    background: active ? "#2563eb" : "none",
    border: "none",
    borderRadius: "8px",
    fontWeight: 700,
    color: active ? "#fff" : "#64748b",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s ease",
    boxShadow: active ? "0 4px 12px rgba(37,99,235,0.2)" : "none"
  });

  const selectStyle = {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    width: "100%",
    backgroundColor: "#fff",
    color: "#1e293b",
    outline: "none",
    boxSizing: "border-box" as const,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  };

  const inputStyle = {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    width: "100%",
    outline: "none",
    boxSizing: "border-box" as const,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  };

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: "#475569",
    marginBottom: "6px"
  };

  // Filter lists based on hideDuplicates checkbox
  const visibleCnTrades = cnTrades.filter(t => !hideDuplicatesCn || !isDuplicateTrade(t, Number(t.portfolioId), t.date));

  const allCnSelected = visibleCnTrades.length > 0 && visibleCnTrades.every(t => t.selected);

  // Check if CN number already exists in scnote1 table OR in voucher narrations
  const isDuplicateCN = cnNo
    ? (state.scnote1?.some((s: any) => s.cnnum && s.cnnum.toLowerCase() === cnNo.toLowerCase()) ||
       getStoredVouchers().some((v: any) => {
         const n = (v.narration || v.narr || '').toLowerCase();
         return n.includes(`no: ${cnNo.toLowerCase()}`) || n.includes(cnNo.toLowerCase());
       }))
    : false;

  const activeCnTrades = visibleCnTrades.filter(t => t.selected);
  const totalCnBuys = activeCnTrades.filter(t => t.type === "Buy").reduce((sum, t) => sum + (t.gross || 0), 0);
  const totalCnSells = activeCnTrades.filter(t => t.type === "Sell").reduce((sum, t) => sum + (t.gross || 0), 0);
  const totalCnCharges = Number(cnCharges.stt) + Number(cnCharges.brokerage) + Number(cnCharges.gst) + Number(cnCharges.stamp) + Number(cnCharges.transCharges) + (Number(cnCharges.other) || 0);
  const netCnAmount = (totalCnBuys + totalCnCharges) - totalCnSells;

  // ── Top-level portfolio/date change handlers ─────────────────────────────
  const handleTopPortfolioChange = (portfolioId: string) => {
    setSelectedPortfolio(portfolioId);
  };

  const handleTopCnDateChange = (date: string) => {
    setCnDate(date);
  };

  // ── Broker contract note PDF/CSV file select ──────────────────────────────
  const handleBrokerCnFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // If PDF, prompt for password
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setPendingFile(file);
      setPasswordPromptOpen(true);
    } else {
      // Parse as CSV
      const text = await file.text();
      console.log('Broker CN file selected:', file.name, 'size:', text.length);
    }
    e.target.value = '';
  };

  // ── CN Trade row management ───────────────────────────────────────────────
  const handleAddCnTradeRow = () => {
    const newRow = {
      id: Date.now(),
      assetName: '',
      amid: -1,
      type: 'Buy',
      quantity: 0,
      price: 0,
      gross: 0,
      brokerage: 0,
      date: cnDate,
      portfolioId: selectedPortfolio,
      selected: true,
    };
    setCnTrades(prev => [...prev, newRow]);
  };

  const handleUpdateCnTradeRow = (id: number, field: string, value: any) => {
    setCnTrades(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };
      // Auto-compute gross if qty/price updated
      if (field === 'quantity' || field === 'price') {
        updated.gross = Number(updated.quantity || 0) * Number(updated.price || 0);
      }
      return updated;
    }));
  };

  const handleDeleteCnTradeRow = (id: number) => {
    setCnTrades(prev => prev.filter(t => t.id !== id));
  };

  // ── Password prompt (for encrypted PDFs) ─────────────────────────────────
  const handlePasswordSubmit = async () => {
    if (!pendingFile) return;
    try {
      const buffer = await pendingFile.arrayBuffer();
      
      const response = await fetch('/api/parse-cn', {
        method: 'POST',
        headers: {
          'x-cn-password': tempPassword,
          'x-cn-broker': selectedBroker,
          'Content-Type': 'application/pdf'
        },
        body: buffer
      });

      if (!response.ok) {
         let errMsg = "Failed to parse Contract Note";
         try {
           const errData = await response.json();
           if (errData.error) errMsg = errData.error;
           if (errData.message) errMsg = errData.message;
         } catch(e){}
         throw new Error(errMsg);
      }

      const result = await response.json();
      if (result.status === 'error') {
        throw new Error(result.message || "Invalid password or parsing error");
      }

      let nextId = Date.now();
      const newTrades: any[] = [];

      // Auto-detect portfolio from PAN
      let autoSelectedPortfolio = selectedPortfolio;
      if (result.pan) {
        const pan = result.pan.toUpperCase();
        const matchedPf = state.portfolios.find((p: any) => p.pan && p.pan.toUpperCase() === pan);
        if (matchedPf) {
          autoSelectedPortfolio = String(matchedPf.id);
          setSelectedPortfolio(autoSelectedPortfolio);
        }
      }

      // Set CN date from parsed PDF (fallback to today)
      const parsedDate = result.cnDate || cnDate;
      if (result.cnDate) setCnDate(result.cnDate);

      // Set CN number from parsed PDF
      if (result.cnNo) setCnNo(result.cnNo);

      // Auto-detect broker
      if (result.broker && result.broker !== selectedBroker) {
        setSelectedBroker(result.broker);
      }

      for (const t of result.trades) {
         const isin = (t.isin || '').toUpperCase().trim();
         const symbol = (t.assetName || '').toUpperCase().trim();
         
         let finalAmid = -1;
         let finalAssetName = symbol;

         // ── ISIN-FIRST MATCHING PIPELINE ─────────────────────────────────────────
         // ISIN is the authoritative global identifier for any listed security.
         // Name can vary ("Aurobindo Pharma" vs "Aurobindo Pharma Limited", renames, etc.)
         // Order of priority: ISIN DB lookup → isinDictionary → NSE symbol DB → name fallback → auto-create
         // ─────────────────────────────────────────────────────────────────────────

         // Step 1: DB lookup by ISIN (highest authority — catches any existing record regardless of name)
         if (isin) {
           // Check in-memory first (faster)
           const inMemory = state.assetMaster.find((a: any) => a.isin && a.isin.toUpperCase() === isin)
             || state.sam.find((s: any) => s.isin && s.isin.toUpperCase() === isin);
           if (inMemory) {
             finalAmid = Number(inMemory.amid);
             finalAssetName = inMemory.name || inMemory.anm || finalAssetName;
           } else {
             // Live DB lookup by ISIN
             const { data: byIsin } = await supabase
               .from('asset_master')
               .select('amid, name, nse_symbol, isin, asset_type')
               .eq('isin', isin)
               .limit(1);
             if (byIsin && byIsin.length > 0) {
               finalAmid = byIsin[0].amid;
               finalAssetName = byIsin[0].name;
               // Cache in memory
               if (!state.assetMaster.find((a: any) => a.amid === finalAmid)) {
                 state.assetMaster.push(byIsin[0]);
               }
             }
           }
         }

         // Step 2: isinDictionary lookup (covers pre-loaded canonical amids for 20,000+ NSE stocks)
         // Only used if ISIN DB lookup failed — means no existing record in asset_master by ISIN yet
         if (finalAmid === -1 && isin && isinToAmidMap[isin]) {
           const dictAmid = isinToAmidMap[isin];
           // Before committing to the dictionary amid, do a live DB verification
           // to check if that amid actually exists (dictionary can be stale)
           const { data: dictCheck } = await supabase
             .from('asset_master')
             .select('amid, name, nse_symbol, isin')
             .eq('amid', dictAmid)
             .limit(1);
           if (dictCheck && dictCheck.length > 0) {
             finalAmid = dictAmid;
             finalAssetName = dictCheck[0].name || finalAssetName;
             // Also write the ISIN back to asset_master if it was missing (key anti-duplicate measure)
             if (!dictCheck[0].isin && isin) {
               await supabase.from('asset_master').update({ isin, nse_symbol: symbol || dictCheck[0].nse_symbol }).eq('amid', dictAmid);
               state.assetMaster.forEach((a: any) => { if (a.amid === dictAmid) { a.isin = isin; } });
             }
             if (!state.assetMaster.find((a: any) => a.amid === finalAmid)) state.assetMaster.push(dictCheck[0]);
           } else {
             // Dictionary amid not in DB — use it as a provisional value
             finalAmid = dictAmid;
             const foundName = getAssetName(finalAmid);
             if (foundName && !foundName.startsWith('Asset ')) finalAssetName = foundName;
           }
         }

         // Step 3: NSE symbol lookup in DB — catch records where ISIN was null in asset_master
         // (old imported records often have ISIN missing — this prevents Aurobindo-style duplicates)
         if (symbol) {
           const { data: byNse } = await supabase
             .from('asset_master')
             .select('amid, name, nse_symbol, isin')
             .eq('nse_symbol', symbol)
             .limit(2); // get 2 to detect conflicts
           
           if (byNse && byNse.length > 0) {
             // Prefer ISIN-matching record if there are multiple
             const isinMatch = byNse.find((r: any) => r.isin && r.isin.toUpperCase() === isin);
             const best = isinMatch || byNse[0];

             if (finalAmid === -1) {
               // No match yet — use this NSE symbol match
               finalAmid = best.amid;
               finalAssetName = best.name;
               if (!state.assetMaster.find((a: any) => a.amid === finalAmid)) state.assetMaster.push(best);
             } else if (best.amid !== finalAmid) {
               // We have a conflict: isinDictionary gave one amid, but DB has a different amid for this NSE symbol
               // The DB record with this NSE symbol is the canonical one (it's already in use in the portfolio)
               // Prefer the existing DB record to prevent creating duplicate holdings
               console.log(`[CN Import] ISIN-DB conflict for ${symbol}: dict/ISIN-said amid=${finalAmid}, NSE-symbol-in-DB says amid=${best.amid}. Using DB record.`);
               finalAmid = best.amid;
               finalAssetName = best.name;
               // Patch the missing ISIN into the existing DB record
               if (!best.isin && isin) {
                 await supabase.from('asset_master').update({ isin }).eq('amid', best.amid);
                 if (!state.assetMaster.find((a: any) => a.amid === best.amid)) state.assetMaster.push({ ...best, isin });
                 else state.assetMaster.forEach((a: any) => { if (a.amid === best.amid) a.isin = isin; });
               }
             }
             // If finalAmid === best.amid, already correct — no conflict
           }
         }

         // Step 4: Name fallback — try matching by full name in state.assetMaster 
         if (finalAmid === -1 && symbol) {
           const byName = state.assetMaster.find((a: any) => 
             a.name && a.name.toUpperCase().trim() === symbol
           ) || state.sam.find((s: any) => 
             s.anm && s.anm.toUpperCase().trim() === symbol
           );
           if (byName) {
             finalAmid = Number(byName.amid);
             finalAssetName = byName.name || byName.anm || finalAssetName;
             // Patch the ISIN into this record too
             if (!byName.isin && isin) {
               await supabase.from('asset_master').update({ isin, nse_symbol: symbol }).eq('amid', finalAmid);
               state.assetMaster.forEach((a: any) => { if (a.amid === finalAmid) { a.isin = isin; if (!a.nse_symbol) a.nse_symbol = symbol; } });
             }
           }
         }

         // Step 5: Auto-create in asset_master with full ISIN + NSE symbol — last resort
         if (finalAmid === -1) {
           const { data: maxRow } = await supabase.from('asset_master').select('amid').order('amid', { ascending: false }).limit(1);
           const nextAmid = ((maxRow?.[0]?.amid || 500000) < 500000 ? 500000 : (maxRow?.[0]?.amid || 500000)) + 1;
           const newAssetRow = {
             amid: nextAmid,
             name: symbol,
             nse_symbol: symbol,
             isin: isin || null,
             asset_type: 50,
             asset_type_name: 'Stocks'
           };
           const { error: insertErr } = await supabase.from('asset_master').insert(newAssetRow);
           if (!insertErr) {
             state.assetMaster.push(newAssetRow);
             finalAmid = nextAmid;
             finalAssetName = symbol;
             console.log(`[CN Import] Auto-created asset_master amid=${nextAmid} for ${symbol} ISIN=${isin}`);
           }
         }
         // ─────────────────────────────────────────────────────────────────────────


         if (t.buyQty > 0) {
           newTrades.push({
             id: nextId++,
             assetName: finalAssetName,
             isin,
             amid: finalAmid,
             type: 'Buy',
             quantity: t.buyQty,
             price: t.buyWap,
             gross: t.buyVal,
             brokerage: 0,
             date: parsedDate,
             portfolioId: autoSelectedPortfolio,
             selected: true,
           });
         }

         if (t.sellQty > 0) {
           newTrades.push({
             id: nextId++,
             assetName: finalAssetName,
             isin,
             amid: finalAmid,
             type: 'Sell',
             quantity: t.sellQty,
             price: t.sellWap,
             gross: t.sellVal,
             brokerage: 0,
             date: parsedDate,
             portfolioId: autoSelectedPortfolio,
             selected: true,
           });
         }
      }

      if (newTrades.length > 0) {
        setCnTrades(newTrades);
      } else {
        throw new Error("No trades were found in this PDF. Please verify it is a valid broker contract note.");
      }

      if (result.charges) {
        setCnCharges({
          stt: Number(result.charges.stt) || 0,
          brokerage: Number(result.charges.brokerage) || 0,
          gst: Number(result.charges.gst) || 0,
          stamp: Number(result.charges.stamp) || 0,
          transCharges: Number(result.charges.transCharges) || 0,
          other: Number(result.charges.other) || 0,
        });
      }
      
      if (result.finalNet !== undefined) {
        setPdfFinalNet(result.finalNet);
      } else {
        setPdfFinalNet(null);
      }

      setPasswordPromptOpen(false);
      setTempPassword('');
      setPasswordError('');
    } catch (e: any) {
      setPasswordError(e.message || 'Incorrect password or error parsing PDF. Please try again.');
      console.error(e);
    }
  };

  const handlePasswordCancel = () => {
    setPasswordPromptOpen(false);
    setPendingFile(null);
    setTempPassword('');
    setPasswordError('');
  };


  return (
    <div style={{ maxWidth: "1240px", margin: "32px auto", padding: "0 24px", fontFamily: "inherit" }}>
      
      {/* Tab Navigation Menu */}
      <div style={{ display: "flex", gap: "10px", background: "#f1f5f9", padding: "6px", borderRadius: "12px", marginBottom: "32px", width: "fit-content" }}>
        <button onClick={() => setActiveTab('db')} style={{
          ...tabStyle(activeTab === 'db'),
          background: activeTab === 'db' ? '#2563eb' : 'none',
          color: activeTab === 'db' ? '#fff' : '#2563eb',
          boxShadow: activeTab === 'db' ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
          border: activeTab !== 'db' ? '2px solid #2563eb' : 'none',
        }}>
          <Database size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
          MProfit DB Import
        </button>
        <button onClick={() => setActiveTab('contract-note')} style={tabStyle(activeTab === 'contract-note')}>
          Broker Contract Note
        </button>
        <button onClick={() => setActiveTab('mf-cas')} style={{
          ...tabStyle(activeTab === 'mf-cas'),
          background: activeTab === 'mf-cas' ? '#ea580c' : 'none',
          color: activeTab === 'mf-cas' ? '#fff' : '#ea580c',
          boxShadow: activeTab === 'mf-cas' ? '0 4px 12px rgba(234,88,12,0.25)' : 'none',
          border: activeTab !== 'mf-cas' ? '2px solid #ea580c' : 'none',
        }}>
          📊 MF CAS Import
        </button>
        <button onClick={() => setActiveTab('db-converter')} style={{
          ...tabStyle(activeTab === 'db-converter'),
          background: activeTab === 'db-converter' ? '#8b5cf6' : 'none',
          color: activeTab === 'db-converter' ? '#fff' : '#8b5cf6',
          boxShadow: activeTab === 'db-converter' ? '0 4px 12px rgba(139,92,246,0.25)' : 'none',
          border: activeTab !== 'db-converter' ? '2px solid #8b5cf6' : 'none',
        }}>
          🛠️ DB to CSV
        </button>
      </div>

      {/* TAB 1: MPROFIT DB IMPORT */}
      {activeTab === 'db' && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <Database size={28} color="#2563eb" /> Import MProfit Database CSVs
              </h1>
              <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px" }}>
                Select or drag MProfit export CSV files to parse and synchronize them with your Supabase account.
              </p>
            </div>
            {hasStaged && !isImporting && (
              <button 
                onClick={clearStaged}
                style={{ padding: "8px 16px", background: "none", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer", transition: "all 0.2s" }}
              >
                Clear Staged Files
              </button>
            )}
          </div>

          {!importComplete && (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? "2px dashed #2563eb" : "2px dashed #cbd5e1",
                borderRadius: "16px",
                background: isDragging ? "rgba(37, 99, 235, 0.03)" : "#fff",
                padding: "48px 24px",
                textAlign: "center",
                cursor: isImporting ? "not-allowed" : "pointer",
                transition: "all 0.2s ease-in-out",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
                marginBottom: "32px",
                opacity: isImporting ? 0.6 : 1,
                pointerEvents: isImporting ? "none" : "auto",
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                multiple 
                accept=".csv,.db,.sqlite,.bak"
                style={{ display: "none" }} 
              />
              <div style={{ display: "inline-flex", padding: "16px", background: "#eff6ff", borderRadius: "50%", color: "#2563eb", marginBottom: "16px" }}>
                <FileUp size={32} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px 0" }}>
                Drag and drop MProfit CSVs, DB or BAK backup files here, or click to browse
              </h3>
              <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
                You can select multiple files at once. The system will match them automatically by name.
              </p>
            </div>
          )}

          {hasStaged && !isImporting && !importComplete && missingRequired.length > 0 && (
            <div style={{ padding: "16px 20px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "32px" }}>
              <AlertTriangle color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#92400e", margin: "0 0 4px 0" }}>Missing Required Database Files</h4>
                <p style={{ fontSize: "13px", color: "#b45309", margin: "0 0 8px 0", lineHeight: 1.5 }}>
                  To complete the import, you still need to stage the following required files:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {missingRequired.map(t => (
                    <span key={t.key} style={{ fontSize: "11px", fontWeight: 700, background: "rgba(217, 119, 6, 0.1)", color: "#b45309", padding: "4px 10px", borderRadius: "100px" }}>
                      {TABLE_CONFIGS.find(c => c.key === t.key)?.name}.csv
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isImporting && (
            <div style={{ padding: "24px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>Overall Progress</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#2563eb" }}>{overallProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "100px", overflow: "hidden", marginBottom: "12px" }}>
                <div style={{ width: `${overallProgress}%`, height: "100%", background: "#2563eb", borderRadius: "100px", transition: "width 0.3s ease-in-out" }} />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>
                <RefreshCw size={14} className="spin" style={{ animation: "spin 2s linear infinite" }} />
                {overallMessage}
              </div>
            </div>
          )}

          {importComplete && (
            <div style={{ padding: "36px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "16px", textAlign: "center", marginBottom: "32px" }}>
              <div style={{ display: "inline-flex", padding: "16px", background: "#d1fae5", borderRadius: "50%", color: "#059669", marginBottom: "16px" }}>
                <CheckCircle size={48} />
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#065f46", margin: "0 0 8px 0" }}>Import Completed Successfully</h2>
              <p style={{ color: "#047857", fontSize: "14px", maxWidth: "600px", margin: "0 auto 24px auto", lineHeight: 1.6 }}>
                All staged MProfit database CSV records have been cleaned and successfully uploaded to your active Supabase database. The application workspace has refreshed with the updated data.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                <button 
                  onClick={() => navigate("/dashboard")}
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 24px" }}
                >
                  Go to Dashboard <ArrowRight size={16} />
                </button>
                <button onClick={clearStaged} style={{ padding: "10px 24px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                  Import More Files
                </button>
              </div>
            </div>
          )}

          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b", marginBottom: "16px" }}>
            Database Tables Import Status
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
            {TABLE_CONFIGS.map(config => {
              const status = tableStatus[config.key];
              const fileInfo = stagedFiles[config.key];
              const isStaged = !!fileInfo;

              let statusBg = "#f8fafc";
              let statusBorder = "#e2e8f0";
              let badgeText = "Missing";
              let badgeColor = "#64748b";
              let badgeBg = "#f1f5f9";

              if (status.status === "parsed") {
                statusBg = "#f0fdf4";
                statusBorder = "#bbf7d0";
                badgeText = "Staged";
                badgeColor = "#15803d";
                badgeBg = "#dcfce7";
              } else if (status.status === "importing") {
                statusBg = "#eff6ff";
                statusBorder = "#bfdbfe";
                badgeText = `Importing (${status.progress}%)`;
                badgeColor = "#1d4ed8";
                badgeBg = "#dbeafe";
              } else if (status.status === "done") {
                statusBg = "#f0fdf4";
                statusBorder = "#bbf7d0";
                badgeText = "Completed";
                badgeColor = "#166534";
                badgeBg = "#dcfce7";
              } else if (status.status === "error") {
                statusBg = "#fef2f2";
                statusBorder = "#fecaca";
                badgeText = "Error";
                badgeColor = "#991b1b";
                badgeBg = "#fee2e2";
              }

              return (
                <div key={config.key} style={{ background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "130px", boxSizing: "border-box", transition: "all 0.2s ease" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {config.name}
                      </span>
                      {config.required && !isStaged && status.status === "idle" && (
                        <span style={{ fontSize: "9px", fontWeight: 800, background: "#fee2e2", color: "#b91c1c", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" }}>
                          Required
                        </span>
                      )}
                    </div>
                    {isStaged ? (
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          File: {fileInfo.fileName}
                        </span>
                        <span>Rows count: {status.rowCount.toLocaleString()}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                        No file staged yet. Expected: {config.key.replace(/1$/, "1") + ".csv"}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, background: badgeBg, color: badgeColor, padding: "4px 8px", borderRadius: "6px" }}>
                      {badgeText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!importComplete && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "24px" }}>
              <button onClick={() => navigate("/dashboard")} style={{ padding: "10px 24px", background: "none", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#64748b", cursor: "pointer" }} disabled={isImporting}>
                Cancel
              </button>
              <button 
                onClick={startImport}
                disabled={!hasStaged || missingRequired.length > 0 || isImporting}
                className="btn-primary"
                style={{ padding: "10px 28px", display: "flex", alignItems: "center", gap: "8px", opacity: (!hasStaged || missingRequired.length > 0 || isImporting) ? 0.5 : 1, cursor: (!hasStaged || missingRequired.length > 0 || isImporting) ? "not-allowed" : "pointer" }}
              >
                <Play size={16} /> Start Database Import
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BROKER CONTRACT NOTE */}
      {activeTab === 'contract-note' && (
        <div style={{ background: '#fff', padding: '28px', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>

          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            📄 Broker Contract Note Importer
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 28px 0' }}>
            Upload a broker contract note PDF. Trades will auto-populate below for review before committing.
          </p>

          {/* ── Row 1: Selectors ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={labelStyle}>Portfolio</label>
              <select value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)} style={selectStyle}>
                <option value="">Select Portfolio...</option>
                {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.portfolioName || p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Broker Ledger</label>
              <select value={selectedBrokerLedger} onChange={e => setSelectedBrokerLedger(e.target.value)} style={selectStyle}>
                <option value="">Select Ledger...</option>
                {brokerLedgers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Broker Format</label>
              <select value={selectedBroker} onChange={e => setSelectedBroker(e.target.value)} style={selectStyle}>
                <option value="zerodha">Zerodha (PDF)</option>
                <option value="rk_global">R K Global (HTML / CSV)</option>
                <option value="dhan">Dhan (PDF)</option>
                <option value="mirae">MStock / Mirae Asset (PDF)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Contract Date</label>
              <input type="date" value={cnDate} onChange={e => setCnDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CN Number</label>
              <input type="text" placeholder="e.g. CNT-26/27-12345" value={cnNo} onChange={e => setCnNo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* ── Upload + Password inline ── */}
          <div style={{ marginBottom: '28px' }}>
            <label style={labelStyle}>Upload Contract Note File</label>

            {/* File drop zone */}
            <div
              onClick={() => { const inp = document.getElementById('cn-file-input') as HTMLInputElement; inp?.click(); }}
              style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563eb')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
            >
              <input
                id="cn-file-input"
                type="file"
                accept=".pdf,.html,.htm,.csv"
                style={{ display: 'none' }}
                onChange={handleBrokerCnFileSelect}
              />
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>Click to select Contract Note file</div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>PDF (Zerodha / Dhan / MStock) · HTML / CSV (RK Global)</div>
            </div>

            {/* Password prompt — shown inline when PDF is pending */}
            {passwordPromptOpen && (
              <div style={{ marginTop: '16px', background: '#f0f9ff', border: '2px solid #2563eb', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '15px', marginBottom: '6px' }}>🔒 Password Protected PDF</div>
                <div style={{ color: '#475569', fontSize: '13px', marginBottom: '14px' }}>
                  This PDF is password-protected. Enter the password to decrypt and parse it.<br/>
                  <span style={{ color: '#2563eb', fontWeight: 600 }}>For Zerodha / Dhan: enter your PAN in UPPERCASE (e.g. ABCDE1234F)</span>
                </div>
                {passwordError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                    ❌ {passwordError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Enter password (e.g. ABCDE1234F)"
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    autoFocus
                  />
                  <button
                    onClick={handlePasswordSubmit}
                    style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '14px' }}
                  >
                    Decrypt PDF
                  </button>
                  <button
                    onClick={handlePasswordCancel}
                    style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Trades Table ── */}
          {cnTrades.length > 0 && (
            <div style={{ marginBottom: '28px' }}>

              {/* Summary bar */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Trades</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{cnTrades.length}</div>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Buy Value</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8' }}>
                      ₹{cnTrades.filter(t => t.type === 'Buy').reduce((s: number, t: any) => s + (Number(t.gross) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Sell Value</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309' }}>
                      ₹{cnTrades.filter(t => t.type === 'Sell').reduce((s: number, t: any) => s + (Number(t.gross) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleAddCnTradeRow}
                    style={{ padding: '8px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    + Add Row
                  </button>
                  <button
                    onClick={() => setCnTrades([])}
                    style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>✓</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Type</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', minWidth: '200px' }}>Stock / Asset</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>ISIN</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Price</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Value ₹</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cnTrades.map((t: any, idx: number) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="checkbox" checked={!!t.selected} onChange={e => handleUpdateCnTradeRow(t.id, 'selected', e.target.checked)} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <select
                            value={t.type || 'Buy'}
                            onChange={e => handleUpdateCnTradeRow(t.id, 'type', e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, color: (t.type || 'Buy') === 'Buy' ? '#16a34a' : '#dc2626', background: '#fff', fontSize: '13px' }}
                          >
                            <option value="Buy">Buy</option>
                            <option value="Sell">Sell</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              value={t.assetName || ''}
                              onChange={e => { handleUpdateCnTradeRow(t.id, 'assetName', e.target.value); handleAssetSearch(e.target.value, t.id); }}
                              onFocus={() => handleAssetSearch(t.assetName || '', t.id)}
                              placeholder="Type to search..."
                              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', fontSize: '13px', outline: 'none' }}
                            />
                            {t.amid === -1 && t.assetName && (
                              <span style={{ position: 'absolute', right: '6px', top: '5px', fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>⚠ unmapped</span>
                            )}
                            {focusedRowId === t.id && searchSuggestions.length > 0 && (
                              <div style={{ position: 'absolute', zIndex: 999, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto' }}>
                                {searchSuggestions.map((s: any) => (
                                  <div
                                    key={s.amid}
                                    onClick={() => selectAssetSuggestion(s, t.id)}
                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                  >
                                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                                    <span style={{ fontSize: '10px', color: s.isLocal ? '#16a34a' : '#2563eb', background: s.isLocal ? '#dcfce7' : '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
                                      {s.isLocal ? 'Holding' : 'Global'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                          {t.isin || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="date" value={t.date || cnDate} onChange={e => handleUpdateCnTradeRow(t.id, 'date', e.target.value)} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            value={t.quantity || 0}
                            onChange={e => handleUpdateCnTradeRow(t.id, 'quantity', parseFloat(e.target.value) || 0)}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '70px', textAlign: 'right', fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={t.price || 0}
                            onChange={e => handleUpdateCnTradeRow(t.id, 'price', parseFloat(e.target.value) || 0)}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '90px', textAlign: 'right', fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹{(Number(t.gross) || Number(t.quantity || 0) * Number(t.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button onClick={() => handleDeleteCnTradeRow(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Charges Section ── */}
          {cnTrades.length > 0 && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>Tax & Regulatory Charges</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
                {Object.keys(cnCharges).map((key) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      {key === 'stt' ? 'STT' : key === 'transCharges' ? 'Exchange Txn' : key === 'gst' ? 'GST' : key === 'stamp' ? 'Stamp Duty' : key.charAt(0).toUpperCase() + key.slice(1)} ₹
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={(cnCharges as any)[key] || 0}
                      onChange={e => setCnCharges((prev: any) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '24px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Charges</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>
                    ₹{(Object.values(cnCharges) as number[]).reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Net Payable</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    ₹{(
                      cnTrades.filter(t => t.type === 'Buy').reduce((s: number, t: any) => s + (Number(t.gross) || 0), 0)
                      + (Object.values(cnCharges) as number[]).reduce((s, v) => s + (Number(v) || 0), 0)
                      - cnTrades.filter(t => t.type === 'Sell').reduce((s: number, t: any) => s + (Number(t.gross) || 0), 0)
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Commit Button ── */}
          {cnTrades.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {isDuplicateCN && (
                <div style={{ padding: '10px 16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ CN No. {cnNo} already exists in database
                </div>
              )}
              {!selectedBrokerLedger && (
                <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px', fontWeight: 600 }}>
                  ⚠ Select a Broker Ledger first
                </div>
              )}
              <button
                onClick={commitContractNote}
                disabled={isImporting || !selectedBrokerLedger || cnTrades.filter(t => t.selected).length === 0 || isDuplicateCN}
                title={isDuplicateCN ? `CN No. ${cnNo} already exists in database. Delete the existing voucher first before re-importing.` : undefined}
                style={{
                  padding: '12px 32px',
                  background: (isImporting || !selectedBrokerLedger || cnTrades.filter(t => t.selected).length === 0 || isDuplicateCN) ? '#94a3b8' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: (isImporting || !selectedBrokerLedger || cnTrades.filter(t => t.selected).length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isImporting ? '⏳ Committing...' : `✅ Commit ${cnTrades.filter(t => t.selected).length} Trade(s) to Ledger`}
              </button>
            </div>
          )}

          {overallMessage && cnTrades.length === 0 && (
            <div style={{ padding: '14px 18px', background: overallMessage.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${overallMessage.includes('✅') ? '#bbf7d0' : '#fca5a5'}`, borderRadius: '10px', color: overallMessage.includes('✅') ? '#166534' : '#991b1b', fontWeight: 600, fontSize: '14px' }}>
              {overallMessage}
            </div>
          )}

        </div>
      )}




            {/* TAB 3: MF CAS IMPORT */}
      {activeTab === 'mf-cas' && (
        <MfCasTab
          portfolios={portfolios}
          casTrades={casTrades}
          setCasTrades={setCasTrades}
          casMessage={casMessage}
          setCasMessage={setCasMessage}
          casImporting={casImporting}
          setCasImporting={setCasImporting}
          casImportDone={casImportDone}
          setCasImportDone={setCasImportDone}
          casImportedVids={casImportedVids}
          setCasImportedVids={setCasImportedVids}
          casPortfolioMap={casPortfolioMap}
          setCasPortfolioMap={setCasPortfolioMap}
          ensureAssetLedgerExists={ensureAssetLedgerExists}
          forceRefreshDatabase={forceRefreshDatabase}
          setRefreshKey={setRefreshKey}
          inputStyle={inputStyle}
          selectStyle={selectStyle}
          labelStyle={labelStyle}
        />
      )}

      {/* TAB 4: SQL RESTORE */}
      {activeTab === 'sql-restore' && (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#dc2626", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <Database size={28} color="#dc2626" /> Restore Full Database (SQL)
              </h1>
              <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px" }}>
                Completely wipe the current database and restore it from a single Supabase SQL backup file.
              </p>
            </div>
          </div>

          <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#b91c1c", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={20} /> Warning: Destructive Action
            </h3>
            <p style={{ margin: 0, color: "#7f1d1d", fontSize: "14px", lineHeight: "1.5" }}>
              This action will execute the raw SQL file directly on your Supabase server. 
              Ensure your SQL file contains the proper <code style={{background:"#fca5a5", padding:"2px 4px", borderRadius:"4px"}}>DROP</code> or <code style={{background:"#fca5a5", padding:"2px 4px", borderRadius:"4px"}}>TRUNCATE</code> commands if you wish to wipe old data first.
              <br/><br/>
              <b>Requirement:</b> You MUST have created the <code style={{background:"#fca5a5", padding:"2px 4px", borderRadius:"4px"}}>exec_sql</code> RPC function in your Supabase SQL Editor for this to work.
            </p>
          </div>

          <div 
            style={{ 
              border: "2px dashed #dc2626", borderRadius: "16px", padding: "40px", 
              textAlign: "center", cursor: sqlLoading ? 'not-allowed' : 'pointer', background: "#fff",
              transition: "all 0.2s ease",
              opacity: sqlLoading ? 0.6 : 1
            }}
            onClick={() => !sqlLoading && sqlFileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={sqlFileInputRef} 
              style={{ display: 'none' }} 
              accept=".sql" 
              onChange={handleSqlRestore} 
            />
            <Database size={48} color="#dc2626" style={{ margin: "0 auto 16px auto", opacity: 0.8 }} />
            <h3 style={{ margin: "0 0 8px 0", color: "#1e293b", fontSize: "18px" }}>Upload .sql Backup File</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>Click to select a file</p>
          </div>

          {sqlMessage && (
            <div style={{ marginTop: "24px", padding: "16px", borderRadius: "8px", background: sqlMessage.includes('❌') ? '#fef2f2' : sqlMessage.includes('✅') ? '#f0fdf4' : '#f8fafc', color: sqlMessage.includes('❌') ? '#991b1b' : sqlMessage.includes('✅') ? '#166534' : '#334155', fontSize: "14px", border: `1px solid ${sqlMessage.includes('❌') ? '#fca5a5' : sqlMessage.includes('✅') ? '#86efac' : '#e2e8f0'}` }}>
              {sqlMessage}
            </div>
          )}
        </div>
      )}

      {activeTab === 'db-converter' && (
        <DbConverter />
      )}

      {/* Spinner animation keyframes and custom table inputs styling */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .table-input {
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          font-size: 13px;
          width: 100%;
          outline: none;
          box-sizing: border-box;
          transition: all 0.15s ease;
          color: #1e293b;
        }
        .table-input:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .table-input:focus {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }

        .table-select {
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          font-size: 13px;
          width: 100%;
          outline: none;
          box-sizing: border-box;
          transition: all 0.15s ease;
          color: #1e293b;
          cursor: pointer;
        }
        .table-select:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .table-select:focus {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
      `}</style>
    </div>
  );
}

function DbConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<{ name: string; rowCount: number; data: any[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setError('');
    setTables([]);

    try {
      const initSqlJs = await loadSqlJs();
      const SQL = await initSqlJs({
        locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
      });
      const buffer = await selectedFile.arrayBuffer();
      
      let db;
      try {
        db = new SQL.Database(new Uint8Array(buffer));
      } catch (e: any) {
        throw new Error(`Could not parse ${selectedFile.name} as a SQLite database. Error: ${e.message}`, { cause: e });
      }

      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tablesResult.length > 0) {
        const allTables = tablesResult[0].values.map((v: any) => v[0] as string);
        const extractedTables = [];
        for (const tableName of allTables) {
          const dataRes = db.exec(`SELECT * FROM "${tableName}"`);
          if (dataRes.length > 0) {
            const cols = dataRes[0].columns;
            const rows = dataRes[0].values;
            const formattedData = rows.map((row: any) => {
              const obj: any = {};
              cols.forEach((col: string, idx: number) => {
                obj[col] = row[idx];
              });
              return obj;
            });
            extractedTables.push({ name: tableName, rowCount: rows.length, data: formattedData });
          } else {
            extractedTables.push({ name: tableName, rowCount: 0, data: [] });
          }
        }
        setTables(extractedTables);
      } else {
        setError('No tables found in this SQLite database.');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (table: { name: string; data: any[] }) => {
    if (table.data.length === 0) {
      alert("Table is empty.");
      return;
    }
    const csvStr = Papa.unparse(table.data);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `${table.name}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ padding: "32px", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <Database size={24} color="#8b5cf6" /> MProfit DB to CSV Converter
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px", lineHeight: 1.5 }}>
        Select your MProfit backup file (<code>.db</code>, <code>.sqlite</code>, or <code>.bak</code>). The system will read all tables inside it and let you download them as individual CSV files.
      </p>

      <div style={{ marginBottom: "24px" }}>
        <input 
          type="file" 
          accept=".db,.sqlite,.bak" 
          onChange={handleFileChange} 
          style={{ display: 'none' }}
          id="db-file-upload"
        />
        <label 
          htmlFor="db-file-upload" 
          style={{ padding: "12px 24px", background: "#8b5cf6", color: "#fff", borderRadius: "8px", cursor: "pointer", fontWeight: 600, display: "inline-block" }}
        >
          {loading ? "Reading Database..." : "Select SQLite Database File"}
        </label>
        {file && <span style={{ marginLeft: "16px", color: "#475569", fontWeight: 600 }}>{file.name}</span>}
      </div>

      {error && (
        <div style={{ padding: "16px", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginBottom: "24px", border: "1px solid #f87171" }}>
          {error}
        </div>
      )}

      {tables.length > 0 && (
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#1e293b" }}>
            Found {tables.length} Tables
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {tables.map(t => (
              <div key={t.name} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#334155", wordBreak: "break-all" }}>{t.name}</span>
                  <span style={{ fontSize: "12px", background: "#e2e8f0", padding: "4px 8px", borderRadius: "100px", color: "#475569", fontWeight: 600 }}>
                    {t.rowCount} rows
                  </span>
                </div>
                <button 
                  onClick={() => downloadCsv(t)}
                  disabled={t.rowCount === 0}
                  style={{ 
                    padding: "8px", background: t.rowCount === 0 ? "#cbd5e1" : "#10b981", color: "#fff", 
                    border: "none", borderRadius: "6px", fontWeight: 600, cursor: t.rowCount === 0 ? "not-allowed" : "pointer" 
                  }}
                >
                  Download {t.name}.csv
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <ImportPageErrorBoundary>
      <ImportPageInner />
    </ImportPageErrorBoundary>
  );
}
