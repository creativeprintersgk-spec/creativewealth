const fs = require('fs');

const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

const start = code.indexOf('const parseMiraePdf = async (text: string, activePfId: string = selectedPortfolio, filename: string = "") => {');
const end = code.indexOf('const processCnPdfText = async (text: string, filename: string = "") => {');

const replacement = `const parseMiraePdf = async (text: string, activePfId: string = selectedPortfolio, filename: string = "") => {
    const resolvedDate = extractCnDate(text, cnDate);
    const resolvedCnNo = extractCnNo(text, filename);
    if (resolvedDate) setCnDate(resolvedDate);
    if (resolvedCnNo) setCnNo(resolvedCnNo);

    let stt = 0;
    let other = 0;

    const sttMatch = text.match(/(?:Securities Transaction Tax|STT)[\\s\\S]{1,50}?\\(Rs\\.\\)[\\s]*([\\d,]+\\.\\d{2})/i) || text.match(/(?:Securities Transaction Tax|STT)[^\\d]*([\\d,]+\\.\\d{2})/i);
    if (sttMatch) stt = parseFloat(sttMatch[1].replace(/,/g, ''));

    const payInOutMatch = text.match(/PAY IN[\\s\\S]{1,50}?OBLIGATION[^\\d]*([\\d,]+\\.\\d{2})/i) || text.match(/PAY IN \\/ PAY OUT OBLIGATION[^\\d]*([\\d,]+\\.\\d{2})/i);
    const netAmountMatch = text.match(/Net Amount (?:Receivable|Payable)[^\\d]*([\\d,]+\\.\\d{2})/i);

    if (payInOutMatch && netAmountMatch) {
      const payInOut = parseFloat(payInOutMatch[1].replace(/,/g, ''));
      const netAmount = parseFloat(netAmountMatch[1].replace(/,/g, ''));
      const totalCharges = Math.abs(payInOut - netAmount);
      other = Math.max(0, Number((totalCharges - stt).toFixed(2)));
    } else {
      const fallback = extractCharges(text);
      stt = fallback.stt || stt;
      other = Number(((fallback.brokerage || 0) + (fallback.gst || 0) + (fallback.stamp || 0) + (fallback.transCharges || 0) + (fallback.other || 0)).toFixed(2));
    }

    setCnCharges({ stt, other, brokerage: 0, gst: 0, stamp: 0, transCharges: 0 });

    const lines = text.split('\\n');
    const parsedTrades: any[] = [];
    let idCounter = 1;
    let currentGroupTrades: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.toUpperCase().startsWith('ISIN:')) {
        const isinMatch = trimmed.match(/ISIN:\\s*(IN[A-Z0-9]{10})/i);
        if (isinMatch && currentGroupTrades.length > 0) {
          const isin = isinMatch[1].toUpperCase();
          for (const t of currentGroupTrades) {
            const matched = await resolveAssetAsync(t._symbol, isin);
            t.assetName = matched?.name || matched?.anm || t._symbol;
            t.amid = matched?.amid || -1;
            const isDuplicate = isDuplicateTrade(
              { amid: t.amid, quantity: t.quantity, price: t.price, type: t.type },
              Number(activePfId),
              resolvedDate
            );
            t.selected = !isDuplicate;
            delete t._symbol;
            parsedTrades.push(t);
          }
          currentGroupTrades = [];
        }
        continue;
      }

      const hasExchange = trimmed.includes('NSE') || trimmed.includes('BSE');
      if (!hasExchange) continue;

      const tokens = trimmed.split(/\\s+/).filter(t => t);
      const exchIdx = tokens.findIndex(t => t === 'NSE' || t === 'BSE');
      if (exchIdx < 1) continue;

      const typeIdx = tokens.findIndex((t, i) => i > exchIdx && /^(BUY|SELL|B|S)$/i.test(t));
      if (typeIdx === -1) continue;

      const typeToken = tokens[typeIdx].toUpperCase();
      const type = (typeToken === 'S' || typeToken === 'SELL') ? 'Sell' : 'Buy';

      const qtyStr = tokens[typeIdx + 1];
      const priceStr = tokens[typeIdx + 2];

      const quantity = parseInt((qtyStr || '').replace(/,/g, '')) || 0;
      const price = parseFloat((priceStr || '').replace(/,/g, '')) || 0;

      if (quantity <= 0 || price <= 0) continue;

      const nameTokens = tokens.slice(exchIdx + 1, typeIdx).filter(t => 
        !['-', 'M', 'A', 'EQ', 'BE', 'BZ', 'SM', 'ST'].includes(t.toUpperCase())
      );
      const name = nameTokens.join(' ').trim();

      currentGroupTrades.push({
        _symbol: name,
        id: idCounter++,
        portfolioId: activePfId,
        type,
        quantity,
        price,
        gross: quantity * price,
        date: resolvedDate,
        brokerage: 0
      });
    }

    for (const t of currentGroupTrades) {
      const matched = await resolveAssetAsync(t._symbol, '');
      t.assetName = matched?.name || matched?.anm || t._symbol;
      t.amid = matched?.amid || -1;
      const isDuplicate = isDuplicateTrade(
        { amid: t.amid, quantity: t.quantity, price: t.price, type: t.type },
        Number(activePfId),
        resolvedDate
      );
      t.selected = !isDuplicate;
      delete t._symbol;
      parsedTrades.push(t);
    }

    if (parsedTrades.length > 0) {
      setCnTrades(parsedTrades);
    } else {
      setCnTrades([{ id: 1, selected: true, portfolioId: activePfId, assetName: '', amid: -1, type: 'Buy', quantity: 0, price: 0, gross: 0, date: resolvedDate, brokerage: 0 }]);
      alert('Could not auto-parse Mirae Asset PDF. Please fill the trades manually.');
    }
  };

  `;

code = code.substring(0, start) + replacement + code.substring(end);
fs.writeFileSync(file, code);
console.log('Fixed ImportPage.tsx');
