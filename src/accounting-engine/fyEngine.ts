export function getFYRange(fy: string) {
  const [startYear] = fy.split("-");
  const year = parseInt(startYear);
  return {
    start: `${year}-04-01`,
    end: `${year + 1}-03-31`
  };
}

export function getFYFromDate(dateStr: string) {
  if (!dateStr) return "1900-1901";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
