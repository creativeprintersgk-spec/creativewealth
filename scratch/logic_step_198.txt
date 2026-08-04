Created At: 2026-05-23T07:52:50Z
Completed At: 2026-05-23T07:52:51Z
File Path: `file:///c:/Users/Admin/Desktop/wealthcore-clean/src/logic.ts`
Total Lines: 628
Total Bytes: 27204
Showing lines 51 to 122
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
51: // ── STATE ─────────────────────────────────────────────────────────────────────
52: let state = {
53:   portfolios: [] as any[],
54:   investorGroupMembers: [] as any[],
55:   accPflink: [] as any[],
56:   acmac1: [] as any[],
57:   sam: [] as any[],
58:   assetMaster: [] as any[],
59:   bs1: [] as any[],
60:   sumTable: [] as any[],
61:   vouchersC1: [] as any[],
62:   transC1: [] as any[],
63:   mprices: [] as any[],
64:   priceMap: {} as Record<number, { curr: number; prev: number }>,
65:   assetNameMap: {} as Record<number, string>,
66:   initialized: false
67: };
68: 
69: // ── SAFE FETCH ────────────────────────────────────────────────────────────────
70: async function safeFetch(table: string, max = 50000): Promise<any[]> {
71:   try {
72:     let all: any[] = [];
73:     let page = 0;
74:     const size = 1000;
75:     while (all.length < max) {
76:       const { data, error } = await supabase
77:         .from(table).select('*').range(page * size, (page + 1) * size - 1);
78:       if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
79:       if (!data || data.length === 0) break;
80:       all = all.concat(data);
81:       if (data.length < size) break;
82:       page++;
83:     }
84:     return all;
85:   } catch (e) {
86:     console.warn(`⚠️ ${table}:`, e);
87:     return [];
88:   }
89: }
90: 
91: // ── INIT ──────────────────────────────────────────────────────────────────────
92: export async function initDatabase() {
93:   if (state.initialized) return;
94:   console.log('Initializing WealthCore...');
95:   const [portfolios, igm, accPflink, acmac1, sam, assetMaster,
96:          bs1, sumTable, vouchersC1, transC1, mprices] = await Promise.all([
97:     safeFetch('portfolios'), safeFetch('investor_group_members'),
98:     safeFetch('acc_pflink'), safeFetch('acmac1'), safeFetch('sam'),
99:     safeFetch('asset_master'), safeFetch('bs1'), safeFetch('sum_table'),
100:     safeFetch('vouchersc1'), safeFetch('transc1'), safeFetch('mprices'),
101:   ]);
102:   state.portfolios = portfolios;
103:   state.investorGroupMembers = igm;
104:   state.accPflink = accPflink;
105:   state.acmac1 = acmac1;
106:   state.sam = sam;
107:   state.assetMaster = assetMaster;
108:   state.bs1 = bs1;
109:   state.sumTable = sumTable;
110:   state.vouchersC1 = vouchersC1;
111:   state.transC1 = transC1;
112:   state.mprices = mprices;
113:   mprices.forEach((p: any) => {
114:     state.priceMap[p.amid] = { curr: Number(p.currp) || 0, prev: Number(p.prevp) || 0 };
115:   });
116:   acmac1.forEach((a: any) => { if (!state.assetNameMap[a.id]) state.assetNameMap[a.id] = a.name; });
117:   sam.forEach((s: any) => { state.assetNameMap[s.amid] = s.anm; });
118:   assetMaster.forEach((a: any) => { state.assetNameMap[a.amid] = a.name; });
119:   state.initialized = true;
120:   console.log(`✅ WealthCore Ready — ${portfolios.length} portfolios, ${bs1.length} txns`);
121: }
122: 
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
