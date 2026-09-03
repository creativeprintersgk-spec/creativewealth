import React, { useState, useRef } from 'react';
import { supabase } from '../supabase';
import { Download, Upload, CheckCircle, AlertCircle, Loader, Database, Clock, Shield } from 'lucide-react';

const TABLES = [
  { name: 'portfolios', pk: 'id', label: 'Portfolios' },
  { name: 'acc_pflink', pk: 'pfid', label: 'Account-Portfolio Links' },
  { name: 'acmac1', pk: 'id', label: 'Ledger Master (ACMAC1)' },
  { name: 'sam', pk: 'amid', label: 'Asset Master (SAM)' },
  { name: 'asset_master', pk: 'amid', label: 'Asset Names & Prices' },
  { name: 'bs1', pk: 'trid', label: 'Portfolio Transactions (BS1)' },
  { name: 'vouchersc1', pk: 'vid', label: 'Cash Vouchers (C1)' },
  { name: 'vouchers1', pk: 'vid', label: 'Account Vouchers' },
  { name: 'transc1', pk: 'transid', label: 'Cash Transactions (C1)' },
  { name: 'trans1', pk: 'transid', label: 'Account Transactions' },
  { name: 'mprices', pk: 'row_id', label: 'Market Prices' },
  // Previously missing from backup/restore entirely. scnote1 is the
  // consequential one: contract-note charges (brokerage/STT/etc.) feed
  // directly into the Capital Gains engine's net-sell-amount calculation
  // (see scMap/cnTrades in getCapitalGains, logic.ts). Without it, a restore
  // would bring bs1/transc1 back correctly but silently leave Capital Gains
  // figures on affected trades slightly wrong until re-imported separately --
  // not a true rollback.
  { name: 'scnote1', pk: 'cnid', label: 'Contract Notes (SCNOTE1)' },
  { name: 'sum_table', pk: 'sid', label: 'Holdings Summary (SumTable)' },
  { name: 'investor_group_members', pk: 'pfolio_id', label: 'Investor Group Members' },
];

const PAGE_SIZE = 1000;
const INSERT_BATCH = 500;

type Status = 'idle' | 'running' | 'success' | 'error';

interface LogLine {
  type: 'info' | 'success' | 'error' | 'warn';
  msg: string;
}

async function fetchAllRows(table: string, pk: string, log: (l: LogLine) => void): Promise<any[]> {
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
      .order(pk, { ascending: true });
    if (error) {
      if (error.message?.includes('does not exist')) {
        log({ type: 'warn', msg: `Table '${table}' not found, skipping.` });
        return [];
      }
      throw new Error(`Fetch '${table}': ${error.message}`);
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

function chunkArray(arr: any[], size: number): any[][] {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export default function BackupRestorePage() {
  const [backupStatus, setBackupStatus] = useState<Status>('idle');
  const [restoreStatus, setRestoreStatus] = useState<Status>('idle');
  const [backupLog, setBackupLog] = useState<LogLine[]>([]);
  const [restoreLog, setRestoreLog] = useState<LogLine[]>([]);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [lastBackupFile, setLastBackupFile] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupLogRef = useRef<HTMLDivElement>(null);
  const restoreLogRef = useRef<HTMLDivElement>(null);

  const addBackupLog = (line: LogLine) => {
    setBackupLog(prev => [...prev, line]);
    setTimeout(() => backupLogRef.current?.scrollTo(0, 99999), 50);
  };
  const addRestoreLog = (line: LogLine) => {
    setRestoreLog(prev => [...prev, line]);
    setTimeout(() => restoreLogRef.current?.scrollTo(0, 99999), 50);
  };

  // ─── BACKUP ───────────────────────────────────────────────────────────────
  const handleBackup = async () => {
    setBackupStatus('running');
    setBackupLog([]);
    setBackupProgress(0);

    try {
      addBackupLog({ type: 'info', msg: '🔄 Starting backup of all tables...' });
      const backup: any = {
        version: 2,
        created_at: new Date().toISOString(),
        tables: {}
      };

      let totalRows = 0;
      for (let i = 0; i < TABLES.length; i++) {
        const { name, pk, label } = TABLES[i];
        addBackupLog({ type: 'info', msg: `📥 Fetching ${label}...` });
        try {
          const rows = await fetchAllRows(name, pk, addBackupLog);
          backup.tables[name] = rows;
          totalRows += rows.length;
          addBackupLog({ type: 'success', msg: `✅ ${label}: ${rows.length.toLocaleString()} rows` });
        } catch (err: any) {
          addBackupLog({ type: 'error', msg: `❌ ${label}: ${err.message}` });
          backup.tables[name] = [];
        }
        setBackupProgress(Math.round(((i + 1) / TABLES.length) * 100));
      }

      // Download as JSON
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
      const filename = `wealthcore_backup_${ts}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastBackupFile(filename);
      addBackupLog({ type: 'success', msg: `\n🎉 Backup complete! ${totalRows.toLocaleString()} rows saved to "${filename}"` });
      setBackupStatus('success');
    } catch (err: any) {
      addBackupLog({ type: 'error', msg: `\n💥 Backup failed: ${err.message}` });
      setBackupStatus('error');
    }
  };

  // ─── RESTORE ──────────────────────────────────────────────────────────────
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be re-selected
    e.target.value = '';

    const confirmed = window.confirm(
      `⚠️ RESTORE WARNING\n\nThis will WIPE all current data and replace it with:\n"${file.name}"\n\nAre you absolutely sure?`
    );
    if (!confirmed) return;

    setRestoreStatus('running');
    setRestoreLog([]);
    setRestoreProgress(0);

    try {
      addRestoreLog({ type: 'info', msg: `📂 Reading backup file: ${file.name}` });
      const text = await file.text();
      const backup = JSON.parse(text);
      addRestoreLog({ type: 'info', msg: `   Backup created: ${backup.created_at}` });

      const tablesToRestore = TABLES.filter(t => backup.tables[t.name] !== undefined);
      const totalRows = tablesToRestore.reduce((s, t) => s + (backup.tables[t.name]?.length || 0), 0);
      addRestoreLog({ type: 'info', msg: `   Total rows to restore: ${totalRows.toLocaleString()}` });

      // Step 1: Truncate all tables (reverse order for FK safety)
      addRestoreLog({ type: 'info', msg: '\n🗑️  Wiping existing data...' });
      const tableList = [...tablesToRestore].reverse().map(t => `public.${t.name}`).join(', ');
      const { error: truncErr } = await (supabase as any).rpc('exec_sql', {
        query: `TRUNCATE TABLE ${tableList} CASCADE;`
      });
      if (truncErr) {
        addRestoreLog({ type: 'warn', msg: `   Bulk truncate failed (${truncErr.message}), truncating individually...` });
        for (const t of [...tablesToRestore].reverse()) {
          const { error: e } = await (supabase as any).rpc('exec_sql', {
            query: `TRUNCATE TABLE public.${t.name} CASCADE;`
          });
          if (e) addRestoreLog({ type: 'warn', msg: `   ⚠️ Could not truncate ${t.name}: ${e.message}` });
        }
      } else {
        addRestoreLog({ type: 'success', msg: '   ✅ All tables wiped.' });
      }

      // Step 2: Insert data
      addRestoreLog({ type: 'info', msg: '\n📤 Restoring tables...' });
      for (let i = 0; i < tablesToRestore.length; i++) {
        const { name, label } = tablesToRestore[i];
        const rows = backup.tables[name] || [];

        if (rows.length === 0) {
          addRestoreLog({ type: 'warn', msg: `⏭️  ${label}: empty, skipped` });
          setRestoreProgress(Math.round(((i + 1) / tablesToRestore.length) * 100));
          continue;
        }

        addRestoreLog({ type: 'info', msg: `📤 Restoring ${label} (${rows.length.toLocaleString()} rows)...` });
        const batches = chunkArray(rows, INSERT_BATCH);
        let inserted = 0;
        let failed = false;

        for (const batch of batches) {
          let currentBatch = batch;
          let attempts = 0;
          while (attempts < 5) {
            const { error } = await supabase.from(name).insert(currentBatch);
            if (!error) { inserted += currentBatch.length; break; }

            // Strip unknown columns and retry
            if (error.code === 'PGRST204' && error.message?.includes("Could not find the '")) {
              const match = error.message.match(/Could not find the '([^']+)' column/);
              if (match) {
                const badCol = match[1];
                addRestoreLog({ type: 'warn', msg: `   Removing unknown column '${badCol}' and retrying...` });
                currentBatch = currentBatch.map((r: any) => { const n = { ...r }; delete n[badCol]; return n; });
                attempts++;
                continue;
              }
            }
            addRestoreLog({ type: 'error', msg: `   ❌ Batch failed for ${name}: ${error.message}` });
            failed = true;
            break;
          }
          if (failed) break;
        }

        if (!failed) {
          addRestoreLog({ type: 'success', msg: `✅ ${label}: ${inserted.toLocaleString()} rows restored` });
        }
        setRestoreProgress(Math.round(((i + 1) / tablesToRestore.length) * 100));
      }

      addRestoreLog({ type: 'success', msg: '\n🎉 Restore complete! Reloading app...' });
      setRestoreStatus('success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      addRestoreLog({ type: 'error', msg: `\n💥 Restore failed: ${err.message}` });
      setRestoreStatus('error');
    }
  };

  const logColor = (type: LogLine['type']) => {
    if (type === 'success') return '#4ade80';
    if (type === 'error') return '#f87171';
    if (type === 'warn') return '#fbbf24';
    return 'rgba(255,255,255,0.7)';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0 }}>Backup & Restore</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.9rem' }}>
            Save a complete snapshot of your data or restore from a previous backup
          </p>
        </div>

        {/* Cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* ── BACKUP CARD ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={17} color="#818cf8" />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Download Backup</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>Save all data as a JSON file</div>
              </div>
            </div>

            {/* Info boxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: <Database size={12} />, text: `${TABLES.length} tables backed up` },
                { icon: <Clock size={12} />, text: 'Takes ~30–60 seconds' },
                { icon: <Shield size={12} />, text: 'Saves to your Downloads folder' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
                  {item.icon} {item.text}
                </div>
              ))}
            </div>

            <button
              onClick={handleBackup}
              disabled={backupStatus === 'running' || restoreStatus === 'running'}
              style={{
                padding: '10px 16px', borderRadius: 9, border: 'none', cursor: backupStatus === 'running' ? 'not-allowed' : 'pointer',
                background: backupStatus === 'running' ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', opacity: restoreStatus === 'running' ? 0.5 : 1
              }}
            >
              {backupStatus === 'running' ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Backing up...</> :
               backupStatus === 'success' ? <><CheckCircle size={15} /> Backup Done!</> :
               backupStatus === 'error' ? <><AlertCircle size={15} /> Retry Backup</> :
               <><Download size={15} /> Download Backup Now</>}
            </button>

            {/* Progress */}
            {backupStatus === 'running' && (
              <div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${backupProgress}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', transition: 'width 0.3s', borderRadius: 4 }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginTop: 4 }}>{backupProgress}% complete</div>
              </div>
            )}

            {/* Log */}
            {backupLog.length > 0 && (
              <div ref={backupLogRef} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {backupLog.map((l, i) => (
                  <div key={i} style={{ color: logColor(l.type), whiteSpace: 'pre-wrap' }}>{l.msg}</div>
                ))}
              </div>
            )}
          </div>

          {/* ── RESTORE CARD ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={17} color="#fbbf24" />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Restore Backup</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>Upload a backup JSON file</div>
              </div>
            </div>

            {/* Warning */}
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
              <AlertCircle size={14} color="#fbbf24" style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ color: '#fbbf24', fontSize: '0.72rem', lineHeight: 1.5 }}>
                <strong>Warning:</strong> This will <strong>wipe all current data</strong> and replace it with the backup file. You will be asked to confirm.
              </div>
            </div>

            {/* Info boxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: <Upload size={12} />, text: 'Select a wealthcore_backup_*.json file' },
                { icon: <Clock size={12} />, text: 'Takes ~60–90 seconds to restore' },
                { icon: <Shield size={12} />, text: 'App will reload automatically when done' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
                  {item.icon} {item.text}
                </div>
              ))}
            </div>

            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelected} />

            <button
              onClick={handleRestoreClick}
              disabled={restoreStatus === 'running' || backupStatus === 'running'}
              style={{
                padding: '10px 16px', borderRadius: 9, border: 'none', cursor: restoreStatus === 'running' ? 'not-allowed' : 'pointer',
                background: restoreStatus === 'running' ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: '#fff', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', opacity: backupStatus === 'running' ? 0.5 : 1
              }}
            >
              {restoreStatus === 'running' ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Restoring...</> :
               restoreStatus === 'success' ? <><CheckCircle size={15} /> Restored! Reloading...</> :
               restoreStatus === 'error' ? <><AlertCircle size={15} /> Retry Restore</> :
               <><Upload size={15} /> Choose Backup File</>}
            </button>

            {/* Progress */}
            {restoreStatus === 'running' && (
              <div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${restoreProgress}%`, background: 'linear-gradient(90deg, #d97706, #f59e0b)', transition: 'width 0.3s', borderRadius: 4 }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginTop: 4 }}>{restoreProgress}% complete</div>
              </div>
            )}

            {/* Log */}
            {restoreLog.length > 0 && (
              <div ref={restoreLogRef} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {restoreLog.map((l, i) => (
                  <div key={i} style={{ color: logColor(l.type), whiteSpace: 'pre-wrap' }}>{l.msg}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tables list */}
        <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Tables included in backup / restore
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {TABLES.map(t => (
              <span key={t.name} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 5, padding: '3px 8px', fontSize: '0.72rem', color: '#a5b4fc', fontFamily: 'monospace' }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
