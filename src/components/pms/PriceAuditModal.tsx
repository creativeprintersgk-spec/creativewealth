import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertTriangle, RefreshCw, Zap, CheckCircle2, Search, Edit3, ArrowRight } from 'lucide-react';
import { runPriceAudit, autoResolveAsset, saveManualAssetPrice, type PriceAuditReport, type PriceAuditIssue } from '../../services/priceAuditService';
import { state, forceRefreshDatabase } from '../../logic';

interface Props {
  onClose: () => void;
  onRefresh?: () => void;
}

export default function PriceAuditModal({ onClose, onRefresh }: Props) {
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [report, setReport] = useState<PriceAuditReport | null>(null);
  const [editingAmid, setEditingAmid] = useState<number | null>(null);
  const [manualPriceInput, setManualPriceInput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const loadAudit = async () => {
    setLoading(true);
    try {
      if (!state.initialized || (state.sumTable || []).length === 0) {
        await forceRefreshDatabase();
      }
      const holdings = state.sumTable || [];
      const res = await runPriceAudit(holdings);
      setReport(res);
    } catch (e: any) {
      console.error('Audit failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleAutoResolveAll = async () => {
    if (!report || report.issues.length === 0) return;
    setResolving(true);
    setStatusMessage('⚡ Scanning AMFI and Yahoo Finance databases for missing tickers...');

    let resolved = 0;
    for (const issue of report.issues) {
      if (issue.status === 'RESOLVED') continue;
      const res = await autoResolveAsset(issue);
      if (res.success) {
        issue.status = 'RESOLVED';
        resolved++;
      }
    }

    setStatusMessage(`✅ Auto-resolved ${resolved} asset mappings! Refreshing audit...`);
    await forceRefreshDatabase();
    await loadAudit();
    setResolving(false);
    if (onRefresh) onRefresh();
  };

  const handleSingleAutoResolve = async (issue: PriceAuditIssue) => {
    setResolving(true);
    setStatusMessage(`Searching mapping for ${issue.name}...`);
    const res = await autoResolveAsset(issue);
    if (res.success) {
      issue.status = 'RESOLVED';
      setStatusMessage(`✅ ${res.message}`);
      await forceRefreshDatabase();
      await loadAudit();
    } else {
      setStatusMessage(`⚠️ ${res.message}`);
    }
    setResolving(false);
    if (onRefresh) onRefresh();
  };

  const handleSaveManualPrice = async (amid: number) => {
    const p = parseFloat(manualPriceInput);
    if (isNaN(p) || p <= 0) return;

    setStatusMessage('Saving market price...');
    const ok = await saveManualAssetPrice(amid, p);
    if (ok) {
      setEditingAmid(null);
      setManualPriceInput('');
      setStatusMessage('✅ Market price updated successfully!');
      await forceRefreshDatabase();
      await loadAudit();
      if (onRefresh) onRefresh();
    } else {
      setStatusMessage('❌ Failed to save market price');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#ffffff', width: '900px', maxWidth: '95vw', maxHeight: '90vh', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '24px 32px', background: 'linear-[#0f172a, #1e293b]', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: report && report.healthScorePct >= 90 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '14px', border: `1px solid ${report && report.healthScorePct >= 90 ? '#22c55e' : '#ef4444'}` }}>
              <ShieldCheck size={28} color={report && report.healthScorePct >= 90 ? '#22c55e' : '#f87171'} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#000' }}>
                Automated Price Health & Audit Engine
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                Continuous price audit across all assets & portfolio holdings
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 16px auto', display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Auditing portfolio asset prices & mappings...</p>
            </div>
          ) : (
            <>
              {/* Health Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Price Health Score</span>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: (report?.healthScorePct || 0) >= 90 ? '#16a34a' : '#dc2626', marginTop: '6px' }}>
                    {report?.healthScorePct}%
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{report?.pricedCount} of {report?.totalAssetsCount} assets verified</span>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Unmapped / Missing</span>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: (report?.issues.length || 0) > 0 ? '#d97706' : '#16a34a', marginTop: '6px' }}>
                    {report?.issues.length}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Require ticker/AMFI mapping</span>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Stale Prices</span>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>
                    {report?.staleCount}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Older than 5 market days</span>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Price Anomalies</span>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: (report?.anomalyCount || 0) > 0 ? '#dc2626' : '#16a34a', marginTop: '6px' }}>
                    {report?.anomalyCount}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>High variance vs cost</span>
                </div>
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} /> {statusMessage}
                </div>
              )}

              {/* Action Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Detected Price Issues & Audit Log ({report?.issues.length})
                </h3>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={loadAudit} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} /> Re-Scan
                  </button>

                  {report && report.issues.length > 0 && (
                    <button 
                      onClick={handleAutoResolveAll}
                      disabled={resolving}
                      style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: resolving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
                    >
                      <Zap size={14} /> {resolving ? 'Auto-Resolving...' : '⚡ Auto-Resolve All Missing Rates'}
                    </button>
                  )}
                </div>
              </div>

              {/* Audit Table */}
              {report?.issues.length === 0 ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#166534' }}>
                  <CheckCircle2 size={40} style={{ margin: '0 auto 12px auto' }} />
                  <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>100% Price Audit Passed!</h4>
                  <p style={{ fontSize: '13px', color: '#15803d', margin: 0 }}>
                    All active assets across your portfolios have valid, verified market rates.
                  </p>
                </div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                        <th style={{ padding: '12px 16px' }}>Asset Name</th>
                        <th style={{ padding: '12px 16px' }}>Issue Type</th>
                        <th style={{ padding: '12px 16px' }}>Avg Cost</th>
                        <th style={{ padding: '12px 16px' }}>Current Price</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report?.issues.map((issue) => (
                        <tr key={issue.amid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                            {issue.name}
                            {issue.isin && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>ISIN: {issue.isin}</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              padding: '3px 8px', 
                              borderRadius: '6px',
                              background: issue.issueType === 'UNMAPPED' ? '#fef3c7' : issue.issueType === 'PRICE_ANOMALY' ? '#fee2e2' : '#e0f2fe',
                              color: issue.issueType === 'UNMAPPED' ? '#b45309' : issue.issueType === 'PRICE_ANOMALY' ? '#b91c1c' : '#0369a1'
                            }}>
                              {issue.issueType}
                            </span>
                            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{issue.issueDescription}</span>
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                            ₹{issue.avgCost.toFixed(2)}
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: 700, color: issue.currentPrice ? '#0f172a' : '#ef4444' }}>
                            {editingAmid === issue.amid ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input 
                                  type="number"
                                  value={manualPriceInput}
                                  onChange={e => setManualPriceInput(e.target.value)}
                                  placeholder="Rate"
                                  style={{ width: '90px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2563eb', fontSize: '13px' }}
                                />
                                <button onClick={() => handleSaveManualPrice(issue.amid)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Save</button>
                                <button onClick={() => setEditingAmid(null)} style={{ background: '#cbd5e1', color: '#334155', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                              </div>
                            ) : (
                              issue.currentPrice ? `₹${issue.currentPrice.toFixed(2)}` : 'NULL'
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button 
                                onClick={() => handleSingleAutoResolve(issue)}
                                disabled={resolving}
                                style={{ padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Zap size={12} /> Auto-Resolve
                              </button>

                              <button 
                                onClick={() => {
                                  setEditingAmid(issue.amid);
                                  setManualPriceInput(issue.currentPrice ? String(issue.currentPrice) : String(issue.avgCost));
                                }}
                                style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Edit3 size={12} /> Set Rate
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            WealthCore Price Audit Engine • Automatic daily scan enabled
          </span>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Close Audit
          </button>
        </div>

      </div>
    </div>
  );
}
