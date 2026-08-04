const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function parseCSV(text) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let currentVal = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(currentVal);
      result.push(row);
      row = [];
      currentVal = "";
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal);
    result.push(row);
  }
  return result;
}

const mapColumn = {
  'pfolioid': 'pfolio_id',
  'clientid': 'client_id',
  'iscurrvmanual': 'is_currv_manual',
  'extid': 'ext_id',
};

function parseValue(val) {
  const cleanVal = val.trim();
  if (cleanVal === "") return null;
  const parsedNum = parseFloat(cleanVal);
  return isNaN(parsedNum) ? cleanVal : parsedNum;
}

async function run() {
  const text = fs.readFileSync('scratch/mprofit_csv/SumTable.csv', 'utf-8');
  const parsed = parseCSV(text);
  const headers = parsed[0].map(h => {
    const lower = h.trim().toLowerCase();
    return mapColumn[lower] || lower;
  });
  
  const rows = parsed.slice(1).filter(r => r.some(c => c.trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = parseValue(row[i] ?? '');
    });
    return obj;
  });

  console.log(`Parsed ${rows.length} rows. Upserting into sum_table...`);
  
  // Upsert in batches of 500
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('sum_table').upsert(batch, { onConflict: 'sid' });
    if (error) {
      console.error('Error upserting batch', i, error.message);
    } else {
      console.log(`Upserted batch ${i / batchSize + 1}`);
    }
  }
  console.log('Done!');
}

run();
