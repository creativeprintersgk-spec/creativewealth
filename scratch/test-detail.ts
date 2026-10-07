import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('1. Navigating to PMS Workspace...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click on "All Gadgets" tab if available
  const allGadgetsTab = page.locator('button:has-text("All Gadgets")');
  if (await allGadgetsTab.isVisible()) {
    await allGadgetsTab.click();
    await page.waitForTimeout(2000);
  }

  // Look for PPF / EPF row and click to expand
  const ppfCategory = page.locator('text=PPF / EPF').first();
  if (await ppfCategory.isVisible()) {
    console.log('Found PPF / EPF category, clicking to ensure expanded...');
    await ppfCategory.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'scratch/pms_all_gadgets_ppf_expanded.png' });

  // Check text content of PPF rows
  const rows = await page.locator('tr').allInnerTexts();
  const ppfRows = rows.filter(r => r.includes('PPF'));
  console.log('PPF Rows found:', ppfRows);

  // 2. Test Bank Ledger drilldown modal
  console.log('2. Navigating to /ledger/Bank or Balance Sheet...');
  await page.goto('http://localhost:5173/balance-sheet', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const bankLink = page.locator('text=Kotak Bank').first();
  if (await bankLink.isVisible()) {
    await bankLink.click();
    await page.waitForTimeout(1500);

    const modalBox = page.locator('.modal-box');
    if (await modalBox.isVisible()) {
      const text = await modalBox.innerText();
      console.log('--- Bank Modal Text Preview ---');
      console.log(text.slice(0, 500));
      await page.screenshot({ path: 'scratch/bank_modal_drilldown.png' });
    }
  }

  // 3. Test Capital Gains page detailed view
  console.log('3. Navigating to /capital-gains...');
  await page.goto('http://localhost:5173/capital-gains', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click first card or table row
  const rowClick = page.locator('table tbody tr').first();
  if (await rowClick.isVisible()) {
    await rowClick.click();
    await page.waitForTimeout(1500);

    const detailedTab = page.locator('button:has-text("Detailed Trade Lots (ITR Format)")');
    if (await detailedTab.isVisible()) {
      await detailedTab.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'scratch/capital_gains_renderer_view.png' });

      // Click BACK
      const backBtn = page.locator('button:has-text("BACK")');
      if (await backBtn.isVisible()) {
        console.log('Clicking BACK button in Capital Gains Renderer...');
        await backBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'scratch/capital_gains_after_back_click.png' });
        console.log('Successfully clicked BACK!');
      }

      // Open detailed again and test X
      if (await detailedTab.isVisible()) {
        await detailedTab.click();
        await page.waitForTimeout(1000);
        const xBtn = page.locator('.print-modal-backdrop button:has(svg.lucide-x)').first();
        if (await xBtn.isVisible()) {
          console.log('Clicking X button in Capital Gains Renderer...');
          await xBtn.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'scratch/capital_gains_after_x_click.png' });
          console.log('Successfully clicked X!');
        }
      }
    }
  }

  await browser.close();
  console.log('All tests finished!');
}

main().catch(console.error);
