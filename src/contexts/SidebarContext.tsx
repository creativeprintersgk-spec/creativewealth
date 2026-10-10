import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleSidebar: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const setIsCollapsed = (val: boolean) => {
    setIsCollapsedState(val);
    localStorage.setItem('sidebar_collapsed', String(val));
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
