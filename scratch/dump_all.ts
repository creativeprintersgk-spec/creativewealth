import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function dumpAll() {
  const [
    { data: families },
    { data: accounts },
    { data: portfolios },
    { data: investorGroups }
  ] = await Promise.all([
    supabase.from('families').select('*'),
    supabase.from('accounts').select('*'),
    supabase.from('portfolios').select('*'),
    supabase.from('investor_groups').select('*')
  ]);
  console.log("Families:", families);
  console.log("Accounts:", accounts);
  console.log("Portfolios:", portfolios);
  console.log("Investor Groups:", investorGroups);
}

dumpAll();
