const fs = require('fs');

const bulkCode = `
export async function createVouchersBulk(dataList: any[]) {
  if (!dataList || dataList.length === 0) return;

  const allVchC1 = [];
  const allTransC1 = [];
  const allBs1 = [];
  const allVch1 = [];
  const allTrans1 = [];
  const allScnote = [];

  let currentVid = await nextVid();
  let currentTransid = await nextTransid();
  let currentTrid = await nextTrid();
  let currentCnid = await nextCnid();

  for (const data of dataList) {
    const linesToValidate = (data.lines || []).filter((l: any) => 
      l.ledgerId && 
      (Number(l.debit) > 0 || Number(l.credit) > 0 || 
       ['bonus', 'split', 'merger', 'demerger'].includes(data.type))
    );

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of linesToValidate) {
      const maid = Number(line.ledgerId);
      if (isNaN(maid) || maid <= 0) {
        throw new Error(\`Cannot create voucher with invalid or missing ledger ID: "\${line.ledgerId}"\`);
      }
      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    }

    const acid = data.accountId ? Number(data.accountId) : null;
    const vid = currentVid++;
    const vtyp = VTYP_MAP[data.type] ?? 5; 

    const vchSrc = data.portfolioId ? 'c' : 't';
    let cnid = data.cnid || -1;

    if (data.isContractNote) {
      cnid = currentCnid++;
      const scnoteRow = {
        cnid,
        pfid: data.portfolioId ? Number(data.portfolioId) : null,
        aty: 50,
        brkrid: data.brokerLedgerId ? Number(data.brokerLedgerId) : 1,
        cnnum: data.cnNo || '',
        billnum: '',
        servtax: data.cnCharges?.gst || 0,
        stmpchrgs: data.cnCharges?.stamp || 0,
        tranchrg: data.cnCharges?.transCharges || 0,
        stt: data.cnCharges?.stt || 0,
        othchrg: data.cnCharges?.other || 0,
        amtdue: data.netPayable || 0,
        dt: data.date,
        isdue: null,
        isspec: null,
        cstr: null
      };
      allScnote.push(scnoteRow);
    }

    const voucherRow = {
      vid,
      acid,
      dt: data.date,
      narr: data.narration || '',
      vtyp,
      pfid: data.portfolioId ? Number(data.portfolioId) : null,
      atype: data.isContractNote ? 50 : null,
      cnid: cnid
    };

    if (vchSrc === 'c') allVchC1.push(voucherRow);
    else allVch1.push(voucherRow);

    const lines = (data.lines || []).filter((l: any) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger'));

    for (const line of lines) {
      const row = {
        transid: currentTransid++,
        vid,
        acid,
        maid: Number(line.ledgerId),
        dramt: Number(line.debit) || 0,
        cramt: Number(line.credit) || 0,
        dt: data.date,
      };
      if (vchSrc === 'c') allTransC1.push(row);
      else allTrans1.push(row);
    }

    let pfid: number | null = null;
    if (data.portfolioId) {
      pfid = Number(data.portfolioId);
      
      const assetLines = (data.lines || []).filter((l: any) => 
        Number(l.ledgerId) >= 100000 || 
        state.acmac1.some((a: any) => String(a.id) === String(l.ledgerId) && [200050, 200051, 200061, 200062].includes(Number(a.parent_id)))
      );

      for (const line of assetLines) {
        let resolvedAmid = Number(line.ledgerId);
        
        const isBuy = (Number(line.debit) > 0);
        const qty = (Number(line.quantity) || 0);
        const price = (Number(line.price) || 0);
        let amt = (Number(line.debit) || Number(line.credit) || 0);

        const asset = state.assetMaster.find((a: any) => a.amid === resolvedAmid);
        const atyid = asset ? asset.asset_type : 50;

        let trty = isBuy ? 20 : 99;
        let trstr = isBuy ? 'Buy' : 'Sell';

        if (data.type === 'dividend') { trty = 62; trstr = 'Dividend Payout'; }
        else if (data.type === 'bonus') { trty = 40; trstr = 'Bonus'; }
        else if (data.type === 'split') { trty = 45; trstr = '*Split'; }
        else if (data.type === 'demerger') { trty = 46; trstr = '*DeMerger'; }
        else if (data.type === 'merger') { trty = 45; trstr = '*Merged'; }
        else if (data.type === 'writeoff') { trty = 99; trstr = 'Write Off'; }

        const bsRow = {
          trid: currentTrid++,
          pfid,
          amid: resolvedAmid,
          atyid,
          sid: -1,
          cnid: cnid,
          trty,
          trstr,
          acvch: vid,
          dt: data.date,
          qn: qty,
          purpr: price,
          brkg: 0,
          netpr: price,
          amt,
          chrgs: 0,
          narr: data.narration || '',
          extstr: line.folio || null
        };
        allBs1.push(bsRow);
      }
    }
  }

  // BATCH INSERTS
  if (allScnote.length > 0) {
    const { error } = await supabase.from('scnote1').insert(allScnote);
    if (error) throw new Error(\`Bulk insert scnote1 failed: \${error.message}\`);
    allScnote.forEach(r => state.scnote1.push(r));
  }

  if (allVchC1.length > 0) {
    const { error } = await supabase.from('vouchersc1').insert(allVchC1);
    if (error) throw new Error(\`Bulk insert vouchersc1 failed: \${error.message}\`);
    allVchC1.forEach(r => state.vouchersC1.push({...r, _src: 'c'}));
  }

  if (allTransC1.length > 0) {
    const { error } = await supabase.from('transc1').insert(allTransC1);
    if (error) throw new Error(\`Bulk insert transc1 failed: \${error.message}\`);
    allTransC1.forEach(r => state.transC1.push({...r, _src: 'c'}));
  }

  if (allVch1.length > 0) {
    const { error } = await supabase.from('vouchers1').insert(allVch1);
    if (error) throw new Error(\`Bulk insert vouchers1 failed: \${error.message}\`);
    allVch1.forEach(r => state.vouchers1.push({...r, _src: 't'}));
  }

  if (allTrans1.length > 0) {
    const { error } = await supabase.from('trans1').insert(allTrans1);
    if (error) throw new Error(\`Bulk insert trans1 failed: \${error.message}\`);
    allTrans1.forEach(r => state.trans1.push({...r, _src: 't'}));
  }

  if (allBs1.length > 0) {
    const dbBsRows = allBs1.map(({ extstr, ...rest }: any) => rest);
    const { error } = await supabase.from('bs1').insert(dbBsRows);
    if (error) throw new Error(\`Bulk insert bs1 failed: \${error.message}\`);
    allBs1.forEach(r => state.bs1.push({...r, _src: 'c'}));
  }

  rebuildAllIndexes();
  console.log(\`✅ Bulk insert complete: \${allVchC1.length + allVch1.length} vouchers, \${allTransC1.length + allTrans1.length} transactions, \${allBs1.length} bs1 rows\`);

  // Sync portfolio stats for unique portfolios/amids
  const uniqueSyncs = new Set();
  for (const bs of allBs1) {
    if (bs.pfid && bs.amid) uniqueSyncs.add(bs.pfid + '-' + bs.amid);
  }
  for (const key of uniqueSyncs) {
    const [pfidStr, amidStr] = (key as string).split('-');
    await syncPortfolioStats(Number(pfidStr), Number(amidStr));
  }
}
`;

fs.appendFileSync('src/logic.ts', bulkCode);
