import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Toast from '../components/toast/Toast';
import {
  deleteCustomerAccount as deleteCustomerAccountApi,
  revokeSession as revokeSessionApi,
  sendLoginOtp as sendLoginOtpApi,
  sendRegisterOtp as sendRegisterOtpApi,
  verifyLoginOtp as verifyLoginOtpApi,
  verifyRegisterOtp as verifyRegisterOtpApi,
} from '../lib/authOtp';
import { clearSession, getRefreshToken, restoreSession, storeSession } from '../lib/appSession';
import { updateCustomerName, isValidProfileName, normalizeProfileName } from '../lib/customerProfile';
import { navigationRef } from '../navigation/navigationRef';
import type { UserRole, UserRow } from '../types/database';
import { isLocalDemoPhone, isLocalDemoUser, LOCAL_DEMO_USER_ID, LOCAL_DEMO_PHONE, verifyLocalDemoAccount } from '../lib/localDemoAccount';

export type AuthUser = Omit<UserRow, 'password'>;

type AuthContextValue = {
  user: AuthUser | null;
  isBootstrapping: boolean;
  /** Sends an SMS OTP to an existing user's phone number for login. Returns the normalized phone (E.164 without '+'). */
  sendLoginOtp: (args: { phone: string }) => Promise<{ phone: string }>;
  /** Verifies the login OTP. On success, persists the user and navigates to Main. */
  verifyLoginOtp: (args: { phone: string; code: string }) => Promise<void>;
  /** Sends an SMS OTP to a phone number for new-account registration. */
  sendRegisterOtp: (args: { phone: string }) => Promise<{ phone: string }>;
  /** Verifies the register OTP and creates the customer account. On success, persists the user and navigates to the customer profile. */
  verifyRegisterOtp: (args: {
    phone: string;
    code: string;
    name: string;
    address?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    city?: string | null;
    email?: string | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteCustomerAccount: () => Promise<void>;
  setUser: (u: AuthUser | null) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  hasRole: (role: UserRole) => boolean;
};

const STORAGE_KEY = 'user';
const AuthContext = createContext<AuthContextValue | null>(null);

async function persistUser(u: AuthUser | null) {
  if (!u) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
}

async function loadPersistedUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function scheduleResetMain(params?: object) {
  const run = () => {
    if (!navigationRef.isReady()) return false;
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Main', params: params ?? {} }],
    });
    return true;
  };
  if (run()) return;
  setTimeout(() => {
    run();
  }, 60);
}

function scheduleResetMainToCustomerProfile() {
  scheduleResetMain({ initialCustomerProfile: true });
}

function scheduleResetToLogin() {
  const run = () => {
    if (!navigationRef.isReady()) return false;
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
    return true;
  };
  if (run()) return;
  setTimeout(() => {
    run();
  }, 60);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const currentUser = useRef<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await loadPersistedUser();
      if (!alive) return;

      if (u?.id === LOCAL_DEMO_USER_ID && !isLocalDemoUser(u.id)) {
        await clearSession();
        await persistUser(null);
        if (alive) setIsBootstrapping(false);
        return;
      }

      if (u) {
        // Refresh the server session on cold start so access tokens work and the
        // cached user row (incl. ocd_plus_subscriber) is brought up to date.
        const restored = isLocalDemoUser(u.id) ? null : await restoreSession();
        if (!alive) return;
        if (restored?.user) {
          const fresh = restored.user as AuthUser;
          currentUser.current = fresh;
          setUserState(fresh);
          await persistUser(fresh);
        } else {
          currentUser.current = u;
          setUserState(u);
        }
      }

      setIsBootstrapping(false);
    })().catch(() => {
      if (!alive) return;
      setIsBootstrapping(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setUser = useCallback(async (u: AuthUser | null) => {
    currentUser.current = u;
    setUserState(u);
    await persistUser(u);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const userId = currentUser.current?.id;
    if (!userId) throw new Error('צריך להתחבר מחדש כדי לעדכן פרטים');
    if (isLocalDemoUser(userId) && currentUser.current) {
      if (!isValidProfileName(name)) throw new Error('יש להזין שם באורך 2 עד 80 תווים');
      await setUser({ ...currentUser.current, name: normalizeProfileName(name) });
      return;
    }
    const profile = await updateCustomerName(name);
    const latest = currentUser.current;
    // Do not restore a signed-out account or overwrite another user's session
    // if identity changed while the network request was in flight.
    if (!latest || latest.id !== userId || profile.id !== userId) {
      throw new Error('החשבון המחובר השתנה. יש לפתוח מחדש את הפרטים האישיים.');
    }
    await setUser({ ...latest, name: profile.name });
  }, [setUser]);

  const signOut = useCallback(async () => {
    try {
      const refresh = await getRefreshToken();
      if (refresh) await revokeSessionApi(refresh);
    } catch {
      // ignore — we clear local tokens regardless
    }
    await clearSession();
    await setUser(null);
    scheduleResetToLogin();
  }, [setUser]);

  const deleteCustomerAccount = useCallback(async () => {
    if (!user?.id || !user.phone) {
      throw new Error('לא נמצא משתמש מחובר');
    }
    if (!isLocalDemoUser(user.id)) await deleteCustomerAccountApi({ userId: user.id, phone: user.phone });
    await clearSession();
    await setUser(null);
    Toast.show({ type: 'success', text1: 'החשבון נמחק' });
    scheduleResetToLogin();
  }, [setUser, user?.id, user?.phone]);

  const hasRole = useCallback((role: UserRole) => user?.role === role, [user?.role]);

  const sendLoginOtp = useCallback(async ({ phone }: { phone: string }) => {
    if (isLocalDemoPhone(phone)) return { phone: LOCAL_DEMO_PHONE };
    const res = await sendLoginOtpApi(phone.trim());
    return { phone: res.phone };
  }, []);

  const verifyLoginOtp = useCallback(
    async ({ phone, code }: { phone: string; code: string }) => {
      if (isLocalDemoPhone(phone)) {
        const demoUser = verifyLocalDemoAccount(phone, code);
        await clearSession();
        await setUser(demoUser);
        Toast.show({ type: 'success', text1: 'התחברת לחשבון הדמו של אדיר' });
        scheduleResetMain();
        return;
      }
      const { user: authedUser, session, refresh } = await verifyLoginOtpApi({
        phone: phone.trim(),
        code: code.trim(),
      });
      await storeSession(session, refresh);
      await setUser(authedUser as AuthUser);
      Toast.show({ type: 'success', text1: 'התחברת בהצלחה' });
      scheduleResetMain();
    },
    [setUser]
  );

  const sendRegisterOtp = useCallback(async ({ phone }: { phone: string }) => {
    const res = await sendRegisterOtpApi(phone.trim());
    return { phone: res.phone };
  }, []);

  const verifyRegisterOtp = useCallback(
    async ({
      phone,
      code,
      name,
      address,
      gender,
      dateOfBirth,
      city,
      email,
    }: {
      phone: string;
      code: string;
      name: string;
      address?: string | null;
      gender?: string | null;
      dateOfBirth?: string | null;
      city?: string | null;
      email?: string | null;
    }) => {
      const { user: authedUser, session, refresh } = await verifyRegisterOtpApi({
        phone: phone.trim(),
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || null,
        gender: gender ?? null,
        dateOfBirth: dateOfBirth ?? null,
        city: city?.trim() || null,
        email: email?.trim() || null,
      });
      await storeSession(session, refresh);
      await setUser(authedUser as AuthUser);
      Toast.show({ type: 'success', text1: 'נרשמת בהצלחה' });
      scheduleResetMainToCustomerProfile();
    },
    [setUser]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      sendLoginOtp,
      verifyLoginOtp,
      sendRegisterOtp,
      verifyRegisterOtp,
      signOut,
      deleteCustomerAccount,
      setUser,
      updateName,
      hasRole,
    }),
    [
      user,
      isBootstrapping,
      sendLoginOtp,
      verifyLoginOtp,
      sendRegisterOtp,
      verifyRegisterOtp,
      signOut,
      deleteCustomerAccount,
      setUser,
      updateName,
      hasRole,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
