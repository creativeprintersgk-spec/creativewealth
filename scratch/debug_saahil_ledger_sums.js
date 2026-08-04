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

  const saahilAcid = 31;
  const linkedPfids = pflinks?.filter(l => l.acid === saahilAcid).map(l => l.pfid) || [];
  console.log('Saahil portfolios:', linkedPfids);

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

  // Map groups by ID for quick lookup
  const { data: groups } = await supabase.from('acmac1').select('*').eq('is_group', true);
  const getGroupType = (groupId) => {
    let current = groups?.find(g => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups?.find(g => g.id === current.parent_id);
    }
    return 'ASSET';
  };

  // Filter entries for Saahil Shah
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

  console.log(`\nFiltered ${saahilEntries.length} entries for Saahil.`);

  // Calculate balances of all ledgers
  const ledgerBalances = {};
  saahilEntries.forEach(e => {
    const maid = e.maid;
    if (!ledgerBalances[maid]) {
      ledgerBalances[maid] = { dr: 0, cr: 0 };
    }
    ledgerBalances[maid].dr += Number(e.dramt) || 0;
    ledgerBalances[maid].cr += Number(e.cramt) || 0;
  });

  console.log('\n--- Saahil Shah Ledger Balances ---');
  let assetTotal = 0;
  let liabilityTotal = 0;

  const resolvedLedgers = accounts?.filter(a => !a.is_group);

  for (const [maidStr, bal] of Object.entries(ledgerBalances)) {
    const maid = Number(maidStr);
    const ledger = resolvedLedgers?.find(a => a.id === maid);
    const name = ledger?.name || `Ledger ${maid}`;
    const groupId = ledger?.parent_id;
    const groupType = getGroupType(groupId);

    const netBal = groupType === 'ASSET' ? bal.dr - bal.cr : bal.cr - bal.dr;
    if (groupType === 'ASSET') {
      assetTotal += netBal;
    } else {
      liabilityTotal += netBal;
    }

    console.log(`Ledger: name="${name}" (maid=${maid}, type=${groupType}) -> dr=${bal.dr.toFixed(2)}, cr=${bal.cr.toFixed(2)}, net=${netBal.toFixed(2)}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Assets Total: ${assetTotal.toFixed(2)}`);
  console.log(`Liabilities & Equity Total: ${liabilityTotal.toFixed(2)}`);
  console.log(`Unbalanced Difference (Assets - Liabilities): ${(assetTotal - liabilityTotal).toFixed(2)}`);
}

run().catch(console.error);
