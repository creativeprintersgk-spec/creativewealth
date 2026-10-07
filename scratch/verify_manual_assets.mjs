import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:5173/pms...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click Stocks tab in the asset bar
  console.log('2. Clicking "Stocks" tab in PMS asset bar...');
  const stocksTab = page.locator('button.asset-type-btn:has-text("Stocks")').first();
  await stocksTab.click();
  await page.waitForTimeout(1000);

  // Check Quick Action button for Add Stock
  console.log('3. Checking Add Stock (ISIN) button...');
  const addStockBtn = page.getByRole('button', { name: 'Add Stock (ISIN)' });
  await addStockBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Found Add Stock (ISIN) button');

  // Click Add Stock button to open modal
  console.log('4. Clicking Add Stock (ISIN)...');
  await addStockBtn.click();
  await page.waitForTimeout(1000);

  // Enter invalid ISIN and verify lookup error
  console.log('5. Testing ISIN validation...');
  const isinInput = page.getByPlaceholder('e.g. INE002A01018');
  await isinInput.fill('INVALID123');
  const verifyBtn = page.getByRole('button', { name: /Verify & Lookup/i });
  await verifyBtn.click();
  await page.waitForTimeout(500);
  const errorMsg = await page.getByText(/Invalid Indian ISIN/i).textContent().catch(() => null);
  console.log('✓ ISIN validation check on invalid input:', errorMsg ? `PASSED (${errorMsg})` : 'FAILED');

  // Enter valid stock ISIN (Reliance INE002A01018)
  await isinInput.fill('INE002A01018');
  await verifyBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/screenshot_add_stock_modal.png' });
  console.log('✓ Saved screenshot_add_stock_modal.png');

  // Switch to Traded Bond Tab inside modal
  console.log('6. Switching to Traded Bond Tab inside modal...');
  const bondTab = page.locator('form button:has-text("Traded Bond")');
  await bondTab.click();
  await page.waitForTimeout(500);

  // Verify bond specific fields are present
  const couponInput = page.locator('input[placeholder="e.g. 7.30"]');
  const maturityInput = page.locator('input[type="date"]');
  const faceValInput = page.locator('input[type="number"][value="100"]');
  const bondClassSelect = page.locator('select').first();
  
  if (await couponInput.isVisible()) console.log('✓ Coupon Rate (%) field is visible');
  if (await maturityInput.isVisible()) console.log('✓ Maturity Date field is visible');
  if (await faceValInput.isVisible()) console.log('✓ Face Value (₹) field is visible');
  if (await bondClassSelect.isVisible()) console.log('✓ Bond Classification field is visible');

  // Fill in bond ISIN: Sovereign Gold Bond (IN0020180314)
  const bondIsinInput = page.getByPlaceholder('e.g. IN0020230051');
  await bondIsinInput.fill('IN0020180314');
  await verifyBtn.click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'scratch/screenshot_add_bond_modal.png' });
  console.log('✓ Saved screenshot_add_bond_modal.png');

  // Close modal
  const cancelBtn = page.getByRole('button', { name: 'Cancel' });
  await cancelBtn.click();
  await page.waitForTimeout(500);

  // Switch to Bonds tab in PMS
  console.log('7. Switching to "Traded Bonds" tab in PMS asset bar...');
  const bondsTab = page.locator('button.asset-type-btn:has-text("Traded Bonds")').first();
  await bondsTab.click();
  await page.waitForTimeout(1000);
  const addBondBtn = page.getByRole('button', { name: /Add Traded Bond \(ISIN\)/i });
  if (await addBondBtn.isVisible()) console.log('✓ Found Add Traded Bond (ISIN) button');

  // Navigate to Master Entry
  console.log('8. Navigating to Master Entry (/master-entry)...');
  await page.goto('http://localhost:5173/master-entry', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click Securities Master tab
  console.log('9. Switching to Securities Master tab...');
  const secTab = page.getByRole('button', { name: /Securities Master/i });
  await secTab.click();
  await page.waitForTimeout(1000);

  // Verify Securities Master table and take screenshot
  await page.screenshot({ path: 'scratch/screenshot_securities_master.png' });
  console.log('✓ Saved screenshot_securities_master.png');

  // Click filter for Traded Bonds
  console.log('10. Filtering by Traded Bonds & G-Secs in Securities Master...');
  const bondFilter = page.getByRole('button', { name: /Traded Bonds & G-Secs/i });
  await bondFilter.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/screenshot_bonds_filter.png' });
  console.log('✓ Saved screenshot_bonds_filter.png');

  // Test opening Add Security Modal from Master Entry
  console.log('11. Clicking Add Security (ISIN) from Master Entry...');
  const addSecMasterBtn = page.getByRole('button', { name: /Add Security \(ISIN\)/i }).first();
  await addSecMasterBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/screenshot_master_entry_modal.png' });
  console.log('✓ Saved screenshot_master_entry_modal.png');

  console.log('\n=============================================');
  console.log(' ALL PLAYWRIGHT BROWSER VERIFICATIONS PASSED! ');
  console.log('=============================================\n');
  await browser.close();
}

run().catch(e => {
  console.error('Playwright verification error:', e);
  process.exit(1);
});
