import React, { useState, useEffect, useMemo } from 'react';
import { useFY } from '../FYContext';
import { useFamily } from '../contexts/FamilyContext';
import { getStoredPortfolios } from '../logic';
import {
  getTaxLossHarvestingData,
  exportTaxLossHarvestingCSV,
  type TaxHarvestingOverview,
  type HarvestAssetSummary,
  type HarvestLot
} from '../services/taxLossHarvestingService';
import {
  TrendingDown,
  Download,
  Filter,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
  Coins
} from 'lucide-react';
import VoucherModal from '../VoucherModal';

export default function TaxLossHarvesting() {
  const { selectedFY, customRange } = useFY();
  const { activeFamily } = useFamily();

  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('all');
  const [termFilter, setTermFilter] = useState<'ALL' | 'STCL' | 'LTCL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'asset' | 'lot'>('asset');
  const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({});

  // Voucher creation modal for 1-click execution
  const [harvestVoucherLot, setHarvestVoucherLot] = useState<HarvestLot | null>(null);

  useEffect(() => {
    const allPfs = getStoredPortfolios().filter(p => !activeFamily?.id || String(p.client_id) === activeFamily.id);
    setPortfolios(allPfs);
  }, [activeFamily]);

  const targetPortfolioIds = useMemo(() => {
    if (selectedPortfolioId !== 'all') {
      return [selectedPortfolioId];
    }
    return portfolios.map(p => p.id);
  }, [selectedPortfolioId, portfolios]);

  const overview: TaxHarvestingOverview = useMemo(() => {
    if (!targetPortfolioIds.length) {
      return {
        realizedSTCG: 0,
        realizedLTCG: 0,
        realizedSTCL: 0,
        realizedLTCL: 0,
        netRealizedSTCG: 0,
        netRealizedLTCG: 0,
        currentTaxLiability: 0,
        totalHarvestableLoss: 0,
        harvestableSTCL: 0,
        harvestableLTCL: 0,
        immediateTaxSavings: 0,
        carryForwardTaxSavings: 0,
        totalTaxSavings: 0,
        assets: [],
        lots: []
      };
    }
    return getTaxLossHarvestingData(
      targetPortfolioIds,
      undefined,
      customRange?.start,
      customRange?.end
    );
  }, [targetPortfolioIds, customRange]);

  const filteredAssets = useMemo(() => {
    return overview.assets.filter(a => {
      if (termFilter === 'STCL' && a.stclLoss <= 0) return false;
      if (termFilter === 'LTCL' && a.ltclLoss <= 0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = a.assetName.toLowerCase().includes(q);
        const matchesIsin = a.isin.toLowerCase().includes(q);
        const matchesPf = a.portfolioName.toLowerCase().includes(q);
        if (!matchesName && !matchesIsin && !matchesPf) return false;
      }
      return true;
    });
  }, [overview.assets, termFilter, searchQuery]);

  const filteredLots = useMemo(() => {
    return overview.lots.filter(l => {
      if (termFilter !== 'ALL' && l.term !== termFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = l.assetName.toLowerCase().includes(q);
        const matchesIsin = l.isin.toLowerCase().includes(q);
        const matchesPf = l.portfolioName.toLowerCase().includes(q);
        if (!matchesName && !matchesIsin && !matchesPf) return false;
      }
      return true;
    });
  }, [overview.lots, termFilter, searchQuery]);

  const handleExportCSV = () => {
    const csv = exportTaxLossHarvestingCSV(overview);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wealthcore_tax_loss_harvesting_${selectedFY}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (key: string) => {
    setExpandedAssets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fmt = (n: number) =>
    (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: 8, borderRadius: 8, display: 'flex' }}>
                <TrendingDown size={22} />
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Tax-Loss Harvesting Assistant
              </h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Scan open FIFO lots in loss, set off against FY {selectedFY} realized gains, and optimize tax liability under Budget 2024 slabs.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: '#334155'
              }}
            >
              <Download size={15} />
              Export Harvesting Plan (CSV)
            </button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: '1.5rem' }}>
          
          {/* Card 1: Realized Gains Current FY */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Current FY Realized Gains
              </span>
              <Coins size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              ₹{fmt(overview.netRealizedSTCG + overview.netRealizedLTCG)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Short-Term (STCG @ 20%):</span>
                <strong style={{ color: '#0f172a' }}>₹{fmt(overview.netRealizedSTCG)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Long-Term (LTCG @ 12.5%):</span>
                <strong style={{ color: '#0f172a' }}>₹{fmt(overview.netRealizedLTCG)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: 4, marginTop: 2 }}>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>Current Tax Liability:</span>
                <strong style={{ color: '#dc2626' }}>₹{fmt(overview.currentTaxLiability)}</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Harvestable Losses */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Harvestable Unrealized Loss
              </span>
              <TrendingDown size={18} color="#ef4444" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', marginBottom: 8 }}>
              -₹{fmt(overview.totalHarvestableLoss)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>STCL (Held &lt; 365 days):</span>
                <strong style={{ color: '#dc2626' }}>-₹{fmt(overview.harvestableSTCL)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>LTCL (Held &ge; 365 days):</span>
                <strong style={{ color: '#dc2626' }}>-₹{fmt(overview.harvestableLTCL)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: 4, marginTop: 2 }}>
                <span>Loss Opportunities:</span>
                <strong style={{ color: '#0f172a' }}>{overview.assets.length} assets ({overview.lots.length} lots)</strong>
              </div>
            </div>
          </div>

          {/* Card 3: Estimated Tax Savings */}
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: 10, padding: 18, border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.05em' }}>
                Potential Tax Savings
              </span>
              <Sparkles size={18} color="#16a34a" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginBottom: 8 }}>
              ₹{fmt(overview.totalTaxSavings)}
            </div>
            <div style={{ fontSize: 12, color: '#166534', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Immediate FY Offset:</span>
                <strong style={{ color: '#15803d' }}>₹{fmt(overview.immediateTaxSavings)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Carry-Forward Benefit (8 AYs):</span>
                <strong style={{ color: '#15803d' }}>₹{fmt(overview.carryForwardTaxSavings)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #86efac', paddingTop: 4, marginTop: 2 }}>
                <span style={{ fontWeight: 600 }}>Sec 111A/112A Optimization:</span>
                <strong>Active</strong>
              </div>
            </div>
          </div>

        </div>

        {/* Rules & Notice Alert */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Info size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
            <strong>How Tax Harvesting Works:</strong> Under Budget 2024 rules, <strong>Short-Term Capital Loss (STCL)</strong> can set off against both STCG (20%) and LTCG (12.5%). <strong>Long-Term Capital Loss (LTCL)</strong> can set off only against LTCG (12.5%). Unabsorbed losses can be carried forward for <strong>8 consecutive Assessment Years</strong>. Selling loss lots and re-entering equivalent assets (or waiting after settlement) resets your acquisition cost and locks in the tax savings.
          </div>
        </div>

        {/* Filter and View Bar */}
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            
            {/* Portfolio Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Portfolio:</span>
              <select
                value={selectedPortfolioId}
                onChange={e => setSelectedPortfolioId(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600, color: '#1e293b' }}
              >
                <option value="all">All Portfolios ({portfolios.length})</option>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.portfolioName}</option>
                ))}
              </select>
            </div>

            {/* Term Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
              {(['ALL', 'STCL', 'LTCL'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTermFilter(t)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 4,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: termFilter === t ? '#fff' : 'transparent',
                    color: termFilter === t ? '#0f172a' : '#64748b',
                    boxShadow: termFilter === t ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  {t === 'ALL' ? 'All Losses' : t === 'STCL' ? 'STCL (20%)' : 'LTCL (12.5%)'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10 }} />
              <input
                type="text"
                placeholder="Search asset, ISIN, portfolio..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '6px 12px 6px 30px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  width: 220,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>View Mode:</span>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
              <button
                onClick={() => setViewMode('asset')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: viewMode === 'asset' ? '#fff' : 'transparent',
                  color: viewMode === 'asset' ? '#0f172a' : '#64748b'
                }}
              >
                Grouped by Asset ({filteredAssets.length})
              </button>
              <button
                onClick={() => setViewMode('lot')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: viewMode === 'lot' ? '#fff' : 'transparent',
                  color: viewMode === 'lot' ? '#0f172a' : '#64748b'
                }}
              >
                FIFO Lots ({filteredLots.length})
              </button>
            </div>
          </div>

        </div>

        {/* Main Data Table */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          
          {viewMode === 'asset' ? (
            /* Grouped by Asset View */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px', width: 40 }}></th>
                    <th style={{ padding: '12px 16px' }}>Asset / Holding</th>
                    <th style={{ padding: '12px 16px' }}>Portfolio</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Harvest Qty</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Avg Cost</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cur. Price</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Invested</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Current Value</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Unrealized Loss</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Est. Tax Saved</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        No harvestable tax loss opportunities found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map(asset => {
                      const key = `${asset.pfid}_${asset.amid}`;
                      const isExpanded = !!expandedAssets[key];
                      return (
                        <React.Fragment key={key}>
                          <tr
                            onClick={() => toggleExpand(key)}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              background: isExpanded ? '#fafafa' : '#fff',
                              transition: 'background 0.15s'
                            }}
                          >
                            <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{asset.assetName}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {asset.isin || 'No ISIN'} • {asset.assetTypeName}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>
                              {asset.portfolioName}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {asset.totalHarvestableQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              ₹{fmt(asset.avgCost)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              ₹{fmt(asset.currentPrice)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              ₹{fmt(asset.investedVal)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              ₹{fmt(asset.currentVal)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                              -₹{fmt(asset.totalLoss)}
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#ef4444' }}>
                                ({asset.stclLoss > 0 ? `STCL: ₹${fmt(asset.stclLoss)}` : ''} {asset.ltclLoss > 0 ? `LTCL: ₹${fmt(asset.ltclLoss)}` : ''})
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                              ₹{fmt(asset.estimatedTaxSavings)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setHarvestVoucherLot(asset.lots[0]);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                              >
                                Harvest
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Lots Table */}
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc' }}>
                              <td colSpan={11} style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Layers size={14} /> Open FIFO Lots for {asset.assetName}:
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11 }}>
                                      <th style={{ padding: '8px 12px' }}>Acquisition Date</th>
                                      <th style={{ padding: '8px 12px' }}>Holding Days</th>
                                      <th style={{ padding: '8px 12px' }}>Tax Term</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Remaining Qty</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Cost / Unit</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Current Price</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unrealized Loss</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tax Rate</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tax Saved</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {asset.lots.map((lot, idx) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px 12px' }}>{lot.buyDate}</td>
                                        <td style={{ padding: '8px 12px' }}>{lot.holdingDays} days</td>
                                        <td style={{ padding: '8px 12px' }}>
                                          <span
                                            style={{
                                              padding: '2px 6px',
                                              borderRadius: 4,
                                              fontSize: 10,
                                              fontWeight: 700,
                                              background: lot.term === 'STCL' ? '#fef3c7' : '#e0e7ff',
                                              color: lot.term === 'STCL' ? '#b45309' : '#3730a3'
                                            }}
                                          >
                                            {lot.term}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {lot.remainingQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          ₹{fmt(lot.costPerUnit)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          ₹{fmt(lot.currentPrice)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                          -₹{fmt(lot.unrealizedLoss)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                                          {lot.taxRate}%
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                                          ₹{fmt(lot.potentialTaxSaving)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                          <button
                                            onClick={() => setHarvestVoucherLot(lot)}
                                            style={{
                                              padding: '2px 8px',
                                              fontSize: 10,
                                              fontWeight: 700,
                                              background: '#dc2626',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: 3,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Sell Lot
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Flat FIFO Lots View */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Asset Name</th>
                    <th style={{ padding: '12px 16px' }}>Portfolio</th>
                    <th style={{ padding: '12px 16px' }}>Buy Date</th>
                    <th style={{ padding: '12px 16px' }}>Holding Days</th>
                    <th style={{ padding: '12px 16px' }}>Term</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Remaining Qty</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cost / Unit</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cur. Price</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Unrealized Loss</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tax Saved</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLots.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        No harvestable FIFO lots found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLots.map((lot, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{lot.assetName}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{lot.isin || 'No ISIN'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{lot.portfolioName}</td>
                        <td style={{ padding: '12px 16px' }}>{lot.buyDate}</td>
                        <td style={{ padding: '12px 16px' }}>{lot.holdingDays} days</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: lot.term === 'STCL' ? '#fef3c7' : '#e0e7ff',
                              color: lot.term === 'STCL' ? '#b45309' : '#3730a3'
                            }}
                          >
                            {lot.term} ({lot.taxRate}%)
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {lot.remainingQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmt(lot.costPerUnit)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmt(lot.currentPrice)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                          -₹{fmt(lot.unrealizedLoss)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmt(lot.potentialTaxSaving)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => setHarvestVoucherLot(lot)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer'
                            }}
                          >
                            Sell Lot
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* Harvest Voucher Modal */}
      {harvestVoucherLot && (
        <VoucherModal
          voucherId={undefined}
          accountId={undefined}
          onClose={() => setHarvestVoucherLot(null)}
          onSaved={() => {
            setHarvestVoucherLot(null);
            alert('Harvest sell voucher created successfully! Realized loss has been booked.');
          }}
        />
      )}

    </div>
  );
}
