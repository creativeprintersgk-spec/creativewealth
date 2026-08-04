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
  const transid = 999999;
  const vid = 13332;
  const maid = 11; // HDFC Bank
  
  console.log("Testing insert with acid=null...");
  const { data: d1, error: e1 } = await supabase
    .from('transc1')
    .insert({
      transid,
      vid,
      acid: null,
      maid,
      dramt: 245000000,
      cramt: 0,
      dt: '2026-05-30'
    });
  
  if (e1) {
    console.error("Insert with acid=null failed:", e1.message);
  } else {
    console.log("Insert with acid=null succeeded:", d1);
    // clean up
    await supabase.from('transc1').delete().eq('transid', transid);
  }

  console.log("Testing insert with acid=29...");
  const { data: d2, error: e2 } = await supabase
    .from('transc1')
    .insert({
      transid: transid + 1,
      vid,
      acid: 29,
      maid,
      dramt: 245000000,
      cramt: 0,
      dt: '2026-05-30'
    });
  
  if (e2) {
    console.error("Insert with acid=29 failed:", e2.message);
  } else {
    console.log("Insert with acid=29 succeeded:", d2);
    // clean up
    await supabase.from('transc1').delete().eq('transid', transid + 1);
  }
}

run().catch(console.error);
