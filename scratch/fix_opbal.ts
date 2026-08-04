import { readFileSync, writeFileSync } from 'fs';

const logicTsPath = 'src/logic.ts';
let code = readFileSync(logicTsPath, 'utf8');

const replacement = `state.ledgers = uniqueAcmac1.filter(a => !a.is_group).map(a => {
      const cr = Number(a.cr_bal) || 0;
      const dr = Number(a.db_bal) || 0;
      const bal = dr > cr ? dr - cr : cr - dr;
      return {
        id: String(a.id),
        name: a.name,
        groupId: String(a.parent_id),
        openingBalance: bal,
        openingType: cr > dr ? 'CR' : 'DR',
        amid: a.amid,
        acid: a.acid
      };
    });`;

code = code.replace(/state\.ledgers = uniqueAcmac1\.filter\(a => !a\.is_group\)\.map\(a => \(\{\n[\s\S]*?acid: a\.acid\n    \}\)\);/, replacement);

writeFileSync(logicTsPath, code);
console.log('Fixed openingBalance parsing in logic.ts!');
