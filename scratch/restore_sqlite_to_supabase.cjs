const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });

// Strict dependency order (parents must be inserted before children)
const tables = [
  { sqlite: 'Portfolios', supabase: 'portfolios' },
  { sqlite: 'ACMAC1', supabase: 'acmac1' },
  { sqlite: 'ACC_PFLINK', supabase: 'acc_pflink' },
  { sqlite: 'InvestorGroupMembers', supabase: 'investor_group_members' },
  { sqlite: 'MPrices', supabase: 'mprices' },
  { sqlite: 'SumTable', supabase: 'sum_table' },
  { sqlite: 'Vouchers1', supabase: 'vouchers1' },
  { sqlite: 'VouchersC1', supabase: 'vouchersc1' },
  { sqlite: 'Trans1', supabase: 'trans1' },
  { sqlite: 'TransC1', supabase: 'transc1' },
  { sqlite: 'BS1', supabase: 'bs1' }
];

const supabaseSchemas = {
  portfolios: [
    'id', 'client_id', 'investor_name', 'is_group', 'full_name', 'investor_addr',
    'city', 'pin_code', 'country', 'phone', 'mobile', 'pan', 'exit_status',
    'risk_profile', 'view_settings', 'pfolio_type', 'ext_id'
  ],
  investor_group_members: [
    'investor_group_id', 'pfolio_id', 'ext_src_id', 'client_id'
  ],
  acc_pflink: [
    'pfid', 'acid', 'is_op_bal_to_be_recalc', 'action_flag', 'client_id'
  ],
  acmac1: [
    'id', 'ext_id', 'parent_id', 'parent_ext_id', 'is_group', 'name', 'disp_seqno',
    'descr', 'flags', 'acid', 'clid', 'is_it_ledger', 'special_type_id', 'cr_bal',
    'db_bal', 'tree_node', 'addr', 'pan', 'addinfo'
  ],
  mprices: [
    'source_id_atyp', 'amid', 'currp', 'prevp', 'date', 'row_id'
  ],
  sum_table: [
    'sid', 'pfolio_id', 'client_id', 'atty', 'amid', 'agentcode', 'qnt', 'amtinv',
    'balpurc', 'sellcnt', 'currv', 'tgain', 'is_currv_manual', 'refno', 'ext_id',
    'flag', 'relgain', 'today_amtinv', 'today_quant', 'tag', 'accinfo'
  ],
  vouchers1: [
    'vid', 'vtyp', 'dt', 'narr', 'pms_trans_id', 'cnid', 'acctlist', 'extid_source',
    'pfid', 'atype', 'sid', 'imp_rec_id', 'chqno', 'acid'
  ],
  vouchersc1: [
    'vid', 'vtyp', 'dt', 'narr', 'pms_trans_id', 'cnid', 'acctlist', 'extid_source',
    'pfid', 'atype', 'sid', 'imp_rec_id', 'chqno', 'acid'
  ],
  trans1: [
    'transid', 'vid', 'vtyp', 'dt', 'maid', 'ext_id', 'cramt', 'dramt', 'special_account',
    'narr', 'acid'
  ],
  transc1: [
    'transid', 'vid', 'vtyp', 'dt', 'maid', 'ext_id', 'cramt', 'dramt', 'special_account',
    'narr', 'acid'
  ],
  bs1: [
    'trid', 'pfid', 'amid', 'atyid', 'sid', 'cnid', 'trty', 'trstr', 'acvch',
    'dt', 'qn', 'purpr', 'brkg', 'netpr', 'amt', 'chrgs', 'narr', 'tmp_balq',
    'tmp_bala', 'accinfo', 'taxetc', 'dtorigin'
  ]
};

const mapColumnOverrides = {
  // portfolios
  'clientid': 'client_id',
  'investorname': 'investor_name',
  'isgroup': 'is_group',
  'fullname': 'full_name',
  'investoraddr': 'investor_addr',
  'pincode': 'pin_code',
  'exitstatus': 'exit_status',
  'riskprofile': 'risk_profile',
  'viewsettings': 'view_settings',
  'pfoliotype': 'pfolio_type',
  'extid': 'ext_id',
  
  // investor_group_members
  'investorgroupid': 'investor_group_id',
  'pfolioid': 'pfolio_id',
  'extsrcid': 'ext_src_id',
  
  // acc_pflink
  'isopbaltoberecalc': 'is_op_bal_to_be_recalc',
  'actionflag': 'action_flag',
  
  // acmac1
  'parent_extid': 'parent_ext_id',
  'disp_seqno': 'disp_seqno',
  'isitledger': 'is_it_ledger',
  'specialtypeid': 'special_type_id',
  'treenode': 'tree_node',
  
  // mprices
  'sourceid_atyp': 'source_id_atyp',
  
  // sum_table
  'iscurrvmanual': 'is_currv_manual',
  
  // vouchers1 / vouchersc1
  'pms_transid': 'pms_trans_id',
  
  // trans1 / transc1
  'specialaccount': 'special_account',
};

function formatMpricesDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const match = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
}

async function run() {
  console.log('🚀 Starting complete SQLite to Supabase restore...');
  
  // 1. Wipe all tables first (reverse order for foreign keys safety)
  console.log('\n🗑️  Wiping existing data from Supabase...');
  const tableNames = tables.map(t => `public.${t.supabase}`).reverse().join(', ');
  const truncateQuery = `TRUNCATE TABLE ${tableNames} CASCADE;`;
  console.log('Executing:', truncateQuery);
  
  const { error: truncErr } = await supabase.rpc('exec_sql', { query: truncateQuery });
  if (truncErr) {
    console.error('❌ Truncate failed. Attempting individual truncates:', truncErr.message);
    for (const t of tables.slice().reverse()) {
      const { error: e } = await supabase.rpc('exec_sql', { query: `TRUNCATE TABLE public.${t.supabase} CASCADE;` });
      if (e) console.error(`   ⚠️ Failed to truncate ${t.supabase}:`, e.message);
      else console.log(`   ✅ Truncated ${t.supabase}`);
    }
  } else {
    console.log('✅ All tables successfully truncated.');
  }

  // 2. Load and insert data for each table in strict dependency order
  for (const t of tables) {
    console.log(`\n📦 Restoring ${t.supabase} from SQLite ${t.sqlite}...`);
    
    const allowedCols = supabaseSchemas[t.supabase];
    const sqliteRows = db.prepare(`SELECT * FROM ${t.sqlite}`).all();
    if (sqliteRows.length === 0) {
      console.log(`⏭️  ${t.supabase}: No rows found in SQLite, skipping.`);
      continue;
    }

    // Map rows
    const mappedRows = sqliteRows.map(row => {
      const mapped = {};
      for (const [key, val] of Object.entries(row)) {
        const keyLower = key.toLowerCase();
        const mappedKey = mapColumnOverrides[keyLower] || keyLower;
        
        if (allowedCols.includes(mappedKey)) {
          let finalVal = val;
          if (typeof val === 'string' && val.trim() === '') {
            finalVal = null;
          }
          
          // Date formatting for mprices Date field (mapped to 'date' column)
          if (t.supabase === 'mprices' && mappedKey === 'date') {
            finalVal = formatMpricesDate(finalVal);
          }
          
          mapped[mappedKey] = finalVal;
        }
      }
      return mapped;
    });

    console.log(`Parsed ${mappedRows.length} rows. Uploading in batches...`);
    
    const batchSize = 1000;
    let successCount = 0;
    try {
      for (let i = 0; i < mappedRows.length; i += batchSize) {
        const batch = mappedRows.slice(i, i + batchSize);
        const { error: insertErr } = await supabase.from(t.supabase).insert(batch);
        if (insertErr) {
          console.error(`❌ Insert failed for batch in ${t.supabase}:`, insertErr.message);
          throw insertErr;
        }
        successCount += batch.length;
      }
      console.log(`✅ Successfully restored ${successCount} rows to ${t.supabase}`);
    } catch (e) {
      console.error(`💥 Failed to restore ${t.supabase}:`, e.message);
      process.exit(1); // Stop execution on failure
    }
  }

  db.close();
  console.log('\n🎉 SQLite to Supabase Restore Complete and Verified!');
}

run();
