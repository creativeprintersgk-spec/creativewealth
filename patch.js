const fs = require('fs');
let text = fs.readFileSync('src/services/priceService.ts', 'utf8');

text = text.replace('const path = /v8/finance/chart/$' + '{encodeURIComponent(idx.symbol)}?interval=1d&range=1d;', 
  'const sid = idx.symbol === \\'^NSEI\\' ? \\'.NSEI\\' : \\'.BSESN\\';\\n      const path = /quotes?sids=$' + '{sid};');
  
text = text.replace('/api/yahoo$' + '{path}', '/api/tt$' + '{path}');
text = text.replace('https://query1.finance.yahoo.com$' + '{path}', 'https://quotes-api.tickertape.in$' + '{path}');

const repl = const quote = json?.data?.[0];
      if (!quote) continue;
      const price = quote.price ?? 0;
      const prev  = quote.c ?? price;
      const change     = parseFloat((price - prev).toFixed(2));
      const change_pct = prev > 0 ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
      
      results.push;
      
text = text.replace(/const meta = json\?\.chart.*?results\.push/s, repl);

fs.writeFileSync('src/services/priceService.ts', text);
