const fs = require('fs');
let code = fs.readFileSync('src/logic.ts', 'utf8');

const target = `    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      openingBalance: 0,
      openingType: 'DR' as const,`;

const replacement = `    .map((a: any) => {
      const cr = Number(a.cr_bal) || 0;
      const dr = Number(a.db_bal) || 0;
      const bal = dr > cr ? dr - cr : cr - dr;
      return {
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      openingBalance: bal,
      openingType: cr > dr ? 'CR' as const : 'DR' as const,`;

code = code.replace(target, replacement);

const target2 = `      currentType: 'DR' as const,
      amid: a.id >= 100000 ? a.id : undefined,
      acid: a.acid
    }));`;

const replacement2 = `      currentType: 'DR' as const,
      amid: a.id >= 100000 ? a.id : undefined,
      acid: a.acid
    };});`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/logic.ts', code);
console.log("Patched successfully");
