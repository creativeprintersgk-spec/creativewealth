const fs = require('fs');
const file = 'src/logic.ts';
let code = fs.readFileSync(file, 'utf-8');

const start = code.indexOf('export async function saveMasterRecord(type: any, record: any) { console.log(\'saveMasterRecord stub\', type); }');
const end = code.indexOf('export function getYearEndClosingLines');

const replacement = `export async function saveMasterRecord(type: any, record: any) {
  if (type === 'accounts' || type === 'portfolios' || type === 'investorGroups') {
    const isNew = isNaN(parseInt(record.id)) || !state.portfolios.find((p: any) => p.id == record.id);
    let pfolio_type = type === 'accounts' ? 10 : (type === 'portfolios' ? 0 : 20);
    
    let dbPayload: any = {
      pfolio_type: pfolio_type,
      client_id: 1, // Default client id
      exit_status: 1
    };
    
    if (type === 'accounts') {
      dbPayload.investor_name = record.accountName || '';
      dbPayload.full_name = record.fullName || '';
      dbPayload.pan = record.pan || '';
    } else if (type === 'portfolios') {
      dbPayload.investor_name = record.portfolioName || '';
    } else if (type === 'investorGroups') {
      dbPayload.investor_name = record.groupName || '';
      dbPayload.full_name = record.fullName || '';
    }

    if (!isNew) {
      // Update existing
      try {
        await supabase.from('portfolios').update(dbPayload).eq('id', record.id);
        const idx = state.portfolios.findIndex((p: any) => p.id == record.id);
        if (idx !== -1) {
          state.portfolios[idx] = { ...state.portfolios[idx], ...dbPayload };
        }
      } catch(e) { console.error('Error updating master record', e); }
    } else {
      // Insert new
      try {
        const { data, error } = await supabase.from('portfolios').insert(dbPayload).select().single();
        if (data) {
          state.portfolios.push(data);
          record.id = String(data.id);
          
          if (type === 'portfolios' && record.accountId) {
             await supabase.from('acc_pflink').insert({ acid: parseInt(record.accountId), pfid: data.id });
             state.accPflink.push({ acid: parseInt(record.accountId), pfid: data.id });
          }
        }
      } catch(e) { console.error('Error inserting master record', e); }
    }
  }
}

export async function deleteMasterRecord(type: any, id: any) {
  if (type === 'accounts' || type === 'portfolios' || type === 'investorGroups') {
    try {
      await supabase.from('portfolios').delete().eq('id', id);
      state.portfolios = state.portfolios.filter((p: any) => p.id != id);
    } catch(e) { console.error('Error deleting master record', e); }
  }
}

`;

code = code.substring(0, start) + replacement + code.substring(end);
fs.writeFileSync(file, code);
console.log('Fixed saveMasterRecord in logic.ts');
