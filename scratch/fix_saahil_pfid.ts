import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fixPfids() {
  console.log('=== FIXING PFIDS FOR SAAHIL DEMERGED STOCKS ===\n');

  // Update Digitide Solutions (503025) and Bluspring Enterprises (503026) pfid to 1 (Saahil Inv) and acid to 31
  const { error: e1 } = await supabase.from('acmac1').update({ acid: 31 }).in('id', [503025, 503026]);
  console.log('acmac1 acid update:', e1 || 'SUCCESS');

  const { error: e2 } = await supabase.from('bs1').update({ pfid: 1 }).in('amid', [503025, 503026]);
  console.log('bs1 pfid update:', e2 || 'SUCCESS');
}

fixPfids().catch(console.error);
