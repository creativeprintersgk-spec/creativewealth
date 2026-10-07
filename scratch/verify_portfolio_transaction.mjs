import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/pms ...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on "Traded Bonds" tab
  console.log('Clicking "Traded Bonds" tab...');
  const tradedBondsTab = page.locator('button:has-text("Traded Bonds")').first();
  await tradedBondsTab.click();
  await page.waitForTimeout(800);

  // Click "+ Add Traded Bond (ISIN)"
  console.log('Clicking "+ Add Traded Bond (ISIN)" button...');
  const addBondBtn = page.locator('button:has-text("Add Traded Bond (ISIN)")').first();
  await addBondBtn.click();
  await page.waitForTimeout(800);

  // Find ISIN input
  const isinInput = page.locator('input[placeholder*="INE"], input[placeholder*="IN00"]').first();
  console.log('Entering ISIN INE549K07HI2 ...');
  await isinInput.fill('INE549K07HI2');

  // Wait for auto-fetch
  await page.waitForTimeout(2000);

  // Fill Quantity: 10
  const qtyInput = page.locator('input[placeholder="e.g. 100"]').first();
  if (await qtyInput.isVisible()) {
    await qtyInput.fill('10');
    console.log('Filled Quantity: 10');
  }

  await page.waitForTimeout(500);

  // Take screenshot
  const screenshotPath = 'scratch/screenshot_bond_portfolio_transaction.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();
})();
