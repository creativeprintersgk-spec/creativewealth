const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBs1() {
  console.log("Checking bs1 schema and max trid...");
  const { data, error } = await supabase
    .from('bs1')
    .select('*')
    .order('trid', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error querying bs1:", error);
    return;
  }
  console.log("Recent trades in bs1:", JSON.stringify(data, null, 2));

  // Check sum_table schema too
  const { data: sumData, error: sumError } = await supabase
    .from('sum_table')
    .select('*')
    .limit(1);

  if (sumError) {
    console.error("Error querying sum_table:", sumError);
  } else {
    console.log("Sample sum_table row:", JSON.stringify(sumData, null, 2));
  }
}

checkBs1();
