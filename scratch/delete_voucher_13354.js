import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const vid = 13354;
  console.log(`Deleting voucher ${vid} from transc1...`);
  const { error: errTrans } = await supabase.from('transc1').delete().eq('vid', vid);
  if (errTrans) {
    console.error("Error deleting from transc1:", errTrans);
  } else {
    console.log("Deleted lines from transc1.");
  }

  console.log(`Deleting voucher ${vid} from vouchersc1...`);
  const { error: errVoucher } = await supabase.from('vouchersc1').delete().eq('vid', vid);
  if (errVoucher) {
    console.error("Error deleting from vouchersc1:", errVoucher);
  } else {
    console.log("Deleted voucher from vouchersc1.");
  }
}

run().catch(console.error);
