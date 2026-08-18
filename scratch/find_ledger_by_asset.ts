import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function findLedgerByAssetName() {
  const assetNames = [
    'L&T Liquid Fund - Direct Plan -Growth',
    'ICICI Prudential Liquid Fund - Direct Plan - Growth'
  ];

  const { data: ledgers, error } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, is_group');

  if (error) {
    console.error(error);
    return;
  }

  assetNames.forEach(anm => {
    const cleanAssetName = anm.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matches = ledgers?.filter((l: any) => {
      if (l.is_group) return false;
      const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
    });

    console.log(`Asset Name: "${anm}"`);
    console.log(`Matches:`, matches);
  });
}

findLedgerByAssetName().catch(console.error);
