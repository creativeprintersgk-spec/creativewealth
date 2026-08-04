import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await sb
    .from('asset_master')
    .select('ticker')
    .not('ticker', 'is', null)
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample non-null tickers:', data);
    
    // Count non-null tickers
    const { count } = await sb
      .from('asset_master')
      .select('*', { count: 'exact', head: true })
      .not('ticker', 'is', null);
    console.log('Total non-null tickers:', count);
  }
}
main().catch(console.error);
