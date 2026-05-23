import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function inspectTable(tableName: string, useIntId: boolean) {
  console.log(`\nInspecting table: ${tableName} (useIntId: ${useIntId})`);
  
  const payload: any = {};
  if (useIntId) {
    payload.id = 999999;
  }
  
  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select('*');

  if (error) {
    console.log(`Failed to insert into ${tableName}: ${error.message} (code: ${error.code})`);
    if (error.details) console.log(`Details: ${error.details}`);
  } else if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log(`Success! Table '${tableName}' columns:`, columns);
    // Cleanup
    const cleanupId = useIntId ? 999999 : data[0].id;
    const { error: delErr } = await supabase.from(tableName).delete().eq('id', cleanupId);
    if (delErr) console.log(`Cleanup error: ${delErr.message}`);
  } else {
    console.log(`Insert succeeded but no data was returned.`);
  }
}

async function run() {
  await inspectTable('pms_portfolios', false);
  await inspectTable('pms_portfolios', true);
  await inspectTable('pms_transactions', false);
  await inspectTable('pms_transactions', true);
  await inspectTable('pms_tax_lots', false);
  await inspectTable('pms_tax_lots', true);
}

run().catch(console.error);
