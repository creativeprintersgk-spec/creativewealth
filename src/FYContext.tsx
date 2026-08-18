import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAvailableFYs, forceRefreshDatabase } from './logic';

export const FYContext = createContext<any>(null);

export function FYProvider({ children }: { children: React.ReactNode }) {
  const [availableFYs, setAvailableFYs] = useState<any[]>([]);
  const today = new Date();
  const currentYear = today.getFullYear();
  const startYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;

  // Helper to get full FY dates
  const getFYDates = (fyStr: string) => {
    const parts = fyStr.split('-');
    if (parts.length >= 2) {
      const sy = parseInt(parts[0]);
      const ey = parseInt(parts[1]);
      return { start: `${sy}-04-01`, end: `${ey}-03-31` };
    }
    return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
  };

  const initialFY = `${startYear}-${startYear + 1}`;
  const [selectedFY, setSelectedFY] = useState(initialFY);
  const [reportFilter, setReportFilter] = useState<'current' | 'last' | 'previous' | 'custom'>('current');
  const [customRange, setCustomRange] = useState(getFYDates(initialFY));

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // Sync customRange whenever selectedFY or reportFilter changes
  useEffect(() => {
    if (reportFilter === 'current') {
      setCustomRange(getFYDates(selectedFY));
    } else if (reportFilter === 'last') {
      const parts = selectedFY.split('-');
      if (parts.length >= 2) {
        const sy = parseInt(parts[0]) - 1;
        const ey = parseInt(parts[1]) - 1;
        setCustomRange(getFYDates(`${sy}-${ey}`));
      }
    } else if (reportFilter === 'previous') {
      const parts = selectedFY.split('-');
      if (parts.length >= 2) {
        const sy = parseInt(parts[0]) - 2;
        const ey = parseInt(parts[1]) - 2;
        setCustomRange(getFYDates(`${sy}-${ey}`));
      }
    }
  }, [selectedFY, reportFilter]);

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
      }
    };
    checkFYs();
    const interval = setInterval(checkFYs, 1000);

    const handleSyncComplete = () => {
      setGlobalRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('wealthcore-sync-complete', handleSyncComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener('wealthcore-sync-complete', handleSyncComplete);
    };
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
