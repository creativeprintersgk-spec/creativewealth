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

const tableMap: Record<string, string> = {
  'portfolios.csv': 'portfolios',
  'investorgroupmembers.csv': 'investor_group_members',
  'acc_pflink.csv': 'acc_pflink',
  'acmac1.csv': 'acmac1',
  'sam.csv': 'sam',
  'bs1.csv': 'bs1',
  'sumtable.csv': 'sum_table',
  'vouchersc1.csv': 'vouchersc1',
  'vouchers1.csv': 'vouchers1',
  'transc1.csv': 'transc1',
  'trans1.csv': 'trans1',
  'mprices.csv': 'mprices',
  'scnote1.csv': 'scnote1'
};

async function run() {
  const zipPath = "C:\\Users\\Admin\\Downloads\\MProfit_Export_2026-08-08 (1).zip";
  const tempDir = path.resolve(__dirname, 'temp_zip_extract');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`);

  console.log('--- COMPARING CSV ROWS vs SUPABASE ROWS ---');
  const files = fs.readdirSync(tempDir);
  for (const file of files) {
    const tableKey = file.toLowerCase().replace(/_/g, '');
    const table = tableMap[tableKey] || tableMap[file.toLowerCase()];
    if (!table) continue;

    const content = fs.readFileSync(path.join(tempDir, file), 'utf-8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    const csvCount = parsed.data.length;

    const { count: sbCount } = await s.from(table).select('*', { count: 'exact', head: true });
    console.log(table.padEnd(25), `CSV: ${csvCount}`.padEnd(15), `Supabase: ${sbCount}`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
}
run();
