import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { count: c1, error: e1 } = await s.from('acmac1').select('id', { count: 'exact', head: true });
    console.log('acmac1 count:', c1, e1);

    const { count: c2, error: e2 } = await s.from('trans1').select('id', { count: 'exact', head: true });
    console.log('trans1 count:', c2, e2);
}
run();
