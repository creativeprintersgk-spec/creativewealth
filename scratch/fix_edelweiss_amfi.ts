import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const AMID = 214155;
const CORRECT_AMFI = 140196;

async function main() {
  console.log(`Updating AMFI code for AMID ${AMID} to ${CORRECT_AMFI}...`);
  const { data: updateData, error: updateErr } = await sb
    .from('asset_master')
    .update({ amfi_code: CORRECT_AMFI })
    .eq('amid', AMID)
    .select();

  if (updateErr) {
    console.error('Error updating asset_master:', updateErr);
    return;
  }
  console.log('Successfully updated asset_master:', updateData);

  console.log(`Deleting incorrect live price for AMID ${AMID} and date 2026-05-26 from mprices...`);
  const { data: delData, error: delErr } = await sb
    .from('mprices')
    .delete()
    .eq('amid', AMID)
    .eq('date', '2026-05-26')
    .select();

  if (delErr) {
    console.error('Error deleting old price row:', delErr);
    return;
  }
  console.log('Successfully deleted old price row:', delData);

  // Now, fetch the live NAV from mfapi.in and upsert it into mprices
  console.log(`Fetching live NAV from mfapi.in for AMFI ${CORRECT_AMFI}...`);
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${CORRECT_AMFI}`);
    if (!res.ok) {
      console.error('Failed to fetch from mfapi.in');
      return;
    }
    const data = await res.json();
    const today = data?.data?.[0];
    const yesterday = data?.data?.[1];

    if (!today) {
      console.error('No price data found on mfapi.in');
      return;
    }

    const todayNav = parseFloat(today.nav);
    const yesterdayNav = yesterday ? parseFloat(yesterday.nav) : todayNav;
    const todayDateStr = today.date; // e.g. "25-05-2026"
    const [dd, mm, yyyy] = todayDateStr.split('-');
    const formattedDate = `${yyyy}-${mm}-${dd}`; // standard SQL date

    console.log(`Latest NAV: ${todayNav} on ${formattedDate} (Yesterday: ${yesterdayNav})`);

    // Let's check if the date of today's NAV should be today's date (2026-05-26) or the NAV's date.
    // For consistency with live syncing, we record today's date "2026-05-26" as the date in mprices, or the NAV's date.
    // In our live sync, it writes it for today's date: "2026-05-26".
    const syncDate = '2026-05-26';

    const { data: insData, error: insErr } = await sb
      .from('mprices')
      .insert({
        source_id_atyp: 60,
        amid: AMID,
        currp: todayNav,
        prevp: yesterdayNav,
        date: syncDate
      })
      .select();

    if (insErr) {
      console.error('Error inserting new price row:', insErr);
    } else {
      console.log('Successfully inserted correct live price row:', insData);
    }
  } catch (err) {
    console.error('Exception fetching/inserting NAV:', err);
  }
}

main().catch(console.error);
