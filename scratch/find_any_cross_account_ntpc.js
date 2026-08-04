import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== Searching for any transactions with amount between 14075.00 and 14076.00 ===');

  const queries = [
    supabase.from('transc1').select('*').gte('dramt', 14075).lte('dramt', 14076),
    supabase.from('transc1').select('*').gte('cramt', 14075).lte('cramt', 14076),
    supabase.from('trans1').select('*').gte('dramt', 14075).lte('dramt', 14076),
    supabase.from('trans1').select('*').gte('cramt', 14075).lte('cramt', 14076)
  ];

  const results = await Promise.all(queries);
  const matched = [];
  
  results.forEach((res, i) => {
    const src = i < 2 ? 'transc1' : 'trans1';
    const side = (i % 2 === 0) ? 'DR' : 'CR';
    (res.data || []).forEach(row => {
      matched.push({ ...row, src, side });
    });
  });

  console.log(`Found ${matched.length} matching entries:`);
  for (const m of matched) {
    console.log(`\nEntry in ${m.src} (${m.side}):`);
    console.log(`  transid: ${m.transid}, vid: ${m.vid}, dt: ${m.dt}, maid: ${m.maid}, dramt: ${m.dramt}, cramt: ${m.cramt}, acid: ${m.acid}`);
    
    // Resolve maid name
    const { data: acmac } = await supabase.from('acmac1').select('name').eq('id', m.maid).eq('acid', m.acid).single();
    console.log(`  Maid Name in acmac1: ${acmac?.name || 'Not found'}`);

    // Fetch full voucher
    const vTable = m.src === 'transc1' ? 'vouchersc1' : 'vouchers1';
    const { data: vch } = await supabase.from(vTable).select('*').eq('vid', m.vid).single();
    if (vch) {
      console.log(`  Linked Voucher: vchno=${vch.vchno}, dt=${vch.dt}, narr="${vch.narr}", acid=${vch.acid}, pfid=${vch.pfid}`);
      
      // Fetch all entries for this voucher
      const eTable = m.src === 'transc1' ? 'transc1' : 'trans1';
      const { data: allLines } = await supabase.from(eTable).select('*').eq('vid', m.vid);
      console.log(`  All lines in this voucher:`);
      for (const line of allLines || []) {
        const { data: lineAcmac } = await supabase.from('acmac1').select('name').eq('id', line.maid).eq('acid', line.acid).single();
        console.log(`    - transid=${line.transid}, maid=${line.maid} (${lineAcmac?.name || 'unknown'}), DR=${line.dramt}, CR=${line.cramt}, acid=${line.acid}`);
      }
    }
  }
}

run().catch(console.error);
