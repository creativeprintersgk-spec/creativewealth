import { readFileSync, writeFileSync } from 'fs';

const logicTsPath = 'src/logic.ts';
let code = readFileSync(logicTsPath, 'utf8');

const importStatement = `import dbData from '../db.json';\n`;
if (!code.includes('import dbData')) {
  code = importStatement + code;
}

const replacement = `    // Extract missing master data from db.json since it's not in Supabase yet
    state.families = dbData.families || [];
    state.accounts = dbData.accounts || [];
    state.portfolios = dbData.portfolios || [];
    state.investorGroups = dbData.investorGroups || [];`;

code = code.replace(/state\.families = \(families \|\| \[\]\)\.map\([\s\S]*?portfolioIds \}\)\);/, replacement);

writeFileSync(logicTsPath, code);
console.log('Fixed master entry data loading from db.json!');
