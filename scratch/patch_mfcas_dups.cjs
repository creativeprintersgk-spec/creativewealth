const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/pages/MfCasTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldCheck = `    const exists = (state.bs1 || []).some((b: any) => {`;

const newCheck = `    const existsInBs1 = (state.bs1 || []).some((b: any) => {
      if (b.pfid !== undefined && t.portfolioId && String(b.pfid) !== String(t.portfolioId)) return false;
      const matchDate = (b.dt || '').substring(0, 10) === t.date;
      if (!matchDate) return false;

      let bIsin = '';
      const am = state.assetMaster.find((a: any) => a.amid === b.amid);
      if (am && am.isin) bIsin = am.isin.toUpperCase();
      if (!bIsin) {
        const samEntry = state.sam.find((s: any) => s.amid === b.amid);
        if (samEntry && samEntry.extstr) bIsin = samEntry.extstr.toUpperCase();
      }

      const tIsin = (t.isin || '').replace(/\\s/g, '').toUpperCase();
      const matchIsin = !!tIsin && !!bIsin && bIsin.includes(tIsin);

      const bName = (state.assetNameMap[b.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tName = (t.fundName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bNameParts = (state.assetNameMap[b.amid] || '').toLowerCase().split(/[\\s\\-]+/).filter((w: string) => w.length > 2);
      const tNameParts = (t.fundName || '').toLowerCase().split(/[\\s\\-]+/).filter((w: string) => w.length > 2);
      let sharedWords = 0;
      for (const w of tNameParts) {
         if (bNameParts.includes(w)) sharedWords++;
      }
      const matchName = sharedWords >= 2 || (!!tName && !!bName && (bName.includes(tName) || tName.includes(bName)));

      const bGrossAmt = Number(b.amt || b.camt || 0);
      const bNetAmt = bGrossAmt - Number(b.chrgs || 0);
      const tAmtGross = t.amount + (t.stampDutyAmount || 0) + (t.sttAmount || 0);
      const matchAmt = Math.abs(bNetAmt - t.amount) < 1 || 
                       Math.abs(bGrossAmt - t.amount) < 1 ||
                       Math.abs(bGrossAmt - tAmtGross) < 1;

      const matchUnits = Math.abs(Number(b.qn || b.qty || 0) - t.units) < 0.001;

      if ((matchIsin || matchName) && (matchAmt || matchUnits)) return true;
      return false;
    });

    const existsInScnote1 = (state.scnote1 || []).some((b: any) => {
      // Find voucher to match portfolio
      const v = state.vouchersc1?.find((v: any) => v.vid === b.vid);
      if (v && v.pfolio_id !== undefined && t.portfolioId && String(v.pfolio_id) !== String(t.portfolioId)) return false;
      
      const dt = b.dt || v?.dt;
      const matchDate = (dt || '').substring(0, 10) === t.date;
      if (!matchDate) return false;

      let bIsin = '';
      const am = state.assetMaster.find((a: any) => a.amid === b.amid);
      if (am && am.isin) bIsin = am.isin.toUpperCase();
      if (!bIsin) {
        const samEntry = state.sam.find((s: any) => s.amid === b.amid);
        if (samEntry && samEntry.extstr) bIsin = samEntry.extstr.toUpperCase();
      }

      const tIsin = (t.isin || '').replace(/\\s/g, '').toUpperCase();
      const matchIsin = !!tIsin && !!bIsin && bIsin.includes(tIsin);

      const bName = (state.assetNameMap[b.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tName = (t.fundName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bNameParts = (state.assetNameMap[b.amid] || '').toLowerCase().split(/[\\s\\-]+/).filter((w: string) => w.length > 2);
      const tNameParts = (t.fundName || '').toLowerCase().split(/[\\s\\-]+/).filter((w: string) => w.length > 2);
      let sharedWords = 0;
      for (const w of tNameParts) {
         if (bNameParts.includes(w)) sharedWords++;
      }
      const matchName = sharedWords >= 2 || (!!tName && !!bName && (bName.includes(tName) || tName.includes(bName)));

      const bGrossAmt = Number(b.amt || 0);
      const bNetAmt = bGrossAmt;
      const tAmtGross = t.amount + (t.stampDutyAmount || 0) + (t.sttAmount || 0);
      const matchAmt = Math.abs(bNetAmt - t.amount) < 1 || 
                       Math.abs(bGrossAmt - t.amount) < 1 ||
                       Math.abs(bGrossAmt - tAmtGross) < 1;

      const matchUnits = Math.abs(Number(b.qn || 0) - t.units) < 0.001;

      if ((matchIsin || matchName) && (matchAmt || matchUnits)) return true;
      return false;
    });

    const exists = existsInBs1 || existsInScnote1;`;

const checkRegex = /const exists = \(state\.bs1 \|\| \[\]\)\.some\(\(b: any\) => \{[\s\S]*?return false;\s*\}\);/g;
if (content.match(checkRegex)) {
  content = content.replace(checkRegex, newCheck);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Patched checkDuplicates in MfCasTab.tsx');
} else {
  console.log('❌ Could not find checkDuplicates regex in MfCasTab.tsx');
}
