import Database from 'better-sqlite3';
import { getCapitalGains, getStoredPortfolios, state, rebuildAllIndexes } from '../src/logic.ts';

const db = new Database('scripts/_old_mprofit_clean.db');
state.bs1 = db.prepare('SELECT * FROM bs1').all().map((r: any) => ({
  trid: r.TRID,
  pfid: r.PFID,
  amid: r.AMID,
  atyid: r.AType || 50,
  trty: r.TRTY,
  dt: r.DT,
  qn: r.QN,
  purpr: r.PURPR,
  amt: r.AMT,
  netpr: r.NETPR,
  cnid: r.CNID,
  sid: r.SID,
  brkg: r.BRKG
}));

state.acmac1 = db.prepare('SELECT * FROM acmac1').all().map((r: any) => ({
  id: r.ID,
  name: r.NAME,
  parent_id: r.Parent_ID,
  is_group: r.IS_GROUP === 1,
  db_bal: r.DB_BAL,
  cr_bal: r.CR_BAL,
  acid: r.ACID,
  exint1: r.ExInt1
}));

state.portfolios = db.prepare('SELECT * FROM portfolios').all().map((r: any) => ({
  id: r.ID,
  name: r.NAME,
  investor_name: r.NAME,
  acid: r.ACID
}));

state.scnote1 = db.prepare('SELECT * FROM scnote1').all().map((r: any) => ({
  cnid: r.CNID,
  servtax: r.ServTax,
  tranchrg: r.TranChrg,
  othchrg: r.OthChrg,
  stmpchrgs: r.StmpChrgs,
  stt: r.STT,
  cstr: r.CSTR
}));

console.log(`Loaded ${state.bs1.length} bs1 rows, ${state.acmac1.length} acmac1 rows, ${state.portfolios.length} portfolios.`);

const pfIds = state.portfolios.map((p: any) => p.id);

console.time('First getCapitalGains run');
const res1 = getCapitalGains(pfIds, '2026-04-01', '2027-03-31');
console.timeEnd('First getCapitalGains run');
console.log(`Results: ${res1.length}`);

console.time('Second getCapitalGains run');
const res2 = getCapitalGains(pfIds, '2026-04-01', '2027-03-31');
console.timeEnd('Second getCapitalGains run');
