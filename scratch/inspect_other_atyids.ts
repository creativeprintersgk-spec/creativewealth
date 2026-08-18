import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function inspectOtherAtyids() {
  const { data: sells, error } = await supabase
    .from('bs1')
    .select('atyid, amid')
    .in('trty', [99, 101]);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const atyidAmids: Record<number, Set<number>> = {};
  sells.forEach(s => {
    const atyid = Number(s.atyid);
    const amid = Number(s.amid);
    if (!atyidAmids[atyid]) atyidAmids[atyid] = new Set();
    atyidAmids[atyid].add(amid);
  });

  console.log('All unique atyids in sells:', Object.keys(atyidAmids));

  for (const atyidStr in atyidAmids) {
    const atyid = Number(atyidStr);
    const amids = Array.from(atyidAmids[atyid]).slice(0, 5);
    
    const { data: assetsSam } = await supabase
      .from('sam')
      .select('amid, anm')
      .in('amid', amids);

    const { data: assetsAm } = await supabase
      .from('asset_master')
      .select('amid, name')
      .in('amid', amids);

    console.log(`atyid: ${atyid}`);
    assetsSam?.forEach(a => {
      console.log(`  [sam] amid: ${a.amid} -> ${a.anm}`);
    });
    assetsAm?.forEach(a => {
      console.log(`  [am]  amid: ${a.amid} -> ${a.name}`);
    });
  }
}

inspectOtherAtyids().catch(console.error);
