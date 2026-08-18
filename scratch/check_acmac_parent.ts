import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function checkAcmacParent() {
  const amids = [213279, 213312, 213079, 213958];
  
  // Find in acmac1
  const { data: ledgers, error } = await supabase
    .from('acmac1')
    .select('id, name, parent_id')
    .in('id', amids);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Ledgers in acmac1:');
  console.log(ledgers);
}

checkAcmacParent().catch(console.error);
