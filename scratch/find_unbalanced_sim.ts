import 'dotenv/config';
import { supabase } from '../src/supabase';

async function findUnbalancedVouchers() {
  console.log("=== SCANNING FOR UNBALANCED OR ONE-SIDED VOUCHERS ===");

  // 1. Fetch all vouchers and trans
  const { data: vchs } = await supabase.from('vouchersc1').select('vid, narr, dt');
  const { data: trans } = await supabase.from('transc1').select('vid, maid, dramt, cramt');

  if (!vchs || !trans) {
    console.log("Failed to fetch data.");
    return;
  }

  // Group transactions by vid
  const transByVid: Record<number, any[]> = {};
  trans.forEach((t: any) => {
    const vid = Number(t.vid);
    if (!transByVid[vid]) transByVid[vid] = [];
    transByVid[vid].push(t);
  });

  console.log(`Scanned ${vchs.length} vouchers and ${trans.length} transaction lines.`);

  let unbalancedCount = 0;
  vchs.forEach((v: any) => {
    const lines = transByVid[v.vid] || [];
    let totalDebit = 0;
    let totalCredit = 0;
    let hasInvalidMaid = false;
    let invalidMaids: number[] = [];

    lines.forEach((l: any) => {
      totalDebit += l.dramt || 0;
      totalCredit += l.cramt || 0;
      if (!l.maid || l.maid === 0) {
        hasInvalidMaid = true;
        invalidMaids.push(l.maid);
      }
    });

    const diff = Math.abs(totalDebit - totalCredit);
    const isUnbalanced = diff > 0.05;

    if (isUnbalanced || hasInvalidMaid) {
      unbalancedCount++;
      console.log(`\n⚠️ Voucher vid=${v.vid} is problematic:`);
      console.log(`   - Date: ${v.dt}, Narration: "${v.narr}"`);
      console.log(`   - Debits sum: ${totalDebit.toFixed(2)}, Credits sum: ${totalCredit.toFixed(2)}, Diff: ${diff.toFixed(2)}`);
      if (hasInvalidMaid) {
        console.log(`   - ❌ Invalid maid (ledger ID) found: ${invalidMaids.join(", ")}`);
      }
      console.log(`   - Transaction lines:`);
      lines.forEach((l: any) => {
        console.log(`     * maid: ${l.maid}, Debit: ${l.dramt}, Credit: ${l.cramt}`);
      });
    }
  });

  console.log(`\n=== SCAN COMPLETE. Found ${unbalancedCount} problematic vouchers. ===`);
}

findUnbalancedVouchers().catch(console.error);
