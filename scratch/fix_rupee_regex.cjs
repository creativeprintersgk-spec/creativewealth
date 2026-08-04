const fs = require('fs');
const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

const start = code.indexOf('const extractCharges = (text: string) => {');
const end = code.indexOf('const extractCnDate = (text: string, fallback: string): string => {');

const replacement = `const extractCharges = (text: string) => {
    const get = (...patterns: RegExp[]) => {
      for (const p of patterns) {
        const m = text.match(p);
        if (m) return parseFloat(m[1].replace(/,/g, '')) || 0;
      }
      return 0;
    };
    
    // Using Unicode escape \\u20B9 for the Rupee symbol to prevent encoding issues
    const cgst = get(/CGST[\\s\\S]{1,80}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /CGST[^\\d]*([\\d,]+\\.\\d{2})/i);
    const sgst = get(/SGST[\\s\\S]{1,80}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /SGST[^\\d]*([\\d,]+\\.\\d{2})/i);
    const igst = get(/IGST[\\s\\S]{1,80}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /IGST[^\\d]*([\\d,]+\\.\\d{2})/i);
    const gstBrokerage = get(/GST on Brokerage[^\\d]*([\\d,]+\\.\\d{2})/i);
    const gstSum = cgst + sgst + igst + gstBrokerage;

    const sebi = get(/SEBI Turnover[\\s\\S]{1,60}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /SEBI Turnover[^\\d]*([\\d,]+\\.\\d{2})/i);
    const ipft = get(/IPFT CONTRIBUTION[\\s\\S]{1,60}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /IPFT CONTRIBUTION[^\\d]*([\\d,]+\\.\\d{2})/i);

    return {
      stt: get(/(?:Securities Transaction Tax|STT)[\\s\\S]{1,50}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /(?:Securities Transaction Tax|STT)[^\\d]*([\\d,]+\\.\\d{2})/i),
      brokerage: get(/Taxable Value of Supply \\(Brokerage\\)[\\s\\S]{1,50}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /Brokerage[^\\d]*([\\d,]+\\.\\d{2})/i, /Commission[^\\d]*([\\d,]+\\.\\d{2})/i),
      gst: Number(gstSum.toFixed(2)),
      stamp: get(/Stamp Duty[\\s\\S]{1,50}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /Stamp(?:Duty|Charges)[^\\d]*([\\d,]+\\.\\d{2})/i),
      transCharges: get(/Taxable Value of Supply \\(Exchange Transaction Charges\\)[\\s\\S]{1,50}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /(?:Exchange Transaction|Exchange transaction charges|Transaction Charges|Regulatory Charges)[\\s\\S]{1,50}?(?:\\(Rs\\.?\\)|\\(\\u20B9\\))[\\s\\d]*\\(*([\\d,]+\\.\\d{2})/i, /(?:Exchange Transaction Charges|Transaction Charges|Regulatory Charges)[^\\d]*([\\d,]+\\.\\d{2})/i),
      other: Number((sebi + ipft).toFixed(2))
    };
  };

  `;

code = code.substring(0, start) + replacement + code.substring(end);
fs.writeFileSync(file, code);
console.log('Fixed extractCharges with unicode encoding');
