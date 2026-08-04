const fs = require('fs');
const lines = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8').split('\n');

const extractIdxStart = lines.findIndex(l => l.includes('const extractCnNo = (text: string'));
const extractIdxEnd = lines.findIndex((l, i) => i > extractIdxStart && l.includes('};'));
lines.splice(extractIdxStart, extractIdxEnd - extractIdxStart + 1,
  '  const extractCnNo = (text: string, filename: string = ""): string => {',
  '    const m = text.match(/(?:Contract Note No\\.?|CN\\s*No\\.?)\\s*[:\\s]*([A-Z0-9\\/\\-]+)/i)',
  '      || text.match(/(?:Order\\s*Ref\\.?|Confirmation\\s*No\\.?)\\s*[:\\s]*([A-Z0-9\\/\\-]+)/i);',
  '    let cn = m ? m[1].trim() : "";',
  '    if (!cn && filename) {',
  '      const parts = filename.replace(/\\.pdf$/i, "").split("_");',
  '      cn = parts[parts.length - 1];',
  '    }',
  '    return cn;',
  '  };'
);

const miraeIdxStart = lines.findIndex(l => l.includes('const parseMiraePdf'));
const miraeCnMatchIdx = lines.findIndex((l, i) => i > miraeIdxStart && l.includes('const cnNoMatch = text.match'));
if (miraeCnMatchIdx !== -1) {
  lines[miraeCnMatchIdx] = '    const resolvedCnNo = extractCnNo(text, filename);';
  lines[miraeCnMatchIdx + 2] = '    if (resolvedCnNo) setCnNo(resolvedCnNo);';
}

const processIdxStart = lines.findIndex(l => l.includes('const processCnPdfText'));
const processIdxEnd = lines.findIndex((l, i) => i > processIdxStart && l.includes('};'));
lines.splice(processIdxStart, processIdxEnd - processIdxStart + 1,
  '  const processCnPdfText = (text: string, filename: string = "") => {',
  '    let autoSelectedPortfolio = selectedPortfolio;',
  '    const panMatch = text.match(/(?:PAN|PAN No|PAN NUMBER|Permanent Account Number)\\s*[:\\s]*([A-Z]{5}[0-9]{4}[A-Z])/i)',
  '                  || text.match(/\\b([A-Z]{5}[0-9]{4}[A-Z])\\b/);',
  '    if (panMatch) {',
  '      const pan = panMatch[1].toUpperCase();',
  '      const matchedPf = portfolios.find(p => p.pan && p.pan.toUpperCase() === pan);',
  '      if (matchedPf) {',
  '        autoSelectedPortfolio = String(matchedPf.id);',
  '        setSelectedPortfolio(autoSelectedPortfolio);',
  '      }',
  '    }',
  '',
  '    const broker = selectedBroker;',
  '    const lowerText = text.toLowerCase();',
  '    const detectedBroker = lowerText.includes("zerodha") ? "zerodha"',
  '      : lowerText.includes("r k global") || lowerText.includes("rkg") ? "rk_global"',
  '      : lowerText.includes("dhan") || lowerText.includes("raise financial") ? "dhan"',
  '      : lowerText.includes("mirae") || lowerText.includes("m.stock") || lowerText.includes("mstock") ? "mirae"',
  '      : broker;',
  '',
  '    if (detectedBroker && detectedBroker !== selectedBroker) {',
  '      setSelectedBroker(detectedBroker);',
  '    }',
  '',
  '    if (detectedBroker === "zerodha") parseZerodhaPdf(text, autoSelectedPortfolio, filename);',
  '    else if (detectedBroker === "rk_global") parseRkGlobalPdf(text, autoSelectedPortfolio, filename);',
  '    else if (detectedBroker === "dhan") parseDhanPdf(text, autoSelectedPortfolio, filename);',
  '    else if (detectedBroker === "mirae") parseMiraePdf(text, autoSelectedPortfolio, filename);',
  '    else parseZerodhaPdf(text, autoSelectedPortfolio, filename);',
  '  };'
);

const pdfParsingIdx = lines.findIndex(l => l.includes('processCnPdfText(fullText)'));
if (pdfParsingIdx !== -1) {
  lines[pdfParsingIdx] = lines[pdfParsingIdx].replace('processCnPdfText(fullText)', 'processCnPdfText(fullText, file.name)');
}

fs.writeFileSync('src/pages/ImportPage.tsx', lines.join('\n'));
console.log('Successfully patched ImportPage.tsx');
