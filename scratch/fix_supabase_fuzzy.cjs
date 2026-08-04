const fs = require('fs');
let code = fs.readFileSync('src/pages/ImportPage.tsx', 'utf8');

const oldAsync = `    if (!matched && isin) {
      const { data } = await supabase.from('asset_master').select('*').eq('isin', isin).limit(1);
      if (data && data.length > 0) return data[0];
    }
    return matched;`;

const newAsync = `    if (!matched && isin) {
      const { data } = await supabase.from('asset_master').select('*').eq('isin', isin).limit(1);
      if (data && data.length > 0) return data[0];
    }
    if (!matched && symbol) {
      const cleanSym = symbol.replace(/-EQ|-BE|-BZ|-SM|-ST/g, '').trim().split(' ')[0];
      if (cleanSym.length > 2) {
         const { data } = await supabase.from('asset_master').select('*').ilike('name', \`%\${cleanSym}%\`).eq('asset_type', 50).limit(1);
         if (data && data.length > 0) return data[0];
      }
    }
    return matched;`;

code = code.replace(oldAsync, newAsync);
fs.writeFileSync('src/pages/ImportPage.tsx', code);
console.log('Added Supabase fuzzy search');
