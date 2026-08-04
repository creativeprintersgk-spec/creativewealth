const text = `NCL-Cash   NCL-F&O   NET TOTAL  Pay in/Pay out obligation (₹)   (20419.25)   0.00   (20419.25)  Taxable value of Supply (Brokerage) (₹) 2   (0.01)   (0.01)  Exchange transaction charges (₹) 4   (0.69)   (0.69)  Clearing charges (₹)  CGST (@9% of Brok, SEBI, Trans & Clearing Charges) (₹) 3  SGST (@9% of Brok, SEBI, Trans & Clearing Charges) (₹) 3  IGST (@18% of Brok, SEBI, Trans & Clearing Charges) (₹) 3   (0.13)   (0.13)  Securities transaction tax (₹)   (20.00)   (20.00)  SEBI turnover fees (₹)   (0.02)   (0.02)  Stamp duty (₹)   (3.00)   (3.00)  Net amount receivable/(payable by client) ( ₹ )   (20443.10)   0.00   (20443.10)`;

const get = (...patterns) => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseFloat(m[1].replace(/,/g, '')) || 0;
  }
  return 0;
};

const cgstMatch = text.match(/CGST[\s\S]{1,80}?Amount \([^)]+\)[\s]*([\d,]+\.\d{2})/i) || text.match(/CGST.*?(?:Amount.*?|)([\d,]+\.\d{2})/i);
const cgst = cgstMatch ? parseFloat(cgstMatch[1].replace(/,/g, '')) : 0;

const sgstMatch = text.match(/SGST[\s\S]{1,80}?Amount \([^)]+\)[\s]*([\d,]+\.\d{2})/i) || text.match(/SGST.*?(?:Amount.*?|)([\d,]+\.\d{2})/i);
const sgst = sgstMatch ? parseFloat(sgstMatch[1].replace(/,/g, '')) : 0;

const igstMatch = text.match(/IGST[\s\S]{1,80}?Amount \([^)]+\)[\s]*([\d,]+\.\d{2})/i) || text.match(/IGST.*?(?:Amount.*?|)([\d,]+\.\d{2})/i);
const igst = igstMatch ? parseFloat(igstMatch[1].replace(/,/g, '')) : 0;

const gstBrokerage = get(/GST on Brokerage[^\d]*([\d,]+\.\d{2})/i);
const gstSum = cgst + sgst + igst + gstBrokerage;

const sebiMatch = text.match(/SEBI Turnover[\s\S]{1,60}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i) || text.match(/SEBI Turnover Fee.*?(?:[\d,]+\.\d{2})/i);
const sebi = get(/SEBI Turnover[\s\S]{1,60}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /SEBI Turnover[^\d]*([\d,]+\.\d{2})/i);
const ipft = get(/IPFT CONTRIBUTION[\s\S]{1,60}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /IPFT CONTRIBUTION[^\d]*([\d,]+\.\d{2})/i);

const stt = get(/(?:Securities Transaction Tax|STT)[\s\S]{1,50}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /(?:Securities Transaction Tax|STT)[^\d]*([\d,]+\.\d{2})/i);
const brokerage = get(/Taxable Value of Supply \(Brokerage\)[\s\S]{1,50}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /Brokerage[^\d]*([\d,]+\.\d{2})/i, /Commission[^\d]*([\d,]+\.\d{2})/i);
const stamp = get(/Stamp Duty[\s\S]{1,50}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /Stamp(?:Duty|Charges)[^\d]*([\d,]+\.\d{2})/i);
const transCharges = get(/Taxable Value of Supply \(Exchange Transaction Charges\)[\s\S]{1,50}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /(?:Exchange Transaction|Exchange transaction charges|Transaction Charges|Regulatory Charges)[\s\S]{1,50}?(?:\(Rs\.?\)|\(₹\))[\s\d]*\(*([\d,]+\.\d{2})/i, /(?:Exchange Transaction Charges|Transaction Charges|Regulatory Charges)[^\d]*([\d,]+\.\d{2})/i);

console.log({
  stt,
  brokerage,
  gst: Number(gstSum.toFixed(2)),
  stamp,
  transCharges,
  other: Number((sebi + ipft).toFixed(2))
});
