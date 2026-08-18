const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Workspace UI Verification for compact asset tabs...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:5173/pms...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  console.log('   ⏳ Waiting 6 seconds for background database sync & rendering...');
  await page.waitForTimeout(6000);

  console.log('2. Taking screenshot of compact asset tab bar...');
  await page.screenshot({ path: 'scratch/pms_workspace_compact_tabs.png', fullPage: true });
  console.log('   📸 Screenshot saved to scratch/pms_workspace_compact_tabs.png');

  await browser.close();
  console.log('🎉 UI Verification Completed!');
})();
