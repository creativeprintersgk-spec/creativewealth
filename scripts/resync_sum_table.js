import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resyncSumTable() {
  console.log("Starting full sum_table resync...");

  // 1. Fetch all bs1 rows
  const { data: bs1, error: bs1Err } = await supabase.from('bs1').select('*');
  if (bs1Err) throw bs1Err;

  console.log(`Fetched ${bs1?.length} bs1 rows`);

  // 2. Fetch all sum_table rows
  const { data: sumTable, error: sumErr } = await supabase.from('sum_table').select('*');
  if (sumErr) throw sumErr;

  console.log(`Fetched ${sumTable?.length} sum_table rows`);

  // 3. Calculate correct sums from bs1
  const correctSums = new Map();

  for (const t of bs1 || []) {
    if (!t.pfid || !t.amid) continue;
    const key = `${t.pfid}_${t.amid}`;
    
    if (!correctSums.has(key)) {
      correctSums.set(key, {
        pfolio_id: t.pfid,
        amid: t.amid,
        atty: t.atyid,
        qnt: 0,
        amtinv: 0
      });
    }

    const s = correctSums.get(key);
    const qty = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = t.trstr?.toLowerCase().includes('buy') || t.trty === 20 || t.trty === 21;

    if (isBuy) {
      s.qnt += qty;
      s.amtinv += amt;
    } else {
      const prevQty = s.qnt;
      s.qnt -= qty;
      if (prevQty > 0) {
        s.amtinv -= (qty / prevQty) * s.amtinv;
      } else {
        s.amtinv -= amt;
      }
    }
  }

  console.log(`Calculated ${correctSums.size} unique portfolio/asset combinations`);

  // 4. Compare and update
  let updatedCount = 0;
  let deletedCount = 0;
  let insertedCount = 0;

  // Check existing sum_table rows
  for (const s of sumTable || []) {
    const key = `${s.pfolio_id}_${s.amid}`;
    const correct = correctSums.get(key);

    if (!correct || correct.qnt <= 0.0001) {
      // Row should not exist or quantity is zero
      console.log(`Deleting sum_table sid=${s.sid} (${key}) - Correct Qty: ${correct?.qnt || 0}, Current Qty: ${s.qnt}`);
      const { error } = await supabase.from('sum_table').delete().eq('sid', s.sid);
      if (error) console.error("Failed to delete", error);
      else deletedCount++;
    } else {
      // Check if values match
      const cQty = Number(correct.qnt.toFixed(4));
      const sQty = Number(Number(s.qnt).toFixed(4));
      const cAmt = Number(correct.amtinv.toFixed(2));
      const sAmt = Number(Number(s.amtinv).toFixed(2));

      if (cQty !== sQty || Math.abs(cAmt - sAmt) > 0.1) {
        console.log(`Updating sum_table sid=${s.sid} (${key}) - Qty: ${sQty} -> ${cQty}, Amt: ${sAmt} -> ${cAmt}`);
        const { error } = await supabase.from('sum_table').update({
          qnt: correct.qnt,
          amtinv: correct.amtinv
        }).eq('sid', s.sid);
        if (error) console.error("Failed to update", error);
        else updatedCount++;
      }
      correctSums.delete(key); // Mark as processed
    }
  }

  // Insert missing rows
  for (const [key, correct] of correctSums.entries()) {
    if (correct.qnt > 0.0001) {
      console.log(`Inserting sum_table for ${key} - Qty: ${correct.qnt}, Amt: ${correct.amtinv}`);
      
      const { data: maxSidData } = await supabase.from('sum_table').select('sid').order('sid', { ascending: false }).limit(1);
      const nextSid = (maxSidData?.[0]?.sid || 1000) + 1;

      const { error } = await supabase.from('sum_table').insert({
        sid: nextSid,
        client_id: 1,
        pfolio_id: correct.pfolio_id,
        amid: correct.amid,
        atty: correct.atty,
        qnt: correct.qnt,
        amtinv: correct.amtinv,
        currv: 0,
        tgain: 0
      });
      if (error) console.error("Failed to insert", error);
      else insertedCount++;
    }
  }

  console.log(`Done. Deleted: ${deletedCount}, Updated: ${updatedCount}, Inserted: ${insertedCount}`);
}

resyncSumTable().catch(console.error);
