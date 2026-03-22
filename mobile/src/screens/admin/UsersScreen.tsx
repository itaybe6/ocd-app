import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react-native';
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
  t['-'.charCodeAt(0)] = 62;
  t['_'.charCodeAt(0)] = 63;
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
  const [roleFilter, setRoleFilter] = useState<UserRole | null>(null);
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
    let list = users;
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      u.name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  }, [users, query, roleFilter]);

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
            code === '42P01' ||
            code === '42703' ||
            msg.includes('does not exist') ||
            msg.includes('column') && msg.includes('does not exist') ||
            msg.includes('relation') && msg.includes('does not exist');
          if (!ignorable) throw res.error;
        }
      };

      if (u.role === 'customer') {
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

  const renderUserCard = ({ item }: { item: UserRow }) => {
    return (
      <View style={[s.userCard, s.shadowSm]}>
        <View style={s.userCardInner}>
          <View style={s.userActions}>
            <TouchableOpacity
              onPress={() => cascadeDelete(item)}
              activeOpacity={0.5}
              disabled={mutating}
              style={[s.actionBtn, s.actionBtnRed, mutating && { opacity: 0.3 }]}
            >
              <Trash2 size={18} color="#FF3B30" />
            </TouchableOpacity>

            {item.role === 'customer' ? (
              <TouchableOpacity
                onPressIn={(e) => setPointsAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
                onPress={() => fetchServicePoints(item)}
                activeOpacity={0.5}
                style={[s.actionBtn, s.actionBtnTeal]}
              >
                <Eye size={18} color="#5AC8FA" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={(e) => openEdit(item, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
              activeOpacity={0.5}
              style={[s.actionBtn, s.actionBtnBlue]}
            >
              <Pencil size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <View style={s.userInfo}>
            <Avatar size={44} uri={item.avatar_url ?? null} name={item.name} style={s.userAvatar} />
            <Text style={s.userName} numberOfLines={1}>{item.name}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.screen}>
      <FlatList
        style={s.list}
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchUsers} tintColor={A.blue} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            {/* ── Hero Card ── */}
            <View style={[s.hero, s.shadowMd]}>
              <View style={s.heroHeader}>
                <View style={s.heroActions}>
                  <TouchableOpacity
                    onPress={(e) => openCreate({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
                    hitSlop={10}
                    activeOpacity={0.7}
                    style={s.fabBtn}
                  >
                    <Plus size={18} color="#fff" strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={fetchUsers}
                    hitSlop={10}
                    activeOpacity={0.5}
                    disabled={refreshing}
                    style={[s.refreshBtn, refreshing && { opacity: 0.4 }]}
                  >
                    <RefreshCw size={16} color={A.muted} />
                  </TouchableOpacity>
                </View>
                <View style={s.heroTitleBlock}>
                  <View style={s.heroIconCircle}>
                    <Users size={20} color={A.blue} />
                  </View>
                  <View>
                    <Text style={s.heroTitle}>משתמשים</Text>
                    <Text style={s.heroSubtitle}>
                      {filtered.length === stats.total
                        ? `${stats.total} משתמשים`
                        : `${filtered.length} מתוך ${stats.total}`}
                      {roleFilter ? '  ·  לחץ שוב לאיפוס' : ''}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Search */}
              <View style={s.searchBar}>
                {!!query.trim() && (
                  <Pressable onPress={() => setQuery('')} hitSlop={10} style={s.searchClear} accessibilityLabel="נקה חיפוש">
                    <X size={13} color="#fff" strokeWidth={2.5} />
                  </Pressable>
                )}
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="חיפוש שם, טלפון או תפקיד…"
                  placeholderTextColor={A.placeholder}
                  style={s.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                <Search size={17} color={A.mutedIcon} />
              </View>

              {/* Stats / Filters */}
              <View style={s.statsRow}>
                <StatPill label="מנהלים" value={stats.admin} color="#5856D6" active={roleFilter === 'admin'} onPress={() => setRoleFilter((p) => p === 'admin' ? null : 'admin')} />
                <StatPill label="עובדים" value={stats.worker} color="#007AFF" active={roleFilter === 'worker'} onPress={() => setRoleFilter((p) => p === 'worker' ? null : 'worker')} />
                <StatPill label="לקוחות" value={stats.customer} color="#34C759" active={roleFilter === 'customer'} onPress={() => setRoleFilter((p) => p === 'customer' ? null : 'customer')} />
              </View>
            </View>

            {/* Loading */}
            {refreshing && !users.length ? (
              <View style={[s.loadingCard, s.shadowSm]}>
                <ActivityIndicator color={A.blue} size="small" />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={s.loadingTitle}>טוען משתמשים…</Text>
                  <Text style={s.loadingSubtitle}>זה אמור לקחת כמה שניות</Text>
                </View>
              </View>
            ) : null}
          </View>
        }
        renderItem={renderUserCard}
        ListEmptyComponent={
          !refreshing ? (
            <View style={[s.emptyCard, s.shadowSm]}>
              <View style={s.emptyIconCircle}>
                <Search size={28} color={A.muted} />
              </View>
              <Text style={s.emptyTitle}>לא מצאנו משתמשים</Text>
              <Text style={s.emptySubtitle}>נסה לשנות את החיפוש או לרענן את הרשימה</Text>
              <View style={s.emptyActions}>
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
            </View>
          ) : null
        }
      />

      {/* ── Edit / Create Modal ── */}
      <AnchoredWindow visible={editOpen} anchor={editAnchor} onClose={closeEdit} showCloseEye={false} durationMs={EDIT_WINDOW_DURATION_MS}>
        <View style={{ flex: 1 }}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={closeEdit} activeOpacity={0.5} style={s.modalCloseBtn} hitSlop={10}>
              <X size={18} color={A.text} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>
              {isEditExisting ? 'עריכת משתמש' : 'משתמש חדש'}
            </Text>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>
            {(editing.role ?? 'customer') !== 'customer' ? (
              <View style={s.avatarSection}>
                <View style={s.avatarSectionInner}>
                  <Avatar size={60} uri={avatarLocalUri ?? editing.avatar_url ?? null} name={editing.name ?? ''} />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={s.avatarSectionTitle}>תמונת משתמש</Text>
                    <Text style={s.avatarSectionSub}>מוצג בלוח בקרה ובמשימות</Text>
                  </View>
                </View>
                <View style={s.avatarSectionBtns}>
                  <Button
                    title={avatarBusy ? 'טוען…' : 'בחר תמונה'}
                    fullWidth={false}
                    style={{ flex: 1 }}
                    disabled={avatarBusy}
                    onPress={pickAvatar}
                  />
                  <Button
                    title="הסר"
                    variant="secondary"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    disabled={avatarBusy}
                    onPress={clearAvatar}
                  />
                </View>
              </View>
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
            <View style={{ marginTop: 6 }}>
              <Button title="שמור" onPress={saveUser} />
            </View>
            <Button title="סגור" variant="secondary" onPress={closeEdit} />
          </ScrollView>
        </View>
      </AnchoredWindow>

      {/* ── Service Points Modal ── */}
      <AnchoredWindow visible={pointsOpen} anchor={pointsAnchor} onClose={() => setPointsOpen(false)} showCloseEye={false}>
        <View style={{ flex: 1 }}>
          <View style={s.modalHeader}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setAddPointOpen((p) => !p)}
                activeOpacity={0.5}
                style={s.modalHeaderBtn}
                hitSlop={10}
              >
                <Plus size={17} color={A.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPointsOpen(false)}
                activeOpacity={0.5}
                style={s.modalHeaderBtn}
                hitSlop={10}
              >
                <X size={17} color={A.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>נקודות ריח</Text>
              <Text style={s.modalSubtitle}>{pointsUser?.name}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>
            {addPointOpen ? (
              <View style={s.pointAddCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Pressable onPress={() => setAddPointOpen(false)} hitSlop={10}>
                    <Text style={{ color: A.muted, fontWeight: '700', fontSize: 14 }}>ביטול</Text>
                  </Pressable>
                  <Text style={{ color: A.text, fontWeight: '800', fontSize: 16, textAlign: 'right' }}>הוספת נקודה</Text>
                </View>
                <PointEditor
                  devices={devices}
                  scents={scents}
                  onSave={(p) => {
                    upsertPoint(p);
                    setAddPointOpen(false);
                  }}
                />
              </View>
            ) : null}

            {points.length ? (
              <View style={{ gap: 10 }}>
                {points.map((item) => (
                  <View key={item.id} style={s.pointCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ gap: 8 }}>
                        {editingPointId === item.id ? (
                          <Pressable onPress={cancelEditPoint} style={{ paddingVertical: 4 }} hitSlop={10}>
                            <Text style={{ color: A.muted, fontWeight: '700', fontSize: 13 }}>ביטול</Text>
                          </Pressable>
                        ) : (
                          <Pressable onPress={() => startEditPoint(item)} style={{ paddingVertical: 4 }} hitSlop={10}>
                            <Text style={{ color: A.blue, fontWeight: '700', fontSize: 13 }}>עריכה</Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => deletePoint(item.id)} style={{ paddingVertical: 4 }} hitSlop={10}>
                          <Text style={{ color: A.red, fontWeight: '700', fontSize: 13 }}>מחק</Text>
                        </Pressable>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: A.text, fontWeight: '700', fontSize: 15, textAlign: 'right' }}>
                          {item.device_type}
                        </Text>
                        <Text style={{ color: A.muted, marginTop: 3, textAlign: 'right', fontSize: 13 }}>
                          {item.scent_type} · מילוי: {item.refill_amount}
                        </Text>
                        {item.notes ? (
                          <Text style={{ color: A.muted, marginTop: 4, textAlign: 'right', fontSize: 13, fontStyle: 'italic' }}>
                            {item.notes}
                          </Text>
                        ) : null}

                        {editingPointId === item.id ? (
                          <View style={{ gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: A.separator }}>
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
                              options={scents.map((sc) => ({ value: sc.name, label: sc.name }))}
                              onChange={setEditScentType}
                            />
                            <Button title="שמור שינויים" onPress={() => saveEditPoint(item)} />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.pointEmptyCard}>
                <Text style={{ color: A.muted, textAlign: 'right', fontWeight: '700', fontSize: 14 }}>אין נקודות ריח עדיין</Text>
                <Text style={{ color: A.mutedIcon, textAlign: 'right', marginTop: 4, fontSize: 13 }}>
                  לחץ על + כדי להוסיף נקודה חדשה
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </AnchoredWindow>
    </View>
  );
}

function formatIls(amount: number, missing?: boolean) {
  if (missing) return '—';
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(safe);
  } catch {
    return `₪${Math.round(safe).toLocaleString('he-IL')}`;
  }
}

const STAT_ACTIVE_BG: Record<string, string> = {
  '#5856D6': '#EEEDFB',
  '#007AFF': '#E5F1FF',
  '#34C759': '#E8F9ED',
};
const STAT_ACTIVE_BORDER: Record<string, string> = {
  '#5856D6': '#C8C6F0',
  '#007AFF': '#A3CDFF',
  '#34C759': '#A0E4B4',
};

function StatPill({ label, value, color, active, onPress }: { label: string; value: number; color: string; active: boolean; onPress: () => void }) {
  const activeBg = STAT_ACTIVE_BG[color] ?? '#F0F0F5';
  const activeBorder = STAT_ACTIVE_BORDER[color] ?? '#D0D0D8';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[
        s.statPill,
        active && { backgroundColor: activeBg, borderColor: activeBorder },
      ]}
    >
      <Text style={[s.statValue, active && { color }]}>{value}</Text>
      <View style={s.statLabelRow}>
        <Text style={[s.statLabel, active && { color, fontWeight: '700' as const }]}>{label}</Text>
        <View style={[s.statDot, { backgroundColor: color }]} />
      </View>
    </TouchableOpacity>
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
  const scentOptions = useMemo(() => scents.map((sc) => ({ value: sc.name, label: sc.name })), [scents]);

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

/* ─────────── Apple-Inspired Design Tokens ─────────── */
const A = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  mutedIcon: '#AEAEB2',
  placeholder: '#9D9DA3',
  blue: '#007AFF',
  red: '#FF3B30',
  separator: '#EBEBF0',
  fill: '#F0F0F5',
  fillSecondary: '#E8E8ED',
} as const;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 40, paddingHorizontal: 16, paddingTop: 12 },

  shadowSm: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  shadowMd: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  /* ── Hero ── */
  hero: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBF0',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleBlock: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  heroIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#1C1C1E',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'right',
    fontWeight: '500',
    fontSize: 13,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  fabBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F5',
  },

  /* ── Search ── */
  searchBar: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8E8ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 15,
    textAlign: 'right',
    paddingVertical: 0,
    fontWeight: '400',
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E8E93',
  },

  /* ── Stats ── */
  statsRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F0F0F5',
    borderWidth: 1.5,
    borderColor: '#F0F0F5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontWeight: '800', fontSize: 20, color: A.text, letterSpacing: -0.4 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statLabel: { fontWeight: '600', fontSize: 12, color: A.muted },
  statDot: { width: 7, height: 7, borderRadius: 3.5 },

  /* ── User Card ── */
  userCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBF0',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  userName: {
    flex: 1,
    color: A.text,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnBlue: {
    backgroundColor: '#EBF5FF',
  },
  actionBtnTeal: {
    backgroundColor: '#E8F7FD',
  },
  actionBtnRed: {
    backgroundColor: '#FFF0EF',
  },

  /* ── Loading ── */
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: A.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: A.separator,
  },
  loadingTitle: { color: A.text, fontWeight: '700', fontSize: 15, textAlign: 'right' },
  loadingSubtitle: { color: A.muted, textAlign: 'right', marginTop: 3, fontSize: 13 },

  /* ── Empty ── */
  emptyCard: {
    backgroundColor: A.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: A.separator,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: A.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { color: A.text, fontWeight: '800', fontSize: 17, textAlign: 'center' },
  emptySubtitle: { color: A.muted, textAlign: 'center', marginTop: 6, fontSize: 14, lineHeight: 20 },
  emptyActions: { marginTop: 16, flexDirection: 'row', gap: 10, width: '100%' },

  /* ── Modal shared ── */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: A.separator,
    marginBottom: 4,
  },
  modalTitle: {
    color: A.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    color: A.muted,
    marginTop: 2,
    textAlign: 'right',
    fontWeight: '600',
    fontSize: 13,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: A.fillSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: A.fillSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { gap: 10, paddingBottom: 20, paddingTop: 10 },

  /* ── Avatar section in edit modal ── */
  avatarSection: {
    backgroundColor: A.fill,
    borderRadius: 16,
    padding: 14,
  },
  avatarSectionInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarSectionTitle: { color: A.text, fontWeight: '800', textAlign: 'right', fontSize: 15 },
  avatarSectionSub: { color: A.muted, marginTop: 3, textAlign: 'right', fontWeight: '600', fontSize: 13 },
  avatarSectionBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },

  /* ── Points ── */
  pointAddCard: {
    backgroundColor: A.fill,
    borderRadius: 16,
    padding: 14,
  },
  pointCard: {
    backgroundColor: A.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: A.separator,
  },
  pointEmptyCard: {
    backgroundColor: A.fill,
    borderRadius: 16,
    padding: 20,
  },
});
