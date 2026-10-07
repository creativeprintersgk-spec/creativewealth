/**
 * MfCasTab — Demat eCAS (CDSL / NSDL) Import
 *
 * Parses the text extracted from a CAMS/KFintech Consolidated Account Statement (CAS) PDF.
 * Extracts:
 *   - Investor PAN → maps to a Portfolio
 *   - Fund name + ISIN → maps to an asset ledger
 *   - Transactions: Purchase / Redemption / Switch In / Switch Out / Dividend
 *
 * Each transaction creates a balanced double-entry voucher:
 *   Purchase:   Dr MF Asset Ledger  / Cr Bank Ledger
 *   Redemption: Dr Bank Ledger      / Cr MF Asset Ledger
 *   Switch Out: Dr Destination Fund / Cr Source Fund  (internal)
 *   Dividend:   Dr Bank Ledger      / Cr Dividend Income
 *
 * Newly imported rows are highlighted in ORANGE for easy identification.
 */

import React, { useState, useRef } from "react";
import { Upload, CheckCircle, AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import { supabase } from "../supabase";
import { state, createVoucher, getStoredLedgers } from "../logic";

// ── TYPES ───────────────────────────────────────────────────────────────────

interface CasTransaction {
  id: number;
  pan: string;
  investorName: string;
  fundName: string;
  isin: string;
  folio: string;
  date: string;
  type: 'purchase' | 'redemption' | 'switch_in' | 'switch_out' | 'dividend' | 'stamp_duty' | 'stt' | 'other';
  amount: number;
  price: number;
  units: number;
  narration: string;
  switchCounterpart: string; // For Switch: the counterpart fund name (e.g. "Bandhan Liquid Fund")
  sttAmount?: number;
  stampDutyAmount?: number;
  selected: boolean;
  isDuplicate: boolean;
  amid: number | null;
  portfolioId: string;
  bankLedgerId: string;
  registrar: 'CAMS' | 'KFINTECH' | 'UNKNOWN';
}

interface MfCasTabProps {
  portfolios: any[];
  casTrades: CasTransaction[];
  setCasTrades: React.Dispatch<React.SetStateAction<CasTransaction[]>>;
  casMessage: string;
  setCasMessage: (m: string) => void;
  casImporting: boolean;
  setCasImporting: (v: boolean) => void;
  casImportDone: boolean;
  setCasImportDone: (v: boolean) => void;
  casImportedVids: number[];
  setCasImportedVids: (v: number[]) => void;
  casPortfolioMap: Record<string, string>;
  setCasPortfolioMap: (m: Record<string, string>) => void;
  ensureAssetLedgerExists: (amid: number, name: string, portfolioId: number, assetType: number) => Promise<number>;
  forceRefreshDatabase: () => Promise<void>;
  setRefreshKey: (fn: (k: number) => number) => void;
  inputStyle: any;
  selectStyle: any;
  labelStyle: any;
}

// ── TRANSACTION TYPE CLASSIFIER ─────────────────────────────────────────────

function classifyTransaction(rawType: string): CasTransaction['type'] {
  const t = rawType.toLowerCase();
  // Financial transactions take priority
  if (t.includes('switch in') || t.includes('switch-in') || t.includes('lateral shift in') || t.includes('stp in')) return 'switch_in';
  if (t.includes('switch out') || t.includes('switch-out') || t.includes('lateral shift out') || t.includes('stp out')) return 'switch_out';
  if (t.includes('redemption') || t.includes('repurchase') || t.includes('instant redemption')) return 'redemption';
  if (t.includes('purchase') || t.includes('sip') || t.includes('net purchase') || t.includes('subscription') || t.includes('reinvest')) return 'purchase';
  if (t.includes('dividend') || t.includes('idcw')) return 'dividend';
  
  // Non-financial / fees
  if (t.includes('stamp duty') || t.includes('stamp_duty')) return 'stamp_duty';
  if (t.includes('stt paid') || t.includes('stt')) return 'stt';
  
  return 'other';
}

// ── CAS TEXT PARSER (line-by-line state machine) ─────────────────────────
// Structure of each folio section in the CAS PDF (line-by-line after pdfjs):
//   LINE: PAN: XXXXXX KYC: OK PAN: OK
//   LINE: [CODE] - [Fund Name] - [Plan] ( Non - Demat ) - ISIN : [ISIN] Registrar : CAMS
//   LINE: Folio No: XXXXX / XX
//   LINE: [Investor Name]       ← ALWAYS next line after Folio No
//   LINE: Nominee 1: ...
//   LINE: Opening Unit Balance: ...
//   LINE: DD-Mon-YYYY  amount  price  units  description  balance   ← transactions
//   LINE: ...
//   LINE: Closing Unit Balance: ...

const MONTHS_MAP: Record<string, string> = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'
};

function parseIsoDate(raw: string): string {
  const p = raw.trim().split('-');
  if (p.length !== 3) return '';
  return `${p[2]}-${MONTHS_MAP[p[1].toLowerCase().slice(0,3)] || '01'}-${p[0].padStart(2,'0')}`;
}

function cleanNum(s: string): number {
  const neg = s.includes('(');
  const n = parseFloat(s.replace(/[,()\s]/g, '')) || 0;
  return neg ? -n : n;
}

// "Switch Out - To Bandhan Liquid Fund-(Dir Pln)-Gr , less STT" -> "Bandhan Liquid Fund"
// "Switch In - From Bandhan Small Cap Fund-Dir-Growth" -> "Bandhan Small Cap Fund"
function extractSwitchCounterpart(narr: string): string {
  const m = narr.match(/(?:From|To)\s+([A-Za-z][A-Za-z\s&\-]+?(?:Fund|ETF|Scheme))/i);
  return m ? m[1].replace(/-\s*(Dir|Direct|Growth|Dividend|Gr)\s*$/, '').trim() : '';
}

// Extract clean fund name from the full scheme line:
// "GDFCCG - Bandhan Liquid Fund - Direct Plan - Growth ( Non - Demat ) - ISIN : ..."
// -> "Bandhan Liquid Fund - Direct Plan - Growth"
function extractFundName(line: string): string {
  // Remove code prefix (e.g. "GDFCCG - " or "GD 340 - ")
  const afterCode = line.replace(/^[A-Z0-9\s]{2,12}-\s*/, '');
  // Remove everything from "(Non" or "- ISIN" onwards
  const cleaned = afterCode.replace(/\s*\(\s*Non.*$/i, '').replace(/\s*-\s*ISIN.*$/i, '').trim();
  return cleaned;
}

function parseCasText(text: string): CasTransaction[] {
  const transactions: CasTransaction[] = [];
  let idCounter = 1;

  // Normalize to lines
  const newlineCount = (text.match(/\n/g) || []).length;
  let lines: string[];
  if (newlineCount > 20) {
    lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  } else {
    // Single-line format (cas_text.txt) — split on 3+ spaces
    lines = text.replace(/[ \t]{3,}/g, '\n').split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  }

  // State
  let curPan = '';
  let curName = '';
  let curFund = '';
  let curIsin = '';
  let curFolio = '';
  let curReg: 'CAMS' | 'KFINTECH' | 'UNKNOWN' = 'UNKNOWN';
  let expectingName = false; // true after seeing "Folio No:" line

  const TX_KW = /purchase|redemption|switch|sip|idcw|dividend|stp in|stp out|lateral|repurchase|subscription|reinvest/i;
  // Transaction line: DD-Mon-YYYY  amount  price  units  description
  const reTx = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+([\(\)\d,\.]+)\s+([\d,\.]+)\s+([\(\)\d,\.]+)\s+(.+)$/;
  // Fee line: DD-Mon-YYYY amount (often STT or Stamp Duty right after a transaction)
  const reFee = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+([\d,\.]+)$/;

  for (const line of lines) {
    // ── PAN ──────────────────────────────────────────────────────────────────
    const pm = line.match(/PAN:\s*([A-Z]{5}\d{4}[A-Z])\s+KYC:\s*(?:OK|NA)/);
    if (pm) {
      curPan = pm[1];
      expectingName = false;
      continue;
    }

    // ── Scheme line: "[CODE] - [FundName] - [Plan] ( Non - Demat ) - ISIN : [ISIN]" ──
    // This line contains both fund name AND ISIN
    const isinInLine = line.match(/ISIN\s*:\s*(INF\s*[\w\s]{5,15})/i);
    if (isinInLine) {
      curIsin = isinInLine[1].replace(/\s/g, '').toUpperCase();
      curFund = extractFundName(line);
      const regM = line.match(/Registrar\s*:\s*(CAMS|KFINTECH|KFI)/i);
      if (regM) curReg = regM[1].toUpperCase().startsWith('K') ? 'KFINTECH' : 'CAMS';
      continue;
    }

    // ── Folio No ──────────────────────────────────────────────────────────────
    if (/^Folio No:/i.test(line)) {
      const fm = line.match(/Folio No:\s*([\d\/\s]+)/i);
      if (fm) curFolio = fm[1].trim().replace(/\s+/g, '');
      // Investor name is on the NEXT line (not this line)
      expectingName = true;
      // Also try same-line name as fallback
      const sameLine = line.replace(/^Folio No:\s*[\d\/\s]+/i, '').trim();
      if (sameLine && !/^Nominee/i.test(sameLine) && sameLine.match(/^[A-Z]/)) {
        curName = sameLine;
        expectingName = false;
      }
      continue;
    }

    // ── Investor name (line immediately after Folio No) ───────────────────────
    if (expectingName) {
      // Skip "Nominee", "Opening", page headers, dates
      const isNominee  = /^Nominee/i.test(line);
      const isOpening  = /^Opening/i.test(line);
      const isPageHdr  = /^(Consolidated|Date|Page|\d{2}-[A-Za-z]{3})/i.test(line);
      const isNameLike = /^[A-Z][A-Za-z\s&\(\)\.]+$/.test(line) && line.length > 3;
      if (!isNominee && !isOpening && !isPageHdr && isNameLike) {
        curName = line.trim();
        expectingName = false;
      } else if (isNominee || isOpening) {
        expectingName = false; // done looking
      }
      // Don't continue — let this line also be processed as a transaction if it matches
    }

    // ── Fee Line (STT / Stamp Duty) ───────────────────────────────────────────
    const feeMatch = line.match(reFee);
    if (feeMatch && curPan && curFund && transactions.length > 0) {
      const amount = Math.abs(cleanNum(feeMatch[2]));
      if (amount > 0) {
        // Look back at the last transaction and attach this fee to it
        const lastTx = transactions[transactions.length - 1];
        if (lastTx.type === 'switch_out' || lastTx.type === 'redemption') {
          lastTx.sttAmount = (lastTx.sttAmount || 0) + amount;
        } else {
          lastTx.stampDutyAmount = (lastTx.stampDutyAmount || 0) + amount;
        }
      }
      continue;
    }

    // ── Transaction line ──────────────────────────────────────────────────────
    const tx = line.match(reTx);
    if (tx && curPan && curFund) {
      const desc = tx[5].trim();
      if (!TX_KW.test(desc)) continue;
      const txType = classifyTransaction(desc);
      if (txType === 'stamp_duty' || txType === 'stt' || txType === 'other') continue;
      const isoDate = parseIsoDate(tx[1]);
      if (!isoDate) continue;
      const amount = Math.abs(cleanNum(tx[2]));
      const price  = Math.abs(cleanNum(tx[3]));
      const units  = Math.abs(cleanNum(tx[4]));
      if (amount === 0 && units === 0) continue;
      const switchCounterpart = (txType === 'switch_in' || txType === 'switch_out')
        ? extractSwitchCounterpart(desc) : '';
      transactions.push({
        id: idCounter++,
        pan: curPan,
        investorName: curName || curPan,
        fundName: curFund,
        isin: curIsin,
        folio: curFolio,
        date: isoDate,
        type: txType,
        amount,
        price,
        units,
        narration: desc.substring(0, 100),
        switchCounterpart,
        selected: true,
        isDuplicate: false,
        amid: null,
        portfolioId: '',
        bankLedgerId: '',
        registrar: curReg,
      });
    }
  }

  return transactions;
}
// ── DUPLICATE CHECKER ───────────────────────────────────────────────────────

function checkDuplicates(trades: CasTransaction[]): CasTransaction[] {
  return trades.map(t => {
    // Strict duplicate check: must match date + ISIN (or fund name) + amount
    // A loose check (date+amount only) causes false positives when multiple funds
    // have transactions on the same day with the same amount
        const existsInBs1 = (state.bs1 || []).some((b: any) => {
      if (b.pfid !== undefined && t.portfolioId && String(b.pfid) !== String(t.portfolioId)) return false;
      const matchDate = (b.dt || '').substring(0, 10) === t.date;
      if (!matchDate) return false;

      let bIsin = '';
      const am = state.assetMaster.find((a: any) => a.amid === b.amid);
      if (am && am.isin) bIsin = am.isin.toUpperCase();
      if (!bIsin) {
        const samEntry = state.sam.find((s: any) => s.amid === b.amid);
        if (samEntry && samEntry.extstr) bIsin = samEntry.extstr.toUpperCase();
      }

      const tIsin = (t.isin || '').replace(/\s/g, '').toUpperCase();
      const matchIsin = !!tIsin && !!bIsin && bIsin.includes(tIsin);

      const bName = (state.assetNameMap[b.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tName = (t.fundName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bNameParts = (state.assetNameMap[b.amid] || '').toLowerCase().split(/[\s\-]+/).filter((w: string) => w.length > 2);
      const tNameParts = (t.fundName || '').toLowerCase().split(/[\s\-]+/).filter((w: string) => w.length > 2);
      let sharedWords = 0;
      for (const w of tNameParts) {
         if (bNameParts.includes(w)) sharedWords++;
      }
      const matchName = sharedWords >= 2 || (!!tName && !!bName && (bName.includes(tName) || tName.includes(bName)));

      const bGrossAmt = Number(b.amt || b.camt || 0);
      const bNetAmt = bGrossAmt - Number(b.chrgs || 0);
      const tAmtGross = t.amount + (t.stampDutyAmount || 0) + (t.sttAmount || 0);
      const matchAmt = Math.abs(bNetAmt - t.amount) < 1 || 
                       Math.abs(bGrossAmt - t.amount) < 1 ||
                       Math.abs(bGrossAmt - tAmtGross) < 1;

      const matchUnits = Math.abs(Number(b.qn || b.qty || 0) - t.units) < 0.001;

      if ((matchIsin || matchName) && (matchAmt || matchUnits)) return true;
      return false;
    });

    const existsInScnote1 = (state.scnote1 || []).some((b: any) => {
      // Find voucher to match portfolio
      const v = state.vouchersC1?.find((v: any) => v.vid === b.vid);
      if (v && v.pfolio_id !== undefined && t.portfolioId && String(v.pfolio_id) !== String(t.portfolioId)) return false;
      
      const dt = b.dt || v?.dt;
      const matchDate = (dt || '').substring(0, 10) === t.date;
      if (!matchDate) return false;

      let bIsin = '';
      const am = state.assetMaster.find((a: any) => a.amid === b.amid);
      if (am && am.isin) bIsin = am.isin.toUpperCase();
      if (!bIsin) {
        const samEntry = state.sam.find((s: any) => s.amid === b.amid);
        if (samEntry && samEntry.extstr) bIsin = samEntry.extstr.toUpperCase();
      }

      const tIsin = (t.isin || '').replace(/\s/g, '').toUpperCase();
      const matchIsin = !!tIsin && !!bIsin && bIsin.includes(tIsin);

      const bName = (state.assetNameMap[b.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tName = (t.fundName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bNameParts = (state.assetNameMap[b.amid] || '').toLowerCase().split(/[\s\-]+/).filter((w: string) => w.length > 2);
      const tNameParts = (t.fundName || '').toLowerCase().split(/[\s\-]+/).filter((w: string) => w.length > 2);
      let sharedWords = 0;
      for (const w of tNameParts) {
         if (bNameParts.includes(w)) sharedWords++;
      }
      const matchName = sharedWords >= 2 || (!!tName && !!bName && (bName.includes(tName) || tName.includes(bName)));

      const bGrossAmt = Number(b.amt || 0);
      const bNetAmt = bGrossAmt;
      const tAmtGross = t.amount + (t.stampDutyAmount || 0) + (t.sttAmount || 0);
      const matchAmt = Math.abs(bNetAmt - t.amount) < 1 || 
                       Math.abs(bGrossAmt - t.amount) < 1 ||
                       Math.abs(bGrossAmt - tAmtGross) < 1;

      const matchUnits = Math.abs(Number(b.qn || 0) - t.units) < 0.001;

      if ((matchIsin || matchName) && (matchAmt || matchUnits)) return true;
      return false;
    });

    const exists = existsInBs1 || existsInScnote1;
    return { ...t, isDuplicate: exists };
  });
}

// ── ISIN → AMID RESOLVER ────────────────────────────────────────────────────

async function resolveAmidFromIsin(isin: string, fundName: string): Promise<{ amid: number | null, assetType: number }> {
  let assetType = 60; // Default: Equity MF

  // Heuristic based on fund name
  const ln = fundName.toLowerCase();
  if (ln.includes('liquid') || ln.includes('debt') || ln.includes('bond') || ln.includes('gilt') || ln.includes('credit') || ln.includes('income') || ln.includes('money market')) {
    assetType = 61; // Debt MF
  }

  if (!isin) return { amid: null, assetType };

  // Check asset_master by ISIN
  const { data: byIsin } = await supabase
    .from('asset_master')
    .select('amid, name, asset_type')
    .eq('isin', isin)
    .limit(1);
  if (byIsin && byIsin.length > 0) return { amid: byIsin[0].amid, assetType: byIsin[0].asset_type || assetType };

  // Check sam by extstr (ISIN stored there)
  const { data: bySamIsin } = await supabase
    .from('sam')
    .select('amid, anm, atyp')
    .eq('extstr', isin)
    .limit(1);
  if (bySamIsin && bySamIsin.length > 0) return { amid: bySamIsin[0].amid, assetType: bySamIsin[0].atyp || assetType };

  // Fallback: name search
  const cleanName = fundName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().slice(0, 30);
  const { data: byName } = await supabase
    .from('asset_master')
    .select('amid, name, asset_type')
    .ilike('name', `%${cleanName}%`)
    .limit(1);
  if (byName && byName.length > 0) return { amid: byName[0].amid, assetType: byName[0].asset_type || assetType };

  return { amid: null, assetType };
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function EcasTab({
  portfolios,
  casTrades, setCasTrades,
  casMessage, setCasMessage,
  casImporting, setCasImporting,
  casImportDone, setCasImportDone,
  casImportedVids, setCasImportedVids,
  casPortfolioMap, setCasPortfolioMap,
  ensureAssetLedgerExists,
  forceRefreshDatabase,
  setRefreshKey,
  inputStyle, selectStyle, labelStyle,
}: MfCasTabProps) {

  const casFileRef = useRef<HTMLInputElement>(null);
  const [expandedPans, setExpandedPans] = useState<Set<string>>(new Set());
  const [defaultBankLedger, setDefaultBankLedger] = useState<string>('');
  const [parsedCount, setParsedCount] = useState(0);
  const [casPassword, setCasPassword] = useState<string>(() => {
    try { return localStorage.getItem('wealthcore_cas_pdf_pwd') || ''; } catch { return ''; }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // ── FILE HANDLER ──────────────────────────────────────────────────────────

  const handleCasFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCasMessage('');
    setCasImportDone(false);
    setCasImportedVids([]);
    setCasTrades([]);
    setParsedCount(0);
    setPasswordError('');

    try {
      setCasMessage('📖 Loading PDF parser...');

      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        processTextContent(text);
        return;
      }

      // Load PDF.js dynamically
      const pdfjs: any = await new Promise((resolve, reject) => {
        if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
          const lib = (window as any)['pdfjs-dist/build/pdf'];
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          (window as any).pdfjsLib = lib;
          resolve(lib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });

      setCasMessage('🔍 Extracting text from CAS PDF...');
      const arrayBuffer = await file.arrayBuffer();

      let pdf: any;
      try {
        pdf = await pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          password: casPassword || ''
        }).promise;
        // Password worked — save it
        if (casPassword) {
          try { localStorage.setItem('wealthcore_cas_pdf_pwd', casPassword); } catch {}
        }
        setPasswordError('');
      } catch (pwdErr: any) {
        const isPasswordErr = pwdErr.name === 'PasswordException' ||
          pwdErr.code === 1 ||
          (pwdErr.message || '').toLowerCase().includes('password');
        if (isPasswordErr) {
          setPasswordError(casPassword
            ? '❌ Wrong password — please correct and re-upload the PDF'
            : '🔒 This PDF is password-protected — enter the password above and re-upload');
          setCasMessage('');
          if (casFileRef.current) casFileRef.current.value = '';
          return;
        }
        throw pwdErr;
      }

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let pageText = '';
        let lastY: number | null = null;
        for (const item of (content.items as any[])) {
          if (!item.str?.trim()) continue;
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 3) { pageText += '\n'; }
          pageText += item.str + ' ';
          lastY = y;
        }
        fullText += pageText + ' ';
      }

      processTextContent(fullText);
    } catch (err: any) {
      setCasMessage(`❌ Failed to load CAS: ${err.message}`);
    }
  };

  const processTextContent = (text: string) => {
    setCasMessage('⚙️ Parsing CAS transactions...');

    try {
      let parsed = parseCasText(text);
      // NOTE: checkDuplicates is called AFTER portfolio mapping below so that
      // t.portfolioId is populated and per-portfolio duplicate detection works.

      // Auto-map portfolios: try to match PAN to portfolio investor_name or pan field
      const panMap: Record<string, string> = { ...casPortfolioMap };
      const uniquePans = [...new Set(parsed.map(t => t.pan))];

      for (const pan of uniquePans) {
        if (panMap[pan]) continue;
        // Try matching by PAN in acmac1 or portfolios
        const matched = portfolios.find((p: any) => {
          const pName = (p.investorName || p.name || '').toLowerCase();
          // Try exact PAN match in portfolio data
          return (p.pan && p.pan.toUpperCase() === pan) ||
                 (p.investor_name && p.investor_name.toUpperCase().includes(pan));
        });
        if (matched) panMap[pan] = String(matched.id);
      }
      setCasPortfolioMap(panMap);

      // Apply saved mappings
      const mappings = JSON.parse(localStorage.getItem('wealthcore_cas_mapping') || '{}');
      
      // First pass: resolve the best portfolioId for each PAN based on localStorage
      for (const pan of uniquePans) {
        if (!panMap[pan]) {
          const tradeWithMapping = parsed.find(t => t.pan === pan && mappings[`${t.investorName || ''}_${pan}`]);
          if (tradeWithMapping) {
            panMap[pan] = mappings[`${tradeWithMapping.investorName || ''}_${pan}`].portfolioId;
          }
        }
      }

      const mapped = parsed.map(t => {
         return {
           ...t,
           portfolioId: panMap[t.pan] || '',
         };
      });

      // Run duplicate check NOW — portfolioId is populated so per-portfolio filtering works correctly
      const withDupeCheck = checkDuplicates(mapped);

      setParsedCount(withDupeCheck.length);
      setCasTrades(withDupeCheck);
      setCasMessage(`✅ Parsed ${withDupeCheck.length} transactions from CAS. Review and map portfolios below, then click Import.`);
    } catch (err: any) {
      setCasMessage(`❌ Parse error: ${err.message}`);
    }

    if (casFileRef.current) casFileRef.current.value = '';
  };

  // ── IMPORT FUNCTION ───────────────────────────────────────────────────────

  const commitCasImport = async () => {
    const selected = casTrades.filter(t => t.selected && !t.isDuplicate && t.portfolioId);
    if (selected.length === 0) {
      alert('No trades selected to import!');
      return;
    }

    setCasImporting(true);
    setCasMessage('🔄 Resolving assets and creating vouchers...');
    const importedVids: number[] = [];

    try {
      const voucherDataList: any[] = [];
      const amidCache = new Map<string, { amid: number | null, assetType: number }>();
      const ledgerCache = new Map<string, number>();

      const getCachedLedger = async (aId: number, name: string, pfId: number, aType: number) => {
        const key = `${aId}_${pfId}`;
        if (ledgerCache.has(key)) return ledgerCache.get(key)!;
        const id = await ensureAssetLedgerExists(aId, name, pfId, aType);
        ledgerCache.set(key, id);
        return id;
      };

      for (const trade of selected) {
        const pf = portfolios.find((p: any) => String(p.id) === String(trade.portfolioId));
        if (!pf) continue;
        const acid = pf.accountId || null;

        // Resolve AMID from ISIN or name
        let amid = trade.amid;
        let assetType = 60; // Default to equity
        
        // Always run the heuristic to get the proper asset type, even if amid exists.
        const ln = trade.fundName.toLowerCase();
        if (ln.includes('liquid') || ln.includes('debt') || ln.includes('bond') || ln.includes('gilt') || ln.includes('credit') || ln.includes('income') || ln.includes('money market')) {
          assetType = 61; // Debt MF
        }

        if (!amid) {
          const cacheKey = `${trade.isin}_${trade.fundName}`;
          let resolved = amidCache.get(cacheKey);
          if (!resolved) {
            resolved = await resolveAmidFromIsin(trade.isin, trade.fundName);
            amidCache.set(cacheKey, resolved);
          }
          amid = resolved.amid;
          if (resolved.assetType) assetType = resolved.assetType;

          if (!amid) {
            // Create a hash-based ID from ISIN
            let hash = 0;
            for (let i = 0; i < trade.isin.length; i++) {
              hash = (hash << 5) - hash + trade.isin.charCodeAt(i);
              hash = hash & hash;
            }
            amid = 600000000 + Math.abs(hash % 100000000);
          }
        }

        // Ensure asset ledger exists in acmac1 (using cache)
        const assetLedgerId = await getCachedLedger(amid, trade.fundName, Number(trade.portfolioId), assetType);
        
        // CRITICAL FIX: The ledger ID created in acmac1 becomes the actual AMID for the voucher!
        // Otherwise, duplicate checks fail because the hash AMID is not found in assetNameMap.
        amid = assetLedgerId;

        // Get bank ledger for this account
        const ledgers = getStoredLedgers(acid);
        const bankLedger = ledgers.find((l: any) =>
          l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('unassigned')
        ) || ledgers.find((l: any) => l.name.toLowerCase().includes('cash')) || ledgers[0];
        const bankLedgerId = defaultBankLedger || (bankLedger ? String(bankLedger.id) : null);

        if (!bankLedgerId) {
          console.warn(`No bank ledger found for portfolio ${trade.portfolioId}, skipping trade`);
          continue;
        }

        const amount = trade.amount;
        let lines: any[] = [];
        let voucherType = 'journal';
        let narr = `${trade.narration} | Folio: ${trade.folio}`;

        // Find or fallback suspense ledger for switches
        let suspenseLedger = ledgers.find((l: any) => l.name.toLowerCase().includes('suspense') || l.name.toLowerCase().includes('clearing'));
        let suspenseLedgerId = suspenseLedger ? Number(suspenseLedger.id) : null;
        if (!suspenseLedgerId) {
          // If no suspense ledger, create "MF Suspense A/c" under Current Assets
          suspenseLedgerId = await getCachedLedger(999999999, 'MF Suspense A/c', Number(trade.portfolioId), 40); // 40 = current assets or similar
        }

        if (trade.type === 'purchase') {
          lines = [
            { ledgerId: assetLedgerId, debit: amount, credit: 0, quantity: trade.units, price: trade.price },
            { ledgerId: Number(bankLedgerId), debit: 0, credit: amount },
          ];
          if (trade.stampDutyAmount) {
             // Purchase total paid from bank includes stamp duty
             lines[1].credit += trade.stampDutyAmount;
             // Stamp duty is added to the asset cost
             lines[0].debit += trade.stampDutyAmount;
          }
          voucherType = 'purchase';
        } else if (trade.type === 'switch_in') {
          // Dr MF Fund / Cr Suspense
          lines = [
            { ledgerId: assetLedgerId, debit: amount, credit: 0, quantity: trade.units, price: trade.price },
            { ledgerId: suspenseLedgerId, debit: 0, credit: amount },
          ];
          if (trade.stampDutyAmount) {
             // Stamp duty increases the amount drawn from suspense and added to asset cost
             lines[1].credit += trade.stampDutyAmount;
             lines[0].debit += trade.stampDutyAmount;
          }
          voucherType = 'journal';
        } else if (trade.type === 'redemption') {
          lines = [
            { ledgerId: Number(bankLedgerId), debit: amount, credit: 0 },
            { ledgerId: assetLedgerId, debit: 0, credit: amount, quantity: trade.units, price: trade.price },
          ];
          if (trade.sttAmount) {
             let feeLedger = ledgers.find((l: any) => l.name.toLowerCase().includes('stt'));
             let feeLedgerId = feeLedger ? Number(feeLedger.id) : null;
             if (!feeLedgerId) feeLedgerId = await getCachedLedger(900000001, 'STT MFs', Number(trade.portfolioId), 80);
             
             // The amount from CAS is the NET amount hitting the bank.
             // STT was deducted from the gross asset value.
             lines[1].credit += trade.sttAmount;
             lines.push({ ledgerId: feeLedgerId, debit: trade.sttAmount, credit: 0 });
          }
          voucherType = 'sale';
        } else if (trade.type === 'switch_out') {
          // Dr Suspense / Cr MF Fund
          lines = [
            { ledgerId: suspenseLedgerId, debit: amount, credit: 0 },
            { ledgerId: assetLedgerId, debit: 0, credit: amount, quantity: trade.units, price: trade.price },
          ];
          if (trade.sttAmount) {
             let feeLedger = ledgers.find((l: any) => l.name.toLowerCase().includes('stt'));
             let feeLedgerId = feeLedger ? Number(feeLedger.id) : null;
             if (!feeLedgerId) feeLedgerId = await getCachedLedger(900000001, 'STT MFs', Number(trade.portfolioId), 80);
             
             // The amount from CAS is the NET amount transferred to the suspense account.
             // STT was deducted from the gross asset value.
             lines[1].credit += trade.sttAmount;
             lines.push({ ledgerId: feeLedgerId, debit: trade.sttAmount, credit: 0 });
          }
          voucherType = 'journal';
        } else if (trade.type === 'dividend') {
          // Dr Bank / Cr Dividend Income (use bank for both temporarily → contra)
          lines = [
            { ledgerId: Number(bankLedgerId), debit: amount, credit: 0 },
            { ledgerId: assetLedgerId, debit: 0, credit: amount },
          ];
          voucherType = 'receipt';
          narr = `Dividend: ${trade.fundName} | Folio: ${trade.folio}`;
        }

        if (lines.length === 0) continue;

        voucherDataList.push({
          accountId: acid,
          portfolioId: trade.portfolioId,
          date: trade.date,
          narration: narr,
          type: voucherType,
          lines,
          assetId: amid,
          quantity: trade.units,
          price: trade.price,
          amount,
        });
      }

      // Use bulk insert for performance
      if (voucherDataList.length > 0) {
        // We need to capture the next vid before bulk insert
        const { data: maxVid } = await supabase
          .from('vouchersc1')
          .select('vid')
          .order('vid', { ascending: false })
          .limit(1);
        const startVid = (maxVid?.[0]?.vid || 0) + 1;

        for (const data of voucherDataList) {
          await createVoucher(data);
        }

        // Track imported VIDs for orange highlight
        const { data: newVids } = await supabase
          .from('vouchersc1')
          .select('vid')
          .gte('vid', startVid)
          .order('vid', { ascending: true });
        if (newVids) {
          importedVids.push(...newVids.map((v: any) => v.vid));
        }
      }

      setCasImportedVids(importedVids);

      // Mark as imported in localStorage for orange highlight persistence
      try {
        const stored = JSON.parse(localStorage.getItem('wealthcore_orange_vids') || '[]');
        const merged = [...new Set([...stored, ...importedVids])];
        localStorage.setItem('wealthcore_orange_vids', JSON.stringify(merged));
      } catch {}

      await forceRefreshDatabase();
      setRefreshKey(k => k + 1);

      setCasImportDone(true);
      setCasMessage(`✅ Imported ${voucherDataList.length} MF transactions successfully! ${importedVids.length} vouchers created. (highlighted in orange in ledger)`);

      // Deselect imported trades
      setCasTrades(casTrades.map(t => t.selected ? { ...t, isDuplicate: true, selected: false } : t));
    } catch (err: any) {
      setCasMessage(`❌ Import failed: ${err.message}`);
    } finally {
      setCasImporting(false);
    }
  };

  // ── GROUP BY PAN ──────────────────────────────────────────────────────────

  const uniquePans = [...new Set(casTrades.map(t => t.pan))];
  const selectedCount = casTrades.filter(t => t.selected && !t.isDuplicate).length;
  const duplicateCount = casTrades.filter(t => t.isDuplicate).length;

  const togglePan = (pan: string) => {
    setExpandedPans(prev => {
      const next = new Set(prev);
      if (next.has(pan)) next.delete(pan);
      else next.add(pan);
      return next;
    });
  };

  const updateTrade = (id: number, key: string, val: any) => {
    setCasTrades(casTrades.map(t => t.id === id ? { ...t, [key]: val } : t));
  };

  const updateAllPan = (pan: string, key: string, val: any) => {
    setCasTrades(casTrades.map(t => t.pan === pan ? { ...t, [key]: val } : t));
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '32px' }}>📊</span>
            Demat eCAS Import
          </h1>
          <p style={{ color: '#64748b', marginTop: '6px', fontSize: '14px' }}>
            Import from CAMS / KFintech Consolidated Account Statement (CAS PDF or text file)
          </p>
        </div>

        {casImportDone && (
          <div style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', border: '1px solid #ea580c', borderRadius: '12px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={18} color="#ea580c" />
            <span style={{ fontWeight: 700, color: '#ea580c', fontSize: '14px' }}>Import complete — orange rows in ledger</span>
          </div>
        )}
      </div>

      {/* Password input */}
      <div style={{
        background: '#fff',
        border: passwordError ? '2px solid #ef4444' : '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#374151' }}>PDF Password</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Usually PAN or date of birth (e.g. ABCDE1234F or 01-Jan-1990)</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter PDF password..."
              value={casPassword}
              onChange={e => {
                setCasPassword(e.target.value);
                setPasswordError('');
                try { localStorage.setItem('wealthcore_cas_pdf_pwd', e.target.value); } catch {}
              }}
              style={{
                ...inputStyle,
                paddingRight: '40px',
                borderColor: passwordError ? '#ef4444' : '#e2e8f0',
                background: passwordError ? '#fef2f2' : '#fff',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '0',
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {casPassword && (
            <button
              type="button"
              onClick={() => { setCasPassword(''); setPasswordError(''); try { localStorage.removeItem('wealthcore_cas_pdf_pwd'); } catch {} }}
              style={{ padding: '8px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>
        {passwordError && (
          <div style={{ width: '100%', fontSize: '13px', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            {passwordError}
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div style={{
        border: '2px dashed #fb923c',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
        marginBottom: '28px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
        onClick={() => casFileRef.current?.click()}
      >
        <input ref={casFileRef} type="file" accept=".pdf,.txt" style={{ display: 'none' }} onChange={handleCasFile} />
        <Upload size={40} color="#ea580c" style={{ marginBottom: '12px' }} />
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', marginBottom: '8px' }}>
          Click to upload CAS PDF / Text file
        </div>
        <div style={{ fontSize: '13px', color: '#9a3412' }}>
          {casPassword
            ? `🔑 Password set — PDF will be decrypted automatically`
            : 'Enter password above first if your PDF is password-protected'}
        </div>
      </div>

      {/* Status Message */}
      {casMessage && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: casMessage.startsWith('❌') ? '#fef2f2' : casMessage.startsWith('✅') ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${casMessage.startsWith('❌') ? '#fca5a5' : casMessage.startsWith('✅') ? '#86efac' : '#fb923c'}`,
          color: casMessage.startsWith('❌') ? '#dc2626' : casMessage.startsWith('✅') ? '#16a34a' : '#9a3412',
          fontWeight: 600, fontSize: '14px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          {casMessage.startsWith('❌') ? <AlertTriangle size={16} /> : casMessage.startsWith('✅') ? <CheckCircle size={16} /> : <RefreshCw size={16} />}
          {casMessage}
        </div>
      )}

      {/* Default Bank Ledger selector & Global Actions */}
      {casTrades.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={labelStyle}>Default Bank / Counter Ledger</label>
              <select
                value={defaultBankLedger}
                onChange={e => setDefaultBankLedger(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- Auto-detect from portfolio --</option>
                {(state.acmac1 || []).filter((l: any) => !l.is_group && (
                  l.name?.toLowerCase().includes('bank') ||
                  l.name?.toLowerCase().includes('cash')
                )).map((l: any) => (
                  <option key={l.id} value={String(l.id)}>{l.name} (ID: {l.id})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setCasTrades(casTrades.map(t => ({ ...t, selected: true })))}
                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
              >
                <CheckSquare size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Select All
              </button>
              <button
                onClick={() => setCasTrades(casTrades.map(t => ({ ...t, selected: false })))}
                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
              >
                <Square size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Deselect All
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ textAlign: 'center', background: '#fff7ed', border: '1px solid #fb923c', borderRadius: '8px', padding: '8px 16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ea580c' }}>{parsedCount}</div>
                <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 600 }}>Total</div>
              </div>
              <div style={{ textAlign: 'center', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{selectedCount}</div>
                <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>Selected</div>
              </div>
              <div style={{ textAlign: 'center', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{duplicateCount}</div>
                <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>Duplicates</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grouped by PAN */}
      {uniquePans.map(pan => {
        const panTrades = casTrades.filter(t => t.pan === pan);
        const investorName = panTrades[0]?.investorName || pan;
        const portfolioId = panTrades[0]?.portfolioId || '';
        const isExpanded = expandedPans.has(pan) || casTrades.length < 20;
        const panSelected = panTrades.filter(t => t.selected && !t.isDuplicate).length;
        const isUnmapped = !portfolioId; // No portfolio selected yet

        return (
          <div key={pan} style={{
            border: isUnmapped ? '2px solid #fbbf24' : '1px solid #e2e8f0',
            borderRadius: '12px',
            marginBottom: '16px',
            overflow: 'hidden'
          }}>
            {/* PAN Header */}
            <div style={{
              background: isUnmapped
                ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                : 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
            }} onClick={() => togglePan(pan)}>
              {isExpanded ? <ChevronUp size={18} color={isUnmapped ? '#d97706' : '#ea580c'} /> : <ChevronDown size={18} color={isUnmapped ? '#d97706' : '#ea580c'} />}
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 800, color: isUnmapped ? '#92400e' : '#9a3412', fontSize: '15px' }}>{investorName}</span>
                <span style={{ marginLeft: '12px', background: isUnmapped ? '#d97706' : '#ea580c', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>{pan}</span>
                <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '13px' }}>{panTrades.length} transactions ({panSelected} selected)</span>
                {isUnmapped && (
                  <span style={{ marginLeft: '10px', background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                    ⚠️ Map to portfolio!
                  </span>
                )}
              </div>

              {/* Portfolio mapping */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                <label style={{ ...labelStyle, margin: 0, whiteSpace: 'nowrap', fontSize: '12px' }}>Map to Portfolio:</label>
                <select
                  value={portfolioId}
                  onChange={e => {
                    const val = e.target.value;
                    // Update portfolioId first, then re-run duplicate check with the updated ids
                    const updated = casTrades.map(t =>
                      (t.pan === pan)
                        ? { ...t, portfolioId: val }
                        : t
                    );
                    // Re-check duplicates now that portfolioId is updated
                    setCasTrades(checkDuplicates(updated));
                    // Save to localStorage
                    const mappings = JSON.parse(localStorage.getItem('wealthcore_cas_mapping') || '{}');
                    mappings[`${investorName}_${pan}`] = { ...mappings[`${investorName}_${pan}`], portfolioId: val };
                    localStorage.setItem('wealthcore_cas_mapping', JSON.stringify(mappings));
                    setCasPortfolioMap({ ...casPortfolioMap, [pan]: val });
                  }}
                  style={{ ...selectStyle, width: '200px', fontSize: '13px', padding: '6px 10px' }}
                >
                  <option value="">-- Select Portfolio --</option>
                  {portfolios.map((p: any) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name || p.portfolioName || `Portfolio ${p.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="checkbox"
                checked={panTrades.every(t => t.selected || t.isDuplicate)}
                onChange={e => updateAllPan(pan, 'selected', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ea580c' }}
                onClick={e => e.stopPropagation()}
                title="Select/deselect all transactions for this investor"
              />
            </div>

            {/* Transactions table */}
            {isExpanded && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>✓</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Fund</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Type</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Units</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Folio</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panTrades.map((trade, idx) => {
                      const isNew = casImportedVids.length > 0; // after import, all become orange
                      const rowBg = trade.isDuplicate ? '#fef2f2'
                        : isNew && casImportedVids.length > 0 ? 'rgba(234,88,12,0.08)'
                        : idx % 2 === 0 ? '#fff' : '#f8fafc';
                      const borderLeft = trade.isDuplicate ? '3px solid #fca5a5'
                        : casImportedVids.length > 0 && !trade.isDuplicate ? '3px solid #ea580c'
                        : '3px solid transparent';

                      return (
                        <tr key={trade.id} style={{ borderBottom: '1px solid #f1f5f9', background: rowBg, borderLeft }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {trade.isDuplicate ? (
                              <span title="Duplicate - already in database" style={{ color: '#ef4444', fontSize: '16px' }}>⊘</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={trade.selected}
                                onChange={e => updateTrade(trade.id, 'selected', e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: '#ea580c' }}
                              />
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {trade.date}
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: '250px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px', lineHeight: '1.3' }}>
                              {trade.fundName}
                            </div>
                            {trade.isin && (
                              <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>{trade.isin}</div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: trade.type === 'purchase' || trade.type === 'switch_in' ? '#dcfce7'
                                : trade.type === 'redemption' || trade.type === 'switch_out' ? '#fef2f2'
                                : '#fef9c3',
                              color: trade.type === 'purchase' || trade.type === 'switch_in' ? '#16a34a'
                                : trade.type === 'redemption' || trade.type === 'switch_out' ? '#dc2626'
                                : '#ca8a04',
                            }}>
                              {trade.type === 'purchase' ? '↓ BUY'
                                : trade.type === 'redemption' ? '↑ SELL'
                                : trade.type === 'switch_in' ? '⇄ SWITCH IN'
                                : trade.type === 'switch_out' ? '⇄ SWITCH OUT'
                                : trade.type === 'dividend' ? '💰 DIV'
                                : trade.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: trade.type === 'purchase' || trade.type === 'switch_in' ? '#16a34a' : '#dc2626' }}>
                            ₹{trade.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                            {trade.price.toFixed(4)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                            {trade.units.toFixed(3)}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>
                            {trade.folio}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {trade.isDuplicate ? (
                              <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>DUPE</span>
                            ) : trade.selected ? (
                              <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>✓ NEW</span>
                            ) : (
                              <span style={{ background: '#f1f5f9', color: '#94a3b8', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>SKIP</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Import Button */}
      {casTrades.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px', paddingBottom: '40px' }}>
          <button
            onClick={() => { setCasTrades([]); setCasMessage(''); setCasImportDone(false); }}
            style={{ padding: '12px 24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Trash2 size={16} />
            Clear
          </button>
          <button
            onClick={commitCasImport}
            disabled={casImporting || selectedCount === 0}
            style={{
              padding: '14px 36px',
              background: casImporting || selectedCount === 0 ? '#94a3b8' : 'linear-gradient(135deg, #ea580c, #f97316)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 800,
              color: '#fff',
              cursor: casImporting || selectedCount === 0 ? 'not-allowed' : 'pointer',
              boxShadow: casImporting || selectedCount === 0 ? 'none' : '0 6px 20px rgba(234,88,12,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
            }}
          >
            {casImporting ? (
              <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</>
            ) : (
              <><CheckCircle size={16} /> Import {selectedCount} MF Transactions</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
