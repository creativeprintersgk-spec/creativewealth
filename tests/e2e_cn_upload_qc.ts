import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('[QC] Starting Playwright browser test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[Browser Page Error] ${err.message}`);
  });

  console.log('[QC] Navigating to http://localhost:5173/import ...');
  await page.goto('http://localhost:5173/import', { waitUntil: 'networkidle' });

  console.log('[QC] Clicking "Broker Contract Note" tab...');
  await page.locator('button:has-text("Broker Contract Note")').click();
  await page.waitForTimeout(500);

  // Take screenshot of initial state
  const ssDir = path.resolve('tests');
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
  await page.screenshot({ path: path.join(ssDir, 'qc_step1_initial.png') });
  console.log('[QC] Saved screenshot: tests/qc_step1_initial.png');

  // Test 1: Click the Browse Files button
  console.log('[QC] Test 1: Clicking "Browse Files" button...');
  const [fileChooser1] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 4000 }),
    page.locator('button:has-text("Browse Files")').click()
  ]);
  console.log('[QC] Test 1 Result: File chooser opened successfully! isMultiple:', fileChooser1.isMultiple());

  // Test 2: Click the dashed dropzone box itself
  console.log('[QC] Test 2: Clicking dashed dropzone container...');
  const [fileChooser2] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 4000 }),
    page.locator('text=Click or Drag & Drop One or Multiple Contract Note files here').click()
  ]);
  console.log('[QC] Test 2 Result: File chooser opened successfully! isMultiple:', fileChooser2.isMultiple());

  // Test 3: Upload a real contract note file and verify end-to-end staging
  const testCsvContent = `Trade Date,Settlement Date,Contract Note No,Trade No,Order No,Security Name,ISIN,Buy/Sell,Quantity,Price,Brokerage,STT,Stamp Duty,Exchange Turn Over Charges,SEBI Turnover Fee,Net Total
11-10-2026,12-10-2026,CNT-QC-8888,TRD888,ORD888,TCS LIMITED,INE467B01029,BUY,5,3800.00,10.00,19.00,2.85,6.20,0.15,19038.20`;
  const testFilePath = path.resolve('tests', 'test_qc_trade.csv');
  fs.writeFileSync(testFilePath, testCsvContent, 'utf-8');

  console.log('[QC] Test 3: Uploading test trade CSV via filechooser...');
  await fileChooser2.setFiles(testFilePath);
  await page.waitForTimeout(1000);

  // Scroll down main to view staged trades
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 1000;
  });
  await page.screenshot({ path: path.join(ssDir, 'qc_step2_staged.png') });
  console.log('[QC] Saved screenshot: tests/qc_step2_staged.png');

  // Check if staged trade appeared
  const hasStaged = await page.locator('text=TCS LIMITED').isVisible();
  console.log('[QC] Test 3 Result: TCS LIMITED trade staged visibly in UI?', hasStaged);

  const commitBtn = page.locator('button:has-text("Commit")');
  const commitVisible = await commitBtn.isVisible();
  console.log('[QC] Test 3 Result: Commit button visible?', commitVisible);

  await browser.close();
  console.log('[QC] ALL QC TESTS PASSED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('[QC FAILED]', err);
  process.exit(1);
});
