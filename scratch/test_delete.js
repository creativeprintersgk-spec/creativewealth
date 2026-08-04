import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim();
    env[k] = v;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: vch } = await supabase.from('vouchersc1').select('vid').order('vid', { ascending: false }).limit(1);
  if (!vch || vch.length === 0) { console.log("No vouchers"); return; }
  const rawVid = vch[0].vid;
  console.log("Found vid:", rawVid);

  const res1 = await supabase.from('transc1').delete().eq('vid', rawVid);
  console.log("Delete transc1:", res1.error ? res1.error : "Success");

  const res2 = await supabase.from('bs1').delete().eq('acvch', rawVid);
  console.log("Delete bs1:", res2.error ? res2.error : "Success");

  const res3 = await supabase.from('vouchersc1').delete().eq('vid', rawVid);
  console.log("Delete vouchersc1:", res3.error ? res3.error : "Success");
}
test();
