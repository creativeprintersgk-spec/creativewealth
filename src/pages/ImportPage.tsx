import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, CheckCircle, AlertTriangle, ArrowRight, Upload, Play, Database, RefreshCw, ChevronRight, Edit2, Plus, Trash2, Search, CheckSquare, Square } from "lucide-react";
import Papa from 'papaparse';
import { supabase } from "../supabase";
import { useFY } from "../FYContext";
import { useTestMode } from "../contexts/TestModeContext";
import { state, forceRefreshDatabase, getStoredPortfolios, getStoredLedgers, ensureLedgerExists, createVoucher, getStoredVouchers, syncLivePrices, getAssetName, computeLedgerOpeningBalanceGaps, buildAssetFifoLedger, depleteFifoLots, FIFO_BUY_TRTY, FIFO_SELL_TRTY, isSupabaseReachable, importStagedTablesLocally, persistStateToIDB } from "../logic";
import isinDictionary from "../services/isinDictionary.json";
import { MfCasTab } from "./MfCasTab";
import { EcasTab } from "./EcasTab";
import { parseFnoSymbol } from "../utils/fnoUtils";
import { parseContractNoteClientPdf, parseContractNoteClientText } from "../services/contractNoteClientParser";

import standardMprofitGroups from "../standard_mprofit_groups.json";

const isinToAmidMap: Record<string, number> = {};
for (const [amidStr, isinVal] of Object.entries(isinDictionary as Record<string, string>)) {
  if (isinVal) isinToAmidMap[isinVal.toUpperCase().trim()] = Number(amidStr);
}

const BROKER_MATCHERS: Record<string, string[]> = {
  zerodha: ['zerodha'],
  groww: ['groww', 'nextbillion'],
  icici: ['icici', 'direct'],
  kotak: ['kotak'],
  hdfc: ['hdfc'],
  motilal: ['motilal', 'mosl', 'mofsl'],
  dhan: ['dhan', 'moneylicious', 'raise'],
  mirae: ['mirae', 'mstock', 'm.stock'],
  rk_global: ['rk global', 'r k global', 'rkglobal'],
  upstox: ['upstox', 'rksv'],
  angel: ['angel', 'angelone', 'angel one'],
  sharekhan: ['sharekhan'],
  axis: ['axis'],
  '5paisa': ['5paisa', 'five paisa']
};

const BROKER_NAMES: Record<string, string> = {
  auto: '⚡ Auto-Detect Broker',
  zerodha: 'Zerodha',
  groww: 'Groww',
  icici: 'ICICI Direct',
  kotak: 'Kotak Securities',
  hdfc: 'HDFC Securities',
  motilal: 'Motilal Oswal',
  dhan: 'Dhan',
  mirae: 'MStock / Mirae Asset',
  rk_global: 'R K Global',
  upstox: 'Upstox',
  angel: 'Angel One',
  sharekhan: 'Sharekhan',
  axis: 'Axis Securities',
  '5paisa': '5Paisa'
};

// Define the 12 MProfit replicated tables and their expected file names
interface TableConfig {
  key: string;
  name: string;
  filePattern: RegExp;
  required: boolean;
  deleteKey: string;
}

const TABLE_CONFIGS: TableConfig[] = [
  { key: 'portfolios', name: 'Portfolios', filePattern: /^portfolios?\.csv$/i, required: true, deleteKey: 'id' },
  { key: 'investor_group_members', name: 'Investor Group Members', filePattern: /^(?:investor_?group_?members?|investorgroupmembers)\.csv$/i, required: false, deleteKey: 'pfolio_id' },
  { key: 'acc_pflink', name: 'Account Portfolio Links', filePattern: /^(?:acc_?pfln?k|acc_pflink)\.csv$/i, required: true, deleteKey: 'pfid' },
  { key: 'acmac1', name: 'Chart of Accounts (ACMAC1)', filePattern: /^(?:acmac1|acma1|acma)\.csv$/i, required: true, deleteKey: 'id' },
  { key: 'sam', name: 'Security Asset Master (SAM)', filePattern: /^sam\.csv$/i, required: true, deleteKey: 'amid' },
  { key: 'bs1', name: 'Portfolio Transactions (BS1)', filePattern: /^bs1\.csv$/i, required: true, deleteKey: 'trid' },
  { key: 'sum_table', name: 'Holdings Summary (SumTable)', filePattern: /^sum_?table\.csv$/i, required: true, deleteKey: 'sid' },
  { key: 'vouchersc1', name: 'Capital Vouchers (VouchersC1)', filePattern: /^(?:vouchers?_?c[0-9]*|vouchers?c)\.csv$/i, required: false, deleteKey: 'vid' },
  { key: 'vouchers1', name: 'Trading Vouchers (Vouchers1)', filePattern: /^(?:vouchers?1|vouchers?_?1)\.csv$/i, required: true, deleteKey: 'vid' },
  { key: 'transc1', name: 'Capital Transactions (TransC1)', filePattern: /^(?:trans?a?c?_?c[0-9]*|trans?c)\.csv$/i, required: false, deleteKey: 'transid' },
  { key: 'trans1', name: 'Trading Transactions (Trans1)', filePattern: /^(?:trans?1|trans?a?c?_?1)\.csv$/i, required: true, deleteKey: 'transid' },
  { key: 'mprices', name: 'Market Prices (MPrices)', filePattern: /^m_?prices?\.csv$/i, required: true, deleteKey: 'row_id' },
  { key: 'scnote1', name: 'Contract Notes (SCNOTE1)', filePattern: /^sc_?notes?1?\.csv$/i, required: false, deleteKey: 'cnid' },
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
        if (!(await isSupabaseReachable())) {
          localStorage.setItem('didClearCorruptedData_13371', 'true');
          return;
        }
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

  // Tabs: 'db' | 'contract-note' | 'mf-cas' | 'ecas' | 'sql-restore' | 'db-converter'
  const [activeTab, setActiveTab] = useState<'db' | 'contract-note' | 'mf-cas' | 'ecas' | 'sql-restore' | 'db-converter'>('db');

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

  // Demat eCAS Import States
  const [ecasTrades, setEcasTrades] = useState<any[]>([]);
  const [ecasMessage, setEcasMessage] = useState('');
  const [ecasImporting, setEcasImporting] = useState(false);
  const [ecasImportDone, setEcasImportDone] = useState(false);
  const [ecasImportedVids, setEcasImportedVids] = useState<number[]>([]);
  const [ecasPortfolioMap, setEcasPortfolioMap] = useState<Record<string, string>>({});

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
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'connected' | 'paused'>('checking');

  useEffect(() => {
    let isMounted = true;
    isSupabaseReachable(true).then(online => {
      if (isMounted) {
        setCloudStatus(online ? 'connected' : 'paused');
      }
    });
    return () => { isMounted = false; };
  }, []);

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
                 
                 let match = undefined;
                 if (config.key === 'transc1') {
                   match = allTables.find((t: string) => /^transc1$/i.test(t)) || allTables.find((t: string) => /^trans_?c1$/i.test(t));
                 } else if (config.key === 'vouchersc1') {
                   match = allTables.find((t: string) => /^vouchersc1$/i.test(t)) || allTables.find((t: string) => /^vouchers?_?c1$/i.test(t));
                 } else if (config.key === 'acmac1') {
                   match = allTables.find((t: string) => /^acmac1$/i.test(t)) || allTables.find((t: string) => /^acma1$/i.test(t));
                 } else {
                   match = allTables.find((t: string) => config.filePattern.test(t + '.csv'));
                 }
                 
                 if (match) {
                    const dataRes = db.exec(`SELECT * FROM "${match}"`);
                    let rows: any[] = [];
                    if (dataRes.length > 0) {
                       const columns = dataRes[0].columns;
                       const values = dataRes[0].values;
                       
                       rows = values.map((row: any) => {
                          const obj: Record<string, any> = {};
                          columns.forEach((col: string, i: number) => {
                           const mappedCol = mapHeaderToColumn(col);
                           obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                          });
                          return obj;
                       });

                       // If parsing portfolios, also check for Clients table in SQLite
                        if (config.key === 'portfolios' && allTables.includes('Clients')) {
                          try {
                            const clRes = db.exec('SELECT * FROM "Clients"');
                            if (clRes.length > 0) {
                              const clCols = clRes[0].columns;
                              const existingIds = new Set(rows.map((r: any) => r.id));
                              clRes[0].values.forEach((row: any) => {
                                const obj: Record<string, any> = {};
                                clCols.forEach((col: string, i: number) => {
                                  const mappedCol = mapHeaderToColumn(col);
                                  obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                                });
                                const clientId = obj.id || obj.client_id;
                                const compositeId = (clientId ? Number(clientId) + 1000000 : 1000000);
                                if (!existingIds.has(compositeId)) {
                                  rows.push({
                                    id: compositeId,
                                    client_id: clientId,
                                    investor_name: obj.name || obj.investor_name,
                                    full_name: obj.name || obj.full_name,
                                    is_group: 1,
                                    city: obj.city,
                                    pin_code: obj.pin_code,
                                    country: obj.country,
                                    phone: obj.phone,
                                    mobile: obj.mobile
                                  });
                                }
                              });
                            }
                          } catch (err) {
                            console.warn('Could not merge Clients into portfolios:', err);
                          }
                        }

                        // If parsing acmac1, merge all ACMA tables (ACMA1, ACMA2, ACMA3, ACMA4, ACMA5, ACMA6, ACMA7, ACMAC1, etc.)
                        if (config.key === 'acmac1') {
                          const acmaTables = allTables.filter((t: string) => /^ACMA[0-9C]*$/i.test(t) && t !== match);
                          const existingKeys = new Set(rows.map((r: any) => `${r.id}_${r.acid ?? ''}_${r.is_group ?? ''}_${r.name ?? ''}`));
                          for (const acmaTab of acmaTables) {
                            try {
                              const acmaRes = db.exec(`SELECT * FROM "${acmaTab}"`);
                              if (acmaRes.length > 0) {
                                const acmaCols = acmaRes[0].columns;
                                acmaRes[0].values.forEach((row: any) => {
                                  const obj: Record<string, any> = {};
                                  acmaCols.forEach((col: string, i: number) => {
                                    const mappedCol = mapHeaderToColumn(col);
                                    obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                                  });
                                  const key = `${obj.id}_${obj.acid ?? ''}_${obj.is_group ?? ''}_${obj.name ?? ''}`;
                                  if (!existingKeys.has(key)) {
                                    existingKeys.add(key);
                                    rows.push(obj);
                                  }
                                });
                              }
                            } catch (err) {
                              console.warn(`Could not merge ${acmaTab} into acmac1:`, err);
                            }
                          }

                          // Auto-inject 40 standard MProfit accounting groups for all accounts if missing
                          const hasGroups = rows.some((r: any) => r.is_group === true || r.is_group === 1 || r.is_group === 'true');
                          if (!hasGroups) {
                            const acids = new Set<number>();
                            rows.forEach((r: any) => { if (r.acid && Number(r.acid) > 0) acids.add(Number(r.acid)); });
                            try {
                              const pflnkRes = db.exec('SELECT DISTINCT ACID FROM "ACC_PFLINK"');
                              if (pflnkRes.length > 0) {
                                pflnkRes[0].values.forEach((v: any) => {
                                  if (v[0] && Number(v[0]) > 0) acids.add(Number(v[0]));
                                });
                              }
                            } catch (e) {}

                            if (acids.size === 0) {
                              [29, 30, 31, 32, 36, 61, 62].forEach(id => acids.add(id));
                            }

                            acids.forEach(acid => {
                              (standardMprofitGroups as any[]).forEach(g => {
                                rows.push({
                                  id: g.id,
                                  parent_id: g.parent_id,
                                  is_group: true,
                                  name: g.name,
                                  special_type_id: g.special_type_id,
                                  flags: g.flags,
                                  disp_seqno: g.disp_seqno,
                                  tree_node: g.tree_node,
                                  acid: acid,
                                  db_bal: 0,
                                  cr_bal: 0
                                });
                              });
                            });
                          }
                        }

                        // If parsing vouchers (trading or capital), merge all matching voucher tables
                        if (config.key === 'vouchers1' || config.key === 'vouchersc1') {
                          const isCapital = config.key === 'vouchersc1';
                          const vTables = allTables.filter((t: string) => {
                            if (t === match) return false;
                            if (isCapital) return /^VOUCHERS?_?C[0-9]*$/i.test(t) || /^VOUCHERS?C$/i.test(t);
                            return /^VOUCHERS?[0-9]+$/i.test(t) && !/C/i.test(t);
                          });
                          const existingKeys = new Set(rows.map((r: any) => `${r.vid}_${r.acid ?? ''}_${r.dt ?? ''}_${r.pms_trans_id ?? ''}`));
                          for (const vTab of vTables) {
                            try {
                              const vRes = db.exec(`SELECT * FROM "${vTab}"`);
                              if (vRes.length > 0) {
                                const vCols = vRes[0].columns;
                                vRes[0].values.forEach((row: any) => {
                                  const obj: Record<string, any> = {};
                                  vCols.forEach((col: string, i: number) => {
                                    const mappedCol = mapHeaderToColumn(col);
                                    obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                                  });
                                  const key = `${obj.vid}_${obj.acid ?? ''}_${obj.dt ?? ''}_${obj.pms_trans_id ?? ''}`;
                                  if (!existingKeys.has(key)) {
                                    existingKeys.add(key);
                                    rows.push(obj);
                                  }
                                });
                              }
                            } catch (err) {
                              console.warn(`Could not merge ${vTab} into ${config.key}:`, err);
                            }
                          }
                        }

                        // If parsing trans (trading or capital), merge all matching trans tables
                        if (config.key === 'trans1' || config.key === 'transc1') {
                          const isCapital = config.key === 'transc1';
                          const tTables = allTables.filter((t: string) => {
                            if (t === match) return false;
                            if (isCapital) return /^TRANS?A?C?_?C[0-9]*$/i.test(t) || /^TRANSC$/i.test(t);
                            return /^TRANS?A?C?[0-9]+$/i.test(t) && !/C/i.test(t);
                          });
                          const existingKeys = new Set(rows.map((r: any) => `${r.transid}_${r.acid ?? ''}_${r.vid ?? ''}_${r.maid ?? ''}`));
                          for (const tTab of tTables) {
                            try {
                              const tRes = db.exec(`SELECT * FROM "${tTab}"`);
                              if (tRes.length > 0) {
                                const tCols = tRes[0].columns;
                                tRes[0].values.forEach((row: any) => {
                                  const obj: Record<string, any> = {};
                                  tCols.forEach((col: string, i: number) => {
                                    const mappedCol = mapHeaderToColumn(col);
                                    obj[mappedCol] = parseValue(mappedCol, String(row[i] ?? ''));
                                  });
                                  const key = `${obj.transid}_${obj.acid ?? ''}_${obj.vid ?? ''}_${obj.maid ?? ''}`;
                                  if (!existingKeys.has(key)) {
                                    existingKeys.add(key);
                                    rows.push(obj);
                                  }
                                });
                              }
                            } catch (err) {
                              console.warn(`Could not merge ${tTab} into ${config.key}:`, err);
                            }
                          }
                        }
                    }
                    
                    setStagedFiles(prev => ({ ...prev, [config.key]: { rows, fileName: file.name + ` (${match})` } }));
                    setTableStatus(prev => ({
                      ...prev,
                      [config.key]: { status: 'parsed', rowCount: rows.length, progress: 0 }
                    }));
                    console.log(`Staged ${config.name} from DB: ${rows.length} rows`);
                 } else if (!config.required) {
                    setStagedFiles(prev => ({ ...prev, [config.key]: { rows: [], fileName: file.name + ` (Not in backup)` } }));
                    setTableStatus(prev => ({
                      ...prev,
                      [config.key]: { status: 'parsed', rowCount: 0, progress: 0 }
                    }));
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
    setOverallProgress(0);

    const deleteOrder = [
      'transc1', 'trans1', 'scnote1', 'bs1',
      'vouchersc1', 'vouchers1', 'sum_table', 'mprices',
      'investor_group_members', 'acc_pflink', 'acmac1', 'sam', 'portfolios'
    ];

    const tablesInOrder = [
      'portfolios', 'sam', 'acmac1', 'acc_pflink', 'investor_group_members',
      'mprices', 'sum_table', 'scnote1', 'vouchers1', 'vouchersc1',
      'trans1', 'transc1', 'bs1'
    ];

    try {
      setOverallMessage("Checking cloud connection...");
      const isCloudOnline = await isSupabaseReachable(true);
      setCloudStatus(isCloudOnline ? 'connected' : 'paused');

      const totalTablesToUpload = tablesInOrder.filter(t => stagedFiles[t]).length;
      let completedTables = 0;

      // Step 1: Always import directly into Local Database (IndexedDB)
      setOverallMessage("Importing data into Local Database (IndexedDB)...");
      for (const tableKey of tablesInOrder) {
        const fileData = stagedFiles[tableKey];
        const config = TABLE_CONFIGS.find(t => t.key === tableKey);
        if (!fileData || !config) continue;

        setTableStatus(prev => ({
          ...prev,
          [tableKey]: { status: 'importing', rowCount: fileData.rows.length, progress: 50 }
        }));
        setOverallMessage(`Processing ${config.name} (${fileData.rows.length.toLocaleString()} rows)...`);
        
        await new Promise(r => setTimeout(r, 25));

        setTableStatus(prev => ({
          ...prev,
          [tableKey]: { status: 'done', rowCount: fileData.rows.length, progress: 100 }
        }));
        completedTables++;
        setOverallProgress(Math.round((completedTables / totalTablesToUpload) * 100));
      }

      setOverallMessage("Applying database records to local workspace...");
      await importStagedTablesLocally(stagedFiles);
      triggerGlobalRefresh();

      if (!isCloudOnline) {
        setImportComplete(true);
        setOverallMessage("✅ Staged data successfully imported to Local Database (IndexedDB)! All portfolios, transactions & balance sheets are active.");
        return;
      }

      // Step 2: If Supabase cloud is reachable, sync to cloud with strict timeouts
      setOverallMessage("Syncing with Supabase Cloud...");
      try {
        const withTimeout = async <T,>(p: PromiseLike<T>, ms = 8000, desc = "Request timed out"): Promise<T> => {
          let timer: any;
          const to = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(desc)), ms); });
          try { return await Promise.race([Promise.resolve(p), to]); } finally { clearTimeout(timer); }
        };

        for (const tableKey of deleteOrder) {
          if (!stagedFiles[tableKey]) continue;
          if (tableKey === 'acmac1') {
            const hasGroups = stagedFiles['acmac1'].rows.some(r => r.is_group === true || r.is_group === 1 || r.is_group === '1');
            if (!hasGroups) {
              await withTimeout(supabase.from('acmac1').delete().eq('is_group', false));
              continue;
            }
          }
          const config = TABLE_CONFIGS.find(t => t.key === tableKey);
          const delKey = config?.deleteKey || 'id';
          await withTimeout(supabase.from(tableKey).delete().neq(delKey, -99999999));
        }

        for (const tableKey of tablesInOrder) {
          const fileData = stagedFiles[tableKey];
          const config = TABLE_CONFIGS.find(t => t.key === tableKey);
          if (!fileData || !config) continue;

          const allowedCols = allowedColumns[tableKey] || [];
          const cleanRows = fileData.rows.map(r => {
            const mapped: Record<string, any> = {};
            for (const [col, val] of Object.entries(r)) {
              if (allowedCols.includes(col)) {
                let finalVal = val;
                if (typeof val === 'string' && val.trim() === '') finalVal = null;
                mapped[col] = finalVal;
              }
            }
            return mapped;
          });

          const batchSize = 500;
          for (let i = 0; i < cleanRows.length; i += batchSize) {
            const batch = cleanRows.slice(i, i + batchSize);
            const res: any = await withTimeout(supabase.from(tableKey).insert(batch));
            if (res && res.error) {
              await withTimeout(supabase.from(tableKey).upsert(batch));
            }
          }
        }
        setOverallMessage("✅ All database tables imported locally and synced to Supabase Cloud!");
      } catch (cloudErr: any) {
        console.warn("Cloud sync warning:", cloudErr);
        setOverallMessage(`✅ Data imported to Local Database (IndexedDB)! Note: Cloud sync had notice: ${cloudErr.message || cloudErr}`);
      }

      setImportComplete(true);
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
  const [selectedBroker, setSelectedBroker] = useState<string>("auto");
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
  const [lastCommittedInfo, setLastCommittedInfo] = useState<any>(null);
  const [autoDetectedInfo, setAutoDetectedInfo] = useState<{
    individual: string;
    broker: string;
    pan?: string;
  } | null>(null);

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
        // Try to match the selected broker parser to the ledger name (e.g. Zerodha, Groww, ICICI, Kotak, HDFC, Motilal, Dhan, Mirae, RK Global)
        const activeParser = selectedBroker.toLowerCase().replace(/[^a-z0-9]/g, "");
        const matchedLedger = brokers.find(b => {
          const nameLower = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (activeParser === 'zerodha') return nameLower.includes('zerodha');
          if (activeParser === 'groww') return nameLower.includes('groww') || nameLower.includes('nextbillion');
          if (activeParser === 'icici') return nameLower.includes('icici') || nameLower.includes('direct');
          if (activeParser === 'kotak') return nameLower.includes('kotak');
          if (activeParser === 'hdfc') return nameLower.includes('hdfc');
          if (activeParser === 'motilal') return nameLower.includes('motilal') || nameLower.includes('mosl');
          if (activeParser === 'dhan') return nameLower.includes('dhan');
          if (activeParser === 'mirae') return nameLower.includes('mirae') || nameLower.includes('mstock');
          if (activeParser === 'rkglobal') return nameLower.includes('global') || nameLower.includes('rk');
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

    // Helper to strip corporate suffixes, ISINs, and non-alphanumerics
    const cleanLedgerName = (n: string) => {
      let cleaned = String(n || '').replace(/\s*\(?ISIN\s+[A-Z0-9]{12}\)?/gi, '');
      cleaned = cleaned.replace(/\s*\([A-Z]{2}[A-Z0-9]{10}\)/gi, '');
      cleaned = cleaned.replace(/\s*\(\d[\d\s\/,-]*\)/gi, '');
      // Strip corporate legal forms and designations
      cleaned = cleaned.replace(/\b(limited|ltd\.?|private|pvt\.?|corp|corporation|inc|india)\b/gi, '');
      // Strip all punctuation, spaces, and non-alphanumerics
      return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    };
    const cleanedNameLower = cleanLedgerName(name);

    // Step 0: Direct amid / sid linkage check for this portfolio & account
    if (amid && amid > 0) {
      // Look up if this portfolio already has a sid assigned for this amid
      const bsMatch = (state.bs1 || []).find((b: any) => Number(b.pfid) === Number(portfolioId) && Number(b.amid) === Number(amid) && Number(b.sid) > 0);
      const sumMatch = (state.sumTable || []).find((s: any) => Number(s.pfid) === Number(portfolioId) && Number(s.amid) === Number(amid) && Number(s.sid) > 0);
      const sid = bsMatch?.sid || sumMatch?.sid;
      if (sid && sid > 0) {
        const expectedLedgerId = 500000 + Number(sid);
        const existingBySid = state.acmac1.find((a: any) => !a.is_group && Number(a.acid) === acid && Number(a.id) === expectedLedgerId);
        if (existingBySid) {
          console.log(`[ensureLedger] Reusing ledger by sid/amid "${existingBySid.name}" id=${existingBySid.id} acid=${acid}`);
          return Number(existingBySid.id);
        }
      }
    }

    // Step 1: In-memory lookup by cleaned name (stripping Limited, Ltd, etc.) — EXACT acid match only
    const existingByName = state.acmac1.find((a: any) => {
      if (a.is_group || Number(a.acid) !== acid || !a.name) return false;
      const aClean = cleanLedgerName(a.name);
      return aClean === cleanedNameLower || (cleanedNameLower.length > 3 && aClean.length > 3 && (aClean.startsWith(cleanedNameLower) || cleanedNameLower.startsWith(aClean)));
    });
    if (existingByName) {
      console.log(`[ensureLedger] Reusing "${existingByName.name}" id=${existingByName.id} acid=${acid}`);
      return Number(existingByName.id);
    }

    // Step 2: DB lookup (if cloud is reachable) — EXACT acid match only
    if (await isSupabaseReachable()) {
      try {
        const { data: dbByName } = await supabase.from('acmac1')
          .select('*')
          .eq('acid', acid)
          .eq('is_group', false);
        if (dbByName && dbByName.length > 0) {
          const matchedDb = dbByName.find((a: any) => {
            const aClean = cleanLedgerName(a.name);
            return aClean === cleanedNameLower || (cleanedNameLower.length > 3 && aClean.length > 3 && (aClean.startsWith(cleanedNameLower) || cleanedNameLower.startsWith(aClean)));
          });
          if (matchedDb) {
            console.log(`[ensureLedger] DB found "${matchedDb.name}" id=${matchedDb.id} acid=${acid}`);
            if (!state.acmac1.find((a: any) => a.id === matchedDb.id)) {
              state.acmac1.push(matchedDb);
            }
            return Number(matchedDb.id);
          }
        }
      } catch (err) {
        console.warn("Could not query acmac1 in cloud:", err);
      }
    }

    // Step 3: Create a NEW ledger for this exact acid
    const maxExistingId = state.acmac1.reduce((max, a) => Math.max(max, Number(a.id) || 0), 500000);
    const nextId = maxExistingId + 1;

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

    if (await isSupabaseReachable()) {
      try {
        await supabase.from('acmac1').insert([newLedgerRow]);
      } catch (err: any) {
        console.warn("Could not sync new ledger to cloud:", err?.message);
      }
    }

    console.log(`[ensureLedger] Created NEW ledger "${name.trim()}" id=${nextId} acid=${acid}`);
    state.acmac1.push(newLedgerRow);
    await persistStateToIDB();

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
        const rawPid = t.portfolioId || selectedPortfolio || topPortfolioId || 1;
        const pf = portfolios.find((p: any) => String(p.id) === String(rawPid));
        const pId = pf ? String(pf.id) : String(rawPid);
        const groupDate = t.date || topCnDate || cnDate;
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

            // Centralized FIFO cost engine from logic.ts (buildAssetFifoLedger + depleteFifoLots)
            // Exclude transactions from current contract note voucher so they don't consume lots prematurely
            const priorTxForAsset = (state.bs1 || [])
              .filter((r: any) => 
                Number(r.pfid) === Number(pId) && 
                Number(r.amid) === Number(t.amid) && 
                (r.dt || '') <= (t.date || '') && 
                (!cnNo || !String(r.narr || '').includes(cnNo)) &&
                (FIFO_BUY_TRTY.has(Number(r.trty)) || FIFO_SELL_TRTY.has(Number(r.trty)) || [85, 45].includes(Number(r.trty)))
              )
              .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trty) - Number(b.trty)));

            const { openLots } = buildAssetFifoLedger(priorTxForAsset, '0001-01-01', t.date, new Map(), {});
            const { totalCost: fifoTotalCost, matchedLots } = depleteFifoLots(openLots, t.quantity);

            // Fallback 1: Check active holdings in sum_table if FIFO open lots was empty
            let derivedCost = fifoTotalCost;
            if (derivedCost <= 0) {
              const holding = (state.sumTable || []).find((s: any) => Number(s.pfid) === Number(pId) && Number(s.amid) === Number(t.amid));
              if (holding && Number(holding.qnt) > 0 && Number(holding.amtinv) > 0) {
                const avgPrice = Number(holding.amtinv) / Number(holding.qnt);
                derivedCost = avgPrice * t.quantity;
              }
            }

            // Fallback 2: If still no buy history, cost = proceeds (zero gain)
            const finalCost = derivedCost > 0 ? derivedCost : saleProceeds;
            const costBasis = Number(finalCost.toFixed(2));
            const capitalGain = Number((saleProceeds - costBasis).toFixed(2));

            // Line 1: Cr Stock ledger at COST (removes investment from balance sheet)
            mappedLines.push({
              ledgerId,
              amid: t.amid,
              assetName: t.assetName,
              debit: 0,
              credit: costBasis,
              quantity: t.quantity,
              price: t.quantity > 0 ? costBasis / t.quantity : 0
            });

            // Exact ledger IDs from Chart of Accounts (Capital Gains group id=180)
            const GAIN_LEDGERS = {
              STCG_EQUITY: 460,
              LTCG_EQUITY: 465,
              STCG_DEBT:   470,
              LTCG_DEBT:   475,
              STCG_BONDS:  490,
              LTCG_BONDS:  485,
            };

            const bs1Asset = state.bs1.find((r: any) => Number(r.pfid) === Number(pId) && r.amid === t.amid);
            const atyid = bs1Asset?.atyid || 50;
            const EQUITY_GROUPS = new Set([200050, 200051, 200061, 50]);
            const DEBT_GROUPS   = new Set([200062, 200058]);
            const BOND_GROUPS   = new Set([200040, 200070]);

            const getLotGainLedgerId = (lotDate: string): number => {
              const holdingDays = Math.abs((new Date(t.date).getTime() - new Date(lotDate).getTime()) / 86400000);
              if (EQUITY_GROUPS.has(atyid)) {
                return holdingDays > 365 ? GAIN_LEDGERS.LTCG_EQUITY : GAIN_LEDGERS.STCG_EQUITY;
              } else if (DEBT_GROUPS.has(atyid)) {
                // Section 50AA: post-01-Apr-2023 debt mutual funds are strictly STCG
                if ((lotDate || '').slice(0, 10) >= '2023-04-01') {
                  return GAIN_LEDGERS.STCG_DEBT;
                }
                return holdingDays > 1095 ? GAIN_LEDGERS.LTCG_DEBT : GAIN_LEDGERS.STCG_DEBT;
              } else if (BOND_GROUPS.has(atyid)) {
                return holdingDays > 1095 ? GAIN_LEDGERS.LTCG_BONDS : GAIN_LEDGERS.STCG_BONDS;
              }
              return holdingDays > 365 ? GAIN_LEDGERS.LTCG_EQUITY : GAIN_LEDGERS.STCG_EQUITY;
            };

            // Multi-lot gain split: allocate per matched lot to exact STCG / LTCG ledger
            const gainsByLedger: Record<number, number> = {};
            const salePricePerUnit = t.quantity > 0 ? (saleProceeds / t.quantity) : 0;
            let matchedQtySum = 0;

            if (matchedLots.length > 0) {
              matchedLots.forEach(m => {
                const lotLedgerId = getLotGainLedgerId(m.date);
                const lotProceeds = m.qty * salePricePerUnit;
                const lotCost = m.qty * m.costPerUnit;
                const lotGain = lotProceeds - lotCost;
                gainsByLedger[lotLedgerId] = (gainsByLedger[lotLedgerId] || 0) + lotGain;
                matchedQtySum += m.qty;
              });
            }

            if (t.quantity > matchedQtySum) {
              const unmatchedQty = t.quantity - matchedQtySum;
              const defaultLedgerId = getLotGainLedgerId(t.date);
              const unmatchedProceeds = unmatchedQty * salePricePerUnit;
              const unmatchedCost = Math.max(0, costBasis - matchedLots.reduce((s, m) => s + (m.qty * m.costPerUnit), 0));
              const unmatchedGain = unmatchedProceeds - unmatchedCost;
              gainsByLedger[defaultLedgerId] = (gainsByLedger[defaultLedgerId] || 0) + unmatchedGain;
            }

            // Penny rounding reconciliation to ensure double-entry strict balance
            const ledgerEntries = Object.entries(gainsByLedger).map(([idStr, amt]) => ({
              ledgerId: Number(idStr),
              netGain: Number(amt.toFixed(2))
            }));
            const totalGainsRounded = ledgerEntries.reduce((s, e) => s + e.netGain, 0);
            const expectedTotalGain = Number((saleProceeds - costBasis).toFixed(2));
            const roundingDiff = Number((expectedTotalGain - totalGainsRounded).toFixed(2));
            if (Math.abs(roundingDiff) > 0 && ledgerEntries.length > 0) {
              ledgerEntries.sort((a, b) => Math.abs(b.netGain) - Math.abs(a.netGain));
              ledgerEntries[0].netGain = Number((ledgerEntries[0].netGain + roundingDiff).toFixed(2));
            }

            // Line 2+: Capital gain/loss lines
            for (const entry of ledgerEntries) {
              if (entry.netGain > 0.01) {
                mappedLines.push({ ledgerId: entry.ledgerId, debit: 0, credit: entry.netGain });
              } else if (entry.netGain < -0.01) {
                mappedLines.push({ ledgerId: entry.ledgerId, debit: Math.abs(entry.netGain), credit: 0 });
              }
            }

            totalSells += saleProceeds; // Broker receives full sale proceeds
          }
        }

        // Add proportional individual charges under that person's exact MProfit heads
        const pf = portfolios.find((p: any) => String(p.id) === String(pId));
        const acid = pf ? Number(pf.accountId) : 31;

        const groupStt = Number(((cnCharges.stt || 0) / numGroups).toFixed(2));
        const groupBrok = Number(((cnCharges.brokerage || 0) / numGroups).toFixed(2));
        const groupGst = Number(((cnCharges.gst || 0) / numGroups).toFixed(2));
        const groupStamp = Number(((cnCharges.stamp || 0) / numGroups).toFixed(2));
        const groupTrans = Number((((cnCharges.transCharges || 0) + (cnCharges.other || 0)) / numGroups).toFixed(2));

        if (groupStt > 0) {
          const l = await ensureLedgerExists("STT - Equity", "stt", acid);
          if (l?.id) mappedLines.push({ ledgerId: Number(l.id), debit: groupStt, credit: 0 });
        }
        if (groupBrok > 0) {
          const l = await ensureLedgerExists("Share Transaction Charges", "share_txn_charges", acid)
                 || await ensureLedgerExists("Brokerage - Equity", "share_txn_charges", acid);
          if (l?.id) mappedLines.push({ ledgerId: Number(l.id), debit: groupBrok, credit: 0 });
        }
        if (groupGst > 0) {
          const l = await ensureLedgerExists("GST - Equity", "tax_charges_stocks", acid);
          if (l?.id) mappedLines.push({ ledgerId: Number(l.id), debit: groupGst, credit: 0 });
        }
        if (groupStamp > 0) {
          const l = await ensureLedgerExists("Stamp Charges - Equity", "tax_charges_stocks", acid);
          if (l?.id) mappedLines.push({ ledgerId: Number(l.id), debit: groupStamp, credit: 0 });
        }
        if (groupTrans > 0) {
          const l = await ensureLedgerExists("Trans. Charges - Equity(T)", "tax_charges_stocks", acid)
                 || await ensureLedgerExists("Trans. Charges - Equity", "share_txn_charges", acid);
          if (l?.id) mappedLines.push({ ledgerId: Number(l.id), debit: groupTrans, credit: 0 });
        }

        const sumCharges = groupStt + groupBrok + groupGst + groupStamp + groupTrans;
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
      setLastCommittedInfo({
        portfolioId: selectedPortfolio,
        portfolioName: portfolios.find(p => String(p.id) === String(selectedPortfolio))?.portfolioName || "Portfolio",
        brokerLedgerId: selectedBrokerLedger,
        brokerName: brokerLedgers.find(b => String(b.id) === String(selectedBrokerLedger))?.name || "Broker",
        cnNo,
        trades: selectedTrades.map(t => ({
          type: t.type,
          assetName: t.assetName,
          quantity: t.quantity,
          price: t.price,
          gross: Number(t.gross) || (Number(t.quantity || 0) * Number(t.price || 0))
        })),
        charges: { ...cnCharges }
      });
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

  // ── Auto-Detect & Auto-Create Portfolio for Contract Note ───────────────
  const resolveOrCreatePortfolio = async (
    pan: string,
    clientName: string,
    ucc: string,
    isFno: boolean = false
  ): Promise<{ portfolioId: string; accountId: string; portfolioName: string }> => {
    const normPan = (pan || '').trim().toUpperCase();
    const normName = (clientName || '').trim().toUpperCase();
    const isHuf = normName.includes('HUF') || (normPan.length === 10 && normPan[3] === 'H');

    const isActPf = (p: any) => 
      !p.is_group && 
      p.pfolio_type !== 10 && 
      p.exit_status !== 2 && 
      p.exit_status !== 0 && 
      !p.investor_name.toLowerCase().startsWith('x');

    const pickBestPf = (candidates: any[]) => {
      if (isFno) {
        if (isHuf) {
          const hufFo = candidates.find(p => /huf/i.test(p.investor_name) && (/fo/i.test(p.investor_name) || p.pfolio_type === 5));
          if (hufFo) return hufFo;
        }
        const anyFo = candidates.find(p => /fo/i.test(p.investor_name) || p.pfolio_type === 5);
        if (anyFo) return anyFo;
      } else {
        if (isHuf) {
          const hufInv = candidates.find(p => /huf/i.test(p.investor_name) && (/inv|eq/i.test(p.investor_name) || p.pfolio_type === 0));
          if (hufInv) return hufInv;
        }
        const equity = candidates.find(p => /inv|eq|stock/i.test(p.investor_name) && !/fo|curr|mf/i.test(p.investor_name));
        if (equity) return equity;
      }
      return candidates[0];
    };

    // 1. Try matching by PAN first
    if (normPan) {
      let candidatePfs = (state.portfolios || []).filter(
        (p: any) => p.pan && p.pan.trim().toUpperCase() === normPan && isActPf(p)
      );

      // If client name is also provided, ensure candidate doesn't mismatch family member name
      if (normName && candidatePfs.length > 0) {
        const nameTokens = normName.split(/\s+/).filter(w => w.length > 2);
        const nameFiltered = candidatePfs.filter((p: any) => {
          const pStr = `${p.investor_name || ''} ${p.full_name || ''}`.toUpperCase();
          return nameTokens.some(tok => pStr.includes(tok));
        });
        if (nameFiltered.length > 0) candidatePfs = nameFiltered;
      }

      if (candidatePfs.length > 0) {
        const best = pickBestPf(candidatePfs);
        const link = (state.accPflink || []).find((l: any) => Number(l.pfid) === Number(best.id));
        return {
          portfolioId: String(best.id),
          portfolioName: best.investor_name || best.full_name || `Portfolio ${best.id}`,
          accountId: link ? String(link.acid) : (isHuf ? '62' : '31')
        };
      }
    }

    // 2. Try matching by Client Name
    if (normName) {
      const cleanNorm = normName.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const tokens = cleanNorm.split(' ').filter(w => w.length > 1);

      const activeList = (state.portfolios || []).filter(isActPf);
      const matches = activeList.filter((p: any) => {
        const pFull = (p.full_name || '').toUpperCase().trim();
        const pInv = (p.investor_name || '').toUpperCase().trim();
        if (!pFull && !pInv) return false;

        // Exact matches
        if (pFull === cleanNorm || pInv === cleanNorm) return true;

        // Substring match
        if (cleanNorm.includes(pFull) || (pFull && cleanNorm.includes(pFull))) return true;

        // Token overlap match
        const pTokens = `${pFull} ${pInv}`.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
        const common = tokens.filter(t => pTokens.includes(t));
        if (tokens.length >= 2 && pTokens.includes(tokens[0]) && pTokens.includes(tokens[tokens.length - 1])) {
          return true;
        }
        return common.length >= 2;
      });

      if (matches.length > 0) {
        const best = pickBestPf(matches);
        if (normPan && (!best.pan || best.pan.trim().toUpperCase() !== normPan)) {
          best.pan = normPan;
          if (await isSupabaseReachable()) {
            await supabase.from('portfolios').update({ pan: normPan }).eq('id', best.id);
          }
        }
        const link = (state.accPflink || []).find((l: any) => Number(l.pfid) === Number(best.id));
        return {
          portfolioId: String(best.id),
          portfolioName: best.investor_name || best.full_name || `Portfolio ${best.id}`,
          accountId: link ? String(link.acid) : (isHuf ? '62' : '31')
        };
      }
    }

    // 3. Auto-Create New Portfolio in the Individual's Name!
    const finalName = clientName.trim() || (normPan ? `Investor (${normPan})` : `Client ${Date.now()}`);
    console.log(`[CN Import] Auto-creating new portfolio for individual: "${finalName}", PAN: ${normPan}`);

    let nextPfid = 101;
    const existingIds = (state.portfolios || []).map((p: any) => Number(p.id)).filter((n: number) => !isNaN(n));
    if (existingIds.length > 0) {
      nextPfid = Math.max(...existingIds) + 1;
    }

    const newPfRow = {
      id: nextPfid,
      client_id: 1,
      investor_name: finalName,
      full_name: clientName.trim() || finalName,
      pan: normPan || null,
      is_group: false,
      pfolio_type: isFno ? 5 : 0,
      exit_status: 1
    };

    if (await isSupabaseReachable()) {
      const { error: insErr } = await supabase.from('portfolios').insert(newPfRow);
      if (insErr) {
        console.error('[CN Import] Error auto-creating portfolio:', insErr);
      }
    }
    state.portfolios.push(newPfRow);

    const linkRow = { pfid: nextPfid, acid: isHuf ? 62 : 31, client_id: 1 };
    if (await isSupabaseReachable()) {
      await supabase.from('acc_pflink').insert(linkRow);
    }
    state.accPflink.push(linkRow);

    const updatedPorts = getStoredPortfolios();
    setPortfolios(updatedPorts);

    return {
      portfolioId: String(nextPfid),
      portfolioName: finalName,
      accountId: isHuf ? '62' : '31'
    };
  };

  // ── Unified Contract Note ingestion pipeline ───────────────────────────
  const ingestParsedCnResult = async (result: any) => {
    let nextId = Date.now();
    const newTrades: any[] = [];

    // 1. Auto-detect & auto-resolve Portfolio / Individual
    const isFno = (result.trades || []).some((t: any) => !t.isin || /OPT|FUT/i.test(t.assetName || ''));
    const resolvedPf = await resolveOrCreatePortfolio(result.pan || '', result.clientName || '', result.ucc || '', isFno);
    const autoSelectedPortfolio = resolvedPf.portfolioId;
    setSelectedPortfolio(autoSelectedPortfolio);

    // 2. Auto-detect broker & auto-select Broker Ledger
    const detectedBroker = result.broker && result.broker !== 'auto' ? result.broker : 'zerodha';
    setSelectedBroker(detectedBroker);

    const targetAcid = Number(resolvedPf.accountId) || 31;
    const allLedgers = getStoredLedgers(targetAcid);
    const brokerLedgersList = allLedgers.filter(l => l.groupId === '75' || l.groupId === '90' || (l as any).parent_id === 75 || (l as any).parent_id === 90);

    const matchKeys = BROKER_MATCHERS[detectedBroker] || [detectedBroker];
    let matchedLedger = brokerLedgersList.find(b => {
      const bName = b.name.toLowerCase();
      return matchKeys.some(k => bName.includes(k.toLowerCase()));
    });

    if (!matchedLedger && brokerLedgersList.length > 0) {
      matchedLedger = brokerLedgersList[0];
    }

    if (!matchedLedger) {
      const displayName = BROKER_NAMES[detectedBroker] || 'Zerodha';
      const created = await ensureLedgerExists(displayName, 'sundry_creditors', targetAcid);
      if (created) {
        setSelectedBrokerLedger(String(created.id));
        setBrokerLedgers([created]);
      }
    } else {
      setSelectedBrokerLedger(String(matchedLedger.id));
      setBrokerLedgers(brokerLedgersList);
    }

    setAutoDetectedInfo({
      individual: resolvedPf.portfolioName,
      broker: detectedBroker,
      pan: result.pan
    });

    // Set CN date from parsed file (fallback to today)
    const parsedDate = result.cnDate || cnDate;
    if (result.cnDate) setCnDate(result.cnDate);

    // Set CN number from parsed file
    if (result.cnNo) setCnNo(result.cnNo);

    for (const t of (result.trades || [])) {
       const isin = (t.isin || '').toUpperCase().trim();
       const symbol = (t.assetName || '').toUpperCase().trim();
       
       let finalAmid = -1;
       let finalAssetName = symbol;

       // ── ISIN-FIRST MATCHING PIPELINE ─────────────────────────────────────────
       // Step 1: DB lookup by ISIN (highest authority)
       if (isin) {
         const inMemory = state.assetMaster.find((a: any) => a.isin && a.isin.toUpperCase() === isin)
           || state.sam.find((s: any) => s.isin && s.isin.toUpperCase() === isin);
         if (inMemory) {
           finalAmid = Number(inMemory.amid);
           finalAssetName = inMemory.name || inMemory.anm || finalAssetName;
         } else {
           const { data: byIsin } = await supabase
             .from('asset_master')
             .select('amid, name, nse_symbol, isin, asset_type')
             .eq('isin', isin)
             .limit(1);
           if (byIsin && byIsin.length > 0) {
             finalAmid = byIsin[0].amid;
             finalAssetName = byIsin[0].name;
             if (!state.assetMaster.find((a: any) => a.amid === finalAmid)) {
               state.assetMaster.push(byIsin[0]);
             }
           }
         }
       }

       // Step 2: isinDictionary lookup
       if (finalAmid === -1 && isin && isinToAmidMap[isin]) {
         const dictAmid = isinToAmidMap[isin];
         const { data: dictCheck } = await supabase
           .from('asset_master')
           .select('amid, name, nse_symbol, isin')
           .eq('amid', dictAmid)
           .limit(1);
         if (dictCheck && dictCheck.length > 0) {
           finalAmid = dictAmid;
           finalAssetName = dictCheck[0].name || finalAssetName;
           if (!dictCheck[0].isin && isin) {
             await supabase.from('asset_master').update({ isin, nse_symbol: symbol || dictCheck[0].nse_symbol }).eq('amid', dictAmid);
             state.assetMaster.forEach((a: any) => { if (a.amid === dictAmid) { a.isin = isin; } });
           }
           if (!state.assetMaster.find((a: any) => a.amid === finalAmid)) state.assetMaster.push(dictCheck[0]);
         } else {
           finalAmid = dictAmid;
           const foundName = getAssetName(finalAmid);
           if (foundName && !foundName.startsWith('Asset ')) finalAssetName = foundName;
         }
       }

       // Step 3: NSE symbol lookup in DB
       if (symbol) {
         const { data: byNse } = await supabase
           .from('asset_master')
           .select('amid, name, nse_symbol, isin')
           .eq('nse_symbol', symbol)
           .limit(2);
         
         if (byNse && byNse.length > 0) {
           const isinMatch = byNse.find((r: any) => r.isin && r.isin.toUpperCase() === isin);
           const best = isinMatch || byNse[0];

           if (finalAmid === -1) {
             finalAmid = best.amid;
             finalAssetName = best.name;
             if (!state.assetMaster.find((a: any) => a.amid === finalAmid)) state.assetMaster.push(best);
           } else if (best.amid !== finalAmid) {
             console.log(`[CN Import] ISIN-DB conflict for ${symbol}: dict/ISIN-said amid=${finalAmid}, NSE-symbol-in-DB says amid=${best.amid}. Using DB record.`);
             finalAmid = best.amid;
             finalAssetName = best.name;
             if (!best.isin && isin) {
               await supabase.from('asset_master').update({ isin }).eq('amid', best.amid);
               if (!state.assetMaster.find((a: any) => a.amid === best.amid)) state.assetMaster.push({ ...best, isin });
               else state.assetMaster.forEach((a: any) => { if (a.amid === best.amid) a.isin = isin; });
             }
           }
         }
       }

       // Step 4: Name fallback
       if (finalAmid === -1 && symbol) {
         const byName = state.assetMaster.find((a: any) => 
           a.name && a.name.toUpperCase().trim() === symbol
         ) || state.sam.find((s: any) => 
           s.anm && s.anm.toUpperCase().trim() === symbol
         );
         if (byName) {
           finalAmid = Number(byName.amid);
           finalAssetName = byName.name || byName.anm || finalAssetName;
           if (!byName.isin && isin) {
             await supabase.from('asset_master').update({ isin, nse_symbol: symbol }).eq('amid', finalAmid);
             state.assetMaster.forEach((a: any) => { if (a.amid === finalAmid) { a.isin = isin; if (!a.nse_symbol) a.nse_symbol = symbol; } });
           }
         }
       }

       // Step 5: Auto-create in asset_master
       if (finalAmid === -1) {
         const { data: maxRow } = await supabase.from('asset_master').select('amid').order('amid', { ascending: false }).limit(1);
         const nextAmid = ((maxRow?.[0]?.amid || 500000) < 500000 ? 500000 : (maxRow?.[0]?.amid || 500000)) + 1;
         const fnoMatch = parseFnoSymbol(symbol);
          const newAssetRow = {
           amid: nextAmid,
           name: symbol,
           nse_symbol: symbol,
           isin: isin || null,
           asset_type: fnoMatch ? (fnoMatch.optionType === 'FUT' ? 81 : 30) : 50,
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
      throw new Error("No trades were found in this file. Please verify it is a valid broker contract note or tradebook.");
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
  };

  // ── Broker contract note PDF/CSV processor ───────────────────────────────
  const processBrokerCnFile = async (file: File) => {
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buffer = await file.arrayBuffer();

        // 1. Build comprehensive list of candidate passwords (auto-decrypt without ever prompting user)
        const candidatePasswords: string[] = ['']; // Try unencrypted first

        // Saved passwords in localStorage
        try {
          const directSaved = localStorage.getItem('wealthcore_cn_password');
          if (directSaved && !candidatePasswords.includes(directSaved)) candidatePasswords.push(directSaved);

          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('wealthcore_cn_password')) {
              const v = localStorage.getItem(k);
              if (v && !candidatePasswords.includes(v)) candidatePasswords.push(v);
              if (v && !candidatePasswords.includes(v.toUpperCase())) candidatePasswords.push(v.toUpperCase());
            }
          }

          const savedList: string[] = JSON.parse(localStorage.getItem('wealthcore_saved_passwords') || '[]');
          for (const s of savedList) {
            if (s && !candidatePasswords.includes(s)) candidatePasswords.push(s);
            if (s && !candidatePasswords.includes(s.toUpperCase())) candidatePasswords.push(s.toUpperCase());
          }
        } catch {}

        // Known PANs from family portfolios in state
        (state.portfolios || []).forEach((p: any) => {
          if (p.pan && typeof p.pan === 'string') {
            const cleanPan = p.pan.trim().toUpperCase();
            if (cleanPan && !candidatePasswords.includes(cleanPan)) {
              candidatePasswords.push(cleanPan);
            }
            if (cleanPan && !candidatePasswords.includes(cleanPan.toLowerCase())) {
              candidatePasswords.push(cleanPan.toLowerCase());
            }
          }
        });

        // Tokens from file name (e.g. VQ6949, CGTPS8217E)
        const fnTokens = (file.name.match(/[A-Za-z0-9]{4,12}/g) || []);
        for (const tok of fnTokens) {
          const u = tok.toUpperCase();
          if (!candidatePasswords.includes(u)) candidatePasswords.push(u);
        }

        // Try decrypting with each candidate password in background
        for (const candPwd of candidatePasswords) {
          try {
            const clientRes = await parseContractNoteClientPdf(buffer, candPwd, 'auto');
            if (clientRes.status === 'ok') {
              // Successfully decrypted! Save password permanently across all keys
              if (candPwd) {
                try {
                  localStorage.setItem('wealthcore_cn_password', candPwd);
                  if (clientRes.broker && clientRes.broker !== 'auto') {
                    localStorage.setItem(`wealthcore_cn_password_${clientRes.broker}`, candPwd);
                  }
                  if (clientRes.pan) {
                    localStorage.setItem(`wealthcore_cn_password_pan_${clientRes.pan.toUpperCase()}`, candPwd);
                  }
                  const savedList: string[] = JSON.parse(localStorage.getItem('wealthcore_saved_passwords') || '[]');
                  if (!savedList.includes(candPwd)) {
                    savedList.unshift(candPwd);
                    localStorage.setItem('wealthcore_saved_passwords', JSON.stringify(savedList.slice(0, 30)));
                  }
                } catch {}
              }

              if (clientRes.trades && clientRes.trades.length > 0) {
                await ingestParsedCnResult(clientRes);
                return;
              }
            }
          } catch (candErr) {
            // Continue trying other candidate passwords
          }
        }

        // Fallback: try local server /api/parse-cn with saved password if available
        const savedPwd = localStorage.getItem(`wealthcore_cn_password_${selectedBroker}`) || localStorage.getItem('wealthcore_cn_password') || '';
        if (savedPwd) {
          try {
            const response = await fetch('/api/parse-cn', {
              method: 'POST',
              headers: {
                'x-cn-password': savedPwd,
                'x-cn-broker': selectedBroker,
                'Content-Type': 'application/pdf'
              },
              body: buffer
            });
            if (response.ok) {
              const result = await response.json();
              if (result.status === 'ok' && result.trades && result.trades.length > 0) {
                await ingestParsedCnResult(result);
                return;
              }
            }
          } catch {}
        }
      } catch (directErr) {
        // Direct parse failed, prompt user
      }

      // Only prompt if none of the saved or candidate passwords worked
      setPendingFile(file);
      const lastSaved = localStorage.getItem(`wealthcore_cn_password_${selectedBroker}`) || localStorage.getItem('wealthcore_cn_password') || '';
      if (lastSaved) setTempPassword(lastSaved);
      setPasswordPromptOpen(true);
    } else {
      // CSV / HTML / TXT file
      try {
        const text = await file.text();
        
        // 1. In-browser client-side text parse
        const clientRes = parseContractNoteClientText(text, file.name, 'auto');
        if (clientRes.status === 'ok' && clientRes.trades && clientRes.trades.length > 0) {
          await ingestParsedCnResult(clientRes);
          return;
        }

        // 2. Fallback: try local server /api/parse-cn
        const buffer = await file.arrayBuffer();
        const contentType = file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')
          ? 'text/html'
          : 'text/csv';

        const response = await fetch('/api/parse-cn', {
          method: 'POST',
          headers: {
            'x-cn-broker': selectedBroker,
            'Content-Type': contentType
          },
          body: buffer
        });

        if (!response.ok) {
          let errMsg = "Failed to parse trade file";
          try {
            const errData = await response.json();
            if (errData.error) errMsg = errData.error;
            if (errData.message) errMsg = errData.message;
          } catch(e){}
          throw new Error(errMsg);
        }

        const result = await response.json();
        if (result.status === 'error') {
          throw new Error(result.message || "Failed to parse trade file");
        }

        await ingestParsedCnResult(result);
      } catch (err: any) {
        alert("Error parsing file: " + (err.message || String(err)));
        console.error(err);
      }
    }
  };

  const handleBrokerCnFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processBrokerCnFile(file);
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
    const pwd = (tempPassword || '').trim();

    try {
      const buffer = await pendingFile.arrayBuffer();

      // 1. Primary engine: In-browser client-side decryption (works on Vercel & localhost)
      try {
        const clientRes = await parseContractNoteClientPdf(buffer, pwd, 'auto');
        if (clientRes.status === 'ok') {
          // Persist password permanently across all brokers & sessions IMMEDIATELY
          if (pwd) {
            try {
              localStorage.setItem('wealthcore_cn_password', pwd);
              if (clientRes.broker && clientRes.broker !== 'auto') {
                localStorage.setItem(`wealthcore_cn_password_${clientRes.broker}`, pwd);
              }
              if (clientRes.pan) {
                localStorage.setItem(`wealthcore_cn_password_pan_${clientRes.pan.toUpperCase()}`, pwd);
              }
              const savedList = JSON.parse(localStorage.getItem('wealthcore_saved_passwords') || '[]');
              if (!savedList.includes(pwd)) {
                savedList.unshift(pwd);
                localStorage.setItem('wealthcore_saved_passwords', JSON.stringify(savedList.slice(0, 30)));
              }
            } catch (saveErr) {
              console.warn('Failed to save CN password to localStorage:', saveErr);
            }
          }

          if (clientRes.trades && clientRes.trades.length > 0) {
            await ingestParsedCnResult(clientRes);
            setPasswordPromptOpen(false);
            setTempPassword('');
            setPasswordError('');
            return;
          } else {
            // PDF decrypted successfully, but no trades detected
            setPasswordError('PDF decrypted successfully, but no trade records were found in the document.');
            return;
          }
        }

        if (clientRes.status === 'error') {
          setPasswordError(clientRes.message || 'Incorrect password for PDF. Please re-enter your PAN in uppercase.');
          return;
        }
      } catch (clientErr: any) {
        console.warn('Client-side CN parse error, attempting backend fallback:', clientErr);
        if ((clientErr?.message || '').toLowerCase().includes('password')) {
          setPasswordError('Incorrect password for PDF. Please re-enter your PAN in uppercase.');
          return;
        }
      }

      // 2. Secondary fallback: Local python backend /api/parse-cn (if available)
      const response = await fetch('/api/parse-cn', {
        method: 'POST',
        headers: {
          'x-cn-password': pwd,
          'x-cn-broker': selectedBroker,
          'Content-Type': 'application/pdf'
        },
        body: buffer
      });

      if (!response.ok) {
         let errMsg = "Failed to parse PDF.";
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

      // Persist password permanently across all brokers & sessions
      if (pwd) {
        try {
          localStorage.setItem('wealthcore_cn_password', pwd);
          localStorage.setItem(`wealthcore_cn_password_${selectedBroker}`, pwd);
          if (result.pan) {
            localStorage.setItem(`wealthcore_cn_password_pan_${result.pan.toUpperCase()}`, pwd);
          }
          const savedList = JSON.parse(localStorage.getItem('wealthcore_saved_passwords') || '[]');
          if (!savedList.includes(pwd)) {
            savedList.unshift(pwd);
            localStorage.setItem('wealthcore_saved_passwords', JSON.stringify(savedList.slice(0, 30)));
          }
        } catch (saveErr) {
          console.warn('Failed to save CN password to localStorage:', saveErr);
        }
      }

      await ingestParsedCnResult(result);

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

          {/* Cloud Status Alert Banner */}
          {cloudStatus === 'paused' && (
            <div style={{
              padding: "16px 20px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "12px",
              display: "flex",
              gap: "14px",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px"
            }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706", flexShrink: 0 }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#92400e" }}>
                    Supabase Cloud Project is Paused (Free-Tier Inactivity)
                  </div>
                  <div style={{ fontSize: "13px", color: "#b45309", marginTop: "2px", lineHeight: 1.4 }}>
                    Project <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>ajjeoijjsklgkioxqkrb.supabase.co</code> is paused. <strong>Local Database Mode is active</strong>: your database files will import instantly into your browser's local IndexedDB so you can use all portfolios and balance sheets without waiting.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button
                  onClick={async () => {
                    setCloudStatus('checking');
                    const online = await isSupabaseReachable(true);
                    setCloudStatus(online ? 'connected' : 'paused');
                  }}
                  style={{ padding: "8px 14px", background: "#fff", border: "1px solid #fcd34d", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#92400e", cursor: "pointer" }}
                >
                  Retry Connection
                </button>
                <a
                  href="https://supabase.com/dashboard/project/ajjeoijjsklgkioxqkrb"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: "8px 16px", background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  Unpause on Supabase ↗
                </a>
              </div>
            </div>
          )}

          {cloudStatus === 'connected' && (
            <div style={{
              padding: "10px 16px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#166534",
              fontWeight: 600
            }}>
              <CheckCircle size={16} color="#16a34a" />
              Supabase Cloud is Connected. Data will sync locally and to the cloud.
            </div>
          )}

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
                badgeText = status.rowCount > 0 ? "Staged" : (config.required ? "Staged (0 rows)" : "Optional (0 rows)");
                badgeColor = status.rowCount > 0 ? "#15803d" : "#0284c7";
                badgeBg = status.rowCount > 0 ? "#dcfce7" : "#e0f2fe";
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
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
            Upload a broker contract note PDF. The individual and broker will be automatically parsed and selected.
          </p>

          {autoDetectedInfo && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 18px',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '13px',
              color: '#166534',
              fontWeight: 600
            }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
              <span>Auto-Detected & Configured:</span>
              <span style={{ background: '#dcfce7', padding: '3px 10px', borderRadius: '6px' }}>
                Individual: <strong>{autoDetectedInfo.individual}</strong> {autoDetectedInfo.pan ? `(${autoDetectedInfo.pan})` : ''}
              </span>
              <span style={{ background: '#dcfce7', padding: '3px 10px', borderRadius: '6px' }}>
                Broker: <strong>{BROKER_NAMES[autoDetectedInfo.broker] || autoDetectedInfo.broker}</strong>
              </span>
            </div>
          )}

          {/* ── Row 1: Selectors ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={labelStyle}>Portfolio / Individual (Auto)</label>
              <select value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)} style={selectStyle}>
                <option value="">Select Portfolio...</option>
                {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.portfolioName || p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Broker Ledger (Auto)</label>
              <select value={selectedBrokerLedger} onChange={e => setSelectedBrokerLedger(e.target.value)} style={selectStyle}>
                <option value="">Select Ledger...</option>
                {brokerLedgers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Broker (Auto-Detected)</label>
              <select value={selectedBroker} onChange={e => setSelectedBroker(e.target.value)} style={selectStyle}>
                <option value="auto">⚡ Auto-Detect Broker (Default)</option>
                <option value="zerodha">Zerodha</option>
                <option value="groww">Groww</option>
                <option value="icici">ICICI Direct</option>
                <option value="kotak">Kotak Securities</option>
                <option value="hdfc">HDFC Securities</option>
                <option value="motilal">Motilal Oswal</option>
                <option value="dhan">Dhan</option>
                <option value="mirae">MStock / Mirae Asset</option>
                <option value="rk_global">R K Global</option>
                <option value="upstox">Upstox</option>
                <option value="angel">Angel One</option>
                <option value="sharekhan">Sharekhan</option>
                <option value="axis">Axis Securities</option>
                <option value="5paisa">5Paisa</option>
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
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.background = '#eff6ff';
              }}
              onDragLeave={e => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onDrop={async e => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#f8fafc';
                const file = e.dataTransfer?.files?.[0];
                if (file) {
                  await processBrokerCnFile(file);
                }
              }}
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
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>Click or Drag & Drop Contract Note file here</div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>PDF / CSV: Zerodha · Groww · ICICI Direct · Kotak · HDFC Sec · Motilal Oswal · Dhan · MStock · RK Global</div>
            </div>

            {/* Password prompt — shown inline when PDF is pending */}
            {passwordPromptOpen && (
              <div style={{ marginTop: '16px', background: '#f0f9ff', border: '2px solid #2563eb', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '15px', marginBottom: '6px' }}>🔒 Password Protected PDF</div>
                <div style={{ color: '#475569', fontSize: '13px', marginBottom: '14px' }}>
                  This PDF is password-protected. Enter the password to decrypt and parse it.<br/>
                  <span style={{ color: '#2563eb', fontWeight: 600 }}>For Zerodha / Groww / Dhan / Motilal / Kotak: enter PAN in UPPERCASE. For ICICI Direct: enter DOB (DDMMYYYY).</span>
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
                  {(() => {
                    const buyTotal = cnTrades.filter(t => t.type === 'Buy').reduce((s: number, t: any) => s + (Number(t.gross) || 0), 0);
                    const sellTotal = cnTrades.filter(t => t.type === 'Sell').reduce((s: number, t: any) => s + (Number(t.gross) || 0), 0);
                    const chargesTotal = (Object.values(cnCharges) as number[]).reduce((s, v) => s + (Number(v) || 0), 0);
                    const computedNet = (buyTotal + chargesTotal) - sellTotal;
                    const isCredit = computedNet < 0;
                    const absNet = Math.abs(computedNet);
                    const matchesCn = pdfFinalNet !== null && Math.abs(absNet - Math.abs(pdfFinalNet)) < 0.05;

                    return (
                      <>
                        <div style={{ fontSize: '12px', color: isCredit ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                          {isCredit ? 'Net Receivable (CR)' : 'Net Payable (DR)'}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: isCredit ? '#16a34a' : '#0f172a' }}>
                          ₹{absNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {isCredit ? 'CR' : 'DR'}
                        </div>
                        {matchesCn && (
                          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                            ✓ Matches Contract Note: ₹{Math.abs(pdfFinalNet!).toLocaleString(undefined, { minimumFractionDigits: 2 })} {isCredit ? 'CR' : 'DR'}
                          </div>
                        )}
                        {!matchesCn && pdfFinalNet !== null && (
                          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>
                            ⚠ CN Net: ₹{Math.abs(pdfFinalNet).toLocaleString(undefined, { minimumFractionDigits: 2 })} {pdfFinalNet < 0 ? 'CR' : 'DR'}
                          </div>
                        )}
                      </>
                    );
                  })()}
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

          {lastCommittedInfo && cnTrades.length === 0 && (
            <div style={{ marginTop: '20px', padding: '24px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontWeight: 'bold' }}>✓</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Trades Successfully Committed & Balanced!</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Posted to Portfolio: <strong style={{ color: '#0f172a' }}>{lastCommittedInfo.portfolioName}</strong> | Broker: <strong style={{ color: '#0f172a' }}>{lastCommittedInfo.brokerName}</strong> {lastCommittedInfo.cnNo ? `| CN: ${lastCommittedInfo.cnNo}` : ''}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setLastCommittedInfo(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}
                >
                  ✕
                </button>
              </div>

              {/* Trade breakdown */}
              <div style={{ overflowX: 'auto', marginBottom: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Action</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Asset Name</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Gross ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastCommittedInfo.trades.map((t: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: t.type === 'Buy' ? '#16a34a' : '#ea580c' }}>{t.type}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>{t.assetName}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.quantity}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Number(t.price).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>₹{Number(t.gross).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Navigation buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/pms')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  View Holdings in PMS Workspace →
                </button>
                <button
                  onClick={() => navigate('/ledger/' + lastCommittedInfo.brokerLedgerId)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  View Broker Ledger →
                </button>
                <button
                  onClick={() => navigate('/capital-gains')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  View Capital Gains →
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  View Dashboard →
                </button>
              </div>
            </div>
          )}

          {overallMessage && !lastCommittedInfo && cnTrades.length === 0 && (
            <div style={{ padding: '14px 18px', background: overallMessage.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${overallMessage.includes('✅') ? '#bbf7d0' : '#fca5a5'}`, borderRadius: '10px', color: overallMessage.includes('✅') ? '#166534' : '#991b1b', fontWeight: 600, fontSize: '14px' }}>
              {overallMessage}
            </div>
          )}

        </div>
      )}




            {/* TAB 4: DEMAT eCAS IMPORT */}
        {activeTab === 'ecas' && (
          <EcasTab
            portfolios={portfolios}
            casTrades={ecasTrades}
            setCasTrades={setEcasTrades}
            casMessage={ecasMessage}
            setCasMessage={setEcasMessage}
            casImporting={ecasImporting}
            setCasImporting={setEcasImporting}
            casImportDone={ecasImportDone}
            setCasImportDone={setEcasImportDone}
            casImportedVids={ecasImportedVids}
            setCasImportedVids={setEcasImportedVids}
            casPortfolioMap={ecasPortfolioMap}
            setCasPortfolioMap={setEcasPortfolioMap}
            ensureAssetLedgerExists={ensureAssetLedgerExists}
            forceRefreshDatabase={forceRefreshDatabase}
            setRefreshKey={setRefreshKey}
            inputStyle={inputStyle}
            selectStyle={selectStyle}
            labelStyle={labelStyle}
          />
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
