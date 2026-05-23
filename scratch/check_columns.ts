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

async function checkSchema() {
  console.log("Checking 'sacm' table...");
  const { data: sacmData, error: sacmError } = await supabase.from('sacm').select('*').limit(1);
  if (sacmError) {
    console.error('Error fetching sacm:', sacmError.message);
  } else if (sacmData && sacmData.length > 0) {
    console.log('Columns in sacm:', Object.keys(sacmData[0]));
    console.log('Sample data:', sacmData[0]);
  } else {
    console.log('No data in sacm table.');
  }

  console.log("\nChecking 'clients' table...");
  const { data: clientsData, error: clientsError } = await supabase.from('clients').select('*').limit(1);
  if (clientsError) {
    console.error('Error fetching clients:', clientsError.message);
  } else if (clientsData && clientsData.length > 0) {
    console.log('Columns in clients:', Object.keys(clientsData[0]));
    console.log('Sample data:', clientsData[0]);
  } else {
    console.log('No data in clients table.');
  }
}

checkSchema();
