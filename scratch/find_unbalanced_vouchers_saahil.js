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

async function safeFetch(table, max = 50000) {
  let all = [];
  const pkMap = {
    vouchersc1: 'vid', vouchers1: 'vid',
    transc1: 'transid', trans1: 'transid',
    portfolios: 'id', acc_pflink: 'pfid', acmac1: 'id'
  };
  let page = 0;
  const size = 1000;
  while (all.length < max) {
    const { data, error } = await supabase
      .from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  const accountId = '31';
  const startDate = '2026-04-01';
  const endDate = '2027-03-31';

  const [portfolios, accPflink, vouchersC1, vouchers1, transC1, trans1] = await Promise.all([
    safeFetch('portfolios'), safeFetch('acc_pflink'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'), 
    safeFetch('transc1'), safeFetch('trans1'),
  ]);

  const portfolioIds = portfolios
    .map(p => {
      const link = accPflink.find((l) => l.pfid === p.id);
      return { id: String(p.id), accountId: link ? String(link.acid) : null };
    })
    .filter(p => p.accountId === accountId)
    .map(p => p.id);

  const vouchers = [
    ...vouchersC1.map(v => ({ ...v, _src: 'c' })),
    ...vouchers1.map(v => ({ ...v, _src: 't' }))
  ];

  const entries = [
    ...transC1.map(e => ({ ...e, _src: 'c' })),
    ...trans1.map(e => ({ ...e, _src: 't' }))
  ];

  const entriesByVoucher = {};
  entries.forEach(e => {
    const vid = `${e._src}_${e.vid}`;
    if (!entriesByVoucher[vid]) entriesByVoucher[vid] = [];
    entriesByVoucher[vid].push(e);
  });

  console.log(`Checking ${vouchers.length} vouchers for FY 26-27 imbalances...`);
  
  let totalImbalance = 0;

  for (const v of vouchers) {
    const isOpeningBalance = !v.dt || v.dt === '' || v.dt === 'undefined';
    // We only care about FY 26-27 or generally any voucher that causes imbalance.
    // The user said last year tallied, this year doesn't. So the imbalance is in 26-27.
    if (isOpeningBalance || v.dt < startDate || v.dt > endDate) continue;

    const lines = entriesByVoucher[`${v._src}_${v.vid}`] || [];
    
    let dr = 0;
    let cr = 0;
    const saahilLines = [];

    for (const e of lines) {
      const entryAcid = e.acid ? String(e.acid) : String(v.acid);
      const entryPfid = v.pfid ? String(v.pfid) : undefined;
      const belongsToAccount = (entryAcid === accountId) || (entryPfid && portfolioIds.includes(entryPfid));
      
      if (belongsToAccount) {
        dr += Number(e.dramt) || 0;
        cr += Number(e.cramt) || 0;
        saahilLines.push(e);
      }
    }

    const diff = Math.abs(dr - cr);
    if (diff > 0.01 && saahilLines.length > 0) {
      console.log(`\n❌ Unbalanced Voucher for Saahil: [${v._src}] vid=${v.vid}, dt=${v.dt}, type=${v.vtyp}, vchno=${v.vchno}`);
      console.log(`   Debit: ${dr.toFixed(2)}, Credit: ${cr.toFixed(2)}, Diff: ${(dr - cr).toFixed(2)}`);
      console.log(`   Narration: ${v.narr}`);
      console.log(`   Saahil Lines:`);
      saahilLines.forEach(l => {
        console.log(`     - maid=${l.maid}, Dr=${l.dramt}, Cr=${l.cramt}`);
      });
      totalImbalance += (dr - cr);
    }
  }

  console.log(`\nTotal Imbalance found in these vouchers: ${totalImbalance.toFixed(2)}`);
}

run().catch(console.error);
