const fs = require('fs');
const path = require('path');
const file = path.join('c:', 'Users', 'Admin', 'Desktop', 'wealthcore-clean', 'src', 'pages', 'ImportPage.tsx');
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('const ensureAssetLedgerExists =');
const endMarker = '    let totalBuys = 0;';
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFunc = `const ensureAssetLedgerExists = async (amid: number, name: string, portfolioId: number, assetType: number): Promise<number> => {
      // Get active account ID for the portfolio
      const pf = portfolios.find(p => String(p.id) === String(portfolioId));
      const acid = pf ? pf.accountId || 30 : 30; // fallback to default acid

      // 1. Try to find ledger by name globally in state.acmac1
      const existingByName = state.acmac1.find((a: any) =>
        a.name && a.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        (a.acid === acid || (a.acid === 36 && acid === 30) || (a.acid === 30 && acid === 36))
      );

      let matchedLedger = existingByName;

      // 2. Try to find ledger by AMID globally in state.acmac1
      if (!matchedLedger) {
        const existingByAmid = state.acmac1.find((l: any) => 
          l.amid !== undefined && Number(l.amid) === Number(amid) &&
          (l.acid === acid || (l.acid === 36 && acid === 30) || (l.acid === 30 && acid === 36))
        );
        matchedLedger = existingByAmid;
      }

      // 3. Fallback: Query database directly in case it was created recently but state is stale
      if (!matchedLedger) {
        const { data: dbByName } = await supabase.from('acmac1')
          .select('*')
          .ilike('name', name.trim())
          .in('acid', [acid, acid === 30 ? 36 : 30])
          .limit(1);
        if (dbByName && dbByName.length > 0) {
          matchedLedger = dbByName[0];
          state.acmac1.push(matchedLedger);
        }
      }

      if (matchedLedger) {
        console.log(\`Reusing existing ledger: "\${matchedLedger.name}" (ID: \${matchedLedger.id})\`);
        const expectedParentId = assetType === 60 ? 200061 : (assetType === 61 ? 200062 : (assetType === 80 ? 400000 : 200050));
        const parent_id = matchedLedger.parent_id;
        if (parent_id !== expectedParentId && parent_id !== -1 && (assetType === 60 || assetType === 61)) {
           supabase.from('acmac1').update({ parent_id: expectedParentId }).eq('id', matchedLedger.id).then(() => {
              console.log(\`Updated parent_id of \${matchedLedger.name} to \${expectedParentId}\`);
           });
        }
        return Number(matchedLedger.id);
      }

      // 4. Create a new ledger in Supabase
      let nextId = Number(amid);
      if (nextId >= 800000000 || isNaN(nextId) || nextId <= 0) {
        const { data: maxIdRow } = await supabase.from('acmac1').select('id').order('id', { ascending: false }).limit(1);
        nextId = (maxIdRow?.[0]?.id || 500000) + 1;
      } else {
        const { data: idExists } = await supabase.from('acmac1').select('id').eq('id', nextId).limit(1);
        if (idExists && idExists.length > 0) {
          const { data: maxIdRow } = await supabase.from('acmac1').select('id').order('id', { ascending: false }).limit(1);
          nextId = (maxIdRow?.[0]?.id || 500000) + 1;
        }
      }

      const parentId = assetType === 60 ? 200061 : (assetType === 61 ? 200062 : (assetType === 80 ? 400000 : 200050));
      
      const { error } = await supabase.from('acmac1').insert([{
        id: nextId,
        name: name.trim(),
        parent_id: parentId,
        acid: acid,
        is_group: false
      }]);

      if (error) {
        console.error('Error creating missing ledger:', error);
      } else {
        console.log(\`Created missing ledger "\${name.trim()}" with ID \${nextId}\`);
        state.acmac1.push({
          id: nextId,
          name: name.trim(),
          parent_id: parentId,
          acid: acid,
          is_group: false
        });
      }

      return nextId;
    };

`;
  content = content.substring(0, startIdx) + newFunc + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('ImportPage updated successfully.');
} else {
  console.log('Could not find boundaries.');
}
