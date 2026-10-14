/**
 * WealthCore — Client-Side Bank Statement Parser
 * 
 * Supports PDF, CSV, and Excel (XLSX/XLS) bank statements.
 * Runs 100% in the user's browser (zero backend dependency).
 * 
 * Built-in specialized parsers:
 * - IDFC FIRST Bank (both modern PDF layouts with multiline narrations)
 * - Kotak Mahindra Bank (standard layout with serial numbers & wrap narrations)
 * - Generic Fallback (HDFC, ICICI, SBI, Axis, etc.)
 * - CSV & Excel parser (auto-detects columns: Date, Narration, Ref, Dr, Cr, Balance)
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getPdfJsLib } from './contractNoteClientParser';

export interface ParsedBankTransaction {
  id: string; // unique row id
  date: string; // YYYY-MM-DD
  valDate?: string; // YYYY-MM-DD
  narration: string;
  chqRef?: string;
  debit: number; // withdrawal
  credit: number; // deposit
  balance: number;
  rawText?: string;
  // Matching & review state
  selected: boolean;
  targetLedgerId: number | null;
  targetLedgerName: string;
  matchedRuleId?: string;
  matchedRulePattern?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateVoucherId?: number;
  isManuallyAssigned?: boolean;
}

export interface ParsedBankStatement {
  status: 'ok' | 'error';
  bank: 'idfc' | 'kotak' | 'hdfc' | 'icici' | 'sbi' | 'axis' | 'generic';
  bankName: string;
  accountNumber: string;
  ifsc: string;
  customerName: string;
  periodFrom?: string;
  periodTo?: string;
  openingBalance?: number;
  closingBalance?: number;
  totalDebits?: number;
  totalCredits?: number;
  transactions: ParsedBankTransaction[];
  message?: string;
}

// ── Number & Date Helpers ───────────────────────────────────────────────────

export function cleanNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/Rs\.?/gi, '').replace(/[−–]/g, '-').trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1);
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function parseDateToYYYYMMDD(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim().replace(/\//g, '-');

  const monMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // DD-Mon-YYYY or DD Mon YYYY (e.g. 14-Aug-2026 or 17 Aug 2026)
  const m1 = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
  if (m1) {
    const d = m1[1].padStart(2, '0');
    const m = monMap[m1[2].toLowerCase()] || '01';
    let y = m1[3];
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY
  const m2 = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m2) {
    const d = m2[1].padStart(2, '0');
    const m = m2[2].padStart(2, '0');
    let y = m2[3];
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // YYYY-MM-DD
  const m3 = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m3) {
    return `${m3[1]}-${m3[2].padStart(2, '0')}-${m3[3].padStart(2, '0')}`;
  }

  return clean.substring(0, 10);
}

// ── Client-Side Bank Statement PDF Parser ───────────────────────────────────

export async function parseBankStatementPdf(
  buffer: ArrayBuffer | Uint8Array,
  password = ''
): Promise<ParsedBankStatement> {
  const pdfjs = await getPdfJsLib();

  let pdfDoc: any;
  try {
    const byteArr = (buffer as any)?.buffer
      ? new Uint8Array((buffer as any).buffer, (buffer as any).byteOffset || 0, (buffer as any).byteLength || buffer.byteLength)
      : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    const loadingTask = pdfjs.getDocument({
      data: byteArr,
      password: password || undefined
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    const isPwdErr = err?.name === 'PasswordException' ||
      err?.code === 1 ||
      msg.includes('password') ||
      msg.includes('encrypted');
    if (isPwdErr) {
      return {
        status: 'error',
        bank: 'generic',
        bankName: 'Encrypted Statement',
        accountNumber: '',
        ifsc: '',
        customerName: '',
        transactions: [],
        message: password ? 'Incorrect PDF password. Please re-enter your password.' : 'This bank statement is password-protected. Enter the password (e.g. PAN or birthdate) to decrypt.'
      };
    }
    throw new Error('Failed to decrypt or load bank statement PDF: ' + (err?.message || String(err)));
  }

  // Extract all text items with page, x, y coordinates
  const allItems: Array<{ str: string; x: number; y: number; page: number }> = [];
  let page1Text = '';
  let fullText = '';

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    for (const it of (textContent.items as any[])) {
      if (!it.str || !it.str.trim()) continue;
      const cleanStr = it.str.trim();
      allItems.push({
        str: cleanStr,
        x: Math.round(it.transform[4] * 10) / 10,
        y: Math.round(it.transform[5] * 10) / 10,
        page: p
      });
      if (p === 1) page1Text += cleanStr + ' ';
      fullText += cleanStr + ' ';
    }
    if (p === 1) page1Text += '\n';
    fullText += '\n';
  }

  // 1. Bank Identification from Page 1 Header
  let bank: ParsedBankStatement['bank'] = 'generic';
  let bankName = 'Bank Statement';
  let ifsc = '';
  let accountNumber = '';
  let customerName = '';
  let periodFrom = '';
  let periodTo = '';

  const ifscMatch = page1Text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  if (ifscMatch) ifsc = ifscMatch[1].toUpperCase();

  if (/KKBK/i.test(ifsc) || /kotak\s*mahindra/i.test(page1Text) || /kotak\.bank/i.test(fullText)) {
    bank = 'kotak';
    bankName = 'Kotak Mahindra Bank';
  } else if (/IDFB/i.test(ifsc) || /idfc\s*first/i.test(page1Text) || /idfcfirstbank/i.test(page1Text)) {
    bank = 'idfc';
    bankName = 'IDFC FIRST Bank';
  } else if (/HDFC/i.test(ifsc) || /hdfc\s*bank/i.test(page1Text)) {
    bank = 'hdfc';
    bankName = 'HDFC Bank';
  } else if (/ICIC/i.test(ifsc) || /icici\s*bank/i.test(page1Text)) {
    bank = 'icici';
    bankName = 'ICICI Bank';
  } else if (/SBIN/i.test(ifsc) || /state\s*bank\s*of\s*india/i.test(page1Text)) {
    bank = 'sbi';
    bankName = 'State Bank of India';
  } else if (/UTIB/i.test(ifsc) || /axis\s*bank/i.test(page1Text)) {
    bank = 'axis';
    bankName = 'Axis Bank';
  }

  // 2. Account Number Extraction
  const accMatch = page1Text.match(/(?:Account\s*(?:No\.?|Number)|A\/c(?:\s*No\.?)?)\s*[:.\-]?\s*(\d{9,18})/i);
  if (accMatch) {
    accountNumber = accMatch[1];
  } else {
    // Look for isolated digits between 10 and 18 chars
    const candidateAccs = page1Text.match(/\b\d{10,18}\b/g);
    if (candidateAccs && candidateAccs.length > 0) {
      accountNumber = candidateAccs[0];
    }
  }

  // 3. Customer Name Extraction
  const nameMatch = page1Text.match(/(?:Customer\s*Name|Name)\s*[:.\-]?\s*(?:Mr\.?|Ms\.?|Mrs\.?)?\s*([A-Za-z\s]{3,35})/i);
  if (nameMatch) {
    customerName = nameMatch[1].replace(/\s+/g, ' ').trim();
  } else if (bank === 'kotak') {
    // In Kotak, Name is on line right after Account Statement or above Account No
    const kotakNameM = page1Text.match(/Account Statement\s+(?:[0-9A-Za-z\s\-]+)?\s+([A-Za-z\s]{3,35})\s+Account No/i);
    if (kotakNameM) customerName = kotakNameM[1].trim();
  }

  // 4. Period Extraction
  const periodMatch = page1Text.match(/(\d{1,2}[A-Za-z0-9\/\-\s]{7,12})\s+(?:TO|-)\s+(\d{1,2}[A-Za-z0-9\/\-\s]{7,12})/i);
  if (periodMatch) {
    periodFrom = parseDateToYYYYMMDD(periodMatch[1]);
    periodTo = parseDateToYYYYMMDD(periodMatch[2]);
  }

  // 5. Parse Transactions based on Bank
  let txns: ParsedBankTransaction[] = [];
  let openingBalance = 0;
  let closingBalance = 0;

  if (bank === 'idfc') {
    // IDFC FIRST Bank Parser
    txns = parseIdfcTransactions(allItems, pdfDoc.numPages);
    
    // Extract IDFC Opening / Closing balance from summary
    const sumMatch = page1Text.match(/Opening Balance\s+Total Debit\s+Total Credit\s+Closing Balance\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/i);
    if (sumMatch) {
      openingBalance = cleanNum(sumMatch[1]);
      closingBalance = cleanNum(sumMatch[4]);
    } else if (txns.length > 0) {
      closingBalance = txns[txns.length - 1].balance;
    }
  } else if (bank === 'kotak') {
    // Kotak Mahindra Bank Parser
    txns = parseKotakTransactions(allItems, pdfDoc.numPages);
    
    // Extract Kotak Opening Balance
    const obMatch = page1Text.match(/Opening Balance\s+-\s+-\s+-\s+([\d,.]+)/i);
    if (obMatch) openingBalance = cleanNum(obMatch[1]);
    if (txns.length > 0) closingBalance = txns[txns.length - 1].balance;
  } else {
    // Generic Bank Parser
    txns = parseGenericPdfTransactions(allItems, pdfDoc.numPages);
    if (txns.length > 0) closingBalance = txns[txns.length - 1].balance;
  }

  const totalDebits = txns.reduce((s, t) => s + t.debit, 0);
  const totalCredits = txns.reduce((s, t) => s + t.credit, 0);

  return {
    status: 'ok',
    bank,
    bankName,
    accountNumber,
    ifsc,
    customerName,
    periodFrom,
    periodTo,
    openingBalance,
    closingBalance,
    totalDebits: Number(totalDebits.toFixed(2)),
    totalCredits: Number(totalCredits.toFixed(2)),
    transactions: txns
  };
}

// ── Bank Specific Parser: IDFC FIRST Bank ───────────────────────────────────

function parseIdfcTransactions(
  allItems: Array<{ str: string; x: number; y: number; page: number }>,
  numPages: number
): ParsedBankTransaction[] {
  const txns: ParsedBankTransaction[] = [];
  let rowCounter = 1;

  for (let p = 1; p <= numPages; p++) {
    const pageItems = allItems.filter(i => i.page === p);
    // On IDFC statements:
    // Page 1 table begins below y ~ 260.
    // Pages 2, 3, etc. table begins below y ~ 595.
    // Table ends above footer (y ~ 50).
    const tableTop = p === 1 ? 260 : 595;
    const tableBottom = 50;

    const tableItems = pageItems.filter(i => i.y <= tableTop && i.y >= tableBottom);
    if (tableItems.length === 0) continue;

    // Find all transaction date items in Date column (x < 100, format DD-Mon-YYYY)
    const dateItems = tableItems.filter(i => /^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(i.str) && i.x < 100);
    dateItems.sort((a, b) => b.y - a.y); // sort descending (top to bottom)

    for (let idx = 0; idx < dateItems.length; idx++) {
      const curDate = dateItems[idx];
      const prevDateY = idx === 0 ? tableTop : (dateItems[idx - 1].y + curDate.y) / 2;
      const nextDateY = idx === dateItems.length - 1 ? tableBottom : (curDate.y + dateItems[idx + 1].y) / 2;

      // Extract all items in the vertical slice belonging to this transaction
      const bandItems = tableItems.filter(i => i.y <= prevDateY && i.y > nextDateY);
      bandItems.sort((a, b) => b.y - a.y || a.x - b.x);

      let valDate = curDate.str;
      let narrParts: string[] = [];
      let chq = '';
      let dr = 0;
      let cr = 0;
      let bal = 0;

      for (const it of bandItems) {
        if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(it.str) && it.x >= 95 && it.x < 170) {
          valDate = it.str;
        } else if (it.x >= 165 && it.x < 300) {
          narrParts.push(it.str);
        } else if (it.x >= 300 && it.x < 340) {
          chq = (chq + ' ' + it.str).trim();
        } else if (it.x >= 340 && it.x < 420) {
          dr = cleanNum(it.str);
        } else if (it.x >= 420 && it.x < 500) {
          cr = cleanNum(it.str);
        } else if (it.x >= 500) {
          bal = cleanNum(it.str);
        }
      }

      const cleanNarr = narrParts.join(' ').replace(/\s+/g, ' ').trim();

      txns.push({
        id: `idfc_${p}_${rowCounter++}`,
        date: parseDateToYYYYMMDD(curDate.str),
        valDate: parseDateToYYYYMMDD(valDate),
        narration: cleanNarr,
        chqRef: chq,
        debit: dr,
        credit: cr,
        balance: bal,
        selected: true,
        targetLedgerId: null,
        targetLedgerName: '',
        isDuplicate: false
      });
    }
  }

  return txns;
}

// ── Bank Specific Parser: Kotak Mahindra Bank ───────────────────────────────

function parseKotakTransactions(
  allItems: Array<{ str: string; x: number; y: number; page: number }>,
  numPages: number
): ParsedBankTransaction[] {
  const txns: ParsedBankTransaction[] = [];
  let rowCounter = 1;

  // Group items per page into sorted horizontal lines
  const rows: Array<{ page: number; y: number; items: Array<{ str: string; x: number }> }> = [];

  for (let p = 1; p <= numPages; p++) {
    const pageItems = allItems.filter(i => i.page === p).sort((a, b) => b.y - a.y || a.x - b.x);
    const yGroups: Array<{ page: number; y: number; items: Array<{ str: string; x: number }> }> = [];

    for (const it of pageItems) {
      let g = yGroups.find(g => Math.abs(g.y - it.y) <= 4);
      if (!g) {
        g = { page: p, y: it.y, items: [] };
        yGroups.push(g);
      }
      g.items.push(it);
    }
    for (const g of yGroups) {
      g.items.sort((a, b) => a.x - b.x);
      rows.push(g);
    }
  }

  let inTable = false;
  let curTxn: ParsedBankTransaction | null = null;

  for (const r of rows) {
    const rowText = r.items.map(i => i.str).join(' ');

    if (rowText.includes('Withdrawal (Dr.)') && rowText.includes('Deposit (Cr.)')) {
      inTable = true;
      continue;
    }
    if (rowText.includes('End of Statement') || rowText.includes('Account Summary') || rowText.includes('TDS is applicable')) {
      inTable = false;
      if (curTxn) { txns.push(curTxn); curTxn = null; }
      continue;
    }
    if (!inTable) continue;

    // Kotak rows start with serial number '#' (item 0) and Date (item 1)
    const first = r.items[0];
    const second = r.items[1];
    const isTxnStart = first && /^\d+$/.test(first.str) && second && /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(second.str);

    if (isTxnStart) {
      if (curTxn) txns.push(curTxn);

      const dateStr = second.str;
      let descParts: string[] = [];
      let chqParts: string[] = [];
      let dr = 0;
      let cr = 0;
      let bal = 0;

      for (let i = 2; i < r.items.length; i++) {
        const it = r.items[i];
        if (it.x >= 100 && it.x < 275) {
          descParts.push(it.str);
        } else if (it.x >= 275 && it.x < 350) {
          chqParts.push(it.str);
        } else if (it.x >= 350 && it.x < 425) {
          dr = cleanNum(it.str);
        } else if (it.x >= 425 && it.x < 495) {
          cr = cleanNum(it.str);
        } else if (it.x >= 495) {
          bal = cleanNum(it.str);
        }
      }

      curTxn = {
        id: `kotak_${r.page}_${rowCounter++}`,
        date: parseDateToYYYYMMDD(dateStr),
        valDate: parseDateToYYYYMMDD(dateStr),
        narration: descParts.join(' '),
        chqRef: chqParts.join(' ').trim(),
        debit: dr,
        credit: cr,
        balance: bal,
        selected: true,
        targetLedgerId: null,
        targetLedgerName: '',
        isDuplicate: false
      };
    } else if (curTxn) {
      // Continuation lines for narration or cheque reference
      if (rowText.includes('Page ') || rowText.includes('Statement Generated') || rowText.includes('Savings Account Transactions')) {
        continue;
      }
      for (const it of r.items) {
        if (it.x >= 100 && it.x < 275) {
          curTxn.narration = (curTxn.narration + ' ' + it.str).trim();
        } else if (it.x >= 275 && it.x < 350) {
          curTxn.chqRef = ((curTxn.chqRef || '') + ' ' + it.str).trim();
        }
      }
    }
  }

  if (curTxn) txns.push(curTxn);

  return txns;
}

// ── Generic Fallback PDF Parser ─────────────────────────────────────────────

function parseGenericPdfTransactions(
  allItems: Array<{ str: string; x: number; y: number; page: number }>,
  numPages: number
): ParsedBankTransaction[] {
  const txns: ParsedBankTransaction[] = [];
  let rowCounter = 1;

  // Group items by line
  const rows: Array<{ page: number; y: number; items: Array<{ str: string; x: number }> }> = [];
  for (let p = 1; p <= numPages; p++) {
    const pageItems = allItems.filter(i => i.page === p).sort((a, b) => b.y - a.y || a.x - b.x);
    const yGroups: Array<{ page: number; y: number; items: Array<{ str: string; x: number }> }> = [];

    for (const it of pageItems) {
      let g = yGroups.find(g => Math.abs(g.y - it.y) <= 4);
      if (!g) {
        g = { page: p, y: it.y, items: [] };
        yGroups.push(g);
      }
      g.items.push(it);
    }
    for (const g of yGroups) {
      g.items.sort((a, b) => a.x - b.x);
      rows.push(g);
    }
  }

  let curTxn: ParsedBankTransaction | null = null;

  for (const r of rows) {
    // Check if line contains a standard transaction date (DD/MM/YYYY, DD-MM-YYYY, DD-Mon-YYYY)
    const dateItem = r.items.find(i => 
      /^\d{1,2}[\/\-](?:[A-Za-z]{3}|\d{1,2})[\/\-]\d{2,4}$/.test(i.str) ||
      /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(i.str)
    );

    if (dateItem && r.items.length >= 3) {
      if (curTxn) txns.push(curTxn);

      const nums = r.items.filter(i => /^-?[\d,]+(?:\.\d{2})?$/.test(i.str.replace(/[₹Rs]/gi, '').trim())).map(i => cleanNum(i.str));
      const nonNums = r.items.filter(i => i !== dateItem && !/^-?[\d,]+(?:\.\d{2})?$/.test(i.str.replace(/[₹Rs]/gi, '').trim())).map(i => i.str);

      let dr = 0, cr = 0, bal = 0;
      if (nums.length >= 2) {
        bal = nums[nums.length - 1];
        const amt = nums[nums.length - 2];
        const lineText = r.items.map(i => i.str).join(' ').toLowerCase();
        if (lineText.includes('dr') || lineText.includes('debit') || lineText.includes('withdrawal')) {
          dr = Math.abs(amt);
        } else {
          cr = Math.abs(amt);
        }
      }

      curTxn = {
        id: `gen_${r.page}_${rowCounter++}`,
        date: parseDateToYYYYMMDD(dateItem.str),
        valDate: parseDateToYYYYMMDD(dateItem.str),
        narration: nonNums.join(' ').trim(),
        debit: dr,
        credit: cr,
        balance: bal,
        selected: true,
        targetLedgerId: null,
        targetLedgerName: '',
        isDuplicate: false
      };
    } else if (curTxn) {
      // Narration wrap
      const text = r.items.map(i => i.str).join(' ');
      if (!/Page\s+\d/i.test(text) && !/Statement/i.test(text)) {
        curTxn.narration = (curTxn.narration + ' ' + text).trim();
      }
    }
  }

  if (curTxn) txns.push(curTxn);

  return txns;
}

// ── Client-Side CSV & Excel Bank Statement Parser ───────────────────────────

export function parseBankStatementCsvOrExcel(
  fileContent: string | ArrayBuffer,
  fileName: string
): ParsedBankStatement {
  let rawRows: any[][] = [];

  const isExcel = /\.(?:xlsx|xls)$/i.test(fileName);
  if (isExcel) {
    const workbook = XLSX.read(fileContent, { type: typeof fileContent === 'string' ? 'binary' : 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as any[][];
  } else {
    // CSV
    const csvStr = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const parsed = Papa.parse(csvStr, { skipEmptyLines: true });
    rawRows = parsed.data as any[][];
  }

  if (rawRows.length === 0) {
    return {
      status: 'error',
      bank: 'generic',
      bankName: 'CSV/Excel Statement',
      accountNumber: '',
      ifsc: '',
      customerName: '',
      transactions: [],
      message: 'The uploaded file contains no data.'
    };
  }

  // 1. Locate Header Row
  let headerIdx = -1;
  let dateCol = -1;
  let descCol = -1;
  let refCol = -1;
  let drCol = -1;
  let crCol = -1;
  let balCol = -1;

  for (let r = 0; r < Math.min(25, rawRows.length); r++) {
    const row = rawRows[r].map(c => String(c).toLowerCase().trim());
    const dIdx = row.findIndex(c => c.includes('date') && !c.includes('value'));
    const nIdx = row.findIndex(c => c.includes('narration') || c.includes('particular') || c.includes('description') || c.includes('remark'));
    const drIdx = row.findIndex(c => c.includes('debit') || c.includes('withdrawal') || c.includes('dr'));
    const crIdx = row.findIndex(c => c.includes('credit') || c.includes('deposit') || c.includes('cr'));

    if (dIdx !== -1 && (nIdx !== -1 || drIdx !== -1 || crIdx !== -1)) {
      headerIdx = r;
      dateCol = dIdx;
      descCol = nIdx;
      drCol = drIdx;
      crCol = crIdx;
      refCol = row.findIndex(c => c.includes('chq') || c.includes('ref') || c.includes('cheque') || c.includes('utr'));
      balCol = row.findIndex(c => c.includes('balance') || c.includes('closing'));
      break;
    }
  }

  if (headerIdx === -1 || dateCol === -1) {
    return {
      status: 'error',
      bank: 'generic',
      bankName: 'CSV/Excel Statement',
      accountNumber: '',
      ifsc: '',
      customerName: '',
      transactions: [],
      message: 'Could not find standard table headers (Date, Description, Debit/Credit). Please ensure column headers exist.'
    };
  }

  // 2. Metadata from rows above header
  let accountNumber = '';
  let customerName = '';
  let bankName = 'Bank Statement';
  const headerText = rawRows.slice(0, headerIdx).map(r => r.join(' ')).join(' ');
  const accM = headerText.match(/(?:Account\s*(?:No\.?|Number)|A\/c(?:\s*No\.?)?)\s*[:.\-]?\s*(\d{9,18})/i);
  if (accM) accountNumber = accM[1];

  // 3. Parse Data Rows
  const txns: ParsedBankTransaction[] = [];
  let rowId = 1;

  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rawDate = String(row[dateCol] || '').trim();
    if (!rawDate) continue;

    const parsedDate = parseDateToYYYYMMDD(rawDate);
    if (!parsedDate || !/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) continue;

    const narration = descCol !== -1 ? String(row[descCol] || '').trim() : '';
    const chqRef = refCol !== -1 ? String(row[refCol] || '').trim() : '';
    const dr = drCol !== -1 ? cleanNum(row[drCol]) : 0;
    const cr = crCol !== -1 ? cleanNum(row[crCol]) : 0;
    const bal = balCol !== -1 ? cleanNum(row[balCol]) : 0;

    if (dr === 0 && cr === 0 && !narration) continue;

    txns.push({
      id: `csv_${rowId++}`,
      date: parsedDate,
      valDate: parsedDate,
      narration,
      chqRef,
      debit: dr,
      credit: cr,
      balance: bal,
      selected: true,
      targetLedgerId: null,
      targetLedgerName: '',
      isDuplicate: false
    });
  }

  const totalDebits = txns.reduce((s, t) => s + t.debit, 0);
  const totalCredits = txns.reduce((s, t) => s + t.credit, 0);

  return {
    status: 'ok',
    bank: 'generic',
    bankName,
    accountNumber,
    ifsc: '',
    customerName,
    totalDebits: Number(totalDebits.toFixed(2)),
    totalCredits: Number(totalCredits.toFixed(2)),
    transactions: txns
  };
}
