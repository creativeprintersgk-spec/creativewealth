import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Check what asset_master table looks like for the missing NCD/debenture assets
const missingAmids = [781, 784, 845, 873, 920, 929, 1010, 1011, 1012, 1017, 1018,
                      1033, 1040, 1046, 1058, 1067, 1070, 1092, 1093, 1103, 1389, 1583, 1648];

// Check the column names in asset_master
const { data: sample } = await supabase
  .from('asset_master')
  .select('*')
  .limit(2);

if (sample && sample.length > 0) {
  console.log('asset_master columns:', Object.keys(sample[0]));
  console.log('Sample:', JSON.stringify(sample[0]));
} else {
  console.log('asset_master is EMPTY or does not exist');
}

// Look up the missing amid values
const { data: found } = await supabase
  .from('asset_master')
  .select('*')
  .in('amid', missingAmids);

console.log(`\nFound ${found?.length || 0} of ${missingAmids.length} missing assets in asset_master (using raw SAM amid)`);
if (found?.length) {
  for (const r of found.slice(0, 5)) {
    console.log(' ', JSON.stringify(r));
  }
}

// Also try with 500000+ prefix
const missing500k = missingAmids.map(x => x + 500000);
const { data: found500k } = await supabase
  .from('asset_master')
  .select('*')
  .in('amid', missing500k);

console.log(`\nFound ${found500k?.length || 0} of ${missingAmids.length} missing assets using 500000+amid prefix`);
if (found500k?.length) {
  for (const r of found500k.slice(0, 5)) {
    console.log(' ', JSON.stringify(r));
  }
}

// Check SAM table in Supabase for these
const { data: samRows } = await supabase
  .from('sam')
  .select('amid, anm, atyp')
  .in('amid', missingAmids);

console.log(`\nFound ${samRows?.length || 0} of ${missingAmids.length} missing assets in SAM (Supabase) using raw amid`);
if (samRows?.length) {
  for (const r of samRows.slice(0, 10)) {
    console.log(`  amid=${r.amid} anm="${r.anm}" atyp=${r.atyp}`);
  }
}
