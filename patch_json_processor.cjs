const fs = require('fs');

let content = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

const processCasJsonDataStr = `
  const processCasJsonData = async (casData: any) => {
    const parsedCasTrades: any[] = [];
    let idCounter = 1;

    if (casData.statement_period) {
      setCasStatementPeriod(\`\${casData.statement_period.from} to \${casData.statement_period.to}\`);
    } else {
      setCasStatementPeriod('');
    }

    const normalizeDateToYYYYMMDD = (dateStr: string) => {
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
           return dateStr;
        }
        return new Date(dateStr).toISOString().split('T')[0];
      } catch (e) {
        return dateStr;
      }
    };

    const isDuplicateTrade = (trade: any, pfId: number, tdate: string) => {
       const existing = state.bs1.find((t: any) => 
           t.pfolio_id === pfId && 
           t.amid === trade.amid && 
           t.tdate.startsWith(tdate) && 
           t.ttype === trade.type && 
           Math.abs(t.qty - trade.quantity) < 0.01
       );
       return !!existing;
    };

    // Find pf_id based on logic in original
    const findPortfolioIdByPanOrInvestor = (pan: string, investorName: string, folio: string) => {
      if (userFolioMappings[folio]) return userFolioMappings[folio];
      if (pan) {
        const matchedPf = portfolios.find(p => p.panNumber && p.panNumber.toUpperCase() === pan.toUpperCase());
        if (matchedPf) return String(matchedPf.id);
      }
      return "";
    };

    if (!casData.folios) return;

    for (const folioBlock of casData.folios) {
       const currentFolio = folioBlock.folio;
       const currentPan = folioBlock.PAN || '';
       const currentInvestorName = folioBlock.kyc || '';

       for (const schemeBlock of folioBlock.schemes) {
          const isin = schemeBlock.isin || '';
          let currentScheme = schemeBlock.scheme || '';
          let currentSchemeAmid = -1;

          if (isin) {
             const matched = state.assetMaster.find((a: any) => a.isin === isin) || state.sam.find((s: any) => s.extstr === isin);
             if (matched) {
                 currentScheme = matched.name || matched.anm;
                 currentSchemeAmid = matched.amid;
             } else {
                // Not found locally, we could fetch from mfapi but we'll leave it unknown for now
                try {
                  const res = await fetch(\`https://api.mfapi.in/mf/search?q=\${isin}\`);
                  const data = await res.json();
                  if (data && data.length > 0) {
                     currentScheme = data[0].schemeName;
                  }
                } catch(e){}
             }
          }

          for (const tx of schemeBlock.transactions) {
             // casparser uses 'type' for tx type. e.g. PURCHASE, REDEMPTION
             let txType = (tx.type || '').toUpperCase();
             if (txType.includes('PURCHASE')) txType = 'Buy';
             else if (txType.includes('REDEMPTION') || txType.includes('SELL')) txType = 'Sell';
             else if (txType.includes('SIP')) txType = 'Buy';
             else if (txType.includes('DIVIDEND')) txType = 'Dividend';
             else txType = 'Other';

             if (txType === 'Other') continue;

             const resolvedDate = normalizeDateToYYYYMMDD(tx.date);
             const targetPfId = findPortfolioIdByPanOrInvestor(currentPan, currentInvestorName, currentFolio) || selectedCasPortfolio;
             
             const amount = parseFloat(tx.amount || '0');
             const units = parseFloat(tx.units || '0');
             const nav = parseFloat(tx.nav || '0');

             if (!units || !nav || !amount) continue;

             const isDuplicate = isDuplicateTrade(
               { amid: currentSchemeAmid, quantity: units, price: nav, type: txType },
               Number(targetPfId),
               resolvedDate
             );

             parsedCasTrades.push({
                id: idCounter++,
                selected: !isDuplicate,
                portfolioId: targetPfId,
                folio: currentFolio,
                schemeName: currentScheme,
                schemeAmid: currentSchemeAmid,
                date: resolvedDate,
                type: txType,
                units: Math.abs(units),
                price: nav,
                amount: Math.abs(amount),
                isDuplicate
             });
          }
       }
    }

    setCasTrades(parsedCasTrades);
    setOverallMessage("");
    if (parsedCasTrades.length > 0) setImportComplete(true);
  };
`;

const insertIndex = content.indexOf('const handleCasPdfFileSelect');
content = content.substring(0, insertIndex) + processCasJsonDataStr + '\n  ' + content.substring(insertIndex);

fs.writeFileSync('src/pages/ImportPage.tsx', content);
console.log('Inserted processCasJsonData');
