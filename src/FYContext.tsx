import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAvailableFYs, forceRefreshDatabase } from './logic';

export const FYContext = createContext<any>(null);

export function FYProvider({ children }: { children: React.ReactNode }) {
  const [availableFYs, setAvailableFYs] = useState<any[]>([]);
  const today = new Date();
  const currentYear = today.getFullYear();
  const startYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;
  const todayStr = today.toISOString().split('T')[0];

  const [selectedFY, setSelectedFY] = useState(`${startYear}-${startYear + 1}`);
  const [reportFilter, setReportFilter] = useState<'current' | 'last' | 'previous' | 'custom'>('current');
  const [customRange, setCustomRange] = useState({ start: `${startYear}-04-01`, end: todayStr });

  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const triggerGlobalRefresh = async (hard = false) => {
    if (hard) {
      setIsGlobalLoading(true);
      try {
        await forceRefreshDatabase();
      } catch (error) {
        console.error("❌ Global refresh failed:", error);
      } finally {
        setIsGlobalLoading(false);
      }
    }
    setGlobalRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const checkFYs = () => {
      const fys = getAvailableFYs();
      if (fys && fys.length > 0) {
        setAvailableFYs(fys);
        // Do not clear interval immediately, logic might reload
      }
    };
    checkFYs();
    const interval = setInterval(checkFYs, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <FYContext.Provider value={{ 
      selectedFY, 
      setSelectedFY, 
      reportFilter, 
      setReportFilter, 
      customRange, 
      setCustomRange, 
      availableFYs,
      selectedAccountId,
      setSelectedAccountId,
      globalRefreshTrigger,
      isGlobalLoading,
      triggerGlobalRefresh
    }}>
      {children}
    </FYContext.Provider>
  );
}

export const useFY = () => useContext(FYContext);
