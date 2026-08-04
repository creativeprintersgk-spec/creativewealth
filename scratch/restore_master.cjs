const fs = require('fs');
let c = fs.readFileSync('src/logic.ts', 'utf8');

c = c.replace(/export async function saveMasterRecord[\s\S]*?deleteMasterRecord.*?}/, `export async function saveMasterRecord(type: any, record: any) {
  if (type === 'investorGroups') {
    const isNew = !record.id || String(record.id).startsWith('new');
    let groupId = record.id;
    if (isNew) {
      const { data } = await supabase.from('portfolios').insert({
        investor_name: record.groupName,
        full_name: record.fullName,
        is_group: true,
        client_id: 1,
        pfolio_type: 0,
        exit_status: 1
      }).select().single();
      if (data) {
        groupId = String(data.id);
        state.portfolios.push(data);
      }
    } else {
      await supabase.from('portfolios').update({
        investor_name: record.groupName,
        full_name: record.fullName
      }).eq('id', record.id);
      const pf = state.portfolios.find((p: any) => String(p.id) === String(record.id));
      if (pf) {
        pf.investor_name = record.groupName;
        pf.full_name = record.fullName;
      }
    }
    
    await supabase.from('investor_group_members').delete().eq('investor_group_id', groupId);
    state.investorGroupMembers = state.investorGroupMembers.filter((m: any) => String(m.investor_group_id) !== String(groupId));
    
    if (record.portfolioIds && record.portfolioIds.length > 0) {
      const inserts = record.portfolioIds.map((pId: string) => ({
        investor_group_id: Number(groupId),
        pfolio_id: Number(pId),
        client_id: 1,
        ext_src_id: -1
      }));
      await supabase.from('investor_group_members').insert(inserts);
      state.investorGroupMembers.push(...inserts);
    }
  }
}

export async function deleteMasterRecord(type: any, id: any) {
  if (type === 'investorGroups') {
    await supabase.from('investor_group_members').delete().eq('investor_group_id', id);
    await supabase.from('portfolios').delete().eq('id', id);
    state.investorGroupMembers = state.investorGroupMembers.filter((m: any) => String(m.investor_group_id) !== String(id));
    state.portfolios = state.portfolios.filter((p: any) => String(p.id) !== String(id));
  }
}

export async function togglePortfolioStatus(id: any, status: number) {
  await supabase.from('portfolios').update({ exit_status: status }).eq('id', id);
  const pf = state.portfolios.find((p: any) => String(p.id) === String(id));
  if (pf) pf.exit_status = status;
}`);

fs.writeFileSync('src/logic.ts', c);
console.log('Restored master record functions');
