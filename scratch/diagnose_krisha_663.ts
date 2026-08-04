/**
 * Diagnose the ₹663 unbalanced difference in KRISHA A/C's Balance Sheet
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function safeFetch(table: string, max = 50000): Promise<any[]> {
  const pkMap: Record<string, string> = {
    transc1: 'transid', trans1: 'transid', vouchersc1: 'vid',
    vouchers1: 'vid', acmac1: 'id', acc_pflink: 'pfid', portfolios: 'id'
  };
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (all.length < max) {
    const { data, error } = await supabase.from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
    if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  console.log('=== DIAGNOSING ₹663 UNBALANCED IN KRISHA A/C ===\n');

  const [acmac1, pflinks, portfolios] = await Promise.all([
    safeFetch('acmac1'), safeFetch('acc_pflink'), safeFetch('portfolios')
  ]);

  // Step 1: Find Krisha's acid
  const krishaAccounts = acmac1.filter((a: any) =>
    (a.name || '').toLowerCase().includes('krisha') ||
    (a.name || '').toLowerCase().includes('krish')
  );
  console.log('Accounts matching "Krisha":');
  krishaAccounts.forEach((a: any) =>
    console.log(`  id=${a.id} acid=${a.acid} name="${a.name}" is_group=${a.is_group}`)
  );

  // Also check portfolios
  const krishaPorts = portfolios.filter((p: any) =>
    (p.portfolioName || p.name || '').toLowerCase().includes('krisha') ||
    (p.portfolioName || p.name || '').toLowerCase().includes('krish')
  );
  console.log('\nPortfolios matching "Krisha":');
  krishaPorts.forEach((p: any) =>
    console.log(`  pfid=${p.id} name="${p.portfolioName || p.name}" accountId=${p.accountId}`)
  );

  // Find Krisha's acid from pflinks
  const krishaPfids = krishaPorts.map((p: any) => p.id);
  const krishaPfLinks = pflinks.filter((l: any) => krishaPfids.includes(l.pfid) || krishaPfids.includes(Number(l.pfid)));
  console.log('\nPf links for Krisha portfolios:');
  krishaPfLinks.forEach((l: any) => console.log(`  pfid=${l.pfid} acid=${l.acid}`));

  // Gather all possible acids for Krisha
  const krishaAcids = new Set<number>();
  krishaAccounts.forEach((a: any) => { if (a.acid) krishaAcids.add(Number(a.acid)); });
  krishaPfLinks.forEach((l: any) => { if (l.acid) krishaAcids.add(Number(l.acid)); });
  // Also check if any account IS Krisha (i.e., top-level client account)
  const krishaTopAccounts = acmac1.filter((a: any) =>
    !a.is_group && !a.acid &&
    ((a.name || '').toLowerCase().includes('krisha') || (a.name || '').toLowerCase().includes('krish'))
  );
  krishaTopAccounts.forEach((a: any) => krishaAcids.add(Number(a.id)));

  console.log('\nKrisha acids found:', [...krishaAcids]);

  if (krishaAcids.size === 0) {
    console.log('\n❌ Could not find Krisha account. Trying broader search...');
    // Search for any client-level account (acid=null, is_group=false)
    const topLevel = acmac1.filter((a: any) => !a.is_group && !a.acid && a.id < 100000);
    console.log('Top-level client accounts:');
    topLevel.forEach((a: any) => console.log(`  id=${a.id} name="${a.name}"`));
    return;
  }

  // Step 2: For Krisha's acid, get all trans1 + transc1 entries and check balance
  const krishaAcid = [...krishaAcids][0]; // Use the first found acid
  console.log(`\nUsing krishaAcid = ${krishaAcid}`);

  const [transc1All, trans1All, vouchersC1, vouchers1] = await Promise.all([
    safeFetch('transc1'), safeFetch('trans1'),
    safeFetch('vouchersc1'), safeFetch('vouchers1')
  ]);

  // Build voucher map
  const vMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { vMap[`c_${v.vid}`] = v; });
  vouchers1.forEach((v: any) => { vMap[`t_${v.vid}`] = v; });

  // Find linked pfids for krisha
  const linkedPfids = pflinks
    .filter((l: any) => Number(l.acid) === krishaAcid)
    .map((l: any) => Number(l.pfid));
  console.log(`Linked pfids for acid=${krishaAcid}:`, linkedPfids);

  // Get all entries for Krisha (by acid or by pfid via voucher)
  const allEntries = [
    ...transc1All.map((e: any) => ({ ...e, _src: 'c' })),
    ...trans1All.map((e: any) => ({ ...e, _src: 't' }))
  ];

  const krishaEntries = allEntries.filter((e: any) => {
    const vKey = `${e._src}_${e.vid}`;
    const v = vMap[vKey];
    const entryAcid = Number(e.acid) || Number(v?.acid);
    const vPfid = Number(v?.pfid || v?.portfolioId);
    return entryAcid === krishaAcid || (vPfid && linkedPfids.includes(vPfid));
  });

  console.log(`\nTotal entries for Krisha (acid=${krishaAcid}): ${krishaEntries.length}`);

  // Calculate total DR vs CR
  let totalDr = 0, totalCr = 0;
  krishaEntries.forEach((e: any) => {
    totalDr += Number(e.dramt) || 0;
    totalCr += Number(e.cramt) || 0;
  });

  console.log(`Total DR: ₹${totalDr.toFixed(2)}`);
  console.log(`Total CR: ₹${totalCr.toFixed(2)}`);
  console.log(`Difference (DR - CR): ₹${(totalDr - totalCr).toFixed(2)}`);

  // Group by voucher to find unbalanced ones
  const byVoucher: Record<string, { dr: number, cr: number, entries: any[] }> = {};
  krishaEntries.forEach((e: any) => {
    const key = `${e._src}_${e.vid}`;
    if (!byVoucher[key]) byVoucher[key] = { dr: 0, cr: 0, entries: [] };
    byVoucher[key].dr += Number(e.dramt) || 0;
    byVoucher[key].cr += Number(e.cramt) || 0;
    byVoucher[key].entries.push(e);
  });

  const ledgerMap: Record<number, string> = {};
  acmac1.forEach((a: any) => { ledgerMap[a.id] = a.name; });

  console.log('\n--- Unbalanced Vouchers for Krisha ---');
  let unbalancedCount = 0;
  for (const [key, bal] of Object.entries(byVoucher)) {
    const diff = bal.dr - bal.cr;
    if (Math.abs(diff) > 0.01) {
      unbalancedCount++;
      const [src, vidStr] = key.split('_');
      const v = vMap[key];
      console.log(`\n❌ Voucher ${key}: DR=₹${bal.dr.toFixed(2)} CR=₹${bal.cr.toFixed(2)} DIFF=₹${diff.toFixed(2)}`);
      if (v) console.log(`   Date=${v.dt || v.date} Narr="${(v.narr || v.narration || '').substring(0, 60)}"`);
      bal.entries.forEach((e: any) => {
        const name = ledgerMap[e.maid] || `maid=${e.maid}`;
        if ((e.dramt || 0) > 0 || (e.cramt || 0) > 0) {
          console.log(`   └─ maid=${e.maid}(${name}): DR=${e.dramt||0} CR=${e.cramt||0} transid=${e.transid}`);
        }
      });
    }
  }

  if (unbalancedCount === 0) {
    console.log('✅ All Krisha vouchers are balanced!');
    console.log('\nThe ₹663 difference must be a DISPLAY issue in the balance sheet calculation.');
    console.log('Check if any ledger is double-counted or missing in the group hierarchy.');

    // Check if vid=0 has an imbalance for krisha
    const krishaVid0 = krishaEntries.filter((e: any) => e.vid === 0 || e.vid === '0');
    let v0Dr = 0, v0Cr = 0;
    krishaVid0.forEach((e: any) => {
      v0Dr += Number(e.dramt) || 0;
      v0Cr += Number(e.cramt) || 0;
    });
    console.log(`\nKrisha vid=0 (opening): DR=₹${v0Dr.toFixed(2)} CR=₹${v0Cr.toFixed(2)} DIFF=₹${(v0Dr - v0Cr).toFixed(2)}`);
  }
  console.log(`\nTotal unbalanced vouchers: ${unbalancedCount}`);
}

run().catch(console.error);
