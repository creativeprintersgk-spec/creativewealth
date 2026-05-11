import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSchema() {
  console.log("Checking Supabase schema...");
  const { data, error } = await supabase.from('families').select('*').limit(1);
  if (error) {
    if (error.code === '42P01') {
      console.error("❌ Table 'families' does not exist. Please run the SQL script in the Supabase SQL Editor first.");
    } else {
      console.error("❌ Error connecting to Supabase:", error.message);
    }
    process.exit(1);
  }
  console.log("✅ Schema detected. Ready for migration.");
}

checkSchema();
