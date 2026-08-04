const line = "1100000000 09:15:00 1100000000 09:15:00 RELIANCE EQ B NSE 10 2500.00";
const tokens = line.split(/\s+/).filter(t => t.trim() !== '');
const exchIdx = tokens.findIndex(t => t === 'NSE' || t === 'BSE');
const typeIdx = exchIdx - 1;
const nameTokens = tokens.slice(0, typeIdx).filter(t => 
  !/^[\d:\-\/]+$/.test(t) && 
  !/^[A-Z0-9]{15,}$/.test(t) && 
  !/^(EQ|BE|BZ|SM|ST)$/i.test(t)
);
console.log(nameTokens);
