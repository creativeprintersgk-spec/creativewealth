import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function cleanup() {
  const cnNum = 'CNT-26/27-31957379';
  console.log(`Deleting ghost entry for CN: ${cnNum}...`);
  const { data, error } = await supabase.from('scnote1').delete().ilike('cnnum', cnNum);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully deleted ghost entry!');
  }
}

cleanup();
