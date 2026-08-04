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
  const ACID = 31;
  const endDate = '2027-03-31';
  console.log(`=== Optimally calculating BS for Saahil (acid=${ACID}) for FY 26-27 (<= ${endDate}) ===`);

  // Query only what we need
  const [acmacRes, vouchersC1Res, vouchers1Res, transC1Res, trans1Res, portfoliosRes] = await Promise.all([
    supabase.from('acmac1').select('*').eq('acid', ACID),
    supabase.from('vouchersc1').select('*').eq('acid', ACID),
    supabase.from('vouchers1').select('*').eq('acid', ACID),
    supabase.from('transc1').select('*').eq('acid', ACID),
    supabase.from('trans1').select('*').eq('acid', ACID),
    supabase.from('portfolios').select('*') // small table
  ]);

  const acmac1 = acmacRes.data || [];
  const vouchersc1 = vouchersC1Res.data || [];
  const vouchers1 = vouchers1Res.data || [];
  const transc1 = transC1Res.data || [];
  const trans1 = trans1Res.data || [];
  const portfolios = portfoliosRes.data || [];

  // Deduplicate acmac1 as in logic.ts
  const uniqueAcmac1 = [];
  const seenAcmac = new Set();
  for (const a of acmac1) {
    if (a.name === 'Difference in Opening Balances') continue;
    const key = `${a.id}_${a.acid}_${a.is_group}_${a.parent_id}_${a.name}_${a.special_type_id}`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      uniqueAcmac1.push(a);
    }
  }

  const groups = uniqueAcmac1.filter(a => a.is_group);
  const ledgers = uniqueAcmac1.filter(a => !a.is_group);

  const saahilPortfolios = portfolios.filter(p => p.accountId === ACID);
  const saahilPflIds = saahilPortfolios.map(p => p.id);

  console.log(`Groups: ${groups.length}, Ledgers: ${ledgers.length}`);
  console.log(`Saahil Portfolios: ${saahilPortfolios.map(p => p.investor_name).join(', ')}`);

  // Create voucher maps
  const vchMap = new Map();
  vouchersc1.forEach(v => vchMap.set(`c_${v.vid}`, { ...v, _src: 'c' }));
  vouchers1.forEach(v => vchMap.set(`t_${v.vid}`, { ...v, _src: 't' }));

  // Collect entries
  const entries = [
    ...transc1.map(e => ({ ...e, _src: 'c' })),
    ...trans1.map(e => ({ ...e, _src: 't' }))
  ];

  // Filter entries
  const accountEntries = entries.filter(e => {
    const v = vchMap.get(`${e._src}_${e.vid}`);
    const entryDate = e.dt || v?.dt;
    const entryAcid = e.acid || v?.acid;
    const entryPfid = v?.pfid;

    // Filter by date
    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    const dateOk = isOpeningBalance || entryDate <= endDate;
    if (!dateOk) return false;

    // Filter by account/portfolio
    const belongs = (entryAcid === ACID) || (entryPfid && saahilPflIds.includes(entryPfid));
    return belongs;
  });

  console.log(`Valid entries: ${accountEntries.length}`);

  // Group type helper
  function getGroupType(st) {
    if ([150, 40, 50, 125].includes(st)) return 'ASSET';
    if ([250, 275, 276].includes(st)) return 'LIABILITY';
    if (st === 280) return 'INCOME';
    if (st === 290) return 'EXPENSE';
    return 'ASSET';
  }

  function getLedgerGroupType(ledgerGroupId) {
    let current = groups.find(g => g.id === ledgerGroupId);
    while (current) {
      if (current.special_type_id) return getGroupType(current.special_type_id);
      current = groups.find(g => g.id === current.parent_id);
    }
    return 'ASSET';
  }

  // Calculate ledger balances
  const ledgerBalances = {};
  ledgers.forEach(l => {
    const type = getLedgerGroupType(l.parent_id);
    let dr = 0, cr = 0;
    accountEntries.forEach(e => {
      if (e.maid === l.id) {
        dr += Number(e.dramt) || 0;
        cr += Number(e.cramt) || 0;
      }
    });
    const balance = type === 'ASSET' ? dr - cr : cr - dr;
    ledgerBalances[l.id] = { ledger: l, type, dr, cr, balance };
  });

  // Calculate group totals
  function getGroupBalance(groupId) {
    let bal = 0;
    // ledgers direct children
    ledgers.forEach(l => {
      if (l.parent_id === groupId) {
        bal += ledgerBalances[l.id]?.balance || 0;
      }
    });
    // sub groups
    groups.forEach(g => {
      if (g.parent_id === groupId) {
        bal += getGroupBalance(g.id);
      }
    });
    return bal;
  }

  // Get root groups
  const rootGroups = groups.filter(g => g.parent_id === 0 || !groups.some(p => p.id === g.parent_id));

  console.log('\nGroup Balances:');
  let totalAssets = 0, totalLiabilities = 0, totalIncome = 0, totalExpense = 0;
  
  const results = [];
  rootGroups.forEach(g => {
    const bal = getGroupBalance(g.id);
    const type = getGroupType(g.special_type_id || 150);
    console.log(`  Name: ${g.name.padEnd(25)} Type: ${type.padEnd(10)} Balance: ${bal.toFixed(2)}`);
    results.push({ name: g.name, type, balance: bal });
    if (type === 'ASSET') totalAssets += bal;
    else if (type === 'LIABILITY') totalLiabilities += bal;
    else if (type === 'INCOME') totalIncome += bal;
    else if (type === 'EXPENSE') totalExpense += bal;
  });

  const netProfit = totalIncome - totalExpense;
  console.log(`\n=== Recalculated Totals ===`);
  console.log(`Total Assets:                     ₹${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities (exc. profit): ₹${totalLiabilities.toFixed(2)}`);
  console.log(`Net Profit / (Loss):              ₹${netProfit.toFixed(2)}`);
  console.log(`Total Liabilities & Profit:       ₹${(totalLiabilities + netProfit).toFixed(2)}`);
  console.log(`Difference (Assets - L&P):        ₹${(totalAssets - (totalLiabilities + netProfit)).toFixed(2)}`);

  // Print all ledgers with non-zero balances grouped by type
  console.log('\n--- Detail of non-zero ledger balances ---');
  Object.values(ledgerBalances)
    .filter(lb => Math.abs(lb.balance) > 0.01)
    .forEach(lb => {
      console.log(`  [${lb.type}] ${lb.ledger.name}: DR=${lb.dr.toFixed(2)}, CR=${lb.cr.toFixed(2)}, BAL=${lb.balance.toFixed(2)}`);
    });
}

run().catch(console.error);
