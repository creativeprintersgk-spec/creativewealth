import React from 'react';
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
