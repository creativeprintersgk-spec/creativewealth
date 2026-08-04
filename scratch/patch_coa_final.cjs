const fs = require('fs');
let code = fs.readFileSync('src/ChartOfAccounts.tsx', 'utf8');

// 1. Imports
code = code.replace(
  'import { getStoredGroups, getStoredLedgers } from "./logic";',
  'import { getStoredGroups, getStoredLedgers, getStoredAccounts } from "./logic";\nimport { useFamily } from "./contexts/FamilyContext";'
);

// 2. State setup
code = code.replace(
  '  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);',
  '  const { activeFamilyId } = useFamily();\n  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);\n  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts.length > 0 ? accounts[0].id : "");\n  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);'
);

// 3. loadData
code = code.replace(
  /const g = getStoredGroups\(\);\s+const l = getStoredLedgers\(\);/g,
  'const g = getStoredGroups(selectedAccountId);\n    const l = getStoredLedgers(selectedAccountId);'
);

// 4. useEffect
code = code.replace(
  /useEffect\(\(\) => \{\s+loadData\(\);\s+\}, \[\]\);/g,
  'useEffect(() => {\n    loadData();\n  }, [selectedAccountId]);'
);

// 5. dropdown
const regexBeforeGroups = /<div style=\{\{ padding: '16px', borderBottom: '1px solid hsl\(220, 15%, 90%\)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' \}\}>\s*<span style=\{\{ fontWeight: 700, fontSize: '13px', color: 'hsl\(220, 9%, 46%\)', textTransform: 'uppercase' \}\}>Groups<\/span>\s*<\/div>/g;

const afterGroups = `        <div style={{ padding: '16px', borderBottom: '1px solid hsl(220, 15%, 90%)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' }}>Groups</span>
          <select 
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid hsl(220, 15%, 85%)', fontSize: '13px', outline: 'none' }}
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName}</option>)}
          </select>
        </div>`;

code = code.replace(regexBeforeGroups, afterGroups);

fs.writeFileSync('src/ChartOfAccounts.tsx', code);
console.log('Done!');
