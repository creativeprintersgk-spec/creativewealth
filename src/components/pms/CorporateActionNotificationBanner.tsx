import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, ChevronRight, X, Sparkles, Building2, AlertCircle } from 'lucide-react';
import { 
  detectPendingCorporateActions, 
  applyCorporateActionToPortfolios,
  type PendingCorporateAction 
} from '../../services/corporateActionsMasterService';

interface Props {
  portfolioIds: string[];
  onActionApplied?: () => void;
}

export default function CorporateActionNotificationBanner({ portfolioIds, onActionApplied }: Props) {
  const [pendingActions, setPendingActions] = useState<PendingCorporateAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<PendingCorporateAction | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkActions = async () => {
      const pIds = portfolioIds.map(id => Number(id)).filter(id => !isNaN(id));
      const results = await detectPendingCorporateActions(pIds);
      if (isMounted) {
        setPendingActions(results);
      }
    };
    checkActions();
    return () => { isMounted = false; };
  }, [portfolioIds]);

  const visibleActions = pendingActions.filter(p => !dismissedIds.has(p.action.id));

  if (visibleActions.length === 0) return null;

  const currentAction = visibleActions[0];

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    if (selectedAction?.action.id === id) setSelectedAction(null);
  };

  const handleApplyAll = async (pending: PendingCorporateAction) => {
    setIsApplying(true);
    setStatusMessage(null);
    try {
      const selections = pending.affectedPortfolios.map(p => ({
        portfolioId: p.portfolioId,
        accountId: p.accountId,
        quantity: p.currentQuantity,
        costBasis: p.parentCostBasis
      }));

      const res = await applyCorporateActionToPortfolios(pending.action, selections);
      if (res.success) {
        setStatusMessage(res.message);
        handleDismiss(pending.action.id);
        if (onActionApplied) onActionApplied();
        setTimeout(() => {
          setSelectedAction(null);
          setStatusMessage(null);
        }, 2000);
      }
    } catch (err: any) {
      alert("Failed to apply corporate action: " + (err.message || String(err)));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      {/* ── Banner ── */}
      <div style={{
        background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)',
        color: '#fff',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 14px rgba(49, 46, 129, 0.25)',
        border: '1px solid #4338ca'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bell size={20} color="#fbbf24" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: '#4f46e5', padding: '2px 8px', borderRadius: '4px' }}>
                Corporate Action Alert
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e0e7ff' }}>
                {currentAction.action.company_name} ({currentAction.action.action_type.toUpperCase()})
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#c7d2fe' }}>
              {currentAction.action.description} &bull; Detected in <strong>{currentAction.affectedPortfolios.length} portfolio(s)</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setSelectedAction(currentAction)}
            style={{
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)'
            }}
          >
            <Sparkles size={14} /> Review & Apply Across Portfolios
          </button>
          <button
            onClick={() => handleDismiss(currentAction.action.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a5b4fc',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
            title="Dismiss notification"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Review & 1-Click Execution Modal ── */}
      {selectedAction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              background: '#1e1b4b',
              color: '#fff',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Building2 size={24} color="#a5b4fc" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                    1-Click Corporate Action Execution
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#c7d2fe' }}>
                    {selectedAction.action.company_name} &bull; {selectedAction.action.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                fontSize: '13px'
              }}>
                <div>
                  <div style={{ color: '#64748b', fontWeight: 600 }}>Action Type</div>
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>{selectedAction.action.action_type}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontWeight: 600 }}>Record Date</div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{selectedAction.action.record_date}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontWeight: 600 }}>Ratio / Cost Split</div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    {selectedAction.action.ratio_num}:{selectedAction.action.ratio_denom} {selectedAction.action.cost_factor ? `(${selectedAction.action.cost_factor}% cost)` : ''}
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                Affected Portfolios & Shares Adjustment
              </h4>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '10px 14px' }}>Portfolio</th>
                      <th style={{ padding: '10px 14px' }}>Holding Qty</th>
                      <th style={{ padding: '10px 14px' }}>New Shares</th>
                      <th style={{ padding: '10px 14px' }}>Allocated Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAction.affectedPortfolios.map((p) => (
                      <tr key={p.portfolioId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                          {p.portfolioName}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{p.currentQuantity}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16a34a' }}>
                          +{p.expectedTargetQuantity} {selectedAction.action.target_symbol || selectedAction.action.symbol}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          ₹{p.allocatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {statusMessage && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  color: '#16a34a',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} /> {statusMessage}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Strict double-entry vouchers will be generated automatically.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setSelectedAction(null)}
                  style={{
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  disabled={isApplying}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApplyAll(selectedAction)}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isApplying ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: isApplying ? 0.7 : 1
                  }}
                  disabled={isApplying}
                >
                  {isApplying ? 'Applying...' : 'Apply Across All Portfolios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
