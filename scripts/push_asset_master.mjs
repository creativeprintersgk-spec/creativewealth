import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Load full name map from master DBs
const nameMap = JSON.parse(readFileSync('scripts/full_asset_name_map.json', 'utf-8'));
const entries = Object.entries(nameMap);
console.log(`Total names from master DBs: ${entries.length}`);

// Check current asset_master
const { data: existing, error: e1 } = await supabase.from('asset_master').select('amid, name').limit(10);
console.log(`Current asset_master sample (first 10):`, existing?.map(r => `${r.amid}:${r.name}`).join(', '));

// Check schema of asset_master
const { data: schema } = await supabase.from('asset_master').select('*').limit(1);
console.log(`\nasset_master sample row:`, schema?.[0]);

// Build upsert rows - asset_master needs: amid, name, isin (optional)
const rows = entries.map(([amid, name]) => ({
  amid: Number(amid),
  name: name,
}));

console.log(`\nUpserting ${rows.length} rows to asset_master...`);
const CHUNK = 200;
let total = 0, errors = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error } = await supabase.from('asset_master').upsert(chunk, { onConflict: 'amid' });
  if (error) {
    console.error(`Chunk ${i}: ${error.message}`);
    errors++;
  } else {
    total += chunk.length;
  }
}
console.log(`✅ Done: ${total} rows upserted, ${errors} errors`);

// Verify some key stocks
const { data: verify } = await supabase.from('asset_master')
  .select('amid, name')
  .in('amid', [100006, 100023, 100078, 213291, 202408])
  .order('amid');
console.log(`\nVerification (key stocks/MFs):`);
verify?.forEach(r => console.log(`  amid=${r.amid}: ${r.name}`));
