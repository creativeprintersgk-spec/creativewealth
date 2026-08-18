import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  // Let's count how many groups and ledgers exist in acmac1 per acid
  const { data: allAcmac } = await s.from('acmac1').select('id,acid,is_group,name').limit(10000);
  
  const stats = new Map<number, { groups: number; ledgers: number; names: string[] }>();
  allAcmac?.forEach(r => {
    const acid = r.acid;
    const existing = stats.get(acid) || { groups: 0, ledgers: 0, names: [] };
    if (r.is_group) existing.groups++;
    else {
      existing.ledgers++;
      if (existing.names.length < 5) existing.names.push(r.name);
    }
    stats.set(acid, existing);
  });

  console.log('=== acmac1 Stats by acid ===');
  for (const [acid, val] of stats.entries()) {
    console.log(`acid=${acid}: groups=${val.groups}, ledgers=${val.ledgers}`);
    console.log(`  Sample ledgers: ${val.names.join(', ')}`);
  }

  // Check portfolios table
  const { data: portfolios } = await s.from('portfolios').select('id,name,acid');
  console.log('\n=== Portfolios ===');
  console.log(JSON.stringify(portfolios, null, 2));
}
run();
