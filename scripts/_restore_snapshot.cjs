require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const SNAP = "backups/latest_snapshot";
const BATCH = 500;

async function chunkInsert(table, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb.from(table).insert(batch);
    if (error) {
      console.error("\n  ERR batch " + i + ": " + error.message.substring(0, 150));
      return false;
    }
    inserted += batch.length;
    process.stdout.write("\r  " + inserted + "/" + rows.length + " inserted...");
  }
  console.log("\n  Done: " + inserted + " rows.");
  return true;
}

async function clearTable(name) {
  // Use RPC exec_sql to truncate (bypasses FK check order)
  const { error } = await sb.rpc("exec_sql", { query: "TRUNCATE TABLE public." + name + " CASCADE;" });
  if (error) {
    // Fallback: delete rows
    const { error: e2 } = await sb.from(name).delete().gte("transid", -1).catch(() => sb.from(name).delete().gte("vid", -1));
    if (e2) console.warn("  Warn clear " + name + ": " + (e2.message||""));
    else console.log("  Cleared (fallback).");
  } else {
    console.log("  Truncated OK.");
  }
}

async function run() {
  // 1. Restore acmac1 (with correct balances from snapshot - cr_bal/db_bal are non-zero here)
  console.log("\n=== [1/3] Restoring acmac1 (with correct balances) ===");
  {
    const rows = JSON.parse(fs.readFileSync(path.join(SNAP, "acmac1.json"), "utf8"));
    console.log("  " + rows.length + " rows");
    // Check HDFC
    const hdfc = rows.find(r => r.id === 11 && r.acid === 29);
    console.log("  HDFC cr_bal=" + hdfc?.cr_bal + " db_bal=" + hdfc?.db_bal);
    await clearTable("acmac1");
    await chunkInsert("acmac1", rows);
  }

  // 2. Restore vouchersc1 FIRST (transc1 depends on it via FK)
  console.log("\n=== [2/3] Restoring vouchersc1 ===");
  {
    const rows = JSON.parse(fs.readFileSync(path.join(SNAP, "vouchersc1.json"), "utf8"));
    console.log("  " + rows.length + " rows");
    await clearTable("vouchersc1");
    await chunkInsert("vouchersc1", rows);
  }

  // 3. Restore transc1
  console.log("\n=== [3/3] Restoring transc1 ===");
  {
    const rows = JSON.parse(fs.readFileSync(path.join(SNAP, "transc1.json"), "utf8"));
    console.log("  " + rows.length + " rows");
    await clearTable("transc1");
    await chunkInsert("transc1", rows);
  }

  // Verify
  console.log("\n=== Verifying Supabase counts ===");
  for (const t of ["acmac1","transc1","vouchersc1"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log("  " + t + ": " + count + " rows");
  }
  // Verify HDFC balance
  const { data: hdfc } = await sb.from("acmac1").select("id,name,cr_bal,db_bal,acid").eq("id", 11).eq("acid", 29);
  console.log("  HDFC in Supabase: " + JSON.stringify(hdfc));
  console.log("\n? Restore complete!");
}

run().catch(console.error);
