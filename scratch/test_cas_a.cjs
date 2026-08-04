const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER UNCAUGHT ERROR] ${err.message}`);
  });

  console.log("Navigating to Import page...");
  await page.goto('http://localhost:5173/import');

  console.log("Waiting for database initialization...");
  const camsCasButton = await page.waitForSelector('button:has-text("CAMS-CAS")', { timeout: 60000 });
  console.log("Tab buttons rendered.");

  console.log("Clicking CAMS-CAS tab...");
  await camsCasButton.click();
  await page.waitForTimeout(2000);
  
  console.log("Uploading CAS A.pdf...");
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' });
  await fileInput.setInputFiles('C:\\Users\\Admin\\Desktop\\CAS A.pdf');

  console.log("Waiting for Commit button...");
  const commitBtn = await page.waitForSelector('button:has-text("Commit MF Transactions")', { timeout: 45000 });
  console.log("Found Commit button.");

  // Check the bank ledger selection
  const bankLedgerValue = await page.$eval('select:has(option:has-text("Select Bank Account..."))', el => el.value).catch(() => '');
  if (!bankLedgerValue || bankLedgerValue === '') {
    console.log("Selecting bank ledger...");
    await page.selectOption('select:has(option:has-text("Select Bank Account..."))', { index: 1 });
  }

  console.log("Clicking Commit...");
  await commitBtn.click();

  console.log("Waiting 15 seconds for operations to complete...");
  await page.waitForTimeout(15000);

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- PAGE INNER TEXT ---");
  console.log(pageText.substring(0, 1500));
  console.log("-----------------------\n");

  await page.screenshot({ path: 'scratch/success_state.png' });
  console.log("Saved success state screenshot to scratch/success_state.png");

  await browser.close();
  process.exit(0);
})();
