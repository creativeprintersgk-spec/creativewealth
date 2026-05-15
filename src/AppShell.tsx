import React from 'react';
import LivePriceSidebar from './components/LivePriceSidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingRight: 240 }}>
      {children}
      <LivePriceSidebar />
    </div>
  );
}
