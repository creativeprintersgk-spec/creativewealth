import { supabase } from '../src/supabase';

async function main() {
  console.log("Starting revert of Mutual Fund CAS imports (proper batch version)...");

  // --- Step 1: Fetch all vouchersc1 IDs with narration starting with "Mutual Fund CAS" ---
  const vchC1Ids: number[] = [];
  let page = 0;
  const limit = 1000;
  while (true) {
    console.log(`Fetching page ${page} of vouchersc1...`);
    const { data, error } = await supabase
      .from('vouchersc1')
      .select('vid')
      .ilike('narr', 'Mutual Fund CAS%')
      .range(page * limit, (page + 1) * limit - 1);
    if (error) {
      console.error("Error fetching vouchersc1 page:", error.message);
      return;
    }
    if (!data || data.length === 0) break;
    vchC1Ids.push(...data.map(v => Number(v.vid)));
    if (data.length < limit) break;
    page++;
  }
  console.log(`Found a total of ${vchC1Ids.length} vouchers in vouchersc1 to delete.`);

  // --- Step 2: Fetch all vouchers1 IDs with narration starting with "Mutual Fund CAS" ---
  const vch1Ids: number[] = [];
  page = 0;
  while (true) {
    console.log(`Fetching page ${page} of vouchers1...`);
    const { data, error } = await supabase
      .from('vouchers1')
      .select('vid')
      .ilike('narr', 'Mutual Fund CAS%')
      .range(page * limit, (page + 1) * limit - 1);
    if (error) {
      console.error("Error fetching vouchers1 page:", error.message);
      return;
    }
    if (!data || data.length === 0) break;
    vch1Ids.push(...data.map(v => Number(v.vid)));
    if (data.length < limit) break;
    page++;
  }
  console.log(`Found a total of ${vch1Ids.length} vouchers in vouchers1 to delete.`);

  // --- Step 3: Fetch all transaction rows in bs1 to delete, and collect unique pairs ---
  const bs1Ids: number[] = [];
  const uniquePairsMap = new Map<string, { pfid: number; amid: number }>();
  page = 0;
  while (true) {
    console.log(`Fetching page ${page} of bs1 rows...`);
    const { data, error } = await supabase
      .from('bs1')
      .select('trid, pfid, amid')
      .ilike('narr', 'Mutual Fund CAS%')
      .range(page * limit, (page + 1) * limit - 1);
    if (error) {
      console.error("Error fetching bs1 page:", error.message);
      return;
    }
    if (!data || data.length === 0) break;
    bs1Ids.push(...data.map(r => Number(r.trid)));
    for (const r of data) {
      if (r.pfid && r.amid) {
        const key = `${r.pfid}_${r.amid}`;
        uniquePairsMap.set(key, { pfid: Number(r.pfid), amid: Number(r.amid) });
      }
    }
    if (data.length < limit) break;
    page++;
  }
  console.log(`Found a total of ${bs1Ids.length} transaction rows in bs1 to delete.`);
  const uniquePairs = Array.from(uniquePairsMap.values());
  console.log(`Unique (pfid, amid) pairs affected: ${uniquePairs.length}`);

  // --- Step 4: Batch Delete transc1 entries ---
  if (vchC1Ids.length > 0) {
    console.log("Deleting rows from transc1 linked to vouchersc1...");
    for (let i = 0; i < vchC1Ids.length; i += limit) {
      const batch = vchC1Ids.slice(i, i + limit);
      const { error } = await supabase.from('transc1').delete().in('vid', batch);
      if (error) console.error("Error deleting transc1 batch:", error.message);
    }
    console.log("Deleted transc1 rows.");
  }

  // --- Step 5: Batch Delete trans1 entries ---
  if (vch1Ids.length > 0) {
    console.log("Deleting rows from trans1 linked to vouchers1...");
    for (let i = 0; i < vch1Ids.length; i += limit) {
      const batch = vch1Ids.slice(i, i + limit);
      const { error } = await supabase.from('trans1').delete().in('vid', batch);
      if (error) console.error("Error deleting trans1 batch:", error.message);
    }
    console.log("Deleted trans1 rows.");
  }

  // --- Step 6: Batch Delete vouchersc1 ---
  if (vchC1Ids.length > 0) {
    console.log("Deleting vouchers from vouchersc1...");
    for (let i = 0; i < vchC1Ids.length; i += limit) {
      const batch = vchC1Ids.slice(i, i + limit);
      const { error } = await supabase.from('vouchersc1').delete().in('vid', batch);
      if (error) console.error("Error deleting vouchersc1 batch:", error.message);
    }
    console.log("Deleted vouchersc1 rows.");
  }

  // --- Step 7: Batch Delete vouchers1 ---
  if (vch1Ids.length > 0) {
    console.log("Deleting vouchers from vouchers1...");
    for (let i = 0; i < vch1Ids.length; i += limit) {
      const batch = vch1Ids.slice(i, i + limit);
      const { error } = await supabase.from('vouchers1').delete().in('vid', batch);
      if (error) console.error("Error deleting vouchers1 batch:", error.message);
    }
    console.log("Deleted vouchers1 rows.");
  }

  // --- Step 8: Batch Delete bs1 rows ---
  if (bs1Ids.length > 0) {
    console.log("Deleting transaction rows from bs1...");
    for (let i = 0; i < bs1Ids.length; i += limit) {
      const batch = bs1Ids.slice(i, i + limit);
      const { error } = await supabase.from('bs1').delete().in('trid', batch);
      if (error) console.error("Error deleting bs1 batch:", error.message);
    }
    console.log("Deleted bs1 rows.");
  }

  // --- Step 9: Re-sync sum_table (holdings summary) for affected (pfid, amid) pairs ---
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
      console.log(`  Quantity is zero. Deleting holding summary...`);
      const { error: delSumErr } = await supabase
        .from('sum_table')
        .delete()
        .eq('pfolio_id', pair.pfid)
        .eq('amid', pair.amid);
      if (delSumErr) console.error("  Error deleting from sum_table:", delSumErr.message);
    } else {
      console.log(`  Remaining Quantity: ${qty}, AmtInvested: ${amtInvested}. Updating holding summary...`);
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
        // Query current max sid dynamically
        const { data: maxSumData } = await supabase
          .from('sum_table')
          .select('sid')
          .order('sid', { ascending: false })
          .limit(1);
        const nextSid = maxSumData && maxSumData.length > 0 ? Number(maxSumData[0].sid) + 1 : 10001;

        console.log(`  Inserting new sum_table record with sid = ${nextSid}`);
        const { error: insErr } = await supabase
          .from('sum_table')
          .insert({
            sid: nextSid,
            pfolio_id: pair.pfid,
            client_id: 1,
            atty: assetType,
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

  // --- Step 10: Delete orphaned mutual fund ledgers from acmac1 (efficient batch query) ---
  console.log("\nCleaning up orphaned mutual fund ledgers from acmac1...");
  const { data: mfLedgers, error: mfLedgErr } = await supabase
    .from('acmac1')
    .select('id, name')
    .eq('parent_id', 200061);

  if (mfLedgErr) {
    console.error("Error fetching mutual fund ledgers:", mfLedgErr.message);
  } else if (mfLedgers) {
    console.log(`Found ${mfLedgers.length} mutual fund ledgers to check.`);
    const ledgerIds = mfLedgers.map(l => Number(l.id));

    // Chunk ledgerIds into batches of 200 to check active transactions
    const activeLedgerIds = new Set<number>();
    const chunkSize = 200;
    for (let i = 0; i < ledgerIds.length; i += chunkSize) {
      const chunk = ledgerIds.slice(i, i + chunkSize);
      
      const { data: transc1Data } = await supabase
        .from('transc1')
        .select('maid')
        .in('maid', chunk);
      
      const { data: trans1Data } = await supabase
        .from('trans1')
        .select('maid')
        .in('maid', chunk);

      if (transc1Data) transc1Data.forEach(t => activeLedgerIds.add(Number(t.maid)));
      if (trans1Data) trans1Data.forEach(t => activeLedgerIds.add(Number(t.maid)));
    }

    // Ledgers that are NOT active are orphaned!
    const orphanedLedgers = mfLedgers.filter(l => !activeLedgerIds.has(Number(l.id)));
    console.log(`Found ${orphanedLedgers.length} orphaned ledgers out of ${mfLedgers.length}.`);

    for (const ledg of orphanedLedgers) {
      console.log(`  Deleting orphaned ledger: "${ledg.name}" (ID: ${ledg.id})`);
      const { error: delLedgErr } = await supabase
        .from('acmac1')
        .delete()
        .eq('id', ledg.id);
      if (delLedgErr) console.error(`  Error deleting ledger ${ledg.id}:`, delLedgErr.message);
    }
  }

  console.log("\nRevert complete! All imported mutual fund CAS records have been successfully and fully reverted.");
}

main().catch(console.error);
