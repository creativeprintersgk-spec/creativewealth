import React, { createContext, useContext, useState } from 'react';

export const FYContext = createContext<any>(null);

function getCurrentFYEnd(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 
    ? now.getFullYear() + 1 
    : now.getFullYear()      
  return `${year}-03-31`
}

export function FYProvider({ children }: { children: React.ReactNode }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const startYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;

  const [selectedFY, setSelectedFY] = useState(`${startYear}-${startYear + 1}`);
  const [reportFilter, setReportFilter] = useState<'current' | 'last' | 'previous' | 'custom'>('current');
  const [customRange, setCustomRange] = useState({ start: `${startYear}-04-01`, end: getCurrentFYEnd() });

  return (
    <FYContext.Provider value={{ selectedFY, setSelectedFY, reportFilter, setReportFilter, customRange, setCustomRange }}>
      {children}
    </FYContext.Provider>
  );
}

export const useFY = () => useContext(FYContext);
