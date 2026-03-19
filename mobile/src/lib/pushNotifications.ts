import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import { supabase } from './supabase';

export type PushIdentity = { userId?: string | null; role?: string | null };

const ANDROID_CHANNEL_ID = 'marketing' as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'עדכונים ומבצעים',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
  });
}

export async function registerForPushNotifications(identity?: PushIdentity) {
  try {
    await ensureAndroidChannel();

    const permissions = await Notifications.getPermissionsAsync();
    const granted =
      permissions.granted ||
      permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      permissions.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;

    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      const nowGranted =
        req.granted ||
        req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        req.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
      if (!nowGranted) {
        return { status: 'denied' as const };
      }
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await upsertExpoPushToken(token, identity);
    return { status: 'ok' as const, token };
  } catch (e: any) {
    Toast.show({ type: 'error', text1: 'Push registration failed', text2: e?.message ?? 'Unknown error' });
    return { status: 'error' as const, error: e };
  }
}

async function upsertExpoPushToken(expoPushToken: string, identity?: PushIdentity) {
  const normalized = expoPushToken.trim();
  if (!normalized) return;

  const platform = Platform.OS;
  const payload = {
    expo_push_token: normalized,
    platform,
    user_id: identity?.userId ?? null,
    role: identity?.role ?? null,
    last_seen_at: new Date().toISOString(),
  };

  // Table is created in Supabase (see migration). If it doesn't exist yet, fail silently.
  const { error } = await supabase.from('push_tokens').upsert(payload as any, { onConflict: 'expo_push_token' } as any);
  if (error) {
    // Most common during initial setup before the table exists.
    if (String(error?.message ?? '').toLowerCase().includes('relation') || String(error?.message ?? '').toLowerCase().includes('push_tokens')) {
      return;
    }
    throw error;
  }
}

export function getAndroidChannelId() {
  return ANDROID_CHANNEL_ID;
}

