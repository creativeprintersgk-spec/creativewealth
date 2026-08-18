import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function checkBs1Types() {
  const { data: rows, error } = await supabase
    .from('bs1')
    .select('trty, qn, amt')
    .limit(10000);

  if (error) {
    console.error('Error fetching bs1:', error.message);
    return;
  }

  const trtyMap: Record<number, { count: number; totalQty: number; totalAmt: number }> = {};
  rows.forEach(r => {
    const trty = Number(r.trty);
    const qty = Number(r.qn) || 0;
    const amt = Number(r.amt) || 0;
    if (!trtyMap[trty]) {
      trtyMap[trty] = { count: 0, totalQty: 0, totalAmt: 0 };
    }
    trtyMap[trty].count++;
    trtyMap[trty].totalQty += qty;
    trtyMap[trty].totalAmt += amt;
  });

  console.log('Transaction Types (trty) in bs1:');
  console.log(JSON.stringify(trtyMap, null, 2));
}

checkBs1Types().catch(console.error);
