// Check correct column names of bs1 table
import 'dotenv/config';

const BASE = 'https://ajjeoijjsklgkioxqkrb.supabase.co/rest/v1';
const KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const H = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` };

async function main() {
  const r = await fetch(`${BASE}/bs1?limit=2`, { headers: H });
  const d = await r.json();
  console.log('bs1 sample rows:', JSON.stringify(d, null, 2));
  
  const r2 = await fetch(`${BASE}/sam?limit=2`, { headers: H });
  const d2 = await r2.json();
  console.log('\nsam sample rows:', JSON.stringify(d2, null, 2));
}
main().catch(console.error);
