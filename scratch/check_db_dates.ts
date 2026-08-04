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

async function run() {
  console.log("=== CHECKING DATABASE TRANSACTION DATE BOUNDARIES ===");

  async function getBoundary(table: string) {
    const { data: minData } = await supabase.from(table).select('dt').order('dt', { ascending: true }).limit(1);
    const { data: maxData } = await supabase.from(table).select('dt').order('dt', { ascending: false }).limit(1);
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return {
      min: minData?.[0]?.dt,
      max: maxData?.[0]?.dt,
      count
    };
  }

  const transc1 = await getBoundary('transc1');
  console.log(`transc1: min=${transc1.min} max=${transc1.max} count=${transc1.count}`);

  const trans1 = await getBoundary('trans1');
  console.log(`trans1: min=${trans1.min} max=${trans1.max} count=${trans1.count}`);

  const bs1 = await getBoundary('bs1');
  console.log(`bs1: min=${bs1.min} max=${bs1.max} count=${bs1.count}`);
}
run();
