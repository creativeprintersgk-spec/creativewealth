import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function inspect() {
  console.log('=== INSPECTING ASSETS & TRANSACTIONS ===\n');

  // Search acmac1 for Digitide, Bluspring, Silver, HDFC
  const { data: acmac1Rows } = await supabase.from('acmac1').select('*');
  
  const searchTerms = ['Digitide', 'Bluspring', 'Silver', 'HDFC'];
  const matchedAssets = acmac1Rows?.filter(a => 
    searchTerms.some(t => a.name && a.name.toLowerCase().includes(t.toLowerCase()))
  ) || [];

  console.log('--- MATCHED ASSETS IN ACMAC1 ---');
  matchedAssets.forEach(a => {
    console.log(`ID: ${a.id} | Name: ${a.name} | ATYID: ${a.atyid} | Acid: ${a.acid} | ISIN: ${a.isin || a.extstr1}`);
  });

  const ids = matchedAssets.map(a => a.id);

  // Fetch transactions from transc1
  const { data: transc1Rows } = await supabase.from('transc1').select('*').in('maid', ids);

  console.log('\n--- MATCHED TRANSACTIONS IN TRANSC1 ---');
  transc1Rows?.forEach(t => {
    const asset = matchedAssets.find(a => a.id === t.maid);
    console.log(`VID: ${t.vid} | Date: ${t.dt} | Asset: ${asset?.name} (MAID: ${t.maid}) | Qty: ${t.qnt} | Dramt: ${t.dramt} | Cramt: ${t.cramt} | TRTY: ${t.trty} | PFID: ${t.pfid}`);
  });
}

inspect().catch(console.error);
