import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from '../components/toast/Toast';
import {
  deleteCustomerAccount as deleteCustomerAccountApi,
  sendLoginOtp as sendLoginOtpApi,
  sendRegisterOtp as sendRegisterOtpApi,
  verifyLoginOtp as verifyLoginOtpApi,
  verifyRegisterOtp as verifyRegisterOtpApi,
} from '../lib/authOtp';
import { navigationRef } from '../navigation/navigationRef';
import type { UserRole, UserRow } from '../types/database';

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
  verifyRegisterOtp: (args: { phone: string; code: string; name: string; address?: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteCustomerAccount: () => Promise<void>;
  setUser: (u: AuthUser | null) => Promise<void>;
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
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await loadPersistedUser();
      if (!alive) return;
      setUserState(u);
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
    setUserState(u);
    await persistUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await setUser(null);
    scheduleResetToLogin();
  }, [setUser]);

  const deleteCustomerAccount = useCallback(async () => {
    if (!user?.id || !user.phone) {
      throw new Error('לא נמצא משתמש מחובר');
    }
    await deleteCustomerAccountApi({ userId: user.id, phone: user.phone });
    await setUser(null);
    Toast.show({ type: 'success', text1: 'החשבון נמחק' });
    scheduleResetToLogin();
  }, [setUser, user?.id, user?.phone]);

  const hasRole = useCallback((role: UserRole) => user?.role === role, [user?.role]);

  const sendLoginOtp = useCallback(async ({ phone }: { phone: string }) => {
    const res = await sendLoginOtpApi(phone.trim());
    return { phone: res.phone };
  }, []);

  const verifyLoginOtp = useCallback(
    async ({ phone, code }: { phone: string; code: string }) => {
      const { user: authedUser } = await verifyLoginOtpApi({ phone: phone.trim(), code: code.trim() });
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
    async ({ phone, code, name, address }: { phone: string; code: string; name: string; address?: string | null }) => {
      const { user: authedUser } = await verifyRegisterOtpApi({
        phone: phone.trim(),
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || null,
      });
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
