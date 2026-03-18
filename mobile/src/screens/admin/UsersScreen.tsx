import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { ModalSheet } from '../../components/ModalSheet';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import type { UserRole } from '../../types/database';

type UserRow = {
  id: string;
  phone: string;
  password?: string | null;
  role: UserRole;
  name: string;
  address?: string | null;
  price?: number | null;
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

function emptyUser(): Partial<UserRow> {
  return { role: 'customer', name: '', phone: '', password: '' };
}

export function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<UserRow>>(emptyUser());
  const isEditExisting = !!editing.id;

  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsUser, setPointsUser] = useState<UserRow | null>(null);
  const [points, setPoints] = useState<ServicePoint[]>([]);
  const [pointsDraft, setPointsDraft] = useState<Partial<ServicePoint>[]>([]);
  const [pointsMode, setPointsMode] = useState<'single' | 'batch'>('batch');

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [scents, setScents] = useState<ScentRow[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, query]);

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
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, phone, password, role, name, address, price, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data ?? []) as UserRow[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת משתמשים נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
      fetchLookups();
    }, [fetchUsers, fetchLookups])
  );

  const openCreate = () => {
    setEditing(emptyUser());
    setEditOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing({ ...u, password: u.password ?? '' });
    setEditOpen(true);
  };

  const saveUser = async () => {
    const payload = {
      phone: (editing.phone ?? '').trim(),
      password: (editing.password ?? '') || null,
      role: (editing.role ?? 'customer') as UserRole,
      name: (editing.name ?? '').trim(),
      address: (editing.address ?? null) || null,
      price: editing.role === 'customer' ? (editing.price ?? null) : null,
    };
    if (!payload.phone || !payload.name) {
      Toast.show({ type: 'error', text1: 'חסר שם/טלפון' });
      return;
    }

    try {
      if (isEditExisting) {
        const { error } = await supabase.from('users').update(payload).eq('id', editing.id!);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'עודכן' });
      } else {
        const { error } = await supabase.from('users').insert(payload);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'נוצר' });
      }
      setEditOpen(false);
      await fetchUsers();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שמירה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const fetchServicePoints = async (customer: UserRow) => {
    try {
      setPointsUser(customer);
      setPointsOpen(true);
      const { data, error } = await supabase
        .from('service_points')
        .select('id, customer_id, device_type, scent_type, refill_amount, notes, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as ServicePoint[];
      setPoints(list);
      setPointsDraft(
        list.map((p) => ({
          id: p.id,
          customer_id: p.customer_id,
          device_type: p.device_type,
          scent_type: p.scent_type,
          refill_amount: p.refill_amount,
          notes: p.notes ?? '',
        }))
      );
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת נקודות שירות נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const savePointsBatch = async () => {
    if (!pointsUser) return;
    const cleaned = pointsDraft
      .map((p) => ({
        customer_id: pointsUser.id,
        device_type: (p.device_type ?? '').trim(),
        scent_type: (p.scent_type ?? '').trim(),
        refill_amount: Number(p.refill_amount ?? 0),
        notes: (p.notes as any)?.trim?.() ? String(p.notes).trim() : null,
      }))
      .filter((p) => p.device_type && p.scent_type && p.refill_amount);

    try {
      setLoading(true);
      const del = await supabase.from('service_points').delete().eq('customer_id', pointsUser.id);
      if (del.error) throw del.error;
      if (cleaned.length) {
        const ins = await supabase.from('service_points').insert(cleaned);
        if (ins.error) throw ins.error;
      }
      Toast.show({ type: 'success', text1: 'נשמר (delete + insert)' });
      await fetchServicePoints(pointsUser);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שמירה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
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
      setLoading(true);

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
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title="הוסף משתמש" fullWidth={false} onPress={openCreate} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>משתמשים</Text>
        </View>

        <Input label="חיפוש" value={query} onChangeText={setQuery} placeholder="שם/טלפון/role" />
        <SelectSheet
          label="פילטר role"
          value={roleFilter === 'all' ? '' : roleFilter}
          placeholder="הכל"
          options={[
            { value: '', label: 'הכל' },
            { value: 'admin', label: 'admin' },
            { value: 'worker', label: 'worker' },
            { value: 'customer', label: 'customer' },
          ]}
          onChange={(v) => setRoleFilter((v || 'all') as any)}
        />
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => openEdit(item)} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>עריכה</Text>
                </Pressable>
                <Pressable onPress={() => cascadeDelete(item)} style={{ paddingVertical: 6 }} disabled={loading}>
                  <Text style={{ color: colors.danger, fontWeight: '900' }}>מחיקה</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>
                  {item.phone} • {item.role}
                </Text>
                {item.role === 'customer' ? (
                  <Pressable onPress={() => fetchServicePoints(item)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.text, textAlign: 'right', fontWeight: '800' }}>נקודות שירות</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין משתמשים.</Text>}
      />

      <ModalSheet visible={editOpen} onClose={() => setEditOpen(false)}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
            {isEditExisting ? 'עריכת משתמש' : 'משתמש חדש'}
          </Text>
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
          <Button title="סגור" variant="secondary" onPress={() => setEditOpen(false)} />
        </View>
      </ModalSheet>

      <ModalSheet visible={pointsOpen} onClose={() => setPointsOpen(false)}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
            נקודות שירות — {pointsUser?.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={pointsMode === 'batch' ? 'מצב עריכה: Batch' : 'מצב עריכה: Single'}
                variant="secondary"
                onPress={() => setPointsMode((p) => (p === 'batch' ? 'single' : 'batch'))}
              />
            </View>
            {pointsMode === 'batch' ? (
              <View style={{ flex: 1 }}>
                <Button title="שמור הכל (delete+insert)" onPress={savePointsBatch} />
              </View>
            ) : null}
          </View>

          {pointsMode === 'single' ? (
            <PointEditor devices={devices} scents={scents} onSave={(p) => upsertPoint(p)} />
          ) : (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>עריכה מרוכזת</Text>
              <View style={{ gap: 10 }}>
                {pointsDraft.map((p, idx) => (
                  <View key={String(p.id ?? idx)} style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <SelectSheet
                      label={`מכשיר #${idx + 1}`}
                      value={String(p.device_type ?? '')}
                      placeholder="בחר מכשיר…"
                      options={devices.map((d) => ({ value: d.name, label: d.name }))}
                      onChange={(v) => setPointsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, device_type: v } : x)))}
                    />
                    <SelectSheet
                      label="ניחוח"
                      value={String(p.scent_type ?? '')}
                      placeholder="בחר ניחוח…"
                      options={scents.map((s) => ({ value: s.name, label: s.name }))}
                      onChange={(v) => setPointsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, scent_type: v } : x)))}
                    />
                    <Input
                      label="כמות מילוי"
                      value={String(p.refill_amount ?? '')}
                      keyboardType="numeric"
                      onChangeText={(v) => setPointsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, refill_amount: Number(v) } : x)))}
                    />
                    <Input
                      label="הערות"
                      value={String(p.notes ?? '')}
                      onChangeText={(v) => setPointsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: v } : x)))}
                    />
                    <Pressable
                      onPress={() => setPointsDraft((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ paddingVertical: 6 }}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '900', textAlign: 'right' }}>הסר שורה</Text>
                    </Pressable>
                  </View>
                ))}
                <Button
                  title="הוסף שורה"
                  variant="secondary"
                  onPress={() =>
                    setPointsDraft((prev) => [
                      ...prev,
                      { device_type: '', scent_type: '', refill_amount: 0, notes: '' },
                    ])
                  }
                />
              </View>
            </Card>
          )}
          <FlatList
            data={points}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
            renderItem={({ item }) => (
              <Card>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.device_type}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                  ניחוח: {item.scent_type} • מילוי: {item.refill_amount}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Pressable onPress={() => upsertPoint(item)} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: colors.primary, fontWeight: '900' }}>שמור שוב</Text>
                  </Pressable>
                  <Pressable onPress={() => deletePoint(item.id)} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: colors.danger, fontWeight: '900' }}>מחק</Text>
                  </Pressable>
                </View>
              </Card>
            )}
            ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות שירות.</Text>}
          />
          <Button title="סגור" variant="secondary" onPress={() => setPointsOpen(false)} />
        </View>
      </ModalSheet>
    </Screen>
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
    <Card>
      <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>הוספת נקודה</Text>
      <View style={{ gap: 10 }}>
        <SelectSheet
          label="מכשיר"
          value={deviceType}
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
          options={scentOptions.length ? scentOptions : [{ value: scentType || 'Unknown', label: scentType || 'Unknown' }]}
          onChange={setScentType}
        />
        <Input label="כמות מילוי" value={refillAmount} onChangeText={setRefillAmount} keyboardType="numeric" />
        <Input label="הערות" value={notes} onChangeText={setNotes} />
        <Button
          title="הוסף"
          onPress={() => {
            onSave({
              device_type: deviceType,
              scent_type: scentType,
              refill_amount: Number(refillAmount),
              notes,
            });
            setNotes('');
          }}
        />
      </View>
    </Card>
  );
}

