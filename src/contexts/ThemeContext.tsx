import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'terminal';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    localStorage.setItem('wealthcore_theme', 'light');
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove('terminal-theme');
    body.classList.remove('terminal-theme');
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'terminal' ? 'light' : 'terminal'));
  };

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
