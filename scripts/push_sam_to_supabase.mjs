import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Check current SAM in Supabase
const { data: currentSam, error: e1 } = await supabase.from('sam').select('amid, anm').order('amid');
console.log(`Current Supabase SAM: ${currentSam?.length || 0} rows`);
if (currentSam?.length) {
  const sample = currentSam.slice(-5);
  console.log('Last 5 entries:', sample.map(r => `amid=${r.amid} anm="${r.anm}"`).join(', '));
}

// Load the full SAM from our export
const samData = JSON.parse(readFileSync('scripts/sam_export.json', 'utf-8'));
console.log(`\nLocal SAM export: ${samData.length} rows`);

// Check which amids are missing from Supabase
const supabaseAmids = new Set(currentSam?.map(r => r.amid) || []);
const missing = samData.filter(r => !supabaseAmids.has(r.amid));
const wrongName = samData.filter(r => {
  const sup = currentSam?.find(s => s.amid === r.amid);
  return sup && sup.anm !== r.anm;
});

console.log(`\nMissing from Supabase: ${missing.length}`);
console.log(`Wrong name in Supabase: ${wrongName.length}`);
if (missing.length > 0) {
  console.log('Missing sample:', missing.slice(0, 5).map(r => `amid=${r.amid} "${r.anm}"`).join(', '));
}
if (wrongName.length > 0) {
  console.log('Wrong name sample:', wrongName.slice(0, 3).map(r => {
    const sup = currentSam?.find(s => s.amid === r.amid);
    return `amid=${r.amid}: Supabase="${sup?.anm}" vs Local="${r.anm}"`;
  }).join('\n  '));
}

// If there are differences, upsert all
if (missing.length > 0 || wrongName.length > 0) {
  console.log('\nUpserting complete SAM to Supabase...');
  // Batch in chunks of 100
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < samData.length; i += CHUNK) {
    const chunk = samData.slice(i, i + CHUNK);
    const { error } = await supabase.from('sam').upsert(chunk, { onConflict: 'amid' });
    if (error) {
      console.error(`Error at chunk ${i}: ${error.message}`);
    } else {
      total += chunk.length;
    }
  }
  console.log(`✅ Upserted ${total} SAM rows to Supabase`);
} else {
  console.log('\n✅ Supabase SAM is already up-to-date!');
}
