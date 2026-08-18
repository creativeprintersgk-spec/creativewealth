const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Capital Gains UI Verification...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Click Reports button or trigger report modal
  const reportsBtn = await page.locator('button:has-text("Reports")');
  if (await reportsBtn.isVisible()) {
    await reportsBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'scratch/cg_fixed_modal.png', fullPage: true });
  console.log('📸 Saved screenshot to scratch/cg_fixed_modal.png');

  await browser.close();
})();
