const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update activeTab state
content = content.replace(
  /  \/\/ Tabs: 'db' \| 'contract-note' \| 'mf-cas' \| 'sql-restore'\r?\n  const \[activeTab, setActiveTab\] = useState<'db' \| 'contract-note' \| 'mf-cas' \| 'sql-restore'>\('db'\);/g,
  `  // Tabs: 'contract-note' | 'mf-cas' | 'sql-restore'\n  const [activeTab, setActiveTab] = useState<'contract-note' | 'mf-cas' | 'sql-restore'>('contract-note');`
);

// 2. Remove the MProfit DB tab button
content = content.replace(
  /        <button onClick=\{\(\) => setActiveTab\('db'\)\} style=\{tabStyle\(activeTab === 'db'\)\}>\r?\n          MProfit DB Import\r?\n        <\/button>\r?\n/g,
  ''
);

// 3. Remove the entire TAB 1 content section
const tab1StartStr = '      {/* TAB 1: MPROFIT DB IMPORT */}';
const tab2StartStr = '      {/* TAB 2: BROKER CONTRACT NOTE */}';

const startIndex = content.indexOf(tab1StartStr);
const endIndex = content.indexOf(tab2StartStr);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + content.slice(endIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('ImportPage updated.');
