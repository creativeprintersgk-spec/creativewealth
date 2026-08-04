import dotenv from 'dotenv';
dotenv.config();

// Polyfill import.meta.env for Node.js running this script
if (typeof (import.meta as any).env === 'undefined') {
  (import.meta as any).env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  };
}

async function main() {
  console.log('Dynamic importing logic...');
  const { initDatabase, syncLivePrices } = await import('../src/logic');
  console.log('Initializing database...');
  await initDatabase();
  console.log('Running syncLivePrices...');
  await syncLivePrices();
  console.log('Sync finished.');
}
main().catch(console.error);
