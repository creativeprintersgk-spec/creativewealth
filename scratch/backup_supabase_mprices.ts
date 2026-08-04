import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const backupPath = path.join(process.cwd(), 'scratch', 'supabase_mprices_backup.json');

async function main() {
  console.log('Starting backup of Supabase `mprices` table...');
  
  const sbRows: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb
      .from('mprices')
      .select('*')
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (error) {
      console.error('Error fetching from Supabase:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    sbRows.push(...data);
    console.log(`Fetched page ${page + 1} (${data.length} rows, total: ${sbRows.length})`);
    page++;
  }

  fs.writeFileSync(backupPath, JSON.stringify(sbRows, null, 2), 'utf8');
  console.log(`Backup completed successfully! Saved ${sbRows.length} rows to ${backupPath}`);
}

main().catch(console.error);
