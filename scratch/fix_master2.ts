import { readFileSync, writeFileSync } from 'fs';

const logicTsPath = 'src/logic.ts';
let code = readFileSync(logicTsPath, 'utf8');

const replacement = `
    const pfData = portfolios || [];
    
    // 1. Investor Groups
    const invGroups = pfData.filter((p: any) => p.is_group);
    
    // 2. Individual Portfolios
    const indivPfs = pfData.filter((p: any) => !p.is_group);
    
    // 3. Build Unique Accounts from full_name
    const uniqueAccounts = new Map<string, any>();
    indivPfs.forEach((p: any) => {
      const accName = p.full_name || p.investor_name || 'Unknown Account';
      if (!uniqueAccounts.has(accName)) {
        uniqueAccounts.set(accName, {
          id: \`acc_\${accName.replace(/\\s+/g, '_')}\`,
          familyId: 'fam_default',
          accountName: accName,
          pan: p.pan || ''
        });
      }
    });
    const accountsArr = Array.from(uniqueAccounts.values());
    
    // 4. Set state
    state.families = [{ id: 'fam_default', familyName: 'MProfit Imports' }];
    state.accounts = accountsArr;
    
    state.portfolios = indivPfs.map((p: any) => {
      const accName = p.full_name || p.investor_name || 'Unknown Account';
      const acc = uniqueAccounts.get(accName);
      return {
        ...p,
        id: String(p.id),
        accountId: acc.id,
        portfolioName: p.investor_name,
        portfolioType: 'Equity' // Default
      };
    });
    
    state.investorGroups = invGroups.map((ig: any) => ({
      ...ig,
      id: String(ig.id),
      groupName: ig.investor_name,
      portfolioIds: [] // Can be filled if MProfit has a linkage table for pf groups
    }));
`;

code = code.replace(/    \/\/ Extract missing master data from db\.json since it's not in Supabase yet\s+state\.families = dbData\.families \|\| \[\];\s+state\.accounts = dbData\.accounts \|\| \[\];\s+state\.portfolios = dbData\.portfolios \|\| \[\];\s+state\.investorGroups = dbData\.investorGroups \|\| \[\];/g, replacement);

writeFileSync(logicTsPath, code);
console.log('Fixed logic to derive master data directly from Supabase portfolios table!');
