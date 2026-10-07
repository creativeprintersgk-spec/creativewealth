import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click on 'Krisha Inv' tab
  const buttons = await page.locator('button, div').all();
  for (const b of buttons) {
    const text = await b.textContent();
    if (text && text.trim() === 'Krisha Inv') {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'scratch/krisha_pms_verified.png' });

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

  console.log('Verification Results:', JSON.stringify(check, null, 2));
  await browser.close();
})();
