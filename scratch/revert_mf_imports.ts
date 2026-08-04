import { supabase } from '../src/supabase';

async function main() {
  console.log("Starting revert of Mutual Fund CAS imports...");

  // 1. Find all vouchers in vouchersc1 (Capital Vouchers) with narration starting with "Mutual Fund CAS"
  const { data: vchC1, error: vchC1Err } = await supabase
    .from('vouchersc1')
    .select('vid, narr')
    .ilike('narr', 'Mutual Fund CAS%');

  if (vchC1Err) {
    console.error("Error fetching vouchersc1:", vchC1Err.message);
    return;
  }

  // 2. Find all vouchers in vouchers1 (Trading Vouchers) with narration starting with "Mutual Fund CAS"
  const { data: vch1, error: vch1Err } = await supabase
    .from('vouchers1')
    .select('vid, narr')
    .ilike('narr', 'Mutual Fund CAS%');

  if (vch1Err) {
    console.error("Error fetching vouchers1:", vch1Err.message);
    return;
  }

  const vchC1Ids = vchC1 ? vchC1.map(v => v.vid) : [];
  const vch1Ids = vch1 ? vch1.map(v => v.vid) : [];

  console.log(`Found ${vchC1Ids.length} vouchers in vouchersc1 to delete.`);
  console.log(`Found ${vch1Ids.length} vouchers in vouchers1 to delete.`);

  // 3. Find transactions in bs1 (Portfolio Transactions) with narration starting with "Mutual Fund CAS"
  const { data: bs1Rows, error: bs1Err } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, narr')
    .ilike('narr', 'Mutual Fund CAS%');

  if (bs1Err) {
    console.error("Error fetching bs1:", bs1Err.message);
    return;
  }

  const bs1Ids = bs1Rows ? bs1Rows.map(r => r.trid) : [];
  console.log(`Found ${bs1Ids.length} transaction rows in bs1 to delete.`);

  // Collect unique (pfid, amid) pairs from bs1 rows to sync their stats later
  const uniquePairsMap = new Map<string, { pfid: number; amid: number }>();
  if (bs1Rows) {
    for (const r of bs1Rows) {
      if (r.pfid && r.amid) {
        const key = `${r.pfid}_${r.amid}`;
        uniquePairsMap.set(key, { pfid: Number(r.pfid), amid: Number(r.amid) });
      }
    }
  }
  const uniquePairs = Array.from(uniquePairsMap.values());
  console.log(`Unique (pfid, amid) pairs affected: ${uniquePairs.length}`);

  // 4. Delete transactions in transc1 linked to vouchersc1 IDs
  if (vchC1Ids.length > 0) {
    console.log("Deleting rows from transc1 linked to vouchersc1...");
    const { error: delTransC1Err } = await supabase
      .from('transc1')
      .delete()
      .in('vid', vchC1Ids);
    if (delTransC1Err) console.error("Error deleting from transc1:", delTransC1Err.message);
    else console.log("Deleted transc1 rows.");
  }

  // 5. Delete transactions in trans1 linked to vouchers1 IDs
  if (vch1Ids.length > 0) {
    console.log("Deleting rows from trans1 linked to vouchers1...");
    const { error: delTrans1Err } = await supabase
      .from('trans1')
      .delete()
      .in('vid', vch1Ids);
    if (delTrans1Err) console.error("Error deleting from trans1:", delTrans1Err.message);
    else console.log("Deleted trans1 rows.");
  }

  // 6. Delete vouchers from vouchersc1
  if (vchC1Ids.length > 0) {
    console.log("Deleting vouchers from vouchersc1...");
    const { error: delVchC1Err } = await supabase
      .from('vouchersc1')
      .delete()
      .in('vid', vchC1Ids);
    if (delVchC1Err) console.error("Error deleting from vouchersc1:", delVchC1Err.message);
    else console.log("Deleted vouchersc1 rows.");
  }

  // 7. Delete vouchers from vouchers1
  if (vch1Ids.length > 0) {
    console.log("Deleting vouchers from vouchers1...");
    const { error: delVch1Err } = await supabase
      .from('vouchers1')
      .delete()
      .in('vid', vch1Ids);
    if (delVch1Err) console.error("Error deleting from vouchers1:", delVch1Err.message);
    else console.log("Deleted vouchers1 rows.");
  }

  // 8. Delete transaction rows from bs1
  if (bs1Ids.length > 0) {
    console.log("Deleting transaction rows from bs1...");
    const { error: delBs1Err } = await supabase
      .from('bs1')
      .delete()
      .in('trid', bs1Ids);
    if (delBs1Err) console.error("Error deleting from bs1:", delBs1Err.message);
    else console.log("Deleted bs1 rows.");
  }

  // 9. Re-sync sum_table (holdings summary) for affected (pfid, amid) pairs
  console.log("\nRe-syncing affected portfolio holdings...");
  for (const pair of uniquePairs) {
    console.log(`Syncing stats for Portfolio ID ${pair.pfid}, AMID ${pair.amid}...`);
    // Query remaining transactions in bs1 for this pair
    const { data: remainingTxs, error: remErr } = await supabase
      .from('bs1')
      .select('*')
      .eq('pfid', pair.pfid)
      .eq('amid', pair.amid);

    if (remErr) {
      console.error(`  Error querying bs1 for pfid ${pair.pfid}, amid ${pair.amid}:`, remErr.message);
      continue;
    }

    let qty = 0;
    let amtInvested = 0;
    let assetType = 50;

    const sortedTxs = remainingTxs ? [...remainingTxs].sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trid) - Number(b.trid))) : [];

    sortedTxs.forEach((t: any) => {
      const q = Number(t.qn) || 0;
      const amt = Number(t.amt) || 0;
      const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
      assetType = t.atyid || assetType;

      if (isBuy) {
        qty += q;
        amtInvested += amt;
      } else {
        const prevQty = qty;
        qty -= q;
        if (prevQty > 0) {
          amtInvested -= (q / prevQty) * amtInvested;
        } else {
          amtInvested -= amt;
        }
      }
    });

    if (qty <= 0.0001) {
      qty = 0;
      amtInvested = 0;
    }
    if (amtInvested < 0) amtInvested = 0;

    if (qty === 0) {
      // Delete holding from sum_table
      console.log(`  Quantity is zero. Deleting holding summary...`);
      const { error: delSumErr } = await supabase
        .from('sum_table')
        .delete()
        .eq('pfolio_id', pair.pfid)
        .eq('amid', pair.amid);
      if (delSumErr) console.error("  Error deleting from sum_table:", delSumErr.message);
    } else {
      // Update holding in sum_table
      console.log(`  Remaining Quantity: ${qty}, AmtInvested: ${amtInvested}. Updating holding summary...`);
      // Update or insert
      const { data: existingSum } = await supabase
        .from('sum_table')
        .select('sid')
        .eq('pfolio_id', pair.pfid)
        .eq('amid', pair.amid)
        .limit(1);

      if (existingSum && existingSum.length > 0) {
        const { error: updErr } = await supabase
          .from('sum_table')
          .update({
            qnt: qty,
            amtinv: amtInvested,
          })
          .eq('sid', existingSum[0].sid);
        if (updErr) console.error("  Error updating sum_table:", updErr.message);
      } else {
        // Insert new sum row
        const { error: insErr } = await supabase
          .from('sum_table')
          .insert({
            pfolio_id: pair.pfid,
            amid: pair.amid,
            qnt: qty,
            amtinv: amtInvested,
            currv: qty * 1.0,
            sellcnt: 0,
            tgain: 0,
            relgain: 0,
            today_amtinv: 0,
            today_quant: 0
          });
        if (insErr) console.error("  Error inserting into sum_table:", insErr.message);
      }
    }
  }

  // 10. Delete any dynamically created mutual fund ledgers in acmac1 (ledger IDs >= 500000)
  // that have parent_id = 200061 (Mutual Funds) and have NO transactions remaining in transc1 or trans1
  console.log("\nCleaning up orphaned mutual fund ledgers from acmac1...");
  const { data: mfLedgers, error: mfLedgErr } = await supabase
    .from('acmac1')
    .select('id, name')
    .eq('parent_id', 200061);

  if (mfLedgErr) {
    console.error("Error fetching mutual fund ledgers:", mfLedgErr.message);
  } else if (mfLedgers) {
    console.log(`Found ${mfLedgers.length} mutual fund ledgers to check.`);
    for (const ledg of mfLedgers) {
      // Check if there are any remaining transc1 entries
      const { count: transCCount } = await supabase
        .from('transc1')
        .select('*', { count: 'exact', head: true })
        .eq('maid', ledg.id);

      // Check if there are any remaining trans1 entries
      const { count: trans1Count } = await supabase
        .from('trans1')
        .select('*', { count: 'exact', head: true })
        .eq('maid', ledg.id);

      const totalCount = (transCCount || 0) + (trans1Count || 0);
      if (totalCount === 0) {
        console.log(`  Ledger "${ledg.name}" (ID: ${ledg.id}) has no remaining transactions. Deleting...`);
        const { error: delLedgErr } = await supabase
          .from('acmac1')
          .delete()
          .eq('id', ledg.id);
        if (delLedgErr) console.error(`  Error deleting ledger ${ledg.id}:`, delLedgErr.message);
      }
    }
  }

  console.log("\nRevert complete! All imported mutual fund CAS records have been removed successfully.");
}

main().catch(console.error);
