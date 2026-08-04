const fs = require('fs');
const path = require('path');

const logicPath = path.join(__dirname, '../src/logic.ts');
let content = fs.readFileSync(logicPath, 'utf8');

if (!content.includes('createVouchersBulk')) {
  content += `\n
export async function createVouchersBulk(dataList: any[]) {
  if (dataList.length === 0) return;

  const VTYP_MAP: Record<string, number> = {
    journal: 5,
    payment: 1,
    receipt: 2,
    contra: 3,
    purchase: 4,
    sales: 6,
    bonus: 5,
    split: 5,
    merger: 5,
    demerger: 5,
    dividend: 2,
  };

  const { data: maxVid } = await supabase.from('vouchersc1').select('vid').order('vid', { ascending: false }).limit(1);
  let nextVid = (maxVid?.[0]?.vid || 0) + 1;

  const { data: maxTrans } = await supabase.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
  let nextTransid = (maxTrans?.[0]?.transid || 0) + 1;

  const vouchers: any[] = [];
  const allTrans: any[] = [];
  const allNotes: any[] = [];

  for (const data of dataList) {
    const acid = data.accountId ? Number(data.accountId) : null;
    const vid = nextVid++;
    const vtyp = VTYP_MAP[data.type] ?? 5;

    vouchers.push({
      vid,
      acid,
      dt: data.date,
      narr: data.narration || '',
      vtyp,
      pfid: data.portfolioId ? Number(data.portfolioId) : null,
    });

    const lines = (data.lines || []).filter((l: any) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger'));

    for (const line of lines) {
      const transid = nextTransid++;
      const amid = data.assetId ? Number(data.assetId) : null;
      allTrans.push({
        transid,
        vid,
        acid,
        dt: data.date,
        maid: Number(line.ledgerId),
        crdr: Number(line.credit) > 0 ? 1 : 0,
        amount: Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit),
        pfid: data.portfolioId ? Number(data.portfolioId) : null,
        amid,
      });

      if (data.type === 'journal' || data.type === 'purchase' || data.type === 'sales' || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger') {
        const qty = Number(data.quantity) || 0;
        const pr = Number(data.price) || 0;
        if (qty > 0 || pr > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger') {
          allNotes.push({
            transid,
            acid,
            qty,
            pr,
            brok: 0,
            stax: 0,
            tran_chg: 0,
            stamp: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            stt: 0
          });
        }
      }
    }
  }

  const { error: vErr } = await supabase.from('vouchersc1').insert(vouchers);
  if (vErr) {
    console.error('Failed to insert vouchers bulk:', vErr);
    throw new Error('Bulk insert failed for vouchersc1: ' + vErr.message);
  }

  // Insert in chunks of 500 to avoid limits
  for (let i = 0; i < allTrans.length; i += 500) {
    const chunk = allTrans.slice(i, i + 500);
    const { error: tErr } = await supabase.from('transc1').insert(chunk);
    if (tErr) throw new Error('Bulk insert failed for transc1: ' + tErr.message);
  }

  if (allNotes.length > 0) {
    for (let i = 0; i < allNotes.length; i += 500) {
      const chunk = allNotes.slice(i, i + 500);
      const { error: nErr } = await supabase.from('scnote1').insert(chunk);
      if (nErr) throw new Error('Bulk insert failed for scnote1: ' + nErr.message);
    }
  }
}
`;
}

fs.writeFileSync(logicPath, content, 'utf8');
console.log('Successfully added createVouchersBulk');
