import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { AnchoredWindow, type WindowAnchor } from '../../components/AnchoredWindow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { Avatar } from '../../components/ui/Avatar';
import { supabase, USER_AVATARS_BUCKET } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import type { UserRole } from '../../types/database';

const base64Lookup = (() => {
  const t = new Int16Array(256);
  t.fill(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) t[alphabet.charCodeAt(i)] = i;
  t['-'.charCodeAt(0)] = 62; // URL-safe
  t['_'.charCodeAt(0)] = 63; // URL-safe
  return t;
})();

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = (b64 || '').replace(/[\r\n\s]+/g, '');
  if (!clean) return new Uint8Array(0);
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outLen = Math.floor((clean.length * 3) / 4) - pad;
  const out = new Uint8Array(outLen);

  let outIdx = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = base64Lookup[clean.charCodeAt(i)] ?? -1;
    const c2 = base64Lookup[clean.charCodeAt(i + 1)] ?? -1;
    const c3ch = clean.charAt(i + 2);
    const c4ch = clean.charAt(i + 3);
    const c3 = c3ch === '=' ? 0 : base64Lookup[clean.charCodeAt(i + 2)] ?? -1;
    const c4 = c4ch === '=' ? 0 : base64Lookup[clean.charCodeAt(i + 3)] ?? -1;
    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) continue;

    const triple = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    if (outIdx < outLen) out[outIdx++] = (triple >> 16) & 0xff;
    if (outIdx < outLen && c3ch !== '=') out[outIdx++] = (triple >> 8) & 0xff;
    if (outIdx < outLen && c4ch !== '=') out[outIdx++] = triple & 0xff;
  }

  return out;
}

type UserRow = {
  id: string;
  phone: string;
  password?: string | null;
  role: UserRole;
  name: string;
  address?: string | null;
  price?: number | null;
  avatar_url?: string | null;
  created_at?: string;
};

type ServicePoint = {
  id: string;
  customer_id: string;
  device_type: string;
  scent_type: string;
  refill_amount: number;
  notes?: string | null;
  created_at?: string;
};

type DeviceRow = { id: string; name: string; refill_amount?: number | null };
type ScentRow = { id: string; name: string };

const roleOptions = [
  { value: 'admin', label: 'admin' },
  { value: 'worker', label: 'worker' },
  { value: 'customer', label: 'customer' },
] as const;

const EDIT_WINDOW_DURATION_MS = 320;

function emptyUser(): Partial<UserRow> {
  return { role: 'customer', name: '', phone: '', password: '' };
}

export function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mutating, setMutating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<UserRow>>(emptyUser());
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [editAnchor, setEditAnchor] = useState<WindowAnchor | null>(null);
  const isEditExisting = !!editing.id;
  const clearEditAnchorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsUser, setPointsUser] = useState<UserRow | null>(null);
  const [points, setPoints] = useState<ServicePoint[]>([]);
  const [pointsAnchor, setPointsAnchor] = useState<WindowAnchor | null>(null);
  const [addPointOpen, setAddPointOpen] = useState(false);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editDeviceType, setEditDeviceType] = useState('');
  const [editScentType, setEditScentType] = useState('');

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [scents, setScents] = useState<ScentRow[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  }, [users, query]);

  const stats = useMemo(() => {
    const admin = users.filter((u) => u.role === 'admin').length;
    const worker = users.filter((u) => u.role === 'worker').length;
    const customer = users.filter((u) => u.role === 'customer').length;
    return { admin, worker, customer, total: users.length };
  }, [users]);

  const fetchLookups = useCallback(async () => {
    const [dRes, sRes] = await Promise.all([
      supabase.from('devices').select('id, name, refill_amount').order('name', { ascending: true }),
      supabase.from('scents').select('id, name').order('name', { ascending: true }),
    ]);
    if (!dRes.error) setDevices((dRes.data ?? []) as DeviceRow[]);
    if (!sRes.error) setScents((sRes.data ?? []) as ScentRow[]);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, phone, password, role, name, address, price, avatar_url, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data ?? []) as UserRow[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת משתמשים נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
      fetchLookups();
    }, [fetchUsers, fetchLookups])
  );

  useEffect(() => {
    return () => {
      if (clearEditAnchorTimer.current) clearTimeout(clearEditAnchorTimer.current);
      clearEditAnchorTimer.current = null;
    };
  }, []);

  const openCreate = (anchor?: WindowAnchor | null) => {
    if (clearEditAnchorTimer.current) clearTimeout(clearEditAnchorTimer.current);
    setEditing(emptyUser());
    setAvatarLocalUri(null);
    setAvatarBase64(null);
    setEditAnchor(anchor ?? null);
    setEditOpen(true);
  };

  const openEdit = (u: UserRow, anchor?: WindowAnchor | null) => {
    if (clearEditAnchorTimer.current) clearTimeout(clearEditAnchorTimer.current);
    setEditing({ ...u, password: u.password ?? '' });
    setAvatarLocalUri(null);
    setAvatarBase64(null);
    setEditAnchor(anchor ?? null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setAvatarLocalUri(null);
    setAvatarBase64(null);
    if (clearEditAnchorTimer.current) clearTimeout(clearEditAnchorTimer.current);
    // Keep anchor during the closing animation so it "returns" to the opening button.
    clearEditAnchorTimer.current = setTimeout(() => setEditAnchor(null), EDIT_WINDOW_DURATION_MS + 40);
  };

  const pickAvatar = async () => {
    try {
      setAvatarBusy(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'אין הרשאה לגלריה' });
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;

      const pickedUri = res.assets[0].uri;
      const out = await ImageManipulator.manipulateAsync(
        pickedUri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setAvatarLocalUri(out.uri);
      setAvatarBase64(out.base64 ?? null);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'בחירת תמונה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const clearAvatar = () => {
    setAvatarLocalUri(null);
    setAvatarBase64(null);
    setEditing((p) => ({ ...p, avatar_url: null }));
  };

  const uploadUserAvatar = async (userId: string, b64: string): Promise<string> => {
    const bytes = decodeBase64ToBytes(b64);
    if (!bytes.length) throw new Error('Avatar file is empty');
    const path = `avatars/${userId}.jpg`;
    const { error } = await supabase.storage.from(USER_AVATARS_BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
    if (error) throw error;
    const { data } = supabase.storage.from(USER_AVATARS_BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const saveUser = async () => {
    const payload = {
      phone: (editing.phone ?? '').trim(),
      password: (editing.password ?? '') || null,
      role: (editing.role ?? 'customer') as UserRole,
      name: (editing.name ?? '').trim(),
      address: (editing.address ?? null) || null,
      price: (editing.role ?? 'customer') === 'customer' ? (editing.price ?? null) : null,
    };
    if (!payload.phone || !payload.name) {
      Toast.show({ type: 'error', text1: 'חסר שם/טלפון' });
      return;
    }

    try {
      const wantsAvatar = payload.role === 'admin' || payload.role === 'worker';
      if (isEditExisting) {
        let avatarUrl: string | null = wantsAvatar ? (editing.avatar_url ?? null) : null;
        if (avatarBase64 && wantsAvatar) {
          avatarUrl = await uploadUserAvatar(editing.id!, avatarBase64);
        }
        const { error } = await supabase.from('users').update({ ...payload, avatar_url: avatarUrl }).eq('id', editing.id!);
        if (error) throw error;
        if (wantsAvatar && !avatarUrl) {
          await supabase.storage.from(USER_AVATARS_BUCKET).remove([`avatars/${editing.id!}.jpg`]);
        }
        Toast.show({ type: 'success', text1: 'עודכן' });
      } else {
        const { data, error } = await supabase.from('users').insert({ ...payload, avatar_url: null }).select('id').single();
        if (error) throw error;
        const newId = (data as any)?.id as string;
        if (newId && avatarBase64 && wantsAvatar) {
          const avatarUrl = await uploadUserAvatar(newId, avatarBase64);
          const { error: uErr } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', newId);
          if (uErr) throw uErr;
        }
        Toast.show({ type: 'success', text1: 'נוצר' });
      }
      setEditOpen(false);
      setAvatarLocalUri(null);
      setAvatarBase64(null);
      await fetchUsers();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שמירה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const fetchServicePoints = async (customer: UserRow) => {
    try {
      setPointsUser(customer);
      setPointsOpen(true);
      setAddPointOpen(false);
      setEditingPointId(null);
      const { data, error } = await supabase
        .from('service_points')
        .select('id, customer_id, device_type, scent_type, refill_amount, notes, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as ServicePoint[];
      setPoints(list);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת נקודות שירות נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const startEditPoint = (p: ServicePoint) => {
    setAddPointOpen(false);
    setEditingPointId(p.id);
    setEditDeviceType(p.device_type);
    setEditScentType(p.scent_type);
  };

  const cancelEditPoint = () => {
    setEditingPointId(null);
    setEditDeviceType('');
    setEditScentType('');
  };

  const saveEditPoint = async (p: ServicePoint) => {
    await upsertPoint({
      id: p.id,
      device_type: editDeviceType,
      scent_type: editScentType,
      refill_amount: p.refill_amount,
      notes: p.notes ?? null,
    });
    cancelEditPoint();
  };

  const upsertPoint = async (p: Partial<ServicePoint>) => {
    if (!pointsUser) return;
    const payload = {
      customer_id: pointsUser.id,
      device_type: (p.device_type ?? '').trim(),
      scent_type: (p.scent_type ?? '').trim(),
      refill_amount: Number(p.refill_amount ?? 0),
      notes: (p.notes ?? null) || null,
    };
    if (!payload.device_type || !payload.scent_type || !payload.refill_amount) {
      Toast.show({ type: 'error', text1: 'חסר device/scent/refill' });
      return;
    }

    try {
      if (p.id) {
        const { error } = await supabase.from('service_points').update(payload).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('service_points').insert(payload);
        if (error) throw error;
      }
      await fetchServicePoints(pointsUser);
      Toast.show({ type: 'success', text1: 'נשמר' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שמירה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const deletePoint = async (id: string) => {
    try {
      const { error } = await supabase.from('service_points').delete().eq('id', id);
      if (error) throw error;
      setPoints((prev) => prev.filter((p) => p.id !== id));
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const cascadeDelete = async (u: UserRow) => {
    try {
      setMutating(true);

      const tryOp = async (op: PromiseLike<{ error: any }>) => {
        const res = await op;
        if (res?.error) {
          const msg = String(res.error?.message ?? res.error);
          const code = String(res.error?.code ?? '');
          const ignorable =
            code === '42P01' || // undefined_table
            code === '42703' || // undefined_column
            msg.includes('does not exist') ||
            msg.includes('column') && msg.includes('does not exist') ||
            msg.includes('relation') && msg.includes('does not exist');
          if (!ignorable) throw res.error;
        }
      };

      if (u.role === 'customer') {
        // jobs -> job_service_points
        const jobsRes = await supabase.from('jobs').select('id').eq('customer_id', u.id);
        if (jobsRes.error) throw jobsRes.error;
        const jobIds = (jobsRes.data ?? []).map((r: any) => r.id);
        if (jobIds.length) {
          const jspDel = await supabase.from('job_service_points').delete().in('job_id', jobIds);
          if (jspDel.error) throw jspDel.error;
          const jDel = await supabase.from('jobs').delete().in('id', jobIds);
          if (jDel.error) throw jDel.error;
        }

        await tryOp(supabase.from('service_points').delete().eq('customer_id', u.id));

        await tryOp(supabase.from('installation_jobs').delete().eq('customer_id', u.id));
        // Special jobs are not necessarily tied to a customer in the original spec.
        await tryOp(supabase.from('template_stations').delete().eq('customer_id', u.id));
      }

      if (u.role === 'worker') {
        await tryOp(supabase.from('jobs').delete().eq('worker_id', u.id));
        await tryOp(supabase.from('installation_jobs').delete().eq('worker_id', u.id));
        await tryOp(supabase.from('special_jobs').delete().eq('worker_id', u.id));
        await tryOp(supabase.from('template_stations').delete().eq('worker_id', u.id));
      }

      const { error } = await supabase.from('users').delete().eq('id', u.id);
      if (error) throw error;

      Toast.show({ type: 'success', text1: 'משתמש נמחק' });
      await fetchUsers();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setMutating(false);
    }
  };

  const busy = refreshing || mutating || avatarBusy;

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchUsers} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={[styles.hero, styles.shadowMd]}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroActionsRow}>
                  <Pressable
                    onPress={(e) => openCreate({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="הוסף משתמש"
                    style={({ pressed }) => [styles.fabBtn, pressed && { opacity: 0.9 }]}
                  >
                    <Plus size={17} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={fetchUsers}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="רענון"
                    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }, refreshing && { opacity: 0.5 }]}
                    disabled={refreshing}
                  >
                    <RefreshCw size={17} color={IOS.muted} />
                  </Pressable>
                </View>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.heroTitle}>ניהול משתמשים</Text>
                  <Text style={styles.heroSubtitle}>{filtered.length} תוצאות · סה״כ {stats.total}</Text>
                </View>
              </View>

              <View style={styles.searchWrap}>
                <Search size={18} color="rgba(60,60,67,0.62)" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="חיפוש לפי שם, טלפון או תפקיד"
                  placeholderTextColor="rgba(60,60,67,0.55)"
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {!!query.trim() && (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={10}
                    style={styles.clearBtn}
                    accessibilityRole="button"
                    accessibilityLabel="נקה חיפוש"
                  >
                    <X size={14} color="#fff" />
                  </Pressable>
                )}
              </View>

              <View style={styles.statsRow}>
                <StatPill label="מנהלים" value={stats.admin} />
                <StatPill label="עובדים" value={stats.worker} />
                <StatPill label="לקוחות" value={stats.customer} />
              </View>
            </View>

            {refreshing && !users.length ? (
              <Card style={[styles.loadingCard, styles.shadowSm]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ActivityIndicator color={colors.primary} />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>טוען משתמשים…</Text>
                    <Text style={{ color: colors.muted, textAlign: 'right', marginTop: 4 }}>זה אמור לקחת כמה שניות</Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.userCell, styles.shadowSm]}>
            <View style={styles.userRow}>
              <View style={styles.actionsCol}>
                {item.role === 'customer' ? (
                  <Pressable
                    onPressIn={(e) => setPointsAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
                    onPress={() => fetchServicePoints(item)}
                    hitSlop={8}
                    style={styles.actionIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="נקודות שירות"
                  >
                    <Eye size={18} color="#8E8E93" />
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => cascadeDelete(item)}
                  hitSlop={8}
                  disabled={mutating}
                  style={[styles.actionIconBtn, mutating && { opacity: 0.4 }]}
                  accessibilityRole="button"
                  accessibilityLabel="מחיקה"
                >
                  <Trash2 size={18} color="#FF3B30" />
                </Pressable>

                <Pressable
                  onPress={(e) => openEdit(item, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
                  hitSlop={8}
                  style={styles.actionIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="עריכה"
                >
                  <Pencil size={18} color="#007AFF" />
                </Pressable>
              </View>

              <View style={styles.userMain}>
                <Avatar size={42} uri={item.avatar_url ?? null} name={item.name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !refreshing ? (
            <Card style={[styles.emptyCard, styles.shadowSm]}>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>לא מצאנו משתמשים</Text>
              <Text style={{ color: colors.muted, textAlign: 'right', marginTop: 6 }}>
                נסה לשנות פילטר/חיפוש או לרענן את הרשימה.
              </Text>
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                <Button title="רענון" fullWidth={false} style={{ flex: 1 }} onPress={fetchUsers} disabled={refreshing} />
                <Button
                  title="משתמש חדש"
                  variant="secondary"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => openCreate(null)}
                  disabled={busy}
                />
              </View>
            </Card>
          ) : null
        }
      />

      <AnchoredWindow visible={editOpen} anchor={editAnchor} onClose={closeEdit} showCloseEye={false} durationMs={EDIT_WINDOW_DURATION_MS}>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              marginBottom: 10,
            }}
          >
            <Pressable
              onPress={closeEdit}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={10}
            >
              <X size={18} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              {isEditExisting ? 'עריכת משתמש' : 'משתמש חדש'}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 14 }}>
            {(editing.role ?? 'customer') !== 'customer' ? (
              <Card style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Avatar size={56} uri={avatarLocalUri ?? editing.avatar_url ?? null} name={editing.name ?? ''} />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונת משתמש</Text>
                    <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right', fontWeight: '700' }}>
                      מוצג בלוח בקרה ובמשימות
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Button
                    title={avatarBusy ? 'טוען…' : 'בחר תמונה'}
                    fullWidth={false}
                    style={{ flex: 1 }}
                    disabled={avatarBusy || loading}
                    onPress={pickAvatar}
                  />
                  <Button
                    title="הסר"
                    variant="secondary"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    disabled={avatarBusy || loading}
                    onPress={clearAvatar}
                  />
                </View>
              </Card>
            ) : null}
            <Input label="שם" value={editing.name ?? ''} onChangeText={(v) => setEditing((p) => ({ ...p, name: v }))} />
            <Input
              label="טלפון"
              value={editing.phone ?? ''}
              onChangeText={(v) => setEditing((p) => ({ ...p, phone: v }))}
              keyboardType="phone-pad"
            />
            <Input
              label="סיסמה"
              value={editing.password ?? ''}
              onChangeText={(v) => setEditing((p) => ({ ...p, password: v }))}
              secureTextEntry
            />
            <SelectSheet
              label="Role"
              value={editing.role ?? 'customer'}
              options={roleOptions as any}
              onChange={(v) => setEditing((p) => ({ ...p, role: v as any }))}
            />
            <Input
              label="כתובת"
              value={editing.address ?? ''}
              onChangeText={(v) => setEditing((p) => ({ ...p, address: v }))}
            />
            {(editing.role ?? 'customer') === 'customer' ? (
              <Input
                label="מחיר"
                value={editing.price?.toString?.() ?? ''}
                onChangeText={(v) => setEditing((p) => ({ ...p, price: v ? Number(v) : null }))}
                keyboardType="numeric"
              />
            ) : null}
            <Button title="שמור" onPress={saveUser} />
            <Button
              title="סגור"
              variant="secondary"
              onPress={closeEdit}
            />
          </ScrollView>
        </View>
      </AnchoredWindow>

      <AnchoredWindow visible={pointsOpen} anchor={pointsAnchor} onClose={() => setPointsOpen(false)} showCloseEye={false}>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Pressable
                onPress={() => setAddPointOpen((p) => !p)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                hitSlop={10}
              >
                <Plus size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setPointsOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                hitSlop={10}
              >
                <X size={18} color={colors.text} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>נקודות ריח</Text>
              <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right', fontWeight: '700' }}>
                {pointsUser?.name}
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 14, paddingTop: 12 }}>
            {addPointOpen ? (
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Pressable onPress={() => setAddPointOpen(false)} hitSlop={10}>
                    <Text style={{ color: colors.muted, fontWeight: '900' }}>ביטול</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>הוספת נקודה</Text>
                </View>
                <PointEditor
                  devices={devices}
                  scents={scents}
                  onSave={(p) => {
                    upsertPoint(p);
                    setAddPointOpen(false);
                  }}
                />
              </Card>
            ) : null}

            {points.length ? (
              <View style={{ gap: 10 }}>
                {points.map((item) => (
                  <Card key={item.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ gap: 10 }}>
                        {editingPointId === item.id ? (
                          <Pressable onPress={cancelEditPoint} style={{ paddingVertical: 6 }} hitSlop={10}>
                            <Text style={{ color: colors.muted, fontWeight: '900' }}>ביטול</Text>
                          </Pressable>
                        ) : (
                          <Pressable onPress={() => startEditPoint(item)} style={{ paddingVertical: 6 }} hitSlop={10}>
                            <Text style={{ color: colors.primary, fontWeight: '900' }}>עריכה</Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => deletePoint(item.id)} style={{ paddingVertical: 6 }} hitSlop={10}>
                          <Text style={{ color: colors.danger, fontWeight: '900' }}>מחק</Text>
                        </Pressable>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                          מכשיר: {item.device_type}
                        </Text>
                        <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                          ניחוח: {item.scent_type} • מילוי: {item.refill_amount}
                        </Text>
                        {item.notes ? (
                          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.notes}</Text>
                        ) : null}

                        {editingPointId === item.id ? (
                          <View style={{ gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <SelectSheet
                              label="מכשיר"
                              value={editDeviceType}
                              placeholder="בחר מכשיר…"
                              options={devices.map((d) => ({ value: d.name, label: d.name }))}
                              onChange={setEditDeviceType}
                            />
                            <SelectSheet
                              label="ניחוח"
                              value={editScentType}
                              placeholder="בחר ניחוח…"
                              options={scents.map((s) => ({ value: s.name, label: s.name }))}
                              onChange={setEditScentType}
                            />
                            <Button title="שמור שינויים" onPress={() => saveEditPoint(item)} />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Card>
                <Text style={{ color: colors.muted, textAlign: 'right', fontWeight: '800' }}>אין נקודות ריח עדיין.</Text>
                <Text style={{ color: colors.muted, textAlign: 'right', marginTop: 4 }}>
                  לחץ על כפתור הפלוס כדי להוסיף נקודה.
                </Text>
              </Card>
            )}
          </ScrollView>
        </View>
      </AnchoredWindow>
    </View>
  );
}

function formatIls(amount: number, missing?: boolean) {
  if (missing) return 'מחיר: —';
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    const fmt = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(safe);
    return `מחיר: ${fmt}`;
  } catch {
    return `מחיר: ₪${Math.round(safe).toLocaleString('he-IL')}`;
  }
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PointEditor({
  devices,
  scents,
  onSave,
}: {
  devices: DeviceRow[];
  scents: ScentRow[];
  onSave: (p: Partial<ServicePoint>) => void;
}) {
  const [deviceType, setDeviceType] = useState('');
  const [scentType, setScentType] = useState('');
  const [refillAmount, setRefillAmount] = useState('');
  const [notes, setNotes] = useState('');

  const deviceOptions = useMemo(
    () => devices.map((d) => ({ value: d.name, label: `${d.name}${d.refill_amount ? ` (${d.refill_amount})` : ''}` })),
    [devices]
  );
  const scentOptions = useMemo(() => scents.map((s) => ({ value: s.name, label: s.name })), [scents]);

  return (
    <View style={{ gap: 10 }}>
      <SelectSheet
        label="מכשיר"
        value={deviceType}
        placeholder="בחר מכשיר…"
        options={deviceOptions.length ? deviceOptions : [{ value: deviceType || 'Unknown', label: deviceType || 'Unknown' }]}
        onChange={(v) => {
          setDeviceType(v);
          const dev = devices.find((d) => d.name === v);
          if (dev?.refill_amount) setRefillAmount(String(dev.refill_amount));
        }}
      />
      <SelectSheet
        label="ניחוח"
        value={scentType}
        placeholder="בחר ניחוח…"
        options={scentOptions.length ? scentOptions : [{ value: scentType || 'Unknown', label: scentType || 'Unknown' }]}
        onChange={setScentType}
      />
      <Input label="כמות מילוי" value={refillAmount} onChangeText={setRefillAmount} keyboardType="numeric" />
      <Input label="הערות" value={notes} onChangeText={setNotes} />
      <Button
        title="הוסף נקודה"
        onPress={() => {
          onSave({
            device_type: deviceType,
            scent_type: scentType,
            refill_amount: Number(refillAmount),
            notes,
          });
          setDeviceType('');
          setScentType('');
          setRefillAmount('');
          setNotes('');
        }}
      />
    </View>
  );
}

// Apple HIG color constants
const IOS = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  blue: '#007AFF',
  red: '#FF3B30',
  separator: 'rgba(60,60,67,0.10)',
  segmentedBg: 'rgba(118,118,128,0.12)',
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: IOS.bg, paddingTop: 12 },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 32, paddingHorizontal: 16 },

  shadowSm: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  shadowMd: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  hero: {
    borderRadius: 26,
    padding: 16,
    backgroundColor: IOS.card,
    borderWidth: 1,
    borderColor: IOS.separator,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroActionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  heroTitle: { color: IOS.text, fontSize: 26, fontWeight: '750', textAlign: 'right' },
  heroSubtitle: { color: IOS.muted, marginTop: 4, textAlign: 'right', fontWeight: '500', fontSize: 13 },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS.segmentedBg,
  },
  fabBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS.blue,
    shadowColor: IOS.blue,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  statsRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IOS.separator,
    backgroundColor: IOS.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: { fontWeight: '800', fontSize: 18, color: IOS.text },
  statLabel: { fontWeight: '600', fontSize: 12, color: IOS.muted },

  searchWrap: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOS.segmentedBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: IOS.text, fontSize: 15, textAlign: 'right', paddingVertical: 0 },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS.muted,
  },

  loadingCard: { borderRadius: 16, borderWidth: 0 },
  emptyCard: { borderRadius: 16, marginTop: 4, borderWidth: 0 },

  userCell: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: IOS.card,
    borderWidth: 1,
    borderColor: IOS.separator,
  },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  userMain: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  userName: { color: IOS.text, fontWeight: '600', fontSize: 17, textAlign: 'right', flexShrink: 1 },
  userMeta: { color: IOS.muted, fontSize: 13, textAlign: 'right' },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: IOS.separator,
    backgroundColor: IOS.segmentedBg,
  },
  rolePillText: { color: IOS.text, fontWeight: '700', fontSize: 12 },

  actionsCol: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

