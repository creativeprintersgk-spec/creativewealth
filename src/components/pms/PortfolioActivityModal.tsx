import React from 'react';
import { X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getPortfolioActivity } from '../../logic';

interface Props {
  open: boolean;
  onClose: () => void;
  portfolioIds: string[];
  title: string;
}

export default function PortfolioActivityModal({ open, onClose, portfolioIds, title }: Props) {
  if (!open) return null;

  const activity = getPortfolioActivity(portfolioIds);

  const fmt = (n: number, dec = 2) => 
    n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ width: '1000px', maxHeight: '85vh', background: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>Portfolio Activity (Coming & Going)</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{title} — {activity.length} transactions</div>
          </div>
          <button onClick={onClose} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
              <tr>
                {['Date', 'Voucher', 'Portfolio', 'Type', 'Asset Name', 'Quantity', 'Price', 'Amount'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No transactions found for this selection.</td>
                </tr>
              ) : (
                activity.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{tx.voucherNo}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{tx.portfolioName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px',
                        color: tx.type === 'BUY' ? '#16a34a' : '#dc2626',
                        fontWeight: 700, fontSize: '11px'
                      }}>
                        {tx.type === 'BUY' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{tx.assetName}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tx.quantity}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{fmt(tx.price)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>₹{fmt(tx.amount, 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
