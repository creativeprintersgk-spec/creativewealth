import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { initDatabase, state } = await import('../src/logic');
  await initDatabase();

  console.log("Total vouchers in memory:", state.vouchersC1.length);
  
  // Sort by vid descending
  const recentVouchers = [...state.vouchersC1]
    .sort((a, b) => b.vid - a.vid)
    .slice(0, 10);
    
  console.log("Most recent 10 vouchers in vouchersc1:");
  recentVouchers.forEach(v => {
    console.log({
      vid: v.vid,
      dt: v.dt,
      narr: v.narr,
      vtyp: v.vtyp,
      pfid: v.pfid,
      acid: v.acid
    });
    
    // Find transaction lines for this voucher
    const lines = state.transC1.filter((t: any) => t.vid === v.vid);
    console.log("  Lines:", lines.map((l: any) => ({
      transid: l.transid,
      maid: l.maid,
      dramt: l.dramt,
      cramt: l.cramt
    })));

    // Find bs1 lines for this voucher
    const bsLines = state.bs1.filter((b: any) => b.acvch === v.vid || b.trid === v.vid);
    console.log("  BS1 rows:", bsLines.map((b: any) => ({
      trid: b.trid,
      pfid: b.pfid,
      amid: b.amid,
      qn: b.qn,
      amt: b.amt,
      trty: b.trty,
      trstr: b.trstr
    })));
  });
}

run().catch(console.error);
