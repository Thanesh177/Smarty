import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { APP_THEME_KEY, applyAppTheme, normalizeAppTheme, readAppTheme, saveAppTheme } from '../lib/appTheme';

const AppearanceContext = createContext({ theme: 'dark', setTheme: () => {} });

export function AppearanceProvider({ children }) {
  const [theme, setThemeState] = useState(readAppTheme);
  useLayoutEffect(() => { applyAppTheme(theme); }, [theme]);
  const setTheme = useCallback(value => {
    const next = saveAppTheme(value);
    applyAppTheme(next);
    setThemeState(next);
  }, []);
  useEffect(() => {
    const sync = event => {
      if (event.key === APP_THEME_KEY || event.key === null) setThemeState(normalizeAppTheme(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => useContext(AppearanceContext);
