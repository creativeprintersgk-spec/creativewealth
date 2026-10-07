import React from 'react';
import { X, Printer, Download, ChevronLeft } from 'lucide-react';
import type { ReportConfig } from './ReportsModal';
import { formatDateDDMMMYYYY } from '../logic';

interface ReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportConfig: ReportConfig | null;
  reportData: any[] | null;
}

import PortfolioSummaryRenderer from './reports/PortfolioSummaryRenderer';
import CapitalGainsRenderer from './reports/CapitalGainsRenderer';

export default function ReportViewerModal({ isOpen, onClose, reportConfig, reportData }: ReportViewerModalProps) {
  if (!isOpen || !reportConfig) return null;

  if (reportConfig.reportName === 'Portfolio Summary') {
    return (
      <PortfolioSummaryRenderer
        isOpen={isOpen}
        onClose={onClose}
        reportConfig={reportConfig}
        reportData={reportData}
      />
    );
  }

  if (
    reportConfig.reportName === 'Realised Capital Gains' ||
    reportConfig.reportName === 'Capital Gains - Income Tax Return Format' ||
    reportConfig.reportName === 'Capital Gain/Loss Detailed' ||
    reportConfig.reportName === 'Capital Gain/Loss Summary'
  ) {
    return (
      <CapitalGainsRenderer
        isOpen={isOpen}
        onClose={onClose}
        reportConfig={reportConfig}
        reportData={reportData}
      />
    );
  }

  const handleExportExcel = () => {
    alert("Export to Excel functionality will be implemented here.");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'white',
      zIndex: 10000,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Top Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', background: '#0f172a', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <ChevronLeft size={20} /> Back
          </button>
          <div style={{ width: '1px', height: '24px', background: '#334155' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{reportConfig.reportName}</h2>
          <span style={{ fontSize: '13px', color: '#94a3b8', background: '#1e293b', padding: '4px 8px', borderRadius: '4px' }}>
            {reportConfig.category}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExportExcel} className="btn-secondary" style={{ height: '36px', background: 'transparent', color: 'white', borderColor: '#334155' }}>
            <Download size={16} /> Export Excel
          </button>
          <button onClick={handlePrint} className="btn-secondary" style={{ height: '36px', background: 'transparent', color: 'white', borderColor: '#334155' }}>
            <Printer size={16} /> Print PDF
          </button>
        </div>
      </div>

      {/* Filter summary bar */}
      <div style={{ background: '#f8fafc', padding: '12px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '24px', fontSize: '13px', color: '#475569' }}>
        <div><span style={{ fontWeight: 600, color: '#0f172a' }}>Assets:</span> {reportConfig.options.assetTypes.join(', ')}</div>
        {reportConfig.options.dateRange && (
          <div><span style={{ fontWeight: 600, color: '#0f172a' }}>Period:</span> {formatDateDDMMMYYYY(reportConfig.options.dateRange.start)} to {formatDateDDMMMYYYY(reportConfig.options.dateRange.end)}</div>
        )}
      </div>

      {/* Data Grid Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        {reportData && reportData.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                {Object.keys(reportData[0]).map(key => (
                  <th key={key} style={{ padding: '12px 16px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '12px' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row">
                  {Object.entries(row).map(([colKey, val]: [string, any], j) => {
                    const isDateKey = colKey.toLowerCase().includes('date');
                    const isIsoDate = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val.trim());
                    const displayVal = typeof val === 'number'
                      ? val.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                      : (isDateKey || isIsoDate)
                        ? formatDateDDMMMYYYY(val)
                        : String(val);
                    return (
                      <td key={j} style={{ padding: '12px 16px', color: '#334155', whiteSpace: (isDateKey || isIsoDate) ? 'nowrap' : 'normal' }}>
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#94a3b8' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#64748b' }}>No Data Available</div>
            <div style={{ fontSize: '14px' }}>There is no data matching the selected report configuration.</div>
          </div>
        )}
      </div>
    </div>
  );
}
