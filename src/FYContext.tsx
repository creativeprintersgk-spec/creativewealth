import React, { createContext, useContext, useState } from 'react';

export const FYContext = createContext<any>(null);

export function FYProvider({ children }: { children: React.ReactNode }) {
  const [selectedFY, setSelectedFY] = useState("2026-2027");
  const [reportFilter, setReportFilter] = useState<'current' | 'last' | 'previous' | 'custom'>('current');
  const [customRange, setCustomRange] = useState({ start: '2026-04-01', end: '2027-03-31' });

  return (
    <FYContext.Provider value={{ selectedFY, setSelectedFY, reportFilter, setReportFilter, customRange, setCustomRange }}>
      {children}
    </FYContext.Provider>
  );
}

export const useFY = () => useContext(FYContext);
