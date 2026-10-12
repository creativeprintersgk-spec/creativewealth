/**
 * Standardizes Government Securities (G-Sec), Treasury Bills, and Sovereign Debt
 * instrument names into the unified WealthCore format:
 * "G-Sec X.XX% GS YYYY (ISIN IN00XXXXXXXX)"
 */

export function formatGSecName(rawName: string, isin = ''): string {
  if (!rawName) return rawName || '';
  const cleanIsin = (isin || '').trim().toUpperCase();
  const name = rawName.trim();

  // If already in standard format "G-Sec X.XX% GS YYYY (ISIN ...)", return as is (append ISIN if missing)
  if (/^G-Sec\s+\d+(?:\.\d+)?%\s+GS\s+\d{4}/i.test(name)) {
    if (cleanIsin && !name.includes(cleanIsin)) {
      return `${name} (ISIN ${cleanIsin})`;
    }
    return name;
  }

  // T-Bill handling: Keep T-Bill designation but format neatly
  if (/TBILL|T-BILL|\b\d+TB\b|\b\d+D\s*-\s*\d{2}\/\d{2}\/\d{2,4}\b/i.test(name)) {
    let tbName = name;
    if (!tbName.toUpperCase().includes('GOI') && !tbName.toUpperCase().includes('T-BILL')) {
      tbName = `GOI T-Bill ${tbName}`;
    }
    if (cleanIsin && !tbName.includes(cleanIsin)) {
      return `${tbName} (ISIN ${cleanIsin})`;
    }
    return tbName;
  }

  // Sovereign Gold Bonds (SGB): Do not alter SGB names to G-Sec
  if (/\bSGB\b/i.test(name)) {
    if (cleanIsin && !name.includes(cleanIsin)) {
      return `${name} (ISIN ${cleanIsin})`;
    }
    return name;
  }

  let rate: string | null = null;
  let year: string | null = null;

  // Pattern 1: Explicit percent e.g. "GOI LOAN 6.90% 2065", "GOI LOAN  7.09% 2074", "8.26% CENTRAL GOVT 2027", "6.10% GS 2031", "GOI 6.9% 2065"
  const m1 = name.match(/(\d+(?:\.\d+)?)\s*%\s*(?:GOI|GOVERNMENT|CENTRAL\s+GOVT|GS|LOAN)?\s*(?:GS|LOAN)?\s*(\d{4})/i)
    || name.match(/(?:GOI|GOVERNMENT|CENTRAL\s+GOVT|GS|LOAN)\s*(\d+(?:\.\d+)?)\s*%\s*(\d{4})/i);
  if (m1) {
    rate = m1[1];
    year = m1[2];
  }

  // Pattern 2: Broker compact ticker e.g. "690GOI65", "690GOI2065", "724GOI55", "828GOI2027", "920GOI2030", "601GOI2028", "795GOI2032"
  if (!rate) {
    const m2 = name.match(/^(\d{2,4})\s*(?:GOI|GS)\s*(\d{2,4})(?:\.NS|\.BO)?$/i);
    if (m2) {
      const rawRate = m2[1];
      const rawYear = m2[2];

      if (rawRate.length === 2) {
        rate = `${rawRate[0]}.${rawRate[1]}0`;
      } else if (rawRate.length === 3) {
        rate = `${rawRate[0]}.${rawRate.slice(1)}`;
      } else if (rawRate.length === 4) {
        rate = `${rawRate.slice(0, 2)}.${rawRate.slice(2)}`;
      }

      if (rawYear.length === 2) {
        year = `20${rawYear}`;
      } else if (rawYear.length === 4) {
        year = rawYear;
      }
    }
  }

  // Pattern 3: GS format e.g. "734GS2064", "73GS2053", "690GS2065"
  if (!rate) {
    const m3 = name.match(/^(\d{2,4})\s*GS\s*(\d{2,4})/i);
    if (m3) {
      const rawRate = m3[1];
      const rawYear = m3[2];

      if (rawRate.length === 2) {
        rate = `${rawRate[0]}.${rawRate[1]}0`;
      } else if (rawRate.length === 3) {
        rate = `${rawRate[0]}.${rawRate.slice(1)}`;
      } else if (rawRate.length === 4) {
        rate = `${rawRate.slice(0, 2)}.${rawRate.slice(2)}`;
      }

      if (rawYear.length === 2) {
        year = `20${rawYear}`;
      } else if (rawYear.length === 4) {
        year = rawYear;
      }
    }
  }

  // Pattern 4: "GOI LOAN 6.13% 2028" or "GOI LOAN 10.18% 2026"
  if (!rate) {
    const m4 = name.match(/GOI\s+LOAN\s+(\d+(?:\.\d+)?)\s*%\s*(\d{4})/i);
    if (m4) {
      rate = m4[1];
      year = m4[2];
    }
  }

  if (rate && year) {
    const numRate = parseFloat(rate);
    const formattedRate = isNaN(numRate) ? rate : numRate.toFixed(2);
    const isinSuffix = cleanIsin ? ` (ISIN ${cleanIsin})` : '';
    return `G-Sec ${formattedRate}% GS ${year}${isinSuffix}`;
  }

  // If ISIN is a sovereign G-Sec (starts with IN00) but didn't match specific patterns above
  if (cleanIsin.startsWith('IN00')) {
    if (!name.includes(cleanIsin)) {
      return `${name} (ISIN ${cleanIsin})`;
    }
    return name;
  }

  return name;
}
