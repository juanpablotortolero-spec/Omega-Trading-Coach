import { createContext, useContext, useState, type ReactNode } from 'react';

type RefreshContextValue = {
  version: number;
  bump: () => void;
};

const RefreshContext = createContext<RefreshContextValue | undefined>(undefined);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((current) => current + 1);

  return <RefreshContext.Provider value={{ version, bump }}>{children}</RefreshContext.Provider>;
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
}
