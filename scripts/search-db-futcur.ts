import Database from 'better-sqlite3';

try {
  const db = new Database('scripts/_old_mprofit.db', { readonly: true });
  console.log('Searching in _old_mprofit.db:');
  const res = db.prepare("SELECT * FROM trans1 WHERE dramt LIKE '%404629%' OR cramt LIKE '%404629%'").all();
  console.log('trans1:', res);
  const resc = db.prepare("SELECT * FROM transc1 WHERE dramt LIKE '%404629%' OR cramt LIKE '%404629%'").all();
  console.log('transc1:', resc);
  const resa = db.prepare("SELECT * FROM acmac1 WHERE db_bal LIKE '%404629%' OR cr_bal LIKE '%404629%' OR name LIKE '%FUTCUR%'").all();
  console.log('acmac1:', resa);
  const resam = db.prepare("SELECT * FROM sam WHERE anm LIKE '%FUTCUR%'").all();
  console.log('sam:', resam);
} catch (e: any) {
  console.log('Error:', e.message);
}
