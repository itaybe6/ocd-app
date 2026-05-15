import React, { createContext, Suspense, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '../state/AuthContext';

/** Dynamic import avoids circular init where navigation imports StoreHomeScreen → context → sheet before export settles */
const OcdPlusSubscribeSheetLazy = React.lazy(async () => {
  const mod = await import('../components/OcdPlusSubscribeSheet');
  return { default: mod.OcdPlusSubscribeSheet };
});

type OcdPlusSubscribeSheetContextValue = {
  openOcdPlusSubscribeSheet: () => void;
};

const OcdPlusSubscribeSheetContext = createContext<OcdPlusSubscribeSheetContextValue | null>(null);

export function OcdPlusSubscribeSheetProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();
  const isSubscriber = user?.role === 'customer' && !!user.ocd_plus_subscriber;

  const openOcdPlusSubscribeSheet = useCallback(() => {
    setVisible(true);
  }, []);

  const closeOcdPlusSubscribeSheet = useCallback(() => {
    setVisible(false);
  }, []);

  const value = useMemo(
    () => ({ openOcdPlusSubscribeSheet }),
    [openOcdPlusSubscribeSheet],
  );

  return (
    <OcdPlusSubscribeSheetContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <OcdPlusSubscribeSheetLazy
          visible={visible}
          onClose={closeOcdPlusSubscribeSheet}
          isSubscriber={isSubscriber}
        />
      </Suspense>
    </OcdPlusSubscribeSheetContext.Provider>
  );
}

export function useOcdPlusSubscribeSheet(): OcdPlusSubscribeSheetContextValue {
  const ctx = useContext(OcdPlusSubscribeSheetContext);
  if (!ctx) {
    throw new Error('useOcdPlusSubscribeSheet must be used within OcdPlusSubscribeSheetProvider');
  }
  return ctx;
}
