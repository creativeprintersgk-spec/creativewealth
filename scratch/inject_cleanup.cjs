const fs = require('fs');
const file = 'src/pages/ImportPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

const target = `export default function ImportPage() {
  const navigate = useNavigate();`;

const replacement = `export default function ImportPage() {
  const navigate = useNavigate();

  // EMERGENCY CLEANUP FOR CORRUPTED CONTRACT NOTE
  useEffect(() => {
    const cleanup = async () => {
      if (localStorage.getItem('didClearCorruptedData_13371')) return;
      try {
        console.log("RUNNING EMERGENCY DB CLEANUP FOR VOUCHER 13371...");
        // Delete scnote1
        await supabase.from('scnote1').delete().eq('cnnum', 'CNT-26/27-40606020');
        // Delete vouchersc1
        await supabase.from('vouchersc1').delete().eq('vid', 13371);
        
        localStorage.setItem('didClearCorruptedData_13371', 'true');
        
        // Force refresh state from DB
        await forceRefreshDatabase();
        
        alert("Corrupted database entry successfully wiped! The screen will now reload to clear memory.");
        window.location.reload();
      } catch (err) {
        console.error("Cleanup failed:", err);
      }
    };
    cleanup();
  }, []);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Injected cleanup logic into ImportPage.tsx');
} else {
  console.log('Target string not found in ImportPage.tsx');
}
