import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click "Open Portfolio"
  const openPortBtn = page.locator('button:has-text("Open Portfolio")');
  await openPortBtn.click();
  await page.waitForTimeout(500);

  // Check "Krisha Inv" in modal
  const krishaOption = page.locator('label:has-text("Krisha Inv"), div:has-text("Krisha Inv")').last();
  await krishaOption.click();
  await page.waitForTimeout(500);

  // Click "Open Selected"
  const openSelectedBtn = page.locator('button:has-text("Open Selected")');
  await openSelectedBtn.click();
  await page.waitForTimeout(2000);

  // Take screenshot of Krisha Inv tab
  await page.screenshot({ path: 'scratch/krisha_tab_open_verified.png' });

  // Evaluate DOM
  const check = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const hasFutcur = bodyText.includes('FUTCURGBPINR28MAR2023');
    const hasSif = bodyText.includes('Special Inv. Funds');
    const hasPpf = bodyText.includes('PPF') || bodyText.includes('Public Provident Fund');

    return {
      hasFutcur,
      hasSif,
      hasPpf
    };
  });

  console.log('Final Krisha Tab Results:', JSON.stringify(check, null, 2));
  await browser.close();
})();
