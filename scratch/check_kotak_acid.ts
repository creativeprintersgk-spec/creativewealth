import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  // Get the Unnati account ID (acid=30 based on earlier diagnostics)
  // Kotak Bank maid=48 for Unnati
  
  // Check how trans1 entries look for Kotak Bank maid=48
  const { data: t1 } = await supabase
    .from('trans1')
    .select('*')
    .eq('maid', 48)
    .limit(20);

  const { data: tc1 } = await supabase
    .from('transc1')
    .select('*')
    .eq('maid', 48)
    .limit(10);

  console.log('=== TRANS1 entries for Kotak Bank (maid=48) ===');
  (t1 || []).forEach((e: any) => {
    console.log(`  transid=${e.transid}, vid=${e.vid}, acid=${e.acid}, pfid=${e.pfid}, dt=${e.dt}, dr=${e.dramt}, cr=${e.cramt}`);
  });

  console.log('\n=== TRANSC1 entries for Kotak Bank (maid=48) ===');
  (tc1 || []).forEach((e: any) => {
    console.log(`  transid=${e.transid}, vid=${e.vid}, acid=${e.acid}, pfid=${e.pfid}, dt=${e.dt}, dr=${e.dramt}, cr=${e.cramt}`);
  });

  // Check vouchers1 for the vids in trans1
  const t1Vids = (t1 || []).map((e: any) => e.vid).filter(Boolean);
  const { data: v1 } = await supabase
    .from('vouchers1')
    .select('*')
    .in('vid', t1Vids.slice(0, 10));

  console.log('\n=== VOUCHERS1 for trans1 bank entries ===');
  (v1 || []).forEach((v: any) => {
    console.log(`  vid=${v.vid}, acid=${v.acid}, pfid=${v.pfid}, dt=${v.dt}, narr="${v.narr?.substring(0,40)}"`);
  });
}

run().catch(console.error);
