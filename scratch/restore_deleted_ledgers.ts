import { supabase } from '../src/supabase';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log("Restoring incorrectly deleted mutual fund ledgers (deduplicated version)...");

  // Path to the log file containing the deleted ledgers
  const logPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\f4514959-25f1-4bb3-b2ec-0b556beaf4cb\\.system_generated\\tasks\\task-1839.log';
  if (!fs.existsSync(logPath)) {
    console.error("Log file not found at:", logPath);
    return;
  }

  const logContent = fs.readFileSync(logPath, 'utf-8');
  const lines = logContent.split('\n');

  // Parse lines like: Deleting orphaned ledger: "Quant Small Cap Fund-Growth Option-Direct Plan (51074476845 / 0)" (ID: 502791)
  const deletedLedgersMap = new Map<number, string>();
  const regex = /Deleting orphaned ledger:\s+"([^"]+)"\s+\(ID:\s+(\d+)\)/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      deletedLedgersMap.set(Number(match[2]), match[1]);
    }
  }

  const deletedLedgers = Array.from(deletedLedgersMap.entries()).map(([id, name]) => ({ id, name }));
  console.log(`Parsed ${deletedLedgers.length} unique deleted ledgers from log file.`);

  // Now, for each ledger, check if there are any transactions referencing it in transc1 or trans1
  let restoreCount = 0;
  for (const ledg of deletedLedgers) {
    // 1. Check transc1
    const { data: txC, error: errC } = await supabase
      .from('transc1')
      .select('acid, transid')
      .eq('maid', ledg.id)
      .limit(1);

    // 2. Check trans1
    const { data: txT, error: errT } = await supabase
      .from('trans1')
      .select('acid, transid')
      .eq('maid', ledg.id)
      .limit(1);

    let activeAcid: number | null = null;
    if (txC && txC.length > 0) activeAcid = Number(txC[0].acid);
    else if (txT && txT.length > 0) activeAcid = Number(txT[0].acid);

    if (activeAcid) {
      console.log(`Ledger "${ledg.name}" (ID: ${ledg.id}) is active for Account ID ${activeAcid}. Checking if exists in acmac1...`);
      
      // Check if it already exists in acmac1 (since some might have been restored in the previous partial run)
      const { data: existing, error: existErr } = await supabase
        .from('acmac1')
        .select('id')
        .eq('id', ledg.id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  Ledger ${ledg.id} already exists. Skipping.`);
        continue;
      }

      console.log(`  Restoring ledger ${ledg.id} to acmac1...`);
      const { error: insErr } = await supabase
        .from('acmac1')
        .insert({
          id: ledg.id,
          parent_id: 200061, // Mutual Funds (Equity)
          is_group: false,
          name: ledg.name,
          disp_seqno: 0,
          descr: '',
          acid: activeAcid,
          clid: 1,
          special_type_id: 150,
          cr_bal: 0,
          db_bal: 0,
          addr: '',
          pan: ''
        });

      if (insErr) {
        console.error(`  Error restoring ledger ${ledg.id}:`, insErr.message);
      } else {
        restoreCount++;
        console.log(`  Successfully restored ledger ${ledg.id}`);
      }
    }
  }

  console.log(`\nRestoration complete. Restored ${restoreCount} active ledgers.`);
}

main().catch(console.error);
