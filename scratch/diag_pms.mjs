import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/pms', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  console.log('Current URL after load:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Body Text snippet:', bodyText);
  await page.screenshot({ path: 'scratch/pms_initial.png' });
  await browser.close();
})();
