/**
 * WealthCore — Client-Side Broker Contract Note Parser
 * 
 * Runs 100% in the user's browser (zero external server dependency, works seamlessly on Vercel & localhost).
 * Uses PDF.js for client-side decryption & layout-aware text extraction.
 * 
 * Supports PDF, CSV, and HTML formats for:
 * - Zerodha Broking
 * - Groww (Nextbillion Technology)
 * - ICICI Direct (ICICI Securities)
 * - Kotak Securities
 * - HDFC Securities
 * - Motilal Oswal Financial Services
 * - Dhan (Moneylicious Securities)
 * - MStock / Mirae Asset Capital Markets
 * - R K Global
 */

export interface ParsedTrade {
  assetName: string;
  isin: string;
  buyQty: number;
  buyWap: number;
  buyVal: number;
  sellQty: number;
  sellWap: number;
  sellVal: number;
}

export interface ParsedCharges {
  stt: number;
  brokerage: number;
  gst: number;
  stamp: number;
  transCharges: number;
  other: number;
}

export interface ParsedContractNote {
  status: 'ok' | 'error';
  broker: string;
  cnNo: string;
  cnDate: string;
  pan: string;
  trades: ParsedTrade[];
  charges: ParsedCharges;
  finalNet?: number | null;
  message?: string;
}

// Regex Helpers
const PAN_REGEX = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
const ISIN_REGEX = /\b(IN[E|F|A-Z0-9][A-Z0-9]{9})\b/;

function cleanNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/Rs\./gi, '').trim();
  // Handle (123.45) as negative or -123.45
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1);
  }
  s = s.replace(/[−–]/g, '-');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDateStr(text: string): string | null {
  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  if (m1) {
    return `${m1[3]}-${m1[2]}-${m1[1]}`;
  }
  // YYYY-MM-DD
  const m2 = text.match(/\b(\d{4})[/-](\d{2})[/-](\d{2})\b/);
  if (m2) {
    return `${m2[1]}-${m2[2]}-${m2[3]}`;
  }
  // DD Mon YYYY
  const m3 = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]+(\d{4})\b/i);
  if (m3) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const mm = months[m3[2].toLowerCase().slice(0, 3)] || '01';
    const dd = m3[1].padStart(2, '0');
    return `${m3[3]}-${mm}-${dd}`;
  }
  return null;
}

function detectBroker(text: string, filename = ''): string {
  const t = (text + ' ' + filename).toLowerCase();
  if (t.includes('nextbillion') || t.includes('groww')) return 'groww';
  if (t.includes('icici securities') || t.includes('icicidirect') || t.includes('icici')) return 'icici';
  if (t.includes('kotak securities') || t.includes('kotak')) return 'kotak';
  if (t.includes('hdfc securities') || t.includes('hdfcsec') || t.includes('hdfc')) return 'hdfc';
  if (t.includes('motilal oswal') || t.includes('mofsl') || t.includes('motilal')) return 'motilal';
  if (t.includes('moneylicious') || t.includes('dhan')) return 'dhan';
  if (t.includes('mirae asset') || t.includes('mstock') || t.includes('m.stock')) return 'mirae';
  if (t.includes('r k global') || t.includes('r.k. global') || t.includes('rkglobal')) return 'rk_global';
  if (t.includes('zerodha')) return 'zerodha';
  return 'zerodha';
}

function extractPan(text: string): string {
  const kwMatch = text.match(/(?:PAN|Permanent\s+Account\s+Number)[\s:/-]*([A-Z]{5}[0-9]{4}[A-Z]{1})/i);
  if (kwMatch) return kwMatch[1].toUpperCase();
  const all = text.match(PAN_REGEX);
  if (all && all.length > 0) return all[0].toUpperCase();
  return '';
}

function extractCnNumber(text: string): string {
  const patterns = [
    /(?:Contract\s*Note\s*No\.?|CN\s*No\.?|Notice\s*No\.?|Invoice\s*No\.?|Contract\s*No\.?)[\s:/-]*([A-Za-z0-9_/-]{4,30})/i,
    /CNT-[0-9\/\-]+/i,
    /CN[\s:/-]*([A-Za-z0-9_/-]{5,25})/i
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const res = (m[1] || m[0]).trim();
      if (res.length >= 4 && !res.toLowerCase().startsWith('date')) return res;
    }
  }
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `CN-${ymd}`;
}

function extractChargeVal(line: string): number {
  // First look for amount numbers with 2 decimals in parentheses: (43.00), (1.32), (0.25), (3.00), (0.01), (0.04)
  const parenMatches: number[] = [];
  const re = /\(([0-9,]+\.[0-9]{2,4})\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v) && v > 0) parenMatches.push(v);
  }
  if (parenMatches.length > 0) return parenMatches[0];

  // If no parenthesized decimal, look for trailing plain decimal numbers (e.g. Groww/ICICI where charges are written without parentheses)
  const trailingMatches = line.match(/\b([0-9,]+\.[0-9]{2})\b/g);
  if (trailingMatches && trailingMatches.length > 0) {
    const v = parseFloat(trailingMatches[trailingMatches.length - 1].replace(/,/g, ''));
    if (!isNaN(v) && v > 0) return v;
  }

  return 0;
}

function extractCharges(text: string): ParsedCharges {
  const charges: ParsedCharges = {
    stt: 0,
    brokerage: 0,
    gst: 0,
    stamp: 0,
    transCharges: 0,
    other: 0
  };

  const lines = text.split('\n');
  for (const line of lines) {
    // 1. Securities Transaction Tax (STT / CTT)
    if (/Securities\s+transaction\s+tax|\bSTT\b|\bCTT\b/i.test(line)) {
      const v = extractChargeVal(line);
      if (v > 0) charges.stt = v;
    }
    // 2. Stamp Duty
    else if (/Stamp\s+duty/i.test(line)) {
      const v = extractChargeVal(line);
      if (v > 0) charges.stamp = v;
    }
    // 3. Exchange / Transaction charges
    else if (/Exchange\s+transaction\s+charges|Trans(?:action)?\s+charges/i.test(line)) {
      const v = extractChargeVal(line);
      if (v > 0) charges.transCharges = v;
    }
    // 4. Brokerage (Taxable value of supply)
    else if ((/Taxable\s+value\s+of\s+Supply|Brokerage/i.test(line)) && !/of\s+Brok/i.test(line)) {
      const v = extractChargeVal(line);
      if (v > 0) charges.brokerage = v;
    }
    // 5. GST (IGST, CGST, SGST)
    else if (/\b(IGST|CGST|SGST)\b/i.test(line) || /Total\s+GST/i.test(line)) {
      const v = extractChargeVal(line);
      if (v > 0) charges.gst = Number((charges.gst + v).toFixed(2));
    }
    // 6. SEBI / Clearing charges / Other
    else if (/SEBI\s+turnover|SEBI\s+fees|Clearing\s+charges/i.test(line)) {
      const v = extractChargeVal(line);
      if (v > 0) charges.other = Number((charges.other + v).toFixed(2));
    }
  }

  return charges;
}

function extractFinalNet(text: string): number | null {
  const lines = text.split('\n');
  for (const line of lines) {
    if (/Net\s+amount\s+receivable|Net\s+Payable/i.test(line)) {
      let clean = line.replace(/\(\s*₹\s*\)[0-9]*/gi, '').replace(/\(₹\)[0-9]*/gi, '');
      const decMatches = clean.match(/[-+]?[0-9,]+\.[0-9]{2,4}/g);
      if (decMatches && decMatches.length > 0) {
        const val = cleanNum(decMatches[0]);
        if (val > 0) return val;
      }
    }
  }
  return null;
}

// ── In-Browser PDF.js Loader ──────────────────────────────────────────────────
export async function getPdfJsLib(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      import('pdfjs-dist/legacy/build/pdf.mjs').then(resolve).catch(reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      const lib = (window as any)['pdfjs-dist/build/pdf'];
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      (window as any).pdfjsLib = lib;
      resolve(lib);
    };
    script.onerror = (e) => reject(new Error('Failed to load PDF.js engine: ' + String(e)));
    document.head.appendChild(script);
  });
}

// ── Main Client-Side PDF Parser ──────────────────────────────────────────────
export async function parseContractNoteClientPdf(
  buffer: ArrayBuffer | Uint8Array,
  password = '',
  brokerHint = 'auto'
): Promise<ParsedContractNote> {
  const pdfjs = await getPdfJsLib();

  let pdfDoc: any;
  try {
    const loadingTask = pdfjs.getDocument({
      data: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
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
        broker: brokerHint,
        cnNo: '',
        cnDate: '',
        pan: '',
        trades: [],
        charges: { stt: 0, brokerage: 0, gst: 0, stamp: 0, transCharges: 0, other: 0 },
        message: password ? 'Incorrect PDF Password. Please re-enter your PAN in uppercase.' : 'This PDF is password-protected. Enter your PAN to decrypt.'
      };
    }
    throw new Error('Failed to decrypt or load PDF: ' + (err?.message || String(err)));
  }

  // Extract layout-aware lines
  const lines: string[] = [];
  let fullText = '';

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageLine = '';

    for (const item of (content.items as any[])) {
      if (!item.str?.trim()) continue;
      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
        if (pageLine.trim()) {
          lines.push(pageLine.trim());
          fullText += pageLine.trim() + '\n';
        }
        pageLine = '';
      }
      pageLine += item.str + ' ';
      lastY = y;
    }
    if (pageLine.trim()) {
      lines.push(pageLine.trim());
      fullText += pageLine.trim() + '\n';
    }
  }

  const detected = brokerHint !== 'auto' && brokerHint ? brokerHint : detectBroker(fullText);
  const pan = extractPan(fullText);
  const cnNo = extractCnNumber(fullText);
  const cnDate = parseDateStr(fullText) || new Date().toISOString().slice(0, 10);
  const charges = extractCharges(fullText);
  const finalNet = extractFinalNet(fullText);

  const summaryTrades: ParsedTrade[] = [];
  const annexureTrades: ParsedTrade[] = [];

  // Pass 1: Parse Summary Table (Zerodha, Motilal, Kotak, HDFC, Groww)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(/\s+/);
    if (ISIN_REGEX.test(parts[0])) {
      const isin = parts[0].toUpperCase();
      const symbol = parts[1] || 'STOCK';
      const nums = parts.slice(2).map(p => cleanNum(p));

      if (nums.length >= 6) {
        const buyQty = nums[0] || 0;
        const buyWap = nums[1] || 0;
        const buyVal = nums[4] || Math.round(buyQty * buyWap * 100) / 100;

        const sellQty = nums[5] || 0;
        const sellWap = nums[6] || 0;
        const sellVal = nums[9] || Math.round(sellQty * sellWap * 100) / 100;

        if (buyQty > 0 || sellQty > 0) {
          summaryTrades.push({
            assetName: symbol,
            isin,
            buyQty,
            buyWap,
            buyVal: Math.abs(buyVal),
            sellQty,
            sellWap,
            sellVal: Math.abs(sellVal)
          });
        }
      }
    }
  }

  // Pass 2: If no summary table found, parse Trade-by-Trade Annexure
  if (summaryTrades.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isinM = line.match(ISIN_REGEX);
      if (!isinM) continue;
      const isin = isinM[1].toUpperCase();

      // Check standard Indian exchange format: Symbol ... [B|S] [NSE|BSE] Qty GrossRate NetRate NetTotal
      const exchM = line.match(/\b([BS])\s+(NSE|BSE)\s+([0-9\s.,()-]+)/i);
      if (exchM) {
        const isBuy = exchM[1].toUpperCase() === 'B';
        const isSell = exchM[1].toUpperCase() === 'S';
        const nums = exchM[3].split(/\s+/).map(p => cleanNum(p)).filter(n => Math.abs(n) > 0);

        if (nums.length >= 2) {
          const qty = Math.floor(nums[0]);
          const rate = nums[nums.length >= 3 ? 2 : 1] || nums[1] || 0;
          const val = nums[nums.length - 1] || Math.round(qty * rate * 100) / 100;

          const cleaned = line.slice(0, exchM.index).replace(isin, '').trim();
          const words = cleaned.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
          const symbol = words[words.length - 1] ? words[words.length - 1].replace(/-EQ$/i, '').toUpperCase() : 'STOCK';

          if (qty > 0) {
            annexureTrades.push({
              assetName: symbol,
              isin,
              buyQty: isBuy ? qty : 0,
              buyWap: isBuy ? rate : 0,
              buyVal: isBuy ? Math.abs(val) : 0,
              sellQty: isSell ? qty : 0,
              sellWap: isSell ? rate : 0,
              sellVal: isSell ? Math.abs(val) : 0
            });
            continue;
          }
        }
      }

      // Generic trade row fallback (Groww / ICICI Direct / MStock)
      const isBuy = /\b(BUY|B)\b/i.test(line);
      const isSell = /\b(SELL|S)\b/i.test(line);
      const tokens = line.split(/\s+/).map(t => cleanNum(t)).filter(n => Math.abs(n) > 0 && Math.abs(n) < 1000000);

      if (tokens.length >= 2 && (isBuy || isSell)) {
        const cleaned = line.replace(isin, '').replace(/\b(BUY|SELL|B|S|NSE|BSE|EQ|DELIVERY|INTRADAY)\b/gi, ' ');
        const words = cleaned.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
        const symbol = words[0] ? words[0].toUpperCase() : 'STOCK';

        const qty = Math.floor(tokens[0]);
        const rate = tokens[1] || 0;
        const val = tokens[2] || Math.round(qty * rate * 100) / 100;

        if (qty > 0) {
          annexureTrades.push({
            assetName: symbol,
            isin,
            buyQty: isBuy ? qty : 0,
            buyWap: isBuy ? rate : 0,
            buyVal: isBuy ? Math.abs(val) : 0,
            sellQty: isSell ? qty : 0,
            sellWap: isSell ? rate : 0,
            sellVal: isSell ? Math.abs(val) : 0
          });
        }
      }
    }
  }

  // Consolidate trades by ISIN
  const rawTrades = summaryTrades.length > 0 ? summaryTrades : annexureTrades;
  const tradeMap = new Map<string, ParsedTrade>();
  for (const t of rawTrades) {
    const key = t.isin;
    if (!tradeMap.has(key)) {
      tradeMap.set(key, { ...t });
    } else {
      const cur = tradeMap.get(key)!;
      cur.buyQty += t.buyQty;
      cur.buyVal += t.buyVal;
      cur.buyWap = cur.buyQty > 0 ? Number((cur.buyVal / cur.buyQty).toFixed(2)) : 0;

      cur.sellQty += t.sellQty;
      cur.sellVal += t.sellVal;
      cur.sellWap = cur.sellQty > 0 ? Number((cur.sellVal / cur.sellQty).toFixed(2)) : 0;
    }
  }

  const finalTrades = Array.from(tradeMap.values());

  return {
    status: 'ok',
    broker: detected,
    cnNo,
    cnDate,
    pan,
    trades: finalTrades,
    charges,
    finalNet: finalNet !== null ? finalNet : undefined
  };
}

// ── Client-Side CSV / TXT / HTML Parser ───────────────────────────────────────
export function parseContractNoteClientText(
  text: string,
  filename = '',
  brokerHint = 'auto'
): ParsedContractNote {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const detected = brokerHint !== 'auto' && brokerHint ? brokerHint : detectBroker(text, filename);
  const pan = extractPan(text);
  const cnNo = extractCnNumber(text);
  const cnDate = parseDateStr(text) || new Date().toISOString().slice(0, 10);
  const charges = extractCharges(text);
  const finalNet = extractFinalNet(text);

  const rawTrades: ParsedTrade[] = [];

  for (const line of lines) {
    const isinM = line.match(ISIN_REGEX);
    if (!isinM) continue;
    const isin = isinM[1].toUpperCase();

    const isBuy = /\b(BUY|B)\b/i.test(line);
    const isSell = /\b(SELL|S)\b/i.test(line);

    // Split CSV / TSV or whitespace
    const parts = line.includes(',') ? line.split(',') : line.split(/\t|\s+/);
    const nums = parts.map(p => cleanNum(p)).filter(n => Math.abs(n) > 0);

    const cleaned = line.replace(isin, '').replace(/\b(BUY|SELL|B|S|NSE|BSE|EQ)\b/gi, ' ');
    const words = cleaned.split(/[,;\t\s]+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
    const symbol = words[0] ? words[0].toUpperCase() : 'STOCK';

    if (nums.length >= 2 && (isBuy || isSell)) {
      const qty = Math.floor(nums[0]);
      const rate = nums[1] || 0;
      const val = nums[2] || Math.round(qty * rate * 100) / 100;

      rawTrades.push({
        assetName: symbol,
        isin,
        buyQty: isBuy ? qty : 0,
        buyWap: isBuy ? rate : 0,
        buyVal: isBuy ? Math.abs(val) : 0,
        sellQty: isSell ? qty : 0,
        sellWap: isSell ? rate : 0,
        sellVal: isSell ? Math.abs(val) : 0
      });
    }
  }

  // Consolidate
  const tradeMap = new Map<string, ParsedTrade>();
  for (const t of rawTrades) {
    const key = t.isin;
    if (!tradeMap.has(key)) {
      tradeMap.set(key, { ...t });
    } else {
      const cur = tradeMap.get(key)!;
      cur.buyQty += t.buyQty;
      cur.buyVal += t.buyVal;
      cur.buyWap = cur.buyQty > 0 ? Number((cur.buyVal / cur.buyQty).toFixed(2)) : 0;
      cur.sellQty += t.sellQty;
      cur.sellVal += t.sellVal;
      cur.sellWap = cur.sellQty > 0 ? Number((cur.sellVal / cur.sellQty).toFixed(2)) : 0;
    }
  }

  return {
    status: 'ok',
    broker: detected,
    cnNo,
    cnDate,
    pan,
    trades: Array.from(tradeMap.values()),
    charges,
    finalNet: finalNet !== null ? finalNet : undefined
  };
}
