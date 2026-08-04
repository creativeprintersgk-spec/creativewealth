const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  for (const l of [
    { id: 66, name: 'OLD Shares', acid: 30 },
    { id: 27, name: 'OLD Shares', acid: 29 }
  ]) {
    const { data: entries1 } = await supabase.from('trans1')
      .select('transid, vid, vtyp, dt, maid, cramt, dramt, narr')
      .eq('acid', l.acid)
      .eq('maid', l.id);
    console.log(`trans1 entries for ${l.name} (acid: ${l.acid}, maid: ${l.id}):`, entries1);

    const { data: vch } = await supabase.from('vouchers1')
      .select('vid, vtyp, dt')
      .eq('acid', l.acid);
    // Find opening balance vouchers
    const opv = vch ? vch.filter(v => v.vtyp === 11 || v.vtyp === 'OP') : [];
    console.log(`opv vouchers for acid ${l.acid}:`, opv.length);
  }
}

run();
