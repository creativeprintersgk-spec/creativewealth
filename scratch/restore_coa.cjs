const fs = require('fs');
let code = fs.readFileSync('src/ChartOfAccounts.tsx', 'utf8');

code = code.replace(
  'import { getStoredGroups, getStoredLedgers } from "./logic";',
  'import { getStoredGroups, getStoredLedgers, getStoredAccounts } from "./logic";\nimport { useFamily } from "./contexts/FamilyContext";'
);

code = code.replace(
  'export default function ChartOfAccounts() {',
  `export default function ChartOfAccounts() {
  const { activeFamilyId } = useFamily();
  const accounts = getStoredAccounts().filter(a => a.familyId === activeFamilyId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts.length > 0 ? accounts[0].id : "");`
);

const beforeLoadData = `  const loadData = async () => {
    setLoading(true);
    const g = getStoredGroups();
    const l = getStoredLedgers();`;

const afterLoadData = `  useEffect(() => {
    if (accounts.length > 0) {
      if (!accounts.some(a => a.id === selectedAccountId)) {
        setSelectedAccountId(accounts[0].id);
      }
    } else {
      setSelectedAccountId('');
    }
  }, [accounts, selectedAccountId]);

  const loadData = async () => {
    setLoading(true);
    const g = getStoredGroups(selectedAccountId);
    const l = getStoredLedgers(selectedAccountId);`;

code = code.replace(beforeLoadData, afterLoadData);

fs.writeFileSync('src/ChartOfAccounts.tsx', code);
console.log('ChartOfAccounts.tsx restored');
