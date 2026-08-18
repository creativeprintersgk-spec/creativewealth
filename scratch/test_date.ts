function normalizeDateToYYYYMMDD(dateStr) { if (!dateStr) return null; const dt = new Date(dateStr); return dt.toISOString().split('T')[0]; } console.log(normalizeDateToYYYYMMDD('2019-06-13'));  
