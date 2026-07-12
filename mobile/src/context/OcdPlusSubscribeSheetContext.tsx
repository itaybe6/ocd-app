import React, { createContext, Suspense, useCallback, useContext, useMemo, useState } from 'react';
import { useOcdPlusMembership } from '../state/useOcdPlusMembership';

/** Dynamic import avoids circular init where navigation imports StoreHomeScreen → context → sheet before export settles */
const OcdPlusSubscribeSheetLazy = React.lazy(async () => {
  const mod = await import('../components/OcdPlusSubscribeSheet');
  return { default: mod.OcdPlusSubscribeSheet };
});

type OcdPlusSubscribeSheetContextValue = {
  openOcdPlusSubscribeSheet: () => void;
};

const OcdPlusSubscribeSheetContext = createContext<OcdPlusSubscribeSheetContextValue | null>(null);

let openOcdPlusSubscribeSheetHandler: (() => void) | null = null;

/** Opens the OCD+ sheet from navigation handlers outside React tree hooks. */
export function triggerOcdPlusSubscribeSheet() {
  openOcdPlusSubscribeSheetHandler?.();
}

export function OcdPlusSubscribeSheetProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { isActiveMember } = useOcdPlusMembership();

  const openOcdPlusSubscribeSheet = useCallback(() => {
    setVisible(true);
  }, []);

  const closeOcdPlusSubscribeSheet = useCallback(() => {
    setVisible(false);
  }, []);

  React.useEffect(() => {
    openOcdPlusSubscribeSheetHandler = openOcdPlusSubscribeSheet;
    return () => {
      if (openOcdPlusSubscribeSheetHandler === openOcdPlusSubscribeSheet) {
        openOcdPlusSubscribeSheetHandler = null;
      }
    };
  }, [openOcdPlusSubscribeSheet]);

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
          isSubscriber={isActiveMember}
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
