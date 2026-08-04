const fs = require('fs');
let code = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

const asyncResolve = `  const resolveAssetAsync = async (symbol: string, isin?: string) => {
    let matched = resolveAsset(symbol, isin);
    if (!matched && isin) {
      const { data } = await supabase.from('asset_master').select('*').eq('isin', isin).limit(1);
      if (data && data.length > 0) return data[0];
    }
    return matched;
  };

  const extractCharges`;

code = code.replace('  const extractCharges', asyncResolve);

const oldProcess = `const processCnPdfText = (text: string, filename: string = "") => {`;
const newProcess = `const processCnPdfText = async (text: string, filename: string = "") => {`;
code = code.replace(oldProcess, newProcess);

code = code.replace(/parseZerodhaPdf\(text, autoSelectedPortfolio, filename\);/g, 'await parseZerodhaPdf(text, autoSelectedPortfolio, filename);');
code = code.replace(/parseRkGlobalPdf\(text, autoSelectedPortfolio, filename\);/g, 'await parseRkGlobalPdf(text, autoSelectedPortfolio, filename);');
code = code.replace(/parseDhanPdf\(text, autoSelectedPortfolio, filename\);/g, 'await parseDhanPdf(text, autoSelectedPortfolio, filename);');
code = code.replace(/parseMiraePdf\(text, autoSelectedPortfolio, filename\);/g, 'await parseMiraePdf(text, autoSelectedPortfolio, filename);');
code = code.replace(/processCnPdfText\(fullText, file\.name\);/g, 'await processCnPdfText(fullText, file.name);');

code = code.replace(/const parseZerodhaPdf = \(text:/, 'const parseZerodhaPdf = async (text:');
code = code.replace(/const parseRkGlobalPdf = \(text:/, 'const parseRkGlobalPdf = async (text:');
code = code.replace(/const parseDhanPdf = \(text:/, 'const parseDhanPdf = async (text:');
code = code.replace(/const parseMiraePdf = \(text:/, 'const parseMiraePdf = async (text:');

// Inside parseMiraePdf only
const oldMatched = `const matched = resolveAsset(name, isin);`;
const newMatched = `const matched = await resolveAssetAsync(name, isin);`;
code = code.replace(oldMatched, newMatched);

// Replace resolveAsset for other parsers just in case they have a simple loop or map
// Wait, if parseZerodhaPdf uses map(), `await` inside map doesn't work correctly without Promise.all.
// Since the user is ONLY having trouble with Mirae, and parseMiraePdf uses a for-loop, it will work safely.
// For Zerodha, Dhan, and RKGlobal, I'll leave them as resolveAsset (synchronous) for now to prevent breaking `lines.map(...)`.
// Actually, I'll just check if they use map or a for loop. If they use map, I should not blindly replace `resolveAsset`.

fs.writeFileSync('src/pages/ImportPage.tsx', code);
console.log('Made parsers async');
