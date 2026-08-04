import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: accounts } = await supabase.from('acmac1').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const { data: pflinks } = await supabase.from('acc_pflink').select('*');
  const { data: transC1 } = await supabase.from('transc1').select('*');
  const { data: trans1 } = await supabase.from('trans1').select('*');
  const { data: vouchersC1 } = await supabase.from('vouchersc1').select('*');
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*');
  const { data: bs1 } = await supabase.from('bs1').select('*');

  // Find Saahil Shah's member account ID
  const saahilMembers = accounts?.filter(a => a.name.toLowerCase().includes('saahil shah') && a.is_group === false && a.id < 100000) || [];
  console.log('Saahil Shah member accounts:');
  saahilMembers.forEach(m => console.log(`  id=${m.id}, name="${m.name}", acid=${m.acid}`));

  // Let's use Saahil's main member account ID (which is likely 31, based on Portfolio id=31 "Saahil Shah A/c")
  const saahilAcid = 31;
  
  // Find linked portfolios from acc_pflink
  const linkedPfids = pflinks?.filter(l => l.acid === saahilAcid).map(l => l.pfid) || [];
  console.log(`Linked portfolios for acid ${saahilAcid} in acc_pflink:`, linkedPfids);

  const allVouchers = [
    ...(vouchersC1 || []).map(v => ({ ...v, _src: 'c' })),
    ...(vouchers1 || []).map(v => ({ ...v, _src: 't' }))
  ];

  const voucherMap = {};
  allVouchers.forEach(v => {
    voucherMap[`${v._src}_${v.vid}`] = v;
  });

  const allEntries = [
    ...(transC1 || []).map(e => ({ ...e, _src: 'c' })),
    ...(trans1 || []).map(e => ({ ...e, _src: 't' }))
  ];

  // Let's check which entries belong to Saahil Shah (using balanceSheet.ts logic)
  const saahilEntries = [];
  allEntries.forEach(e => {
    const vKey = `${e._src}_${e.vid}`;
    const v = voucherMap[vKey];
    const entryAcid = e.acid || v?.acid;
    const entryPfid = v?.portfolioId;

    const belongs = (entryAcid === saahilAcid) || (entryPfid && linkedPfids.includes(Number(entryPfid)));
    if (belongs) {
      saahilEntries.push({ ...e, voucher: v });
    }
  });

  console.log(`\nFound ${saahilEntries.length} entries belonging to Saahil Shah.`);

  // Group by voucher key (src + vid)
  const grouped = {};
  saahilEntries.forEach(e => {
    const key = `${e._src}_${e.vid}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  console.log('\n--- Unbalanced Vouchers for Saahil Shah ---');
  let unbalancedCount = 0;
  for (const [key, lines] of Object.entries(grouped)) {
    const dr = lines.reduce((sum, l) => sum + (Number(l.dramt) || 0), 0);
    const cr = lines.reduce((sum, l) => sum + (Number(l.cramt) || 0), 0);
    const diff = Math.abs(dr - cr);
    
    if (diff > 0.01) {
      unbalancedCount++;
      const first = lines[0];
      const v = first.voucher;
      console.log(`\n❌ Voucher ${key} is UNBALANCED by ${diff.toFixed(2)} (Dr: ${dr}, Cr: ${cr})`);
      if (v) {
        console.log(`   Voucher: Date=${v.dt}, No=${v.vchno}, Narr="${v.narr || ''}", Acid=${v.acid}, Pfid=${v.pfid}`);
      } else {
        console.log(`   (No voucher header found!)`);
      }
      lines.forEach(l => {
        const ledger = accounts?.find(a => a.id === l.maid);
        console.log(`     Line: dr=${l.dramt}, cr=${l.cramt}, maid=${l.maid} (${ledger?.name || 'unknown'})`);
      });
    }
  }
  
  console.log(`\nTotal unbalanced vouchers found: ${unbalancedCount}`);
  
  // Search Saahil entries for any single entry with amount around 2690.00
  console.log('\n--- Saahil entries containing 2690.00 ---');
  const targetEntries = saahilEntries.filter(e => {
    const dr = Number(e.dramt) || 0;
    const cr = Number(e.cramt) || 0;
    return Math.abs(dr - 2690) < 10 || Math.abs(cr - 2690) < 10;
  });
  
  targetEntries.forEach(e => {
    console.log(`Found entry: dr=${e.dramt}, cr=${e.cramt}, maid=${e.maid}, vid=${e.vid}`);
    const siblings = grouped[`${e._src}_${e.vid}`] || [];
    siblings.forEach(s => {
      const ledger = accounts?.find(a => a.id === s.maid);
      console.log(`   Sibling Line: dr=${s.dramt}, cr=${s.cramt}, maid=${s.maid} (${ledger?.name})`);
    });
  });
}

run().catch(console.error);
