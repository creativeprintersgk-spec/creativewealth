import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { initDatabase, deleteVoucher } = await import('../src/logic');
  await initDatabase();
  console.log("Cleaning up test voucher 13341...");
  await deleteVoucher(13341);
  console.log("✅ Cleanup complete!");
}

run().catch(console.error);
