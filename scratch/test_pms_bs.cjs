const { chromium } = require('playwright');
const path = require('path');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/pms ...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr', { timeout: 15000 });

  // Wait 10s for price sync to complete
  console.log('Waiting for price sync to complete...');
  await page.waitForTimeout(10000);

  // Click on "Views" dropdown and click "Expand All"
  console.log('Clicking Expand All...');
  const viewsBtn = await page.$('button:has-text("Views")');
  if (viewsBtn) {
    await viewsBtn.click();
    await page.waitForTimeout(500);
    const expandBtn = await page.$('button.dropdown-item:has-text("Expand All")');
    if (expandBtn) await expandBtn.click();
    await page.waitForTimeout(1000);
  }

  const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\eeae80db-ec04-4e1e-8a06-9d7fe7c4e15e';
  const pmsExpandedPath = path.join(artifactDir, 'pms_workspace_expanded.png');
  await page.screenshot({ path: pmsExpandedPath });
  console.log('PMS expanded screenshot saved to', pmsExpandedPath);

  // Extract first 15 expanded stock rows
  const rows = await page.$$eval('table tbody tr', trs => {
    return trs.slice(0, 15).map(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().replace(/\n/g, ' '));
      return tds;
    });
  });
  console.log('PMS First 15 Rows:');
  rows.forEach((r, idx) => console.log(`Row ${idx}:`, r));

  // Also check Balance sheet
  console.log('Navigating to http://localhost:5173/balance-sheet ...');
  await page.goto('http://localhost:5173/balance-sheet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const bsPath = path.join(artifactDir, 'balance_sheet_verified.png');
  await page.screenshot({ path: bsPath });
  console.log('Balance Sheet screenshot saved to', bsPath);

  await browser.close();
  console.log('Done!');
}

test().catch(err => {
  console.error('Playwright test error:', err);
  process.exit(1);
});
