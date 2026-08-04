const fs = require('fs');

let c = fs.readFileSync('src/logic.ts', 'utf8');

const updateRegex = /export async function updateVoucher\(data: any\) {[\s\S]*?await createVoucher\(data, rawVid \|\| undefined\);\n}/;
const deleteRegex = /export async function deleteVoucher\(id: any\) {[\s\S]*?if \(pfid && amid\) \{\n\s+await syncPortfolioStats\(pfid, amid\);\n\s+\}\n\s+\}\n}/;

const newUpdate = `export async function updateVoucher(data: any) {
  const strId = String(data.id || '');
  const isExplicitTrid = strId.startsWith('trid_');
  const numericId = isExplicitTrid ? Number(strId.replace('trid_', '')) : Number(strId.match(/\\d+/) ? strId.match(/\\d+/)[0] : NaN);

  if (!isNaN(numericId)) {
    if (isExplicitTrid) {
      const tx = state.bs1.find((t: any) => t.trid === numericId);
      const pfid = tx?.pfid;
      const amid = tx?.amid;
      
      await supabase.from('bs1').delete().eq('trid', numericId);
      state.bs1 = state.bs1.filter((t: any) => t.trid !== numericId);
      
      rebuildAllIndexes();
      if (pfid && amid) await syncPortfolioStats(pfid, amid);
    } else {
      const tx = state.bs1.find((t: any) => Number(t.acvch) === numericId);
      const pfid = tx?.pfid;
      const amid = tx?.amid;

      await Promise.all([
        supabase.from('transc1').delete().eq('vid', numericId),
        supabase.from('vouchersc1').delete().eq('vid', numericId),
        supabase.from('trans1').delete().eq('vid', numericId),
        supabase.from('vouchers1').delete().eq('vid', numericId),
        supabase.from('bs1').delete().eq('acvch', numericId)
      ]);

      state.vouchersC1 = state.vouchersC1.filter((v: any) => v.vid !== numericId);
      state.transC1 = state.transC1.filter((e: any) => e.vid !== numericId);
      state.vouchers1 = state.vouchers1.filter((v: any) => v.vid !== numericId);
      state.trans1 = state.trans1.filter((e: any) => e.vid !== numericId);
      state.bs1 = state.bs1.filter((t: any) => Number(t.acvch) !== numericId);
      
      rebuildAllIndexes();
      if (pfid && amid) await syncPortfolioStats(pfid, amid);
    }
  }
  await createVoucher(data, !isExplicitTrid && !isNaN(numericId) ? numericId : undefined);
}`;

const newDelete = `export async function deleteVoucher(id: any) {
  const strId = String(id || '');
  const isExplicitTrid = strId.startsWith('trid_');
  const numericId = isExplicitTrid ? Number(strId.replace('trid_', '')) : Number(strId.match(/\\d+/) ? strId.match(/\\d+/)[0] : NaN);

  if (!isNaN(numericId)) {
    if (isExplicitTrid) {
      const tx = state.bs1.find((t: any) => t.trid === numericId);
      const pfid = tx?.pfid;
      const amid = tx?.amid;
      
      await supabase.from('bs1').delete().eq('trid', numericId);
      state.bs1 = state.bs1.filter((t: any) => t.trid !== numericId);
      
      rebuildAllIndexes();
      if (pfid && amid) await syncPortfolioStats(pfid, amid);
    } else {
      const tx = state.bs1.find((t: any) => Number(t.acvch) === numericId);
      const pfid = tx?.pfid;
      const amid = tx?.amid;

      await Promise.all([
        supabase.from('transc1').delete().eq('vid', numericId),
        supabase.from('vouchersc1').delete().eq('vid', numericId),
        supabase.from('trans1').delete().eq('vid', numericId),
        supabase.from('vouchers1').delete().eq('vid', numericId),
        supabase.from('bs1').delete().eq('acvch', numericId)
      ]);

      state.vouchersC1 = state.vouchersC1.filter((v: any) => v.vid !== numericId);
      state.transC1 = state.transC1.filter((e: any) => e.vid !== numericId);
      state.vouchers1 = state.vouchers1.filter((v: any) => v.vid !== numericId);
      state.trans1 = state.trans1.filter((e: any) => e.vid !== numericId);
      state.bs1 = state.bs1.filter((t: any) => Number(t.acvch) !== numericId);
      
      rebuildAllIndexes();
      if (pfid && amid) await syncPortfolioStats(pfid, amid);
    }
  }
}`;

c = c.replace(updateRegex, newUpdate);
c = c.replace(deleteRegex, newDelete);

fs.writeFileSync('src/logic.ts', c);
console.log('Patched logic.ts update/delete successfully.');
