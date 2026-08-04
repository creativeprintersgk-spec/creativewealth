export async function createVoucher(data: any, reuseVid?: number) {
  // Validate that all transaction lines have valid ledger IDs and are balanced
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
      throw new Error(`Cannot create voucher with invalid or missing ledger ID: "${line.ledgerId}"`);
    }
    totalDebit += Number(line.debit) || 0;
    totalCredit += Number(line.credit) || 0;
  }

  const isCorporateAction = ['bonus', 'split', 'merger', 'demerger'].includes(data.type);
  if (!isCorporateAction && Math.abs(totalDebit - totalCredit) > 0.05) {
    throw new Error(`Cannot create unbalanced voucher! Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)}). Difference is ₹${Math.abs(totalDebit - totalCredit).toFixed(2)}.`);
  }

  const acid = data.accountId ? Number(data.accountId) : null;
  const vid = reuseVid ?? await nextVid();
  const vtyp = VTYP_MAP[data.type] ?? 5; // default journal

  // MProfit Separation rule:
  // Vouchers with portfolio_id go to vouchersc1/transc1 (Capital),
  // Vouchers without portfolio_id go to vouchers1/trans1 (Trading).
  const vchTable = data.portfolioId ? 'vouchersc1' : 'vouchers1';
  const transTable = data.portfolioId ? 'transc1' : 'trans1';
  const vchSrc = data.portfolioId ? 'c' : 't';

  let cnid = data.cnid || -1;

  // If this is a contract note import, create the scnote1 header row
  if (data.isContractNote) {
    cnid = await nextCnid();
    const scnoteRow = {
      cnid,
      pfid: data.portfolioId ? Number(data.portfolioId) : null,
      aty: 50, // stock
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

    console.log("Saving contract note header to scnote1:", scnoteRow);
    const { error: scErr } = await supabase.from('scnote1').insert(scnoteRow);
    if (scErr) {
      console.error('❌ Failed to save contract note header:', scErr.message);
      throw new Error(`Failed to save contract note header: ${scErr.message}`);
    }
    state.scnote1.push(scnoteRow);
  }

  // 1. Prepare voucherRow
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

  // 2. Prepare transaction entries
  const lines = (data.lines || []).filter((l: any) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger'));
  let currentTransid = await nextTransid();
  const transRows: any[] = [];

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
    transRows.push(row);
  }

  // 3. Prepare bsRows (portfolio transactions) if portfolioId is present
  const bsRows: any[] = [];
  let pfid: number | null = null;

  if (data.portfolioId) {
    pfid = Number(data.portfolioId);
    
    // Resolve all asset lines from data.lines
    const assetLines = (data.lines || []).filter((l: any) => 
      Number(l.ledgerId) >= 100000 || 
      state.acmac1.some((a: any) => String(a.id) === String(l.ledgerId) && [200050, 200051, 200061, 200062].includes(Number(a.parent_id)))
    );

    const assetLinesInfo: Array<{ assetLine?: any; amid: number }> = [];
    const explicitAmidRaw = data.assetId ? Number(data.assetId) : undefined;
    const explicitAmid = (explicitAmidRaw !== undefined && !isNaN(explicitAmidRaw)) ? explicitAmidRaw : undefined;

    if (explicitAmid) {
      const matchingLine = data.lines.find((l: any) => Number(l.ledgerId) === explicitAmid);
      assetLinesInfo.push({ assetLine: matchingLine, amid: explicitAmid });
    } else {
      for (const line of assetLines) {
        const ledgerIdNum = Number(line.ledgerId);
        const ledger = state.acmac1.find((l: any) => String(l.id) === String(ledgerIdNum));
        let resolvedAmid = ledgerIdNum;
        if (ledger) {
          const cleanLedgerName = ledger.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          let matchedAsset = state.assetMaster.find((a: any) => {
            const cleanAssetName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
          }) || state.sam.find((s: any) => {
            const cleanAssetName = s.anm.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
          });

          if (!matchedAsset) {
            // Fetch dynamically from Supabase database
            const { data: dbAsset } = await supabase.from('asset_master').select('*').ilike('name', `%${ledger.name}%`).limit(1);
            if (dbAsset && dbAsset.length > 0) {
              matchedAsset = dbAsset[0];
              state.assetMaster.push(matchedAsset);
            } else {
              const { data: dbSam } = await supabase.from('sam').select('*').ilike('anm', `%${ledger.name}%`).limit(1);
              if (dbSam && dbSam.length > 0) {
                matchedAsset = dbSam[0];
                state.sam.push(matchedAsset);
              }
            }
          }

          if (matchedAsset) {
            resolvedAmid = matchedAsset.amid;
          }
        }
        assetLinesInfo.push({ assetLine: line, amid: resolvedAmid });
      }
    }

    let currentTrid = await nextTrid();
    for (const info of assetLinesInfo) {
      const { assetLine, amid } = info;
      const isBuy = assetLine ? (Number(assetLine.debit) > 0) : (data.type !== 'dividend' && data.type !== 'buyback' && data.type !== 'writeoff');
      const qty = assetLine ? (Number(assetLine.quantity) || 0) : (Number(data.quantity) || 0);
      const price = assetLine ? (Number(assetLine.price) || 0) : (Number(data.price) || 0);
      let amt = assetLine ? (Number(assetLine.debit) || Number(assetLine.credit) || 0) : (Number(data.amount) || qty * price || 0);
      
      if (!amt && data.type === 'dividend') {
        const creditLine = data.lines?.find((l: any) => Number(l.credit) > 0);
        if (creditLine) {
          amt = Number(creditLine.credit) || 0;
        } else {
          amt = data.lines?.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0) || 0;
        }
      }

      const asset = state.assetMaster.find((a: any) => a.amid === amid);
      const atyid = asset ? asset.asset_type : 50;

      let trty = isBuy ? 20 : 99;
      let trstr = isBuy ? 'Buy' : 'Sell';

      if (data.type === 'dividend') {
        trty = 62;
        trstr = 'Dividend Payout';
      } else if (data.type === 'bonus') {
        trty = 40;
        trstr = 'Bonus';
      } else if (data.type === 'split') {
        trty = 45;
        trstr = '*Split';
      } else if (data.type === 'demerger') {
        trty = 46;
        trstr = '*DeMerger';
      } else if (data.type === 'merger') {
        trty = 45;
        trstr = '*Merged';
      } else if (data.type === 'writeoff') {
        trty = 99;
        trstr = 'Write Off';
      }

      const bsRow = {
        trid: currentTrid++,
        pfid,
        amid,
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
        extstr: assetLine?.folio || null
      };
      bsRows.push(bsRow);
    }
  }

  // 4. Save to Supabase sequentially to satisfy foreign key constraints
  const { error: vchErr } = await supabase.from(vchTable).insert(voucherRow);
  if (vchErr) {
    console.error(`❌ Failed to save voucher header into ${vchTable}:`, vchErr.message);
    throw new Error(`Failed to save voucher header: ${vchErr.message}`);
  }

  if (transRows.length > 0) {
    const { error: transErr } = await supabase.from(transTable).insert(transRows);
    if (transErr) {
      console.error(`❌ Failed to save transaction entries into ${transTable}:`, transErr.message);
      // Rollback voucher header
      await supabase.from(vchTable).delete().eq('vid', vid);
      throw new Error(`Failed to save transaction entries: ${transErr.message}`);
    }
  }

  if (bsRows.length > 0) {
    // Strip extstr from the DB payload since the 'bs1' table does not contain it.
    const dbBsRows = bsRows.map(({ extstr, ...rest }: any) => rest);
    const { error: bsErr } = await supabase.from('bs1').insert(dbBsRows);
    if (bsErr) {
      console.error('❌ Failed to save portfolio holdings stats:', bsErr.message);
      // Rollback transaction entries and voucher header
      if (transRows.length > 0) {
        await supabase.from(transTable).delete().eq('vid', vid);
      }
      await supabase.from(vchTable).delete().eq('vid', vid);
      throw new Error(`Failed to save portfolio transaction: ${bsErr.message}`);
    }
  }

  // 5. Update in-memory state immediately so UI reflects new data without page reload
  if (vchSrc === 'c') {
    state.vouchersC1.push({ ...voucherRow, _src: 'c' });
    transRows.forEach(row => state.transC1.push({ ...row, _src: 'c' }));
  } else {
    state.vouchers1.push({ ...voucherRow, _src: 't' });
    transRows.forEach(row => state.trans1.push({ ...row, _src: 't' }));
  }
  bsRows.forEach(row => state.bs1.push({ ...row, _src: 'c' }));
  rebuildAllIndexes();

  console.log(`✅ Voucher saved into ${vchTable}: vid=${vid}, ${lines.length} entries, acid=${acid}`);

  // 6. Sync portfolio stats to sum_table for all updated assets
  if (pfid) {
    for (const row of bsRows) {
      if (row.amid) {
        await syncPortfolioStats(pfid, row.amid);
      }
    }
  }
}

export async function updateVoucher(data: any) {
  let rawVid = null;
  if (data.id) {
    const match = String(data.id).match(/\d+/);
    if (match) {
      const candidateVid = Number(match[0]);
      const exists = state.vouchersC1.some((v: any) => v.vid === candidateVid) ||
                     state.vouchers1.some((v: any) => v.vid === candidateVid) ||
                     state.bs1.some((t: any) => t.trid === candidateVid || Number(t.acvch) === candidateVid);
      if (exists) {
        rawVid = candidateVid;
      }
    }
  }

  if (rawVid && !isNaN(rawVid)) {
    const v = state.vouchersC1.find((v: any) => v.vid === rawVid) || state.vouchers1.find((v: any) => v.vid === rawVid);
    const cnid = v?.cnid;

    const affectedBs = state.bs1.filter((t: any) => 
      t.trid === rawVid || 
      Number(t.acvch) === rawVid || 
      (cnid && cnid !== -1 && t.cnid === cnid)
    );
    const pfid = affectedBs[0]?.pfid;
    const uniqueAmids = Array.from(new Set(affectedBs.map((t: any) => t.amid).filter(Boolean)));

    // Delete children first to satisfy foreign key constraints
    await Promise.all([
      supabase.from('transc1').delete().eq('vid', rawVid),
      supabase.from('trans1').delete().eq('vid', rawVid),
      cnid && cnid !== -1
        ? supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid},cnid.eq.${cnid}`)
        : supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`),
      cnid && cnid !== -1
        ? supabase.from('scnote1').delete().eq('cnid', cnid)
        : Promise.resolve()
    ]);
    // Then delete parents
    await Promise.all([
      supabase.from('vouchersc1').delete().eq('vid', rawVid),
      supabase.from('vouchers1').delete().eq('vid', rawVid)
    ]);

    state.vouchersC1 = state.vouchersC1.filter((v: any) => v.vid !== rawVid);
    state.transC1 = state.transC1.filter((e: any) => e.vid !== rawVid);
    state.vouchers1 = state.vouchers1.filter((v: any) => v.vid !== rawVid);
    state.trans1 = state.trans1.filter((e: any) => e.vid !== rawVid);
    if (cnid && cnid !== -1) {
      state.scnote1 = state.scnote1.filter((s: any) => s.cnid !== cnid);
    }
    state.bs1 = state.bs1.filter((t: any) => 
      t.trid !== rawVid && 
      Number(t.acvch) !== rawVid && 
      !(cnid && cnid !== -1 && t.cnid === cnid)
    );
    rebuildAllIndexes();

    // Skip redundant syncPortfolioStats here because createVoucher below will call it after inserting updated entries!
  }
  await createVoucher(data, rawVid || undefined);
}

