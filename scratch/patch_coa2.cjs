const fs = require('fs');
let code = fs.readFileSync('src/ChartOfAccounts.tsx', 'utf8');

code = code.replace(
  '  useEffect(() => {\r\n    loadData();\r\n  }, []);',
  '  useEffect(() => {\r\n    loadData();\r\n  }, [selectedAccountId]);'
);

code = code.replace(
  '  useEffect(() => {\n    loadData();\n  }, []);',
  '  useEffect(() => {\n    loadData();\n  }, [selectedAccountId]);'
);

const beforeGroups = `        <div style={{ padding: '16px', borderBottom: '1px solid hsl(220, 15%, 90%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' }}>Groups</span>
        </div>`;

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

code = code.replace(beforeGroups, afterGroups);

// Also handle the case with different line endings
const beforeGroupsWindows = `        <div style={{ padding: '16px', borderBottom: '1px solid hsl(220, 15%, 90%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\r\n          <span style={{ fontWeight: 700, fontSize: '13px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' }}>Groups</span>\r\n        </div>`;

code = code.replace(beforeGroupsWindows, afterGroups);

fs.writeFileSync('src/ChartOfAccounts.tsx', code);
console.log('ChartOfAccounts.tsx patched successfully');
