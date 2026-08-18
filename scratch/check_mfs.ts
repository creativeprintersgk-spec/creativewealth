import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function checkMFs() {
  const { data: sells, error } = await supabase
    .from('bs1')
    .select('atyid, amid, trty')
    .in('trty', [99, 101]);

  if (error) {
    console.error(error);
    return;
  }

  // Group sells by atyid
  const atyids: Record<number, number> = {};
  sells.forEach(s => {
    const aty = Number(s.atyid);
    atyids[aty] = (atyids[aty] || 0) + 1;
  });
  console.log('Sells grouped by atyid:', atyids);

  // Let's inspect some of the sells where atyid = 60
  const sells60 = sells.filter(s => Number(s.atyid) === 60).slice(0, 10);
  const amids = sells60.map(s => s.amid);

  const { data: assets } = await supabase
    .from('asset_master')
    .select('amid, name')
    .in('amid', amids);

  console.log('Sells with atyid 60:');
  sells60.forEach(s => {
    const asset = assets?.find(a => a.amid === s.amid);
    console.log(`  amid: ${s.amid} -> ${asset?.name || 'unknown'}`);
  });
}

checkMFs().catch(console.error);
