import sys

with open('src/logic.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = """    if (rawVid && !isNaN(rawVid)) {
      const tx = state.bs1.find((t: any) => t.trid === rawVid || Number(t.acvch) === rawVid);
      const pfid = tx?.pfid;
      const amid = tx?.amid;
  
      await Promise.all([
        supabase.from('transc1').delete().eq('vid', rawVid),
        supabase.from('vouchersc1').delete().eq('vid', rawVid),
        supabase.from('trans1').delete().eq('vid', rawVid),
        supabase.from('vouchers1').delete().eq('vid', rawVid),
        supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`)
      ]);"""

new_str = """    if (rawVid && !isNaN(rawVid)) {
      const txs = state.bs1.filter((t: any) => t.trid === rawVid || Number(t.acvch) === rawVid);
      const tx = txs[0];
      const pfid = tx?.pfid;
      const amid = tx?.amid;
      
      const vch = state.vouchersC1.find((v: any) => v.vid === rawVid) || state.vouchers1.find((v: any) => v.vid === rawVid);
      const cnidToDelete = vch?.cnid || txs.find((t: any) => t.cnid && t.cnid !== -1)?.cnid;

      const deletePromises: any[] = [
        supabase.from('transc1').delete().eq('vid', rawVid),
        supabase.from('vouchersc1').delete().eq('vid', rawVid),
        supabase.from('trans1').delete().eq('vid', rawVid),
        supabase.from('vouchers1').delete().eq('vid', rawVid),
        supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`)
      ];

      if (cnidToDelete && cnidToDelete !== -1) {
        deletePromises.push(supabase.from('scnote1').delete().eq('cnid', cnidToDelete));
        if (state.scnote1) {
          state.scnote1 = state.scnote1.filter((s: any) => s.cnid !== cnidToDelete);
        }
      }

      await Promise.all(deletePromises);"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('src/logic.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched logic.ts successfully.")
else:
    print("Target string not found in logic.ts!")
