const https = require('https');
const fs = require('fs');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/';
const options = {
  headers: {
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY
  }
};

https.get(url, options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const tables = Object.keys(data.definitions || {});
      fs.writeFileSync('scratch/all_tables.txt', tables.join('\n'));
      console.log('Wrote to scratch/all_tables.txt');
    } catch(e) {
      console.error('Parse error:', e);
    }
  });
}).on('error', e => console.error(e));
