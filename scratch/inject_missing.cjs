const fs = require('fs');
const t = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');
const i = t.indexOf('// MProfit DB Import States');
const snippet = `
  const [mapColumn, setMapColumn] = React.useState<Record<string, string>>({});
  const [topPortfolioId, setTopPortfolioId] = React.useState<string>('');
  const [topCnDate, setTopCnDate] = React.useState<string>('');
  const [cnDate, setCnDate] = React.useState<string>('');
  const [sttLedgerId, setSttLedgerId] = React.useState<number | null>(null);
  const [otherLedgerId, setOtherLedgerId] = React.useState<number | null>(null);
  const toggleSelectAllCn = () => {};
  const setHideDuplicatesCn = () => {};
`;
fs.writeFileSync('src/pages/ImportPage.tsx', t.slice(0, i + 28) + snippet + t.slice(i + 28));
console.log('Injected missing variables');
