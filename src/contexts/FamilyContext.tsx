import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredFamilies } from '../logic';

interface Family {
  id: string;
  familyName: string;
  category?: string;
}

interface FamilyContextType {
  activeFamilyId: string | null;
  setActiveFamilyId: (id: string | null) => void;
  activeFamily: Family | null;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(() => {
    return localStorage.getItem('activeFamilyId');
  });

  const families = getStoredFamilies();

  // Auto-select: restore from localStorage OR pick the first family
  useEffect(() => {
    if (!activeFamilyId) {
      const stored = localStorage.getItem('activeFamilyId');
      if (stored) {
        setActiveFamilyId(stored);
      } else if (families.length > 0) {
        setActiveFamilyId(families[0].id);
      }
    }
  }, [families.length]);

  const activeFamily = families.find(f => f.id === activeFamilyId) || null;

  useEffect(() => {
    if (activeFamilyId) {
      localStorage.setItem('activeFamilyId', activeFamilyId);
    } else {
      localStorage.removeItem('activeFamilyId');
    }
  }, [activeFamilyId]);

  return (
    <FamilyContext.Provider value={{ activeFamilyId, setActiveFamilyId, activeFamily }}>
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};
