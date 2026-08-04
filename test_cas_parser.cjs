const fs = require('fs');
const pdfjs = require('./node_modules/pdfjs-dist/legacy/build/pdf.js');
pdfjs.GlobalWorkerOptions.workerSrc = '';
const data = new Uint8Array(fs.readFileSync('C:/Users/Admin/Desktop/CAS A.pdf'));

const MONTHS = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};

function parseDate(r) {
  const p = r.trim().split('-');
  return p.length === 3 ? `${p[2]}-${MONTHS[p[1].toLowerCase().slice(0,3)] || '01'}-${p[0].padStart(2,'0')}` : '';
}

function cleanNum(s) {
  const neg = s.includes('(');
  const n = parseFloat(s.replace(/[,()\s]/g, '')) || 0;
  return neg ? -n : n;
}

function extractFundName(line) {
  // Remove code prefix: "GDFCCG - " or "GD 340 - "
  const ac = line.replace(/^[A-Z0-9\s]{2,12}-\s*/, '');
  // Remove "(Non - Demat)..." and "- ISIN..." onwards
  return ac.replace(/\s*\(\s*Non[\s\S]*$/i, '').replace(/\s*-\s*ISIN[\s\S]*$/i, '').trim();
}

pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise.then(async (pdf) => {
  const lines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let curLine = '', lastY = null;
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(curLine.trim()); curLine = ''; }
      curLine += item.str + ' ';
      lastY = y;
    }
    if (curLine.trim()) lines.push(curLine.trim());
  }

  const TX_KW = /purchase|redemption|switch|sip|idcw|dividend|repurchase|subscription/i;
  const reTx = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+([\(\d,.]+)\s+([\d,.]+)\s+([\(\d,.]+)\s+(.+)/;
  const rePan = /PAN:\s*([A-Z]{5}\d{4}[A-Z])\s+KYC:\s*(?:OK|NA)/;
  const reIsin = /ISIN\s*:\s*(INF\s*[\w\s]{5,15})/i;
  const reFolio = /Folio No:\s*([\d\/\s]+)/i;

  let curPan = '', curName = '', curFund = '', curIsin = '', curFolio = '', expectingName = false;
  const results = [];

  for (const line of lines) {
    // PAN
    const pm = line.match(rePan);
    if (pm) { curPan = pm[1]; expectingName = false; continue; }

    // ISIN + fund name (same line)
    const im = line.match(reIsin);
    if (im) {
      curIsin = im[1].replace(/\s/g, '').toUpperCase();
      curFund = extractFundName(line);
      continue;
    }

    // Folio
    if (/^Folio No:/i.test(line)) {
      const fm = line.match(reFolio);
      if (fm) curFolio = fm[1].trim().replace(/\s+/g, '');
      const sameLine = line.replace(/^Folio No:\s*[\d\/\s]+/i, '').trim();
      if (sameLine && !/^Nominee/i.test(sameLine) && /^[A-Z]/.test(sameLine)) {
        curName = sameLine; expectingName = false;
      } else {
        expectingName = true;
      }
      continue;
    }

    // Investor name (line after Folio No)
    if (expectingName) {
      const isName = /^[A-Z][A-Za-z\s&().]+$/.test(line) && line.length > 3;
      const skip = /^(Nominee|Opening|Consolidated|Date|Page|\d{2}-[A-Za-z])/i.test(line);
      if (isName && !skip) { curName = line.trim(); expectingName = false; }
      else if (/^(Nominee|Opening)/i.test(line)) { expectingName = false; }
    }

    // Transaction
    const tx = line.match(reTx);
    if (tx && curPan && curFund && TX_KW.test(tx[5])) {
      const desc = tx[5].trim();
      const type = /switch in/i.test(desc) ? 'switch_in'
        : /switch out/i.test(desc) ? 'switch_out'
        : /purchase|sip|net purchase|subscription/i.test(desc) ? 'purchase'
        : /redemption/i.test(desc) ? 'redemption' : 'other';
      if (type === 'other') continue;
      results.push({ pan: curPan, name: curName || curPan, fund: curFund, date: parseDate(tx[1]), type, amount: Math.abs(cleanNum(tx[2])) });
    }
  }

  console.log('=== ALL PARSED TRANSACTIONS ===');
  results.forEach(r => console.log(`${r.pan} | ${r.name} | ${r.fund.substring(0,40)} | ${r.date} | ${r.type} | Rs.${r.amount}`));
  console.log('\nTotal:', results.length);

  // Group by PAN+name
  const groups = {};
  results.forEach(r => {
    const key = r.pan + '|' + r.name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  console.log('\n=== BY INVESTOR ===');
  Object.entries(groups).forEach(([k, txs]) => {
    console.log(`\n${k} (${txs.length} transactions)`);
    txs.forEach(t => console.log(`  ${t.date} ${t.type} Rs.${t.amount} [${t.fund.substring(0,30)}]`));
  });

}).catch(e => console.error('ERROR:', e.message));
