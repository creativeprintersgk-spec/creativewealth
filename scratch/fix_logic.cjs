const fs = require('fs');
const path = require('path');

const logicPath = path.join(__dirname, '../src/logic.ts');
let content = fs.readFileSync(logicPath, 'utf8');

// 1. Fix the family ID to '1'
content = content.replace(/'pramesh_shah_family'/g, "'1'");

// 2. Add the togglePortfolioStatus function if missing
if (!content.includes('togglePortfolioStatus')) {
  content += `\n
export async function togglePortfolioStatus(portfolioId: string, isActive: boolean) {
  const newStatus = isActive ? 1 : 0;
  const { error } = await supabase.from('portfolios').update({ exit_status: newStatus }).eq('id', portfolioId);
  if (error) {
    console.error('Failed to toggle portfolio status', error);
  } else {
    const p = state.portfolios.find(pf => String(pf.id) === String(portfolioId));
    if (p) p.exit_status = newStatus;
  }
}
`;
}

fs.writeFileSync(logicPath, content, 'utf8');
console.log('Successfully fixed logic.ts');
