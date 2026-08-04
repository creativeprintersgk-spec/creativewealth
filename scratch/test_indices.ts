import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

async function testGetIndices() {
  const items = [
    { id: 'index_nifty', type: 'index', code: '^NSEI' },
    { id: 'index_sensex', type: 'index', code: '^BSESN' },
  ];
  
  console.log("Testing Edge Function get-prices with items:", items);
  console.log("URL:", `${supabaseUrl}/functions/v1/get-prices`);
  
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/get-prices`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      }
    );
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Raw Response Text:", text);
  } catch (err: any) {
    console.error("Fetch failed:", err);
  }
}

testGetIndices();
