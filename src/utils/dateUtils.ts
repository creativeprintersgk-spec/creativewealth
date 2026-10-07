/**
 * Standard Date Formatter for WealthCore
 * Formats any date into DD-MMM-YYYY (e.g. 25-May-2026, 01-Apr-2026)
 */

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateDDMMMYYYY(d: string | number | Date | null | undefined): string {
  if (d === null || d === undefined || d === '') return '';

  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'invalid date') return '';

    // If it's already in DD-MMM-YYYY or D-MMM-YYYY
    const alreadyFormatted = trimmed.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})$/);
    if (alreadyFormatted) {
      const day = alreadyFormatted[1].padStart(2, '0');
      const mon = alreadyFormatted[2].charAt(0).toUpperCase() + alreadyFormatted[2].slice(1, 3).toLowerCase();
      const year = alreadyFormatted[3];
      return `${day}-${mon}-${year}`;
    }

    // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const day = isoMatch[3].padStart(2, '0');
      if (mIdx >= 0 && mIdx < 12) {
        return `${day}-${SHORT_MONTHS[mIdx]}-${year}`;
      }
    }

    // DD/MM/YYYY or DD-MM-YYYY or D/M/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const mIdx = parseInt(dmyMatch[2], 10) - 1;
      const year = dmyMatch[3];
      if (mIdx >= 0 && mIdx < 12) {
        return `${day}-${SHORT_MONTHS[mIdx]}-${year}`;
      }
    }

    // Fallback: parse as Date
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const mon = SHORT_MONTHS[parsed.getMonth()];
      const year = parsed.getFullYear();
      return `${day}-${mon}-${year}`;
    }

    return trimmed;
  }

  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = SHORT_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${mon}-${year}`;
  }

  if (typeof d === 'number') {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const day = String(dt.getDate()).padStart(2, '0');
    const mon = SHORT_MONTHS[dt.getMonth()];
    const year = dt.getFullYear();
    return `${day}-${mon}-${year}`;
  }

  return String(d);
}

/**
 * Format a date range "YYYY-MM-DD to YYYY-MM-DD" into "DD-MMM-YYYY to DD-MMM-YYYY"
 */
export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';
  if (start && !end) return `From ${formatDateDDMMMYYYY(start)}`;
  if (!start && end) return `As on ${formatDateDDMMMYYYY(end)}`;
  return `${formatDateDDMMMYYYY(start)} to ${formatDateDDMMMYYYY(end)}`;
}

// Export default alias
export const formatDate = formatDateDDMMMYYYY;
