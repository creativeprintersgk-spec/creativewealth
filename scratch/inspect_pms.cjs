const { chromium } = require('playwright');
const path = require('path');

async function inspectPMS() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  
  console.log('Navigating to http://localhost:5173/pms ...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  
  console.log('Waiting 15s for full price sync across all holdings...');
  await page.waitForTimeout(15000);

  // Expand all groups
  const viewsBtn = await page.$('button:has-text("Views")');
  if (viewsBtn) {
    await viewsBtn.click();
    await page.waitForTimeout(400);
    const expandBtn = await page.$('button.dropdown-item:has-text("Expand All")');
    if (expandBtn) await expandBtn.click();
    await page.waitForTimeout(1000);
  }

  const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\eeae80db-ec04-4e1e-8a06-9d7fe7c4e15e';
  const pmsExpandedPath = path.join(artifactDir, 'pms_workspace_all_prices.png');
  await page.screenshot({ path: pmsExpandedPath });
  console.log('PMS expanded screenshot saved to', pmsExpandedPath);

  // Extract all rows
  const allRows = await page.$$eval('table tbody tr', trs => {
    return trs.map(tr => {
      const isGroupHeader = tr.classList.contains('group-header') || 
                            (tr.querySelector('svg') && tr.querySelector('td[colspan]')) || 
                            tr.querySelectorAll('td').length < 8;
      const nameEl = tr.querySelector('.asset-name') || tr.querySelector('td:nth-child(1)');
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().replace(/\s+/g, ' '));
      return {
        isGroupHeader: !!isGroupHeader,
        name: nameEl ? nameEl.innerText.trim() : (tds[0] || ''),
        tds
      };
    });
  });

  const holdingRows = allRows.filter(r => !r.isGroupHeader);
  console.log(`Total holding rows found: ${holdingRows.length} (out of ${allRows.length} total rows)`);

  const missingPriceRows = [];
  const livePriceRows = [];
  const costFallbackRows = [];

  for (let idx = 0; idx < holdingRows.length; idx++) {
    const r = holdingRows[idx];
    const name = r.name || r.tds[0];
    const qty = r.tds[1] || '';
    const avgPrice = r.tds[2] || '';
    const amtInv = r.tds[3] || '';
    const curPrice = r.tds[4] || '';
    const curValue = r.tds[5] || '';
    const todaysGain = r.tds[6] || '';
    const overallGain = r.tds[7] || '';

    const item = { idx: idx + 1, name, qty, avgPrice, amtInv, curPrice, curValue, todaysGain, overallGain };

    if (!curPrice || curPrice === '—' || curPrice === '0' || curPrice === '0.00' || curPrice.includes('NaN')) {
      missingPriceRows.push({ reason: 'curPrice is blank/zero/dash', ...item });
    } else if (!todaysGain || todaysGain === '—' || todaysGain.includes('NaN')) {
      missingPriceRows.push({ reason: 'todaysGain is blank/dash', ...item });
    } else if (todaysGain.includes('+0.00%') || todaysGain.startsWith('0 (')) {
      costFallbackRows.push(item);
    } else {
      livePriceRows.push(item);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Holdings with Live Market Prices & Gains: ${livePriceRows.length}`);
  console.log(`Holdings with Book Cost Fallback (Unlisted / Non-traded): ${costFallbackRows.length}`);
  console.log(`Holdings with Missing / Blank / Dash Prices: ${missingPriceRows.length}`);

  if (missingPriceRows.length > 0) {
    console.log(`\n=== MISSING PRICE ROWS ===`);
    missingPriceRows.forEach(p => console.log(p));
  }

  // Also verify Balance Sheet comparative view
  console.log('\nNavigating to http://localhost:5173/balance-sheet ...');
  await page.goto('http://localhost:5173/balance-sheet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Turn on Comparative View if not active
  const compBtn = await page.$('button:has-text("Comparative View")');
  if (compBtn) {
    // Check if background indicates not active
    const bg = await compBtn.evaluate(el => window.getComputedStyle(el).backgroundColor);
    if (!bg.includes('239')) { // not #eff6ff
      await compBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  const bsPath = path.join(artifactDir, 'balance_sheet_pct_fixed.png');
  await page.screenshot({ path: bsPath });
  console.log('Balance Sheet screenshot saved to', bsPath);

  // Check Profit & Loss line in Balance Sheet table
  const plText = await page.$$eval('div', divs => {
    const found = divs.filter(d => d.innerText.includes('Profit & Loss') && d.innerText.includes('%'));
    return found.slice(0, 3).map(f => f.innerText.replace(/\s+/g, ' '));
  });
  console.log('Balance Sheet sample comparative text:', plText.slice(0, 2));

  await browser.close();
  console.log('All verification checks completed successfully!');
}

inspectPMS().catch(console.error);
