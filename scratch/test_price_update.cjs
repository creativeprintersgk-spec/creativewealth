const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  const testRow = {
    amid: 55555,
    currp: 1653.25,
    prevp: 1650.0,
    date: '2026-05-26'
  };
  
  console.log("Attempting upsert with date:", testRow);
  const { data, error } = await sb.from('mprices').upsert(testRow).select();
  if (error) {
    console.error("Upsert failed:", error.message);
  } else {
    console.log("Upsert succeeded! Returned data:", data);
  }
}

testUpdate();
