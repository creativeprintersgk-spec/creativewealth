require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function run() {
  // Check what maids appear in transc1 vs trans1
  const { data: tc1Sample } = await sb.from("transc1").select("maid").limit(500);
  const tc1Maids = new Set(tc1Sample.map(r => r.maid));
  
  const { data: t1Sample } = await sb.from("trans1").select("maid").limit(1000);
  const t1Maids = new Set(t1Sample.map(r => r.maid));
  
  // Find overlap
  const overlap = [...tc1Maids].filter(m => t1Maids.has(m));
  console.log("transc1 unique maids (sample):", [...tc1Maids].sort((a,b)=>a-b).join(", "));
  console.log("\ntrans1 unique maids (sample):", [...t1Maids].sort((a,b)=>a-b).slice(0,30).join(", "));
  console.log("\nOVERLAP maids (in BOTH tables):", overlap.sort((a,b)=>a-b).join(", "));
  
  // Check HDFC (11) and RKSV (100002) in transc1
  const { data: hdfcC1 } = await sb.from("transc1").select("transid,maid,dramt,cramt,dt,acid").eq("maid", 11).limit(5);
  console.log("\ntransc1 for HDFC (maid=11):", hdfcC1?.length, "rows");
  hdfcC1?.forEach(r => console.log("  " + JSON.stringify(r)));

  const { data: rksv } = await sb.from("transc1").select("transid,maid,dramt,cramt,dt,acid").eq("maid", 100002).limit(5);
  console.log("\ntransc1 for RKSV (maid=100002):", rksv?.length, "rows");
  rksv?.forEach(r => console.log("  " + JSON.stringify(r)));

  // Get full HDFC net from transc1 only
  const { data: hdfcAll } = await sb.from("transc1").select("dramt,cramt").eq("maid", 11);
  const hdfcNet = (hdfcAll||[]).reduce((acc, r) => acc + (r.dramt||0) - (r.cramt||0), 0);
  console.log("\nHDFC net from transc1 ONLY:", hdfcNet.toFixed(2));
  
  // Get full RKSV net from transc1 only
  const { data: rksvAll } = await sb.from("transc1").select("dramt,cramt").eq("maid", 100002);
  const rksvNet = (rksvAll||[]).reduce((acc, r) => acc + (r.dramt||0) - (r.cramt||0), 0);
  console.log("RKSV net from transc1 ONLY:", rksvNet.toFixed(2));

  // Also check trans1 for maid=11 net
  const { data: hdfcT1 } = await sb.from("trans1").select("dramt,cramt").eq("maid", 11);
  const hdfcNetT1 = (hdfcT1||[]).reduce((acc, r) => acc + (r.dramt||0) - (r.cramt||0), 0);
  console.log("HDFC net from trans1 ONLY:", hdfcNetT1.toFixed(2));

  // Check what maids >= 500000 look like in transc1
  const { data: invInC1 } = await sb.from("transc1").select("maid").gte("maid", 500000).limit(5);
  console.log("\nInvestment maids (>=500000) in transc1:", invInC1?.length, invInC1?.map(r=>r.maid));
}
run().catch(console.error);
