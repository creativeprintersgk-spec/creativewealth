import React, { useState, useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Download, Filter } from 'lucide-react';
import { getPortfolioActivity } from '../../logic';

interface Props {
  open: boolean;
  onClose: () => void;
  portfolioIds: string[];
  title: string;
  onEditTransaction?: (voucherId: string) => void;
}

export default function PortfolioActivityModal({ open, onClose, portfolioIds, title, onEditTransaction }: Props) {
  const [selectedAssetType, setSelectedAssetType] = useState<string>('ALL');
  const [selectedAssetName, setSelectedAssetName] = useState<string>('ALL');
  const [selectedTxType, setSelectedTxType] = useState<string>('ALL');

  const rawActivity = useMemo(() => {
    if (!open) return [];
    return getPortfolioActivity(portfolioIds.map(Number), 10000);
  }, [open, portfolioIds]);

  // Distinct Asset Names for Filter Dropdown
  const availableAssetNames = useMemo(() => {
    const names = new Set<string>();
    rawActivity.forEach(tx => {
      if (tx.assetName) names.add(tx.assetName);
    });
    return Array.from(names).sort();
  }, [rawActivity]);

  // Distinct Asset Types Map
  const mapAssetCategory = (atyid?: number, assetName?: string) => {
    const name = (assetName || '').toLowerCase();
    if (name.includes('gold') || name.includes('silver') || atyid === 75 || atyid === 77 || atyid === 150 || atyid === 151) return 'Gold & Precious Metals';
    if (atyid === 50) return 'Stocks & ETFs';
    if (atyid === 60 || atyid === 61) return 'Mutual Funds';
    if (atyid === 90) return 'FDs';
    if (atyid === 100 || atyid === 70) return 'Traded Bonds';
    if (atyid === 110) return 'NCD/Debentures';
    if (atyid === 130) return 'PPF/EPF';
    return 'Other';
  };

  // Filtered Activity List
  const filteredActivity = useMemo(() => {
    return rawActivity.filter(tx => {
      // 1. Asset Type Filter
      if (selectedAssetType !== 'ALL') {
        const cat = mapAssetCategory(tx.assetType, tx.assetName);
        if (cat !== selectedAssetType) return false;
      }
      // 2. Asset Name Filter
      if (selectedAssetName !== 'ALL') {
        if (tx.assetName !== selectedAssetName) return false;
      }
      // 3. Transaction Type Filter
      if (selectedTxType !== 'ALL') {
        const typeStr = (tx.type || '').toUpperCase();
        if (selectedTxType === 'BUY' && !typeStr.includes('BUY')) return false;
        if (selectedTxType === 'SELL' && !typeStr.includes('SELL')) return false;
        if (selectedTxType === 'BONUS' && !typeStr.includes('BONUS')) return false;
        if (selectedTxType === 'SPLIT' && !typeStr.includes('SPLIT')) return false;
        if (selectedTxType === 'DIVIDEND' && !typeStr.includes('DIVIDEND') && !typeStr.includes('INTEREST')) return false;
      }
      return true;
    });
  }, [rawActivity, selectedAssetType, selectedAssetName, selectedTxType]);

  if (!open) return null;

  const fmt = (n: number, dec = 2) => 
    n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  // Export to CSV Function
  const exportToCSV = () => {
    const headers = ['Date', 'Voucher', 'Portfolio', 'Type', 'Asset Name', 'Quantity', 'Price (Rs.)', 'Amount (Rs.)', 'Narration'];
    const rows = filteredActivity.map(tx => [
      `"${tx.date}"`,
      `"${tx.voucherNo}"`,
      `"${tx.portfolioName}"`,
      `"${tx.type}"`,
      `"${tx.assetName.replace(/"/g, '""')}"`,
      tx.quantity,
      tx.price,
      tx.amount,
      `"${(tx.narration || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Portfolio_Activity_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ width: '1100px', maxHeight: '88vh', background: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '17px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Portfolio Activity (Coming & Going)</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {title} — Showing <strong>{filteredActivity.length}</strong> of <strong>{rawActivity.length}</strong> transactions
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={exportToCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', background: '#0284c7', color: 'white',
                border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Download size={14} />
              <span>Export to CSV</span>
            </button>

            <button onClick={onClose} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MProfit 3-Tier Filter Bar */}
        <div style={{ padding: '12px 24px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          {/* Filter 1: Asset Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Asset Type:</label>
            <select
              value={selectedAssetType}
              onChange={e => setSelectedAssetType(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white', color: '#0f172a', fontWeight: 600 }}
            >
              <option value="ALL">All Asset Types</option>
              <option value="Stocks & ETFs">Stocks & ETFs</option>
              <option value="Mutual Funds">Mutual Funds</option>
              <option value="Gold & Precious Metals">Gold & Precious Metals</option>
              <option value="Traded Bonds">Traded Bonds</option>
              <option value="NCD/Debentures">NCD/Debentures</option>
              <option value="FDs">FDs</option>
              <option value="PPF/EPF">PPF/EPF</option>
              <option value="Other">Other Assets</option>
            </select>
          </div>

          {/* Filter 2: Asset Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Asset Name:</label>
            <select
              value={selectedAssetName}
              onChange={e => setSelectedAssetName(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white', color: '#0f172a', fontWeight: 600, maxWidth: '240px' }}
            >
              <option value="ALL">All Assets ({availableAssetNames.length})</option>
              {availableAssetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Filter 3: Transaction Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Tx Type:</label>
            <select
              value={selectedTxType}
              onChange={e => setSelectedTxType(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white', color: '#0f172a', fontWeight: 600 }}
            >
              <option value="ALL">All Types</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
              <option value="BONUS">Bonus</option>
              <option value="SPLIT">Split</option>
              <option value="DIVIDEND">Dividend / Interest</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedAssetType !== 'ALL' || selectedAssetName !== 'ALL' || selectedTxType !== 'ALL') && (
            <button
              onClick={() => { setSelectedAssetType('ALL'); setSelectedAssetName('ALL'); setSelectedTxType('ALL'); }}
              style={{ padding: '4px 10px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Table Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
              <tr>
                {['Date', 'Voucher', 'Portfolio', 'Type', 'Asset Name', 'Quantity', 'Price', 'Amount'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Quantity' || h === 'Price' || h === 'Amount' ? 'right' : 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No transactions found for the selected filter criteria.</td>
                </tr>
              ) : (
                filteredActivity.map((tx, i) => {
                  const isImported = tx.narration && tx.narration.toLowerCase().includes("mutual fund cas");
                  const isBuyType = (tx.type || '').toUpperCase().includes('BUY') || (tx.type || '').toUpperCase().includes('BONUS');
                  return (
                  <tr 
                    key={tx.id} 
                    style={{ borderBottom: '1px solid #f1f5f9', background: isImported ? '#e0f2fe' : (i % 2 === 0 ? 'white' : '#fafafa'), cursor: 'pointer' }}
                    onDoubleClick={() => onEditTransaction?.(String(tx.id))}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{tx.voucherNo}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{tx.portfolioName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        color: isBuyType ? '#16a34a' : '#dc2626',
                        background: isBuyType ? '#f0fdf4' : '#fef2f2',
                        padding: '2px 8px', borderRadius: '4px',
                        fontWeight: 700, fontSize: '11px'
                      }}>
                        {isBuyType ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{tx.assetName}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{tx.quantity}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{fmt(tx.price)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>₹{fmt(tx.amount, 0)}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Tip: Double-click any row to edit or view full transaction voucher.
          </div>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
