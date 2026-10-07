import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/pms ...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(4000);

  // Click "Open Portfolio"
  console.log('Clicking "Open Portfolio"...');
  const openPortBtn = page.locator('button:has-text("Open Portfolio")').first();
  await openPortBtn.click();
  await page.waitForTimeout(1000);

  // Select "Pramesh Inv" in the modal
  console.log('Selecting Pramesh Inv in portfolio selector modal...');
  const prameshOption = page.locator('div:has-text("Pramesh Inv"), label:has-text("Pramesh Inv")').last();
  await prameshOption.click();
  await page.waitForTimeout(500);

  // Click Done or Open in the selector modal
  const doneBtn = page.locator('button:has-text("Done"), button:has-text("Select"), button:has-text("Apply")').first();
  if (await doneBtn.isVisible()) {
    await doneBtn.click();
  } else {
    // maybe pressing Enter or closing
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(2000);

  // Click "Traded Bonds" sub-tab
  console.log('Clicking "Traded Bonds" tab...');
  const tradedBondsTab = page.locator('button:has-text("Traded Bonds")').first();
  await tradedBondsTab.click();
  await page.waitForTimeout(1500);

  // Check for Muthoot
  const muthootElem = page.locator('text=Muthoot Fincorp NCD').first();
  const isFound = await muthootElem.isVisible();
  console.log('Is "Muthoot Fincorp NCD" visible in Pramesh Inv?', isFound);

  // Take screenshot
  await page.screenshot({ path: 'scratch/screenshot_pramesh_muthoot_confirmed.png' });
  console.log('Screenshot saved to scratch/screenshot_pramesh_muthoot_confirmed.png');

  // Also click All Assets tab to see it there
  const allAssetsTab = page.locator('button:has-text("All Assets")').first();
  if (await allAssetsTab.isVisible()) {
    await allAssetsTab.click();
    await page.waitForTimeout(1500);
    const isFoundAll = await page.locator('text=Muthoot Fincorp NCD').first().isVisible();
    console.log('Is "Muthoot Fincorp NCD" visible in All Assets?', isFoundAll);
    await page.screenshot({ path: 'scratch/screenshot_pramesh_all_assets_confirmed.png' });
  }

  await browser.close();
})();
