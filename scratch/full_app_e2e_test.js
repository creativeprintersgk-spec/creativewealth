const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Full App E2E Test Suite via Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('1. Navigating to http://localhost:5173/pms...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('2. Checking Page Content...');
  const pageText = await page.textContent('body');
  console.log('   Pramesh R Shah visible:', pageText.includes('Pramesh') ? 'YES ✅' : 'NO ❌');

  console.log('3. Opening Reports Modal...');
  const reportBtn = page.locator('button').filter({ hasText: /^Reports$/i }).first();
  if (await reportBtn.isVisible()) {
    await reportBtn.click();
    await page.waitForTimeout(1500);
    console.log('   ✅ Reports button clicked!');
  } else {
    // Try finding any button with 'Report' in text
    const anyReportBtn = page.locator('button:has-text("Report")').first();
    if (await anyReportBtn.isVisible()) {
      await anyReportBtn.click();
      await page.waitForTimeout(1500);
      console.log('   ✅ Found & Clicked Report button!');
    }
  }

  console.log('4. Selecting Capital Gains - Income Tax Return Format...');
  const itrOption = page.locator('text="Capital Gains - Income Tax Return Format"').first();
  if (await itrOption.isVisible()) {
    await itrOption.click();
    await page.waitForTimeout(1000);

    const generateBtn = page.locator('button:has-text("Generate Report")').first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(3000);
      console.log('   ✅ Generated Capital Gains ITR Format Report Modal!');

      const modalText = await page.textContent('body');
      console.log('   ISIN Codes present (INF/INE):', (modalText.includes('INE') || modalText.includes('INF')) ? 'YES ✅' : 'NO ❌');
      console.log('   Vodafone Idea Present:', modalText.includes('Vodafone Idea') ? 'YES ✅' : 'NO ❌');
      console.log('   Short Term Capital Gain Header:', modalText.includes('Short Term Capital Gain') ? 'YES ✅' : 'NO ❌');
      console.log('   Long Term Capital Gain Header:', modalText.includes('Long Term Capital Gain') ? 'YES ✅' : 'NO ❌');
    } else {
      console.log('   ⚠️ Generate Report button not visible!');
    }
  } else {
    console.log('   ⚠️ Capital Gains ITR option not visible directly!');
  }

  await browser.close();
  console.log('🎉 Full App E2E Test Suite Completed!');
})();
