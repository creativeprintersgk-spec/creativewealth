import React, { useMemo } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { getAssetTransactions } from '../../logic';

interface Props {
  open: boolean;
  assetId: string;
  assetName: string;
  portfolioIds: string[];
  onClose: () => void;
}

export default function AssetLedgerModal({
  open,
  assetId,
  assetName,
  portfolioIds,
  onClose,
}: Props) {
  if (!open) return null;

  const transactions = useMemo(() => {
    return getAssetTransactions(portfolioIds, assetId);
  }, [portfolioIds, assetId, open]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60
    }}>
      <div style={{
        width: '1000px',
        maxWidth: '95vw',
        height: '80vh',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: '#3b82f6', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white'
            }}>
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{assetName}</h3>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Transaction Ledger • {assetId}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '8px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* TABLE CONTENT */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
              <tr>
                {[
                  "Date",
                  "Type",
                  "Portfolio",
                  "Quantity",
                  "Price",
                  "Amount",
                  "Balance Qty",
                  "Narration",
                ].map((head) => (
                  <th
                    key={head}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: '#64748b',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>
                    No transactions found for this asset in selected portfolios.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    className="ledger-row"
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{tx.date}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: 800, 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        background: tx.type === 'PAYMENT' ? '#fee2e2' : tx.type === 'RECEIPT' ? '#dcfce7' : '#f1f5f9',
                        color: tx.type === 'PAYMENT' ? '#991b1b' : tx.type === 'RECEIPT' ? '#166534' : '#475569'
                      }}>
                        {tx.type === 'PAYMENT' ? 'BUY' : tx.type === 'RECEIPT' ? 'SELL' : tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{tx.portfolioName}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{tx.quantity.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>₹{tx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: tx.debit > 0 ? '#0f172a' : '#16a34a' }}>
                      ₹{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, background: '#f8fafc' }}>
                      {tx.balanceQty.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.narration}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          background: '#f8fafc'
        }}>
          <div style={{ color: '#64748b' }}>
            Showing {transactions.length} transactions
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#64748b' }}>Total Qty:</span>
              <span style={{ fontWeight: 800 }}>{transactions.length > 0 ? transactions[transactions.length - 1].balanceQty.toLocaleString() : 0}</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .ledger-row:hover { background-color: #f8fafc; }
      `}</style>
    </div>
  );
}
