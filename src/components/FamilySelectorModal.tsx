import React from 'react';
import { useFamily } from '../contexts/FamilyContext';
import { getStoredFamilies } from '../logic';
import { Users, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FamilySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FamilySelectorModal({ isOpen, onClose }: FamilySelectorModalProps) {
  if (!isOpen) return null;
  const { setActiveFamilyId } = useFamily();
  const families = getStoredFamilies();
  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    setActiveFamilyId(id);
    onClose();
  };

  const handleCreateNew = () => {
    navigate('/master-entry');
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'white',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          width: '64px',
          height: '64px',
          background: 'hsl(217, 91%, 60%)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: 'white',
          boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
        }}>
          <Users size={32} />
        </div>
        
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Open Which Family?
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', marginBottom: '32px' }}>
          Select a family workspace to continue
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
          {families.map(family => (
            <button
              key={family.id}
              onClick={() => handleSelect(family.id)}
              className="family-option"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                background: '#f8fafc',
                border: '2px solid transparent',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>{family.familyName}</div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                  {family.category || 'Family Workspace'}
                </div>
              </div>
              <ChevronRight size={18} color="#94a3b8" />
            </button>
          ))}

          <button
            onClick={handleCreateNew}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px',
              background: 'transparent',
              border: '2px dashed #e2e8f0',
              borderRadius: '16px',
              cursor: 'pointer',
              color: '#64748b',
              fontWeight: 600,
              fontSize: '14px',
              marginTop: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} /> Add New Family
          </button>
        </div>
      </div>
      <style>{`
        .family-option:hover {
          background: white;
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

