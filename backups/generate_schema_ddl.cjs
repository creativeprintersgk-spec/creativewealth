const fs = require('fs');
const path = require('path');

const snapshotDir = path.join(__dirname, 'latest_snapshot');
const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json') && f !== 'manifest.json');

let sqlDDL = `-- ==============================================================================
-- WEALTHCORE COMPLETE SUPABASE SCHEMA & COLUMN DEFINITION DDL SCRIPT
-- Generated: ${new Date().toISOString()}
-- PURPOSE: If table columns are deleted, altered, or modified in Supabase,
-- paste and run this in Supabase SQL Editor to restore exact original columns.
-- ==============================================================================

`;

for (const f of files) {
  const tableName = f.replace('.json', '');
  const rows = JSON.parse(fs.readFileSync(path.join(snapshotDir, f), 'utf8'));
  if (rows.length === 0) continue;

  const sample = rows[0];
  const cols = Object.keys(sample);

  sqlDDL += `-- ------------------------------------------------------------------------------\n`;
  sqlDDL += `-- Table: ${tableName}\n`;
  sqlDDL += `-- ------------------------------------------------------------------------------\n`;
  sqlDDL += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

  const colDefs = cols.map(col => {
    const val = sample[col];
    let colType = 'TEXT';
    if (typeof val === 'number') {
      colType = Number.isInteger(val) ? 'BIGINT' : 'NUMERIC';
    } else if (typeof val === 'boolean') {
      colType = 'BOOLEAN';
    }
    return `  "${col}" ${colType}`;
  });

  sqlDDL += colDefs.join(',\n') + '\n);\n\n';
  sqlDDL += `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\n`;
  sqlDDL += `DO $$ BEGIN\n`;
  sqlDDL += `  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '${tableName}' AND policyname = 'Allow public access') THEN\n`;
  sqlDDL += `    CREATE POLICY "Allow public access" ON public.${tableName} FOR ALL USING (true) WITH CHECK (true);\n`;
  sqlDDL += `  END IF;\n`;
  sqlDDL += `END $$;\n\n`;
}

fs.writeFileSync(path.join(snapshotDir, 'schema_ddl.sql'), sqlDDL, 'utf8');
console.log('Successfully generated backups/latest_snapshot/schema_ddl.sql');
