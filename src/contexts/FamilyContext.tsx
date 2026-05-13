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
  // DB is already initialized before FamilyProvider mounts (App.tsx gates on initDatabase)
  // So getStoredFamilies() is populated and safe to use in the initializer
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(() => {
    const stored = localStorage.getItem('activeFamilyId');
    if (stored) return stored;
    // Auto-select first available family
    const families = getStoredFamilies();
    return families.length > 0 ? families[0].id : null;
  });

  const families = getStoredFamilies();

  // Fallback: if still no family selected after render, pick first
  useEffect(() => {
    if (!activeFamilyId && families.length > 0) {
      setActiveFamilyId(families[0].id);
    }
  }, [families.length, activeFamilyId]);

  const activeFamily = families.find(f => f.id === activeFamilyId) ||
                       (families.length > 0 ? families[0] : null);

  // Persist selection
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
