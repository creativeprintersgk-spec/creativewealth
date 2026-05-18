import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/get-prices`;
  console.log('Hitting:', url);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: [
        { id: 'index_nifty', type: 'index', code: '^NSEI' },
        { id: 'index_sensex', type: 'index', code: '^BSESN' }
      ]
    })
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main();
