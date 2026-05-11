import React, { useState } from 'react';
import { X, Save, TrendingUp } from 'lucide-react';
import { updateAssetPrice } from '../../logic';

interface Props {
  assetId: string;
  assetName: string;
  currentPrice: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function PMSPriceModal({ assetId, assetName, currentPrice, onClose, onSaved }: Props) {
  const [price, setPrice] = useState<number>(currentPrice);

  const handleSave = async () => {
    await updateAssetPrice(assetId, price);
    onSaved();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#ffffff', width: '400px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Title Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px' }}>
              <TrendingUp size={20} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Update Price</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Asset Name</label>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{assetName}</div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Market Price (₹)</label>
            <input 
              type="number" 
              value={price || ''} 
              onChange={e => setPrice(Number(e.target.value))} 
              autoFocus
              style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '20px', fontWeight: 800, color: '#1e293b', outline: 'none', transition: 'border-color 0.2s' }} 
              onFocus={e => e.target.select()}
            />
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>This price will be used for valuation in all portfolios.</p>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.4)' }}>
            <Save size={16} /> Save Price
          </button>
        </div>
      </div>
    </div>
  );
}
