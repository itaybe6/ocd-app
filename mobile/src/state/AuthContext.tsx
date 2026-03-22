import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import type { UserRole, UserRow } from '../types/database';

export type AuthUser = Omit<UserRow, 'password'>;

type AuthContextValue = {
  user: AuthUser | null;
  isBootstrapping: boolean;
  signInWithPassword: (args: { phone: string; password: string }) => Promise<void>;
  signUpCustomer: (args: { phone: string; password: string; name: string; address?: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
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

function normalizePhone(phone: string) {
  return phone.trim();
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
  }, [setUser]);

  const hasRole = useCallback((role: UserRole) => user?.role === role, [user?.role]);

  const signInWithPassword = useCallback(
    async ({ phone, password }: { phone: string; password: string }) => {
      const normalizedPhone = normalizePhone(phone);
      const normalizedPassword = password;

      const { data, error } = await supabase
        .from('users')
        .select('id, phone, password, role, name, address, price, avatar_url, created_at')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        Toast.show({ type: 'error', text1: 'המשתמש לא נמצא' });
        return;
      }
      if ((data as UserRow).password !== normalizedPassword) {
        Toast.show({ type: 'error', text1: 'סיסמה שגויה' });
        return;
      }

      const { password: _pw, ...safeUser } = data as UserRow;
      await setUser(safeUser as AuthUser);
      Toast.show({ type: 'success', text1: 'התחברת בהצלחה' });
    },
    [setUser]
  );

  const signUpCustomer = useCallback(
    async ({ phone, password, name, address }: { phone: string; password: string; name: string; address?: string | null }) => {
      const normalizedPhone = normalizePhone(phone);
      const normalizedPassword = password;
      const normalizedName = name.trim();
      const normalizedAddress = address?.trim() || null;

      if (!normalizedName || !normalizedPhone || !normalizedPassword) {
        Toast.show({ type: 'error', text1: 'נא למלא שם, טלפון וסיסמה' });
        return;
      }

      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existingUserError) throw existingUserError;
      if (existingUser) {
        Toast.show({ type: 'error', text1: 'כבר קיים חשבון עם הטלפון הזה' });
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .insert({
          phone: normalizedPhone,
          password: normalizedPassword,
          role: 'customer',
          name: normalizedName,
          address: normalizedAddress,
          price: null,
          avatar_url: null,
        })
        .select('id, phone, role, name, address, price, avatar_url, created_at')
        .single();

      if (error) throw error;

      await setUser(data as AuthUser);
      Toast.show({ type: 'success', text1: 'נרשמת בהצלחה' });
    },
    [setUser]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, isBootstrapping, signInWithPassword, signUpCustomer, signOut, setUser, hasRole }),
    [user, isBootstrapping, signInWithPassword, signUpCustomer, signOut, setUser, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

