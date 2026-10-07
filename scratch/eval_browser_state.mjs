import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Evaluate in browser context
  const evalResult = await page.evaluate(async () => {
    // Access global or import logic
    // Check localStorage or indexedDB
    const allBondsInSumTable = window.state?.sumTable?.filter((s) => s.amid === 1930000 || (s.atty === 100 || s.atty === 40));
    const muthootInSumTable = window.state?.sumTable?.filter((s) => s.amid === 1930000);
    const muthootInBs1 = window.state?.bs1?.filter((b) => b.amid === 1930000);
    const muthootInVouchers = window.state?.vouchersC1?.filter((v) => (v.narr || '').includes('Muthoot'));

    return {
      hasWindowState: Boolean(window.state),
      muthootInSumTable,
      muthootInBs1,
      muthootInVouchers,
      totalSumTableRows: window.state?.sumTable?.length
    };
  });

  console.log('Browser state evaluation result:', JSON.stringify(evalResult, null, 2));

  await browser.close();
})();
