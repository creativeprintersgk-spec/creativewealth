import { state, getStoredPortfolios, getStoredVouchers, getStoredEntries, getStoredLedgers } from '../logic';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTallyDate(dateStr: string): string {
  if (!dateStr) return '20240401';
  // Standard Tally date format is YYYYMMDD
  return dateStr.replace(/[^0-9]/g, '').slice(0, 8);
}

// Maps WealthCore group types to standard Tally Parent Groups
const TALLY_PARENT_MAP: Record<string, string> = {
  'bank': 'Bank Accounts',
  'cash': 'Cash-in-Hand',
  'stocks': 'Investments',
  'mf_equity': 'Investments',
  'mf_debt': 'Investments',
  'capital': 'Capital Account',
  'sundry_creditors': 'Sundry Creditors',
  'sundry_debtors': 'Sundry Debtors',
  'dividend': 'Direct Incomes',
  'stt': 'Indirect Expenses',
  'tax_charges_stocks': 'Indirect Expenses',
  'share_txn_charges': 'Indirect Expenses',
  'tds': 'Current Assets',
};

export function generateTallyXml(
  financialYear?: string,
  accountId?: number
): string {
  const accountNum = accountId ? Number(accountId) : undefined;

  // 1. Filter Ledgers
  const ledgers = state.acmac1.filter((l: any) => 
    !l.is_group && (!accountNum || l.acid === accountNum)
  );

  // 2. Filter Vouchers for selected FY (April 1 to March 31)
  const allVouchers = getStoredVouchers();
  const allEntries = getStoredEntries();
  const allLedgers = getStoredLedgers();
  const ledgerMap = new Map(allLedgers.map(l => [String(l.id), l.name]));

  const entriesByVoucher = new Map<string, any[]>();
  for (const entry of allEntries) {
    const list = entriesByVoucher.get(entry.voucherId) || [];
    list.push(entry);
    entriesByVoucher.set(entry.voucherId, list);
  }

  const filteredVouchers = allVouchers.filter((v: any) => {
    if (accountNum && Number(v.accountId) !== accountNum) return false;
    if (financialYear) {
      const parts = financialYear.split('-');
      if (parts.length === 2) {
        const startYear = parseInt(parts[0], 10);
        const endYear = parseInt(parts[1], 10);
        const vDate = v.date || '';
        const startDate = `${startYear}-04-01`;
        const endDate = `${endYear}-03-31`;
        if (vDate < startDate || vDate > endDate) return false;
      }
    }
    return true;
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>WealthCore Client</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  // ── Masters: Ledgers ──
  for (const l of ledgers) {
    const lName = escapeXml(l.name);
    const parentName = escapeXml(l.groupName || TALLY_PARENT_MAP[l.group_type] || 'Investments');
    const openingBal = Number(l.openingBalance || l.db_bal || 0) - Number(l.cr_bal || 0);

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${lName}" ACTION="Create">
            <NAME>${lName}</NAME>
            <PARENT>${parentName}</PARENT>
            <OPENINGBALANCE>${openingBal >= 0 ? -openingBal : Math.abs(openingBal)}</OPENINGBALANCE>
            <ISBILLWISEON>No</ISBILLWISEON>
            <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
          </LEDGER>
        </TALLYMESSAGE>
`;
  }

  // ── Transactions: Vouchers ──
  for (const v of filteredVouchers) {
    const vDate = formatTallyDate(v.date);
    const vType = (v.type || 'Journal').charAt(0).toUpperCase() + (v.type || 'Journal').slice(1);
    const narration = escapeXml(v.narration || `${vType} voucher`);
    const vNum = escapeXml(String(v.voucherNo || v.id));

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(vType)}" ACTION="Create">
            <DATE>${vDate}</DATE>
            <VOUCHERTYPENAME>${escapeXml(vType)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vNum}</VOUCHERNUMBER>
            <NARRATION>${narration}</NARRATION>
`;

    const vLines = entriesByVoucher.get(v.id) || [];
    for (const line of vLines) {
      const ledgerName = escapeXml(ledgerMap.get(line.ledgerId) || `Ledger ${line.ledgerId}`);
      const dr = Number(line.debit) || 0;
      const cr = Number(line.credit) || 0;
      // In Tally XML: Debit is represented as a NEGATIVE amount, Credit is POSITIVE
      const amount = dr > 0 ? -dr : cr;
      const isDeemedPositive = dr > 0 ? 'Yes' : 'No';

      xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${ledgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDeemedPositive}</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    }

    xml += `          </VOUCHER>
        </TALLYMESSAGE>
`;
  }

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

/**
 * Generates and triggers browser download of Tally XML file
 */
export function downloadTallyXml(financialYear?: string, accountId?: number) {
  const xmlContent = generateTallyXml(financialYear, accountId);
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `WealthCore_Tally_Export_${financialYear || 'All'}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
