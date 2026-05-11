import React from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  holding: any;
  onClose: () => void;
  onDrilldown: (assetId: string, assetName: string, portIds: string[]) => void;
}

export default function HoldingBreakupModal({
  open,
  holding,
  onClose,
  onDrilldown,
}: Props) {

  if (!open || !holding) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{
        width: '900px',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          height: '56px',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>
              {holding.assetName}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Portfolio-wise Holdings
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* TABLE */}
        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc' }}>
              <tr>
                <th style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px' }}>Portfolio</th>
                <th style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px' }}>Folio</th>
                <th style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: '12px' }}>
                  <div>Quantity</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, marginTop: '2px' }}>Avg. Pur. Price</div>
                </th>
                <th style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: '12px' }}>Invested</th>
                <th style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: '12px' }}>Current Value</th>
              </tr>
            </thead>

            <tbody>
              {holding.portfolioSplits.map((item: any, idx: number) => (
                <tr
                  key={idx}
                  onDoubleClick={() => onDrilldown(holding.assetId, holding.assetName, [item.portfolioId])}
                  className="hover:bg-blue-50"
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                >

                  <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px' }}>
                    {item.portfolioName}
                  </td>

                  <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px' }}>
                    {item.folio || '-'}
                  </td>

                  <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ fontWeight: 500 }}>{item.quantity.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {item.quantity > 0 ? (item.amtInvested / item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </td>

                  <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right' }}>
                    ₹{item.amtInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ fontWeight: 500 }}>₹{(item.quantity * holding.currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDrilldown(holding.assetId, holding.assetName, [item.portfolioId]);
                      }}
                      style={{ 
                        fontSize: '11px', 
                        color: '#2563eb', 
                        background: 'none', 
                        border: 'none', 
                        padding: 0, 
                        textDecoration: 'underline', 
                        cursor: 'pointer',
                        marginTop: '4px'
                      }}
                    >
                      View Activity
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div style={{
          height: '56px',
          borderTop: '1px solid #e2e8f0',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '14px'
        }}>
          <div style={{ color: '#6b7280' }}>
            Double click portfolio later for transaction drilldown
          </div>

          <div style={{ fontWeight: 600 }}>
            Total Value: ₹{holding.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <style>{`
        .hover\\:bg-blue-50:hover { background-color: #eff6ff; }
      `}</style>
    </div>
  );
}
