import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Check portfolio pfid=4
  const { data: port4 } = await supabase.from('portfolios').select('*').eq('id', 4);
  console.log('\n=== PORTFOLIO pfid=4 ===');
  console.log(JSON.stringify(port4, null, 2));

  const { data: link4 } = await supabase.from('acc_pflink').select('*').eq('pfid', 4);
  console.log('\n=== ACC_PFLINK pfid=4 ===');
  console.log(JSON.stringify(link4, null, 2));

  // Check all portfolios and their links
  const { data: allPorts } = await supabase.from('portfolios').select('id,investor_name,pfolio_type,is_group').neq('pfolio_type', 10).neq('pfolio_type', 5).eq('is_group', false).order('id');
  const { data: allLinks } = await supabase.from('acc_pflink').select('*');
  console.log('\n=== ALL PORTFOLIOS (non-account, non-group) ===');
  allPorts?.forEach(p => {
    const link = allLinks?.find(l => l.pfid === p.id);
    console.log(`  pfid=${p.id} type=${p.pfolio_type} acid=${link?.acid || 'NO LINK'} name=${p.investor_name}`);
  });

  // Check specific BS account mapping  
  // bs account acid=30 belongs to which account?
  const { data: accts } = await supabase.from('portfolios').select('*').eq('pfolio_type', 10);
  console.log('\n=== ACCOUNTS (pfolio_type=10) ===');
  accts?.forEach(a => console.log(`  acid=${a.id} name=${a.investor_name}`));
}

run().catch(console.error);
