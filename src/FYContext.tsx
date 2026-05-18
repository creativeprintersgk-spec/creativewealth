import React, { createContext, useContext, useState } from 'react';

export const FYContext = createContext<any>(null);

export function FYProvider({ children }: { children: React.ReactNode }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const startYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;
  const todayStr = today.toISOString().split('T')[0];

  const [selectedFY, setSelectedFY] = useState(`${startYear}-${startYear + 1}`);
  const [reportFilter, setReportFilter] = useState<'current' | 'last' | 'previous' | 'custom'>('current');
  const [customRange, setCustomRange] = useState({ start: `${startYear}-04-01`, end: todayStr });

  return (
    <FYContext.Provider value={{ selectedFY, setSelectedFY, reportFilter, setReportFilter, customRange, setCustomRange }}>
      {children}
    </FYContext.Provider>
  );
}

export const useFY = () => useContext(FYContext);
