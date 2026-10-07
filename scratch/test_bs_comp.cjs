const { chromium } = require('playwright');
const path = require('path');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/balance-sheet ...');
  await page.goto('http://localhost:5173/balance-sheet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click Comparative View button
  const compBtn = await page.$('button:has-text("Comparative View")');
  if (compBtn) {
    console.log('Clicking Comparative View...');
    await compBtn.click();
    await page.waitForTimeout(1000);
  }

  const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\eeae80db-ec04-4e1e-8a06-9d7fe7c4e15e';
  const bsPath = path.join(artifactDir, 'balance_sheet_comparative_verified.png');
  await page.screenshot({ path: bsPath });
  console.log('Comparative Balance Sheet screenshot saved to', bsPath);

  await browser.close();
  console.log('Done!');
}

test().catch(err => {
  console.error('Playwright test error:', err);
  process.exit(1);
});
