/**
 * Deep-dive into the Krisha A/C (acid=32) balance sheet display issue.
 * The raw data is balanced (DR=CR) but the UI shows ₹663 unbalanced.
 * This means a ledger is either:
 * 1. Missing from all groups (orphan ledger not attached to any group type)
 * 2. In a group that's counted twice
 * 3. Entry attributed to wrong account
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
  console.log('=== KRISHA A/C (acid=32) BALANCE SHEET DEEP DIVE ===\n');

  const KRISHA_ACID = 32;
  const [acmac1All, pflinks, portfolios, vouchersC1, vouchers1, transc1All, trans1All] = await Promise.all([
    safeFetch('acmac1'), safeFetch('acc_pflink'), safeFetch('portfolios'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'),
    safeFetch('transc1'), safeFetch('trans1')
  ]);

  // Krisha's portfolios
  const krishaPfids = pflinks.filter((l: any) => Number(l.acid) === KRISHA_ACID).map((l: any) => Number(l.pfid));
  console.log(`Krisha (acid=${KRISHA_ACID}) pfids:`, krishaPfids);

  // Get Krisha-specific acmac1 ledgers and groups
  const krishaAcmac1 = acmac1All.filter((a: any) => Number(a.acid) === KRISHA_ACID);
  const krishaGroups = krishaAcmac1.filter((a: any) => a.is_group);
  const krishaLedgers = krishaAcmac1.filter((a: any) => !a.is_group);

  console.log(`Krisha acmac1 rows: ${krishaAcmac1.length} (${krishaGroups.length} groups, ${krishaLedgers.length} ledgers)\n`);

  // Build voucher map
  const vMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { vMap[`c_${v.vid}`] = v; });
  vouchers1.forEach((v: any) => { vMap[`t_${v.vid}`] = v; });

  const allEntries = [
    ...transc1All.map((e: any) => ({ ...e, _src: 'c' })),
    ...trans1All.map((e: any) => ({ ...e, _src: 't' }))
  ];

  // Get Krisha entries
  const krishaEntries = allEntries.filter((e: any) => {
    const vKey = `${e._src}_${e.vid}`;
    const v = vMap[vKey];
    const eAcid = Number(e.acid) || Number(v?.acid);
    const vPfid = Number(v?.pfid || v?.portfolioId);
    return eAcid === KRISHA_ACID || (vPfid && krishaPfids.includes(vPfid));
  });

  // Calculate balance per ledger (maid)
  const ledgerBals: Record<number, { dr: number, cr: number }> = {};
  krishaEntries.forEach((e: any) => {
    const maid = Number(e.maid);
    if (!ledgerBals[maid]) ledgerBals[maid] = { dr: 0, cr: 0 };
    ledgerBals[maid].dr += Number(e.dramt) || 0;
    ledgerBals[maid].cr += Number(e.cramt) || 0;
  });

  // For each ledger that has a balance, check if it exists in Krisha's acmac1
  const krishaLedgerIds = new Set(krishaLedgers.map((l: any) => l.id));
  const krishaGroupIds = new Set(krishaGroups.map((g: any) => g.id));
  const globalLedgerMap: Record<number, any> = {};
  acmac1All.forEach((a: any) => { globalLedgerMap[a.id] = a; });

  // Walk up group chain to get type
  const getGroupType = (groupId: any): string => {
    let current = acmac1All.find((g: any) => g.id === groupId && g.is_group);
    while (current) {
      if (current.type) return current.type;
      current = acmac1All.find((g: any) => g.id === current.parent && g.is_group);
    }
    return 'UNKNOWN';
  };

  console.log('--- Ledger Balance Analysis for Krisha ---');
  let assetTotal = 0, liabilityTotal = 0, unknownTotal = 0;
  const orphanLedgers: any[] = [];
  const misclassifiedLedgers: any[] = [];

  for (const [maidStr, bal] of Object.entries(ledgerBals)) {
    const maid = Number(maidStr);
    const netBal = bal.dr - bal.cr;
    if (Math.abs(netBal) < 0.01) continue; // Skip zero-balance

    // Find this ledger in Krisha's acmac1
    const ledger = globalLedgerMap[maid];
    if (!ledger) {
      console.log(`  ⚠️ maid=${maid}: NO LEDGER in acmac1! DR=${bal.dr.toFixed(2)} CR=${bal.cr.toFixed(2)} Net=₹${netBal.toFixed(2)}`);
      orphanLedgers.push({ maid, netBal, bal });
      unknownTotal += netBal;
      continue;
    }

    const groupType = getGroupType(ledger.groupId || ledger.parent_id);
    const inKrishaScope = krishaLedgerIds.has(maid) || Number(ledger.acid) === KRISHA_ACID;

    if (groupType === 'ASSET') {
      assetTotal += netBal;
    } else if (['LIABILITY', 'INCOME', 'EXPENSE'].includes(groupType)) {
      liabilityTotal += (bal.cr - bal.dr);
    } else {
      unknownTotal += netBal;
      misclassifiedLedgers.push({ maid, name: ledger.name, groupType, netBal, inKrishaScope });
    }
  }

  console.log(`\nAssets Total:      ₹${assetTotal.toFixed(2)}`);
  console.log(`Liabilities Total: ₹${liabilityTotal.toFixed(2)}`);
  console.log(`Unknown/Orphan:    ₹${unknownTotal.toFixed(2)}`);
  console.log(`Difference (A - L): ₹${(assetTotal - liabilityTotal).toFixed(2)}`);

  if (orphanLedgers.length > 0) {
    console.log('\n❌ ORPHAN LEDGERS (in transactions but not in acmac1):');
    orphanLedgers.forEach(l => console.log(`  maid=${l.maid} Net=₹${l.netBal.toFixed(2)}`));
  }

  if (misclassifiedLedgers.length > 0) {
    console.log('\n⚠️ MISCLASSIFIED LEDGERS (unknown group type):');
    misclassifiedLedgers.forEach(l => {
      console.log(`  maid=${l.maid} name="${l.name}" type=${l.groupType} Net=₹${l.netBal.toFixed(2)} inKrisha=${l.inKrishaScope}`);
    });
  }

  // Check specifically for ₹663 amount in any ledger
  console.log('\n--- Looking for entries with amount near ₹663 ---');
  const target = 663;
  krishaEntries.forEach((e: any) => {
    const dr = Number(e.dramt) || 0;
    const cr = Number(e.cramt) || 0;
    if (Math.abs(dr - target) < 2 || Math.abs(cr - target) < 2) {
      const ledger = globalLedgerMap[e.maid];
      const vKey = `${e._src}_${e.vid}`;
      const v = vMap[vKey];
      console.log(`  transid=${e.transid} vid=${e.vid} date=${v?.dt||'?'} maid=${e.maid}(${ledger?.name}) DR=${dr} CR=${cr}`);
    }
  });

  // Check vid=0 opening balance for acid=32
  console.log('\n--- Krisha (acid=32) Opening Balance (vid=0) ---');
  const op = krishaEntries.filter((e: any) => e.vid === 0 || e.vid === '0');
  let opDr = 0, opCr = 0;
  op.forEach((e: any) => {
    const ledger = globalLedgerMap[e.maid];
    const dr = Number(e.dramt) || 0;
    const cr = Number(e.cramt) || 0;
    opDr += dr; opCr += cr;
    if (dr > 0 || cr > 0) {
      console.log(`  maid=${e.maid}(${ledger?.name||'?'}): DR=${dr} CR=${cr}`);
    }
  });
  console.log(`Opening Total: DR=₹${opDr.toFixed(2)} CR=₹${opCr.toFixed(2)} DIFF=₹${(opDr-opCr).toFixed(2)}`);
}

run().catch(console.error);
