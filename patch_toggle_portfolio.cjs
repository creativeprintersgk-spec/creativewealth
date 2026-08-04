/**
 * Adds togglePortfolioStatus export to logic.ts (it was lost in git restore).
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/logic.ts');
let content = fs.readFileSync(filePath, 'utf8');

const INJECT_AFTER = `export function getStoredPortfolios() {
  return state.portfolios
    .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
    .map(p => {
      // Look up the linked account via accPflink join table
      const link = state.accPflink.find((l: any) => l.pfid === p.id);
      const accountId = link ? String(link.acid) : null;
      return {
        ...p,
        id: String(p.id),
        portfolioName: p.investor_name || p.full_name || \`Portfolio \${p.id}\`,
        accountId,
        portfolioType: p.pfolio_type === 1 ? 'Equity'
          : p.pfolio_type === 2 ? 'Mutual Funds'
          : p.pfolio_type === 3 ? 'Fixed Income'
          : p.pfolio_type === 4 ? 'Real Estate'
          : null
      };
    });
}`;

const NEW_FUNCTION = `

// Toggle a portfolio's active/inactive status in Supabase and in-memory state
export async function togglePortfolioStatus(portfolioId: string | number, isActive: boolean) {
  const id = Number(portfolioId);
  const { error } = await supabase
    .from('portfolios')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    console.error('Failed to toggle portfolio status:', error.message);
    throw new Error(error.message);
  }

  // Update in-memory state immediately
  const pIdx = state.portfolios.findIndex((p: any) => Number(p.id) === id);
  if (pIdx >= 0) {
    state.portfolios[pIdx] = { ...state.portfolios[pIdx], is_active: isActive };
  }
  rebuildAllIndexes();
}`;

// Find the exact string (handle CRLF)
const crlfVersion = INJECT_AFTER.replace(/\n/g, '\r\n');

let replaced = false;
if (content.includes(INJECT_AFTER)) {
  content = content.replace(INJECT_AFTER, INJECT_AFTER + NEW_FUNCTION);
  replaced = true;
} else if (content.includes(crlfVersion)) {
  content = content.replace(crlfVersion, crlfVersion + NEW_FUNCTION.replace(/\n/g, '\r\n'));
  replaced = true;
}

if (replaced) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Added togglePortfolioStatus to logic.ts');
} else {
  // Fallback: append before last closing brace of file
  const insertMarker = '\nexport function getStoredInve';
  const idx = content.indexOf(insertMarker);
  if (idx >= 0) {
    content = content.slice(0, idx) + NEW_FUNCTION + '\n' + content.slice(idx);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Added togglePortfolioStatus (fallback insertion point)');
  } else {
    console.error('❌ Could not find insertion point. Appending to end of file.');
    content += '\n' + NEW_FUNCTION;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Appended togglePortfolioStatus to end of logic.ts');
  }
}
