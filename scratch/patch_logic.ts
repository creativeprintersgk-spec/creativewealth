import { readFileSync, writeFileSync } from 'fs';

const logicTsPath = 'src/logic.ts';
let code = readFileSync(logicTsPath, 'utf8');

const safeFetchCode = `
// ── SAFE FETCH ─────────────────────────────────────────────────────────────────
async function safeFetch(table: string, max = 50000): Promise<any[]> {
  try {
    let all: any[] = [];
    let page = 0;
    const size = 1000;
    while (all.length < max) {
      const { data, error } = await supabase
        .from(table).select('*').range(page * size, (page + 1) * size - 1);
      if (error) { console.warn(\`Error \${table}:\`, error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      page++;
    }
    return all;
  } catch (e) {
    console.warn(\`Error \${table}:\`, e);
    return [];
  }
}

function getGroupType(st: number): string {
  if ([150, 40, 50, 125].includes(st)) return 'ASSET';
  if ([250, 275, 276].includes(st)) return 'LIABILITY';
  if (st === 280) return 'INCOME';
  if (st === 290) return 'EXPENSE';
  return 'ASSET';
}
`;

const newInitDatabase = `
export async function initDatabase() {
  if (state.initialized) return;

  try {
    console.log("Initializing WealthCore with MProfit DB mapping...");
    
    // Fetch directly from raw MProfit tables
    const [
      acmac1,
      vouchersC1,
      transC1,
      { data: families },
      { data: accounts },
      { data: portfolios },
      { data: investorGroups }
    ] = await Promise.all([
      safeFetch('acmac1', 50000),
      safeFetch('vouchersc1', 10000),
      safeFetch('transc1', 50000),
      supabase.from('families').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('portfolios').select('*'),
      supabase.from('investor_groups').select('*')
    ]);

    // Deduplicate acmac1
    const uniqueAcmac1: any[] = [];
    const seenAcmac = new Set();
    for (const a of acmac1) {
      const key = \`\${a.id}_\${a.acid}_\${a.is_group}\`;
      if (!seenAcmac.has(key)) {
        seenAcmac.add(key);
        uniqueAcmac1.push(a);
      }
    }

    state.groups = uniqueAcmac1.filter(a => a.is_group).map(a => ({
      id: String(a.id),
      name: a.name,
      parent: a.parent_id ? String(a.parent_id) : undefined,
      type: getGroupType(a.special_type_id || 0),
      specialTypeId: a.special_type_id
    }));

    state.ledgers = uniqueAcmac1.filter(a => !a.is_group).map(a => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      openingBalance: Number(a.op_bal) || 0,
      openingType: a.op_type === 'CR' ? 'CR' : 'DR',
      amid: a.amid,
      acid: a.acid
    }));

    state.vouchers = vouchersC1.map(v => ({
      id: String(v.vid),
      date: v.vdt,
      type: v.vtyp,
      voucherNo: String(v.vno),
      narration: v.vrmk,
      accountId: String(v.acid),
      fy: v.fy
    }));

    state.entries = transC1.map(e => ({
      id: String(e.id),
      voucherId: String(e.vid),
      ledgerId: String(e.alid),
      debit: Number(e.damt) || 0,
      credit: Number(e.camt) || 0,
      quantity: Number(e.qty) || 0,
      price: Number(e.rate) || 0
    }));

    state.families = (families || []).map(f => ({ ...f, familyName: f.name }));
    state.accounts = (accounts || []).map(a => ({ ...a, familyId: a.family_id, accountName: a.account_name }));
    state.portfolios = (portfolios || []).map(p => ({ ...p, accountId: p.account_id, portfolioName: p.portfolio_name }));
    state.investorGroups = (investorGroups || []).map(ig => ({ ...ig, groupName: ig.group_name || ig.groupName, portfolioIds: ig.portfolio_ids || ig.portfolioIds }));
    
    // Default prices map to empty
    state.prices = {};
    state.taxLots = [];
    
    state.initialized = true;
    console.log(\`✅ WealthCore Ready — \${state.ledgers.length} ledgers, \${state.entries.length} txns\`);
  } catch (err) {
    console.error("❌ Cloud Initialization Failed:", err);
    state.initialized = true;
  }
}
`;

// Inject safeFetch
if (!code.includes('async function safeFetch')) {
  code = code.replace('// ── STUBS ─────────────────────────────────────────────────────────────────────', safeFetchCode + '\n// ── STUBS ─────────────────────────────────────────────────────────────────────');
}

// Replace initDatabase
const initDbRegex = /export async function initDatabase\(\) \{[\s\S]*?\n\}/m;
code = code.replace(initDbRegex, newInitDatabase.trim());

writeFileSync(logicTsPath, code);
console.log('logic.ts successfully patched!');
