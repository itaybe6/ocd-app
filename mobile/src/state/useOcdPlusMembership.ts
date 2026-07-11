import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import Toast from '../components/toast/Toast';
import {
  cancelOcdPlus,
  createOcdPlusPayment,
  getOcdPlusStatus,
  OcdPlusNotConfiguredError,
  type OcdPlusStatus,
  type OcdPlusSubscription,
} from '../lib/ocdPlus';
import { useAuth } from './AuthContext';

type MembershipState = {
  status: OcdPlusStatus;
  subscription: OcdPlusSubscription | null;
  /** True when the server (or synced flag) confirms an active membership. */
  isActiveMember: boolean;
  loading: boolean;
  /** True while a purchase / cancel request is in flight. */
  busy: boolean;
  refresh: () => Promise<void>;
  startPurchase: () => Promise<void>;
  cancel: () => Promise<void>;
};

/**
 * Single source of truth for OCD+ membership in the app.
 *
 * IMPORTANT: returning from the payment browser NEVER marks the user active.
 * We only re-read the server status (which flips to `active` exclusively via the
 * verified Hyp callback).
 */
export function useOcdPlusMembership(): MembershipState {
  const { user, setUser } = useAuth();
  const [status, setStatus] = useState<OcdPlusStatus>(
    user?.ocd_plus_subscriber ? 'active' : 'none',
  );
  const [subscription, setSubscription] = useState<OcdPlusSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const aliveRef = useRef(true);

  const canQuery = !!(user?.id && user.role === 'customer');

  const syncSubscriberFlag = useCallback(
    async (nextStatus: OcdPlusStatus) => {
      if (!user) return;
      const shouldBeSubscriber = nextStatus === 'active';
      if (!!user.ocd_plus_subscriber === shouldBeSubscriber) return;
      await setUser({ ...user, ocd_plus_subscriber: shouldBeSubscriber });
    },
    [setUser, user],
  );

  const refresh = useCallback(async () => {
    if (!canQuery || !user?.id) return;
    setLoading(true);
    try {
      const res = await getOcdPlusStatus();
      if (!aliveRef.current) return;
      setStatus(res.status);
      setSubscription(res.subscription);
      await syncSubscriberFlag(res.status);
    } catch {
      if (!aliveRef.current) return;
      // Server unreachable or session missing — fall back to the user flag we
      // already have locally (refreshed on cold start via restoreSession).
      if (user?.ocd_plus_subscriber) {
        setStatus('active');
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [canQuery, syncSubscriberFlag, user?.id, user?.ocd_plus_subscriber]);

  // Keep status in sync when the auth user row updates (e.g. after bootstrap).
  useEffect(() => {
    if (user?.ocd_plus_subscriber) {
      setStatus((prev) => (prev === 'none' ? 'active' : prev));
    }
  }, [user?.ocd_plus_subscriber]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => {
      aliveRef.current = false;
    };
  }, [refresh]);

  // When the user comes back to the app (e.g. after paying in the browser),
  // re-check the server status.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const startPurchase = useCallback(async () => {
    if (!user?.id || user.role !== 'customer') {
      Toast.show({ type: 'info', text1: 'צריך להתחבר כדי להצטרף ל-OCD+' });
      return;
    }
    setBusy(true);
    try {
      const { paymentUrl } = await createOcdPlusPayment();
      const supported = await Linking.canOpenURL(paymentUrl);
      if (!supported) {
        Toast.show({ type: 'error', text1: 'לא ניתן לפתוח את עמוד התשלום' });
        return;
      }
      await Linking.openURL(paymentUrl);
      // Do not assume success — refresh from server shortly after.
      setStatus('pending');
      setTimeout(() => void refresh(), 4000);
    } catch (e) {
      if (e instanceof OcdPlusNotConfiguredError) {
        Toast.show({
          type: 'info',
          text1: 'בקרוב',
          text2: 'מערכת התשלום עדיין לא מחוברת. אפשר ליצור קשר עם השירות להשלמת ההצטרפות.',
        });
      } else {
        Toast.show({ type: 'error', text1: 'שגיאה בפתיחת התשלום', text2: (e as Error)?.message });
      }
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [refresh, user?.id, user?.phone, user?.role]);

  const cancel = useCallback(async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      const res = await cancelOcdPlus();
      await refresh();
      if (res.cancel_at_period_end && res.status === 'active') {
        Toast.show({ type: 'success', text1: 'המנוי יבוטל בסוף התקופה' });
      } else {
        Toast.show({ type: 'success', text1: 'המנוי בוטל' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'ביטול המנוי נכשל', text2: (e as Error)?.message });
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [refresh, user?.id, user?.phone]);

  return {
    status,
    subscription,
    isActiveMember: canQuery && status === 'active',
    loading,
    busy,
    refresh,
    startPurchase,
    cancel,
  };
}
