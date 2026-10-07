import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Open "Krisha Inv" tab
  const openPortBtn = page.locator('button:has-text("Open Portfolio")');
  await openPortBtn.click();
  await page.waitForTimeout(500);

  const krishaOption = page.locator('label:has-text("Krisha Inv"), div:has-text("Krisha Inv")').last();
  await krishaOption.click();
  await page.waitForTimeout(500);

  const openSelectedBtn = page.locator('button:has-text("Open Selected")');
  await openSelectedBtn.click();
  await page.waitForTimeout(2000);

  // Take screenshot of Krisha Inv All Assets tab
  await page.screenshot({ path: 'scratch/krisha_all_assets_with_ppf.png' });

  // Now click on "PPF / EPF" tab button
  const ppfTabBtn = page.locator('button:has-text("PPF / EPF")');
  if (await ppfTabBtn.count() > 0) {
    await ppfTabBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scratch/krisha_ppf_tab_active.png' });
  }

  // Check DOM text
  const check = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasPPFKrisha: text.includes('PPF - Krisha'),
      has404629: text.includes('4,04,629') || text.includes('404,629'),
      hasEPF: text.includes('EPF - Salary'),
      hasFutcur: text.includes('FUTCURGBPINR28MAR2023'),
      hasSIF: text.includes('Special Inv. Funds')
    };
  });

  console.log('PPF in Krisha PMS DOM Results:', JSON.stringify(check, null, 2));
  await browser.close();
})();
