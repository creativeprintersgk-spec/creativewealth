import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const anonClient = createClient(supabaseUrl, anonKey);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  console.log('--- Testing with Anon Key ---');
  const { data: anonData, error: anonError } = await anonClient.from('prices').select('*').limit(5);
  console.log('Anon Error:', anonError?.message);
  console.log('Anon Data length:', anonData?.length);

  console.log('\n--- Testing with Service Role Key ---');
  const { data: serviceData, error: serviceError } = await serviceClient.from('prices').select('*').limit(5);
  console.log('Service Error:', serviceError?.message);
  console.log('Service Data length:', serviceData?.length);
  if (serviceData?.length) {
    console.log('Sample rows:', serviceData);
  }
}
main();
