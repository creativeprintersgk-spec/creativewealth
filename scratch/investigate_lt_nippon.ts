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

async function investigate() {
  console.log('=== SEARCHING SAM FOR L&T FINANCE AND NIPPON MULTI ASSET ===');

  // Search L&T Finance
  const { data: lt } = await s
    .from('sam')
    .select('*')
    .ilike('anm', '%L&T Finance%');
  console.log('L&T Finance in SAM:', lt);

  // Search Nippon India Multi Asset
  const { data: nippon } = await s
    .from('sam')
    .select('*')
    .ilike('anm', '%Nippon India Multi Asset%');
  console.log('Nippon Multi Asset in SAM:', nippon);

  const amids = [...(lt || []), ...(nippon || [])].map(a => a.amid);
  if (amids.length > 0) {
    const { data: prices } = await s
      .from('mprices')
      .select('*')
      .in('amid', amids);
    console.log('Prices in MPrices:', prices);
  }
}
investigate();
