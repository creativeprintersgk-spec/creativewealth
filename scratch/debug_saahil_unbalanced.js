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
  console.log('Finding Saahil Shah account and portfolios...');
  const { data: accounts } = await supabase.from('acmac1').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const { data: vouchersC1 } = await supabase.from('vouchersc1').select('*');
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*');
  const { data: transC1 } = await supabase.from('transc1').select('*');
  const { data: trans1 } = await supabase.from('trans1').select('*');
  const { data: bs1 } = await supabase.from('bs1').select('*');

  const saahilAccount = accounts?.find(a => a.name.toLowerCase().includes('saahil shah') && !a.name.toLowerCase().includes('huf'));
  if (!saahilAccount) {
    console.error('Saahil Shah account not found!');
    return;
  }
  const saahilAcid = saahilAccount.id; // accountId
  console.log(`Saahil Shah accountId: ${saahilAcid}`);

  const saahilPortfolios = portfolios?.filter(p => p.accountId === saahilAcid) || [];
  const saahilPflIds = saahilPortfolios.map(p => p.id);
  console.log(`Saahil Shah portfolios: ${saahilPflIds.join(', ')}`);

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

  const saahilEntries = [];
  allEntries.forEach(e => {
    const vKey = `${e._src}_${e.vid}`;
    const v = voucherMap[vKey];
    const entryAcid = e.acid || v?.acid;
    const entryPfid = v?.pfid;

    const belongsToSaahil = (entryAcid === saahilAcid) || (entryPfid && saahilPflIds.includes(entryPfid));
    if (belongsToSaahil) {
      saahilEntries.push({ ...e, voucher: v });
    }
  });

  console.log(`Saahil Shah has ${saahilEntries.length} entries.`);

  // Group by voucher key (src + vid)
  const grouped = {};
  saahilEntries.forEach(e => {
    const key = `${e._src}_${e.vid}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  console.log('\nChecking which vouchers are unbalanced within Saahil Shah scope...');
  let totalSaahilDr = 0;
  let totalSaahilCr = 0;

  for (const [key, lines] of Object.entries(grouped)) {
    const dr = lines.reduce((sum, l) => sum + (Number(l.dramt) || 0), 0);
    const cr = lines.reduce((sum, l) => sum + (Number(l.cramt) || 0), 0);
    totalSaahilDr += dr;
    totalSaahilCr += cr;

    if (Math.abs(dr - cr) > 0.01) {
      const first = lines[0];
      const v = first.voucher;
      console.log(`\n❌ Unbalanced Voucher: ${key}`);
      if (v) {
        console.log(`   Voucher: Date=${v.dt}, No=${v.vchno}, Narr="${v.narr || ''}", Acid=${v.acid}, Pfid=${v.pfid}`);
      } else {
        console.log(`   (No voucher header found in database!)`);
      }
      lines.forEach(l => {
        const ledger = accounts?.find(a => a.id === l.maid);
        console.log(`     Entry: dramt=${l.dramt}, cramt=${l.cramt}, maid=${l.maid} (${ledger?.name || 'unknown'}), transid=${l.transid}`);
      });
    }
  }

  console.log(`\nTotal Saahil Shah debits: ${totalSaahilDr.toFixed(2)}`);
  console.log(`Total Saahil Shah credits: ${totalSaahilCr.toFixed(2)}`);
  console.log(`Net Difference: ${(totalSaahilDr - totalSaahilCr).toFixed(2)}`);
}

run().catch(console.error);
