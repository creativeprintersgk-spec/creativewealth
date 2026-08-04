const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to Import page...");
  await page.goto('http://localhost:5173/import');

  console.log("Waiting for initialization...");
  await page.waitForTimeout(5000); 

  console.log("Switching to CAMS-CAS tab...");
  await page.click('button:has-text("CAMS-CAS")');
  
  console.log("Uploading PDF...");
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' });
  await fileInput.setInputFiles('C:\\Users\\Admin\\Desktop\\CAS_01042026-02062026_CP213269985_02062026021613515 (1).pdf');

  console.log("Waiting for password modal to open...");
  try {
    const pwdInput = await page.waitForSelector('input[placeholder="Enter PDF password..."]', { timeout: 15000 });
    await pwdInput.fill('123456');
    await page.click('button:has-text("Decrypt & Parse")');
  } catch (e) {
    console.error("Password modal did not open! Saving screenshot to error.png");
    await page.screenshot({ path: 'error.png' });
    throw e;
  }

  console.log("Waiting for parsing to complete... (waiting for Commit MF Transactions button)");
  const commitBtn = await page.waitForSelector('button:has-text("Commit MF Transactions")', { timeout: 120000 });
  
  page.on('dialog', async dialog => {
    console.log(`[ALERT] ${dialog.message()}`);
    await dialog.accept();
  });

  console.log("Clicking Commit MF Transactions...");
  const startTime = Date.now();
  await commitBtn.click();

  // Wait for the success message to appear in the UI
  try {
    await page.waitForSelector('text=✅ Successfully imported', { timeout: 60000 });
    const timeTaken = (Date.now() - startTime) / 1000;
    console.log(`\n=========================================\n`);
    console.log(`✅ SUCCESS! Transactions committed in ${timeTaken.toFixed(2)} seconds!`);
    console.log(`\n=========================================\n`);
  } catch(e) {
    console.error("Timed out waiting for success message or encountered an error.");
    console.error(e);
  }

  await browser.close();
  process.exit(0);
})();
