import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function syncGroupMembers() {
  const zipPath = "C:\\Users\\Admin\\Downloads\\MProfit_Export_2026-08-08 (1).zip";
  const tempDir = path.resolve(__dirname, 'temp_zip_extract');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`);

  const file = fs.readdirSync(tempDir).find(f => f.toLowerCase() === 'investorgroupmembers.csv');
  if (file) {
    const content = fs.readFileSync(path.join(tempDir, file), 'utf-8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    
    // Map headers to column names
    const rows = parsed.data.map((r: any) => ({
      investor_group_id: r.InvestorGroupID ? Number(r.InvestorGroupID) : null,
      pfolio_id: r.PFolioID ? Number(r.PFolioID) : null,
      ext_src_id: r.ExtSrcID ? Number(r.ExtSrcID) : null
    })).filter(r => r.investor_group_id != null && r.pfolio_id != null);

    console.log('Inserting', rows.length, 'investor_group_members...');
    await s.from('investor_group_members').delete().neq('pfolio_id', -999999);
    const { error } = await s.from('investor_group_members').insert(rows);
    console.log('Result:', error ? error.message : 'SUCCESS!');
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
}
syncGroupMembers();
