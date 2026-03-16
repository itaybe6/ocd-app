import React, { createContext, useContext, useMemo, useState } from 'react';

type LoadingContextValue = {
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const value = useMemo(() => ({ isLoading, setIsLoading }), [isLoading]);
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

