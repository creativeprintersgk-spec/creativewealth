import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const jsonPath = path.join(process.cwd(), 'scratch', 'sqlite_mprices.json');

async function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found at ${jsonPath}`);
    return;
  }

  // 1. Load SQLite JSON data
  const sqliteData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const sqliteSet = new Set<string>();
  const sqliteMap = new Map<string, any>();

  for (const item of sqliteData) {
    const key = `${item.source_id_atyp}-${item.amid}-${item.date}`;
    sqliteSet.add(key);
    sqliteMap.set(key, item);
  }

  // 2. Fetch Supabase mprices data (paginated)
  const sbRows: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb
      .from('mprices')
      .select('source_id_atyp, amid, currp, prevp, date')
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (error) {
      console.error('Error fetching from Supabase:', error.message);
      return;
    }
    if (!data || data.length === 0) break;
    sbRows.push(...data);
    page++;
  }

  const sbSet = new Set<string>();
  const sbMap = new Map<string, any>();
  const todayDate = '2026-05-26'; // Ignore today's live sync prices

  for (const row of sbRows) {
    if (row.date === todayDate) continue;
    const key = `${row.source_id_atyp}-${row.amid}-${row.date}`;
    sbSet.add(key);
    sbMap.set(key, row);
  }

  console.log(`SQLite historical row count: ${sqliteSet.size}`);
  console.log(`Supabase historical row count: ${sbSet.size}`);

  // 3. Find mismatches
  const onlyInSqlite: string[] = [];
  const onlyInSupabase: string[] = [];
  const valueMismatches: string[] = [];

  for (const key of sqliteSet) {
    if (!sbSet.has(key)) {
      onlyInSqlite.push(key);
    } else {
      const sq = sqliteMap.get(key);
      const sbRow = sbMap.get(key);
      const sqCurr = sq.currp !== null ? Math.round(sq.currp * 10000) / 10000 : null;
      const sbCurr = sbRow.currp !== null ? Math.round(sbRow.currp * 10000) / 10000 : null;
      const sqPrev = sq.prevp !== null ? Math.round(sq.prevp * 10000) / 10000 : null;
      const sbPrev = sbRow.prevp !== null ? Math.round(sbRow.prevp * 10000) / 10000 : null;

      if (sqCurr !== sbCurr || sqPrev !== sbPrev) {
        valueMismatches.push(`${key} (SQLite CURR=${sqCurr}/PREV=${sqPrev} vs Supabase CURR=${sbCurr}/PREV=${sbPrev})`);
      }
    }
  }

  for (const key of sbSet) {
    if (!sqliteSet.has(key)) {
      onlyInSupabase.push(key);
    }
  }

  console.log(`Rows only in SQLite: ${onlyInSqlite.length}`);
  if (onlyInSqlite.length > 0) {
    console.log('Sample rows only in SQLite:', onlyInSqlite.slice(0, 10));
  }

  console.log(`Rows only in Supabase: ${onlyInSupabase.length}`);
  if (onlyInSupabase.length > 0) {
    console.log('Sample rows only in Supabase:', onlyInSupabase.slice(0, 10));
  }

  console.log(`Value mismatches: ${valueMismatches.length}`);
  if (valueMismatches.length > 0) {
    console.log('Sample value mismatches:', valueMismatches.slice(0, 10));
  }

  if (onlyInSqlite.length === 0 && onlyInSupabase.length === 0 && valueMismatches.length === 0) {
    console.log('SUCCESS: All historical data in MPrices matches perfectly between SQLite and Supabase!');
  } else {
    console.log('WARNING: Mismatches found between SQLite and Supabase.');
  }

  // Cleanup temp json
  try {
    fs.unlinkSync(jsonPath);
  } catch (e) {}
}

main().catch(console.error);
