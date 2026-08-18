import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixGoldAttyInSupabase() {
  console.log('Fixing Gold atty in sum_table...');
  
  // 1. Update amid 466 (Gold) to atty = 150
  const { error: e1 } = await supabase
    .from('sum_table')
    .update({ atty: 150 })
    .eq('amid', 466);
  if (e1) console.error('Error updating amid 466:', e1);
  else console.log('Successfully updated amid 466 (Gold) to atty 150');

  // 2. Update amid 753 (Gold R) to atty = 150
  const { error: e2 } = await supabase
    .from('sum_table')
    .update({ atty: 150 })
    .eq('amid', 753);
  if (e2) console.error('Error updating amid 753:', e2);
  else console.log('Successfully updated amid 753 (Gold R) to atty 150');

  // 3. Update any other atty 75 rows to atty 150
  const { error: e3 } = await supabase
    .from('sum_table')
    .update({ atty: 150 })
    .eq('atty', 75);
  if (e3) console.error('Error updating atty 75:', e3);
  else console.log('Successfully updated all atty 75 to 150');

  // 4. Update any other atty 77 rows to atty 151 (Silver)
  const { error: e4 } = await supabase
    .from('sum_table')
    .update({ atty: 151 })
    .eq('atty', 77);
  if (e4) console.error('Error updating atty 77:', e4);
  else console.log('Successfully updated all atty 77 to 151');
}

fixGoldAttyInSupabase().catch(console.error);
