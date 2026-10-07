import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// HDFC Bank Unnati = acmac1.id=11, Trans1.maid=11
console.log("=== ALL Trans1 entries for HDFC Bank Unnati (maid=11, acid=29) ===");
const { data: hdfc } = await supabase.from('trans1')
  .select('transid,vid,vtyp,dt,maid,dramt,cramt,narr')
  .eq('maid', 11).eq('acid', 29)
  .order('dt');

let totalDr = 0, totalCr = 0;
hdfc?.forEach(r => {
  totalDr += r.dramt || 0;
  totalCr += r.cramt || 0;
  console.log(`  dt=${r.dt} vtyp=${r.vtyp} dr=${r.dramt} cr=${r.cramt} narr="${r.narr || ''}"`);
});
console.log(`\n  TOTAL: dr=${totalDr.toFixed(2)} cr=${totalCr.toFixed(2)} NET=${(totalDr-totalCr).toFixed(2)}`);

// Now check MProfit backup directly for comparison
console.log("\n=== CHECKING: Does MProfit DB have TransC1 closing entries for HDFC? ===");
// We already know TransC1 doesn't exist in v10 backup
// But check if Trans1 in MProfit DB has a closing entry (transfer/credit to close HDFC)
// The closing entry would be a CREDIT to maid=11 to zero it out

// Check Zerodha
console.log("\n=== Zerodha Settlement ACMA1 entry ===");
const { data: zd } = await supabase.from('acmac1')
  .select('id, acid, name').ilike('name', '%zerodha%').limit(5);
console.log("Zerodha:", JSON.stringify(zd));

if (zd?.length) {
  const zId = zd[0].id;
  const { data: zdT1 } = await supabase.from('trans1')
    .select('transid,dt,dramt,cramt,acid,maid')
    .eq('maid', zId).order('dt');
  let zdDr = 0, zdCr = 0;
  zdT1?.forEach(r => { zdDr += r.dramt||0; zdCr += r.cramt||0; });
  console.log(`  Zerodha maid=${zId}: total dr=${zdDr.toFixed(2)} cr=${zdCr.toFixed(2)} NET=${(zdDr-zdCr).toFixed(2)}`);
  console.log(`  Entries: ${zdT1?.length}`);
  zdT1?.slice(-5).forEach(r => console.log(`    dt=${r.dt} dr=${r.dramt} cr=${r.cramt}`));
}

// Check OPTIDX option - its SAM amid
console.log("\n=== Option OPTIDXNIFTY06JUL2023 PE 18000 balance check ===");
const { data: optSam } = await supabase.from('sam')
  .select('amid, anm').ilike('anm', '%OPTIDXNIFTY06JUL2023%PE%18000%').limit(3);
console.log("Option SAM:", JSON.stringify(optSam));
if (optSam?.length) {
  const optMaid = 500000 + optSam[0].amid;
  const { data: optT1 } = await supabase.from('trans1')
    .select('transid,dt,dramt,cramt,acid,maid').eq('maid', optMaid).order('dt');
  let optDr = 0, optCr = 0;
  optT1?.forEach(r => { optDr += r.dramt||0; optCr += r.cramt||0; });
  console.log(`  Option maid=${optMaid}: dr=${optDr.toFixed(2)} cr=${optCr.toFixed(2)} NET=${(optDr-optCr).toFixed(2)}`);
  optT1?.forEach(r => console.log(`    dt=${r.dt} vtyp=${r.vtyp||''} dr=${r.dramt} cr=${r.cramt}`));
}
