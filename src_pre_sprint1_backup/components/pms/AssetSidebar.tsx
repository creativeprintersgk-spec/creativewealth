import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  PieChart, 
  Shield, 
  Home, 
  Landmark, 
  Coins, 
  Briefcase,
  Users,
  Settings,
  LogOut
} from 'lucide-react';
import { useFamily } from '../../contexts/FamilyContext';

interface AssetSidebarProps {
  activeAssetType: string;
  setActiveAssetType: (id: string) => void;
  onOpenFamilySelector: () => void;
}

export default function AssetSidebar({ 
  activeAssetType, 
  setActiveAssetType,
  onOpenFamilySelector
}: AssetSidebarProps) {
  const { activeFamily } = useFamily();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    equity: true,
    debt: true,
    alt: true
  });

  const toggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const menu = [
    { id: 'all', label: 'All Assets', icon: <PieChart size={14} /> },
    { id: 'stocks', label: 'Stocks', icon: <Briefcase size={14} /> },
    { id: 'mf', label: 'Mutual Funds', icon: <TrendingUp size={14} /> },
    { id: 'special_inv_funds', label: 'Special Inv. Funds', icon: <Shield size={14} /> },
    { id: 'nps', label: 'NPS / ULIP', icon: <Shield size={14} /> },
    { id: 'insurance', label: 'Insurance', icon: <Shield size={14} /> },
    { id: 'private_equity', label: 'Private Equity', icon: <Briefcase size={14} /> },
    { id: 'fds', label: 'Fixed Deposits', icon: <Landmark size={14} /> },
    { id: 'bonds', label: 'Traded Bonds', icon: <Landmark size={14} /> },
    { id: 'ncd', label: 'NCD / Debentures', icon: <Landmark size={14} /> },
    { id: 'deposits_loans', label: 'Deposits / Loans', icon: <Landmark size={14} /> },
    { id: 'ppf', label: 'PPF / EPF', icon: <Landmark size={14} /> },
    { id: 'post', label: 'Post Office', icon: <Landmark size={14} /> },
    { id: 'gold', label: 'Gold', icon: <Coins size={14} /> },
    { id: 'silver', label: 'Silver', icon: <Coins size={14} /> },
    { id: 'jewellery', label: 'Jewellery', icon: <Coins size={14} /> },
    { id: 'properties', label: 'Properties', icon: <Home size={14} /> },
    { id: 'art', label: 'Art', icon: <PieChart size={14} /> },
    { id: 'aif', label: 'AIF', icon: <Shield size={14} /> },
    { id: 'loans', label: 'Loans', icon: <Landmark size={14} /> },
  ];

  const renderItem = (item: any) => {
    const isActive = activeAssetType === item.id;

    return (
      <div key={item.id}>
        <button
          onClick={() => setActiveAssetType(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            background: isActive ? 'hsl(217, 91%, 60%, 0.08)' : 'transparent',
            borderRadius: '6px',
            color: isActive ? 'hsl(217, 91%, 60%)' : '#64748b',
            fontWeight: isActive ? 700 : 500,
            fontSize: '13px',
            cursor: 'pointer',
            marginBottom: '1px',
            transition: 'all 0.1s'
          }}
        >
          <span style={{ color: isActive ? 'hsl(217, 91%, 60%)' : '#cbd5e1', display: 'flex' }}>
            {item.icon}
          </span>
          <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          {isActive && <div style={{ width: '4px', height: '4px', background: 'hsl(217, 91%, 60%)', borderRadius: '50%' }} />}
        </button>
      </div>
    );
  };

  return (
    <div style={{ width: '220px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 20px 16px' }}>
        <h2 style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Portfolio Explorer</h2>
      </div>
      
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
        {menu.map(item => renderItem(item))}
      </nav>

      {/* Family Context Footer */}
      <div style={{ padding: '16px 8px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <button
          onClick={onOpenFamilySelector}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            background: 'white',
            borderRadius: '8px',
            color: '#0f172a',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ width: '24px', height: '24px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <Users size={12} />
          </div>
          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeFamily?.familyName || 'Select Family'}
          </div>
          <ChevronRight size={14} color="#94a3b8" />
        </button>
      </div>
    </div>
  );
}
