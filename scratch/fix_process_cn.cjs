const fs = require('fs');
const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

const start = code.indexOf('const processCnPdfText = async (text: string, filename: string = "") => {');
const end = code.indexOf('const handleAddCnTradeRow = () => {');

const replacement = `const processCnPdfText = async (text: string, filename: string = "") => {
    let autoSelectedPortfolio = selectedPortfolio;
    let detectedPan = "";
    let detectedName = "";

    const panMatch = text.match(/(?:PAN|PAN No|PAN NUMBER|Permanent Account Number)[\\s:]*([A-Z]{5}[0-9]{4}[A-Z])/i)
                  || text.match(/\\b([A-Z]{5}[0-9]{4}[A-Z])\\b/);
                  
    if (panMatch) {
      detectedPan = panMatch[1].toUpperCase();
      let matchedPf = portfolios.find(p => p.pan && p.pan.toUpperCase() === detectedPan);
      
      if (!matchedPf) {
        const nameMatch = text.match(/Dear\\s+([A-Z\\s]+),/i) || text.match(/Name of the Client[\\s:]+([A-Z\\s]+)/i) || text.match(/Name[\\s:]+([A-Z\\s]+)/i) || text.match(/Client Name[\\s:]+([A-Z\\s]+)/i);
        if (nameMatch) {
          detectedName = nameMatch[1].trim().replace(/\\s+/g, ' ').toUpperCase();
          const cleanName = detectedName.replace(/ MR\\.| MRS\\.| MS\\./g, '').trim();
          
          matchedPf = portfolios.find(p => {
             const fn = (p.full_name || '').toUpperCase();
             const iname = (p.investor_name || '').toUpperCase();
             if (fn && (cleanName.includes(fn) || fn.includes(cleanName))) return true;
             if (iname && (cleanName.includes(iname) || iname.includes(cleanName))) return true;
             return false;
          });
          
          if (matchedPf) {
             console.log("Auto-matched portfolio by name", matchedPf.investor_name, "for PAN", detectedPan);
             // Update the database to remember the PAN for next time!
             try {
               await supabase.from('portfolios').update({ pan: detectedPan }).eq('id', matchedPf.id);
             } catch(e) {}
          }
        }
      }

      if (matchedPf) {
        autoSelectedPortfolio = String(matchedPf.id);
        setSelectedPortfolio(autoSelectedPortfolio);
        setOverallMessage(\`Auto-selected portfolio '\${matchedPf.investor_name}' based on PAN/Name match (\${detectedPan})\`);
      } else {
        setOverallMessage(\`Detected PAN \${detectedPan}\${detectedName ? ' ('+detectedName+')' : ''} but could not automatically match to a portfolio.\`);
      }
    }

    const broker = selectedBroker;
    const lowerText = text.toLowerCase();
    const detectedBroker = lowerText.includes("zerodha") ? "zerodha"
      : lowerText.includes("r k global") || lowerText.includes("rkg") ? "rk_global"
      : lowerText.includes("dhan") || lowerText.includes("raise financial") ? "dhan"
      : lowerText.includes("mirae") || lowerText.includes("m.stock") || lowerText.includes("mstock") ? "mirae"
      : broker;

    if (detectedBroker && detectedBroker !== selectedBroker) {
      setSelectedBroker(detectedBroker);
    }

    if (detectedBroker === "zerodha") await parseZerodhaPdf(text, autoSelectedPortfolio, filename);
    else if (detectedBroker === "rk_global") await parseRkGlobalPdf(text, autoSelectedPortfolio, filename);
    else if (detectedBroker === "dhan") await parseDhanPdf(text, autoSelectedPortfolio, filename);
    else if (detectedBroker === "mirae") await parseMiraePdf(text, autoSelectedPortfolio, filename);
    else await parseZerodhaPdf(text, autoSelectedPortfolio, filename);
  };

  `;

code = code.substring(0, start) + replacement + code.substring(end);
fs.writeFileSync(file, code);
console.log('Fixed processCnPdfText');
