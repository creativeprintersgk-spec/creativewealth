const {createClient} = require('@supabase/supabase-js');
require('dotenv').config({path: '.env'});

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const {data: ledgers, error} = await supabase.from('acmac1')
        .select('maid, name, acid')
        .in('acid', [29, 30])
        .ilike('name', '%old share%');
    
    if (error) {
        console.error('Error fetching ledgers', error);
        return;
    }
    
    console.log('Ledgers:', ledgers);
    
    for (let l of ledgers) {
        const {data: ob} = await supabase.from('acvch1')
            .select('vid, vno, date, srno, amount, crdr, type')
            .eq('acid', l.acid)
            .eq('maid', l.maid)
            .eq('type', 11);
            
        console.log(`Opening Balances for ${l.name} (${l.acid}):`, ob);
    }
}

run();
