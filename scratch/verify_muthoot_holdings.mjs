import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/pms ...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click on "Traded Bonds" tab
  console.log('Clicking "Traded Bonds" tab...');
  const tradedBondsTab = page.locator('button:has-text("Traded Bonds")').first();
  await tradedBondsTab.click();
  await page.waitForTimeout(1500);

  // Check if Muthoot appears in the grid
  const muthootText = page.locator('text=Muthoot Fincorp NCD').first();
  const isMuthootVisible = await muthootText.isVisible();
  console.log('Is "Muthoot Fincorp NCD" visible under Traded Bonds?', isMuthootVisible);

  // Take screenshot of Traded Bonds tab
  await page.screenshot({ path: 'scratch/screenshot_pramesh_muthoot_visible.png' });
  console.log('Screenshot saved to scratch/screenshot_pramesh_muthoot_visible.png');

  // Also check All Assets tab
  const allAssetsTab = page.locator('button:has-text("All Assets")').first();
  if (await allAssetsTab.isVisible()) {
    await allAssetsTab.click();
    await page.waitForTimeout(1500);
    const isVisibleInAll = await page.locator('text=Muthoot Fincorp NCD').first().isVisible();
    console.log('Is "Muthoot Fincorp NCD" visible under All Assets?', isVisibleInAll);
    await page.screenshot({ path: 'scratch/screenshot_all_assets_muthoot.png' });
  }

  await browser.close();
})();
