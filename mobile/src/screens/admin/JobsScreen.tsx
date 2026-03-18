import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, SectionList, Text, View, Image } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { yyyyMmDd } from '../../lib/time';
import { colors } from '../../theme/colors';

type JobStatus = 'pending' | 'completed';
type JobKind = 'regular' | 'installation' | 'special';

type BaseUnified = {
  kind: JobKind;
  id: string;
  date: string;
  status: JobStatus;
  worker_id: string;
  customer_id?: string | null;
  one_time_customer_id?: string | null;
  order_number?: number | null;
  notes?: string | null;
};

type UnifiedJob =
  | (BaseUnified & { kind: 'regular' })
  | (BaseUnified & { kind: 'installation' })
  | (BaseUnified & { kind: 'special'; job_type?: string | null; battery_type?: string | null; image_url?: string | null });

type UserLite = { id: string; name: string; role: 'admin' | 'worker' | 'customer' };

type JobServicePoint = { id: string; job_id: string; service_point_id: string; image_url?: string | null; custom_refill_amount?: number | null };
type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };

type InstallationDevice = { id: string; installation_job_id: string; image_url?: string | null; device_name?: string | null };

const SPECIAL_JOB_TYPES: { value: string; label: string; needsBattery?: boolean }[] = [
  { value: 'batteries', label: 'החלפת סוללות', needsBattery: true },
  { value: 'device_issue', label: 'תקלה במכשיר' },
  { value: 'customer_request', label: 'בקשת לקוח' },
  { value: 'other', label: 'אחר' },
];

const BATTERY_TYPES = [
  { value: 'AA', label: 'AA' },
  { value: 'DC', label: 'DC' },
];

type Filters = {
  date: string; // yyyy-MM-dd or empty
  status: '' | JobStatus;
  kind: '' | JobKind;
  q: string;
};

export function JobsScreen() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [items, setItems] = useState<UnifiedJob[]>([]);

  const [filters, setFilters] = useState<Filters>({ date: '', status: '', kind: '', q: '' });

  const [selected, setSelected] = useState<UnifiedJob | null>(null);
  const [regularPoints, setRegularPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null })[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UnifiedJob | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('id, name, role');
    if (!error) setUsers((data ?? []) as UserLite[]);
  };

  const fetchUnified = useCallback(async () => {
    try {
      setLoading(true);

      const [regRes, instRes, specRes] = await Promise.all([
        supabase.from('jobs').select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes'),
        supabase
          .from('installation_jobs')
          .select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes'),
        supabase
          .from('special_jobs')
          .select('id, date, status, worker_id, order_number, notes, job_type, battery_type, image_url'),
      ]);

      if (regRes.error) throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      const regular = ((regRes.data ?? []) as any[]).map(
        (r) =>
          ({
            kind: 'regular',
            ...r,
          }) as UnifiedJob
      );
      const installation = ((instRes.data ?? []) as any[]).map(
        (r) =>
          ({
            kind: 'installation',
            ...r,
          }) as UnifiedJob
      );
      const special = ((specRes.data ?? []) as any[]).map(
        (r) =>
          ({
            kind: 'special',
            ...r,
          }) as UnifiedJob
      );

      const combined = [...regular, ...installation, ...special].sort((a, b) => (a.date < b.date ? 1 : -1));
      setItems(combined);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת משימות נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchUnified();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnified();
    }, [fetchUnified])
  );

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((it) => {
      if (filters.kind && it.kind !== filters.kind) return false;
      if (filters.status && it.status !== filters.status) return false;
      if (filters.date) {
        const key = yyyyMmDd(it.date);
        if (key !== filters.date) return false;
      }
      if (!q) return true;
      const workerName = userMap.get(it.worker_id) ?? '';
      const customerName = it.customer_id ? userMap.get(it.customer_id) ?? '' : '';
      return (
        it.id.toLowerCase().includes(q) ||
        workerName.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        String(it.order_number ?? '').includes(q) ||
        String((it as any).job_type ?? '').toLowerCase().includes(q)
      );
    });
  }, [filters, items, userMap]);

  const sections = useMemo(() => {
    const map = new Map<string, UnifiedJob[]>();
    for (const it of filtered) {
      const key = yyyyMmDd(it.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ title: k, data: map.get(k)! }));
  }, [filtered]);

  const openJob = async (job: UnifiedJob) => {
    setSelected(job);
    setRegularPoints([]);
    setImages([]);

    try {
      if (job.kind === 'regular') {
        const { data: jsp, error: jspErr } = await supabase
          .from('job_service_points')
          .select('id, job_id, service_point_id, image_url, custom_refill_amount')
          .eq('job_id', job.id);
        if (jspErr) throw jspErr;
        const rows = (jsp ?? []) as JobServicePoint[];
        const spIds = rows.map((r) => r.service_point_id);
        let spMap = new Map<string, ServicePoint>();
        if (spIds.length) {
          const { data: sps, error: spErr } = await supabase
            .from('service_points')
            .select('id, device_type, scent_type, refill_amount')
            .in('id', spIds);
          if (spErr) throw spErr;
          spMap = new Map(((sps ?? []) as ServicePoint[]).map((sp) => [sp.id, sp]));
        }

        setRegularPoints(rows.map((r) => ({ ...r, sp: spMap.get(r.service_point_id) ?? null })));
        const urls = rows
          .map((r) => r.image_url)
          .filter(Boolean)
          .map((p) => getPublicUrl(p!));
        setImages(urls);
      }

      if (job.kind === 'special') {
        const p = (job as any).image_url as string | null | undefined;
        setImages(p ? [getPublicUrl(p)] : []);
      }

      if (job.kind === 'installation') {
        const { data, error } = await supabase
          .from('installation_devices')
          .select('id, installation_job_id, image_url, device_name')
          .eq('installation_job_id', job.id);
        if (error) throw error;
        const urls = ((data ?? []) as InstallationDevice[])
          .map((d) => d.image_url)
          .filter(Boolean)
          .map((p) => getPublicUrl(p!));
        setImages(urls);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת פרטים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const deleteJob = async (job: UnifiedJob) => {
    try {
      if (job.kind === 'regular') {
        const { error: jspErr } = await supabase.from('job_service_points').delete().eq('job_id', job.id);
        if (jspErr) throw jspErr;
        const { error } = await supabase.from('jobs').delete().eq('id', job.id);
        if (error) throw error;
      } else if (job.kind === 'installation') {
        await supabase.from('installation_devices').delete().eq('installation_job_id', job.id);
        const { error } = await supabase.from('installation_jobs').delete().eq('id', job.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('special_jobs').delete().eq('id', job.id);
        if (error) throw error;
      }

      setSelected(null);
      setItems((prev) => prev.filter((x) => !(x.kind === job.kind && x.id === job.id)));
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const openEdit = (job: UnifiedJob) => {
    setEditing({ ...job });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const payload: any = {
        date: editing.date,
        status: editing.status,
        worker_id: editing.worker_id,
        notes: editing.notes ?? null,
        order_number: editing.order_number ?? null,
      };

      if (editing.kind === 'regular') {
        const { error } = await supabase.from('jobs').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else if (editing.kind === 'installation') {
        const { error } = await supabase.from('installation_jobs').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.job_type = (editing as any).job_type ?? null;
        payload.battery_type = (editing as any).battery_type ?? null;
        const { error } = await supabase.from('special_jobs').update(payload).eq('id', editing.id);
        if (error) throw error;
      }

      setItems((prev) => prev.map((x) => (x.kind === editing.kind && x.id === editing.id ? (editing as any) : x)));
      setEditOpen(false);
      Toast.show({ type: 'success', text1: 'עודכן' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    }
  };

  const workerOptions = useMemo(
    () => users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name })),
    [users]
  );

  const specialTypeMeta = useMemo(() => {
    if (!editing || editing.kind !== 'special') return null;
    const t = String((editing as any).job_type ?? '');
    return SPECIAL_JOB_TYPES.find((x) => x.value === t) ?? null;
  }, [editing]);

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchUnified} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>משימות</Text>
        </View>

        <Input label="חיפוש" value={filters.q} onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))} placeholder="id/עובד/לקוח/סוג" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="תאריך (yyyy-MM-dd)"
              value={filters.date}
              onChangeText={(v) => setFilters((p) => ({ ...p, date: v }))}
              placeholder="2026-03-15"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SelectSheet
              label="סטטוס"
              value={filters.status}
              placeholder="הכל"
              options={[
                { value: '', label: 'הכל' },
                { value: 'pending', label: 'pending' },
                { value: 'completed', label: 'completed' },
              ]}
              onChange={(v) => setFilters((p) => ({ ...p, status: (v || '') as any }))}
            />
          </View>
        </View>

        <SelectSheet
          label="סוג"
          value={filters.kind}
          placeholder="הכל"
          options={[
            { value: '', label: 'הכל' },
            { value: 'regular', label: 'regular' },
            { value: 'installation', label: 'installation' },
            { value: 'special', label: 'special' },
          ]}
          onChange={(v) => setFilters((p) => ({ ...p, kind: (v || '') as any }))}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        style={{ marginTop: 12 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => openJob(item)}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      backgroundColor: item.status === 'completed' ? colors.success : colors.warning,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '900', fontSize: 11 }}>
                      {item.status}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.elevated,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 11 }}>{item.kind}</Text>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                    #{item.order_number ?? '—'} • {userMap.get(item.worker_id) ?? item.worker_id.slice(0, 6)}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }} numberOfLines={1}>
                    {item.date}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selected} onClose={() => setSelected(null)}>
        {!!selected && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button title="מחיקה" variant="danger" fullWidth={false} onPress={() => deleteJob(selected)} />
              <Pressable onPress={() => openEdit(selected)}>
                <Text style={{ color: colors.primary, fontWeight: '900' }}>עריכה</Text>
              </Pressable>
            </View>

            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              {selected.kind} • {selected.status}
            </Text>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>
              עובד: {userMap.get(selected.worker_id) ?? selected.worker_id}
            </Text>

            {selected.kind === 'regular' ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>נקודות שירות</Text>
                <FlatList
                  data={regularPoints}
                  keyExtractor={(i) => i.id}
                  contentContainerStyle={{ gap: 10 }}
                  renderItem={({ item }) => (
                    <Card>
                      <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                        {item.sp?.device_type ?? item.service_point_id}
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                        ניחוח: {item.sp?.scent_type ?? '-'} • מילוי: {item.custom_refill_amount ?? item.sp?.refill_amount ?? '-'}
                      </Text>
                      {!!item.image_url && (
                        <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }} numberOfLines={1}>
                          תמונה: {getPublicUrl(item.image_url)}
                        </Text>
                      )}
                    </Card>
                  )}
                  ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות.</Text>}
                />
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונות</Text>
              {images.length ? (
                <View style={{ gap: 10 }}>
                  {images.map((u) => (
                    <Card key={u}>
                      <Image source={{ uri: u }} style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" />
                      <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }} numberOfLines={1}>
                        {u}
                      </Text>
                    </Card>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונות.</Text>
              )}
            </View>

            <Button title="סגור" variant="secondary" onPress={() => setSelected(null)} />
          </View>
        )}
      </ModalSheet>

      <ModalSheet visible={editOpen} onClose={() => setEditOpen(false)}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>עריכת משימה</Text>
          {!!editing && (
            <>
              <Input
                label="Date (ISO)"
                value={editing.date}
                onChangeText={(v) => setEditing((p) => (p ? { ...p, date: v } : p))}
                placeholder="2026-03-15T09:00:00.000Z"
              />
              <SelectSheet
                label="Status"
                value={editing.status}
                options={[
                  { value: 'pending', label: 'pending' },
                  { value: 'completed', label: 'completed' },
                ]}
                onChange={(v) => setEditing((p) => (p ? { ...p, status: v as any } : p))}
              />
              <SelectSheet
                label="Worker"
                value={editing.worker_id}
                options={workerOptions.length ? workerOptions : [{ value: editing.worker_id, label: editing.worker_id }]}
                onChange={(v) => setEditing((p) => (p ? { ...p, worker_id: v } : p))}
              />
              <Input
                label="Order number"
                value={String(editing.order_number ?? '')}
                onChangeText={(v) => setEditing((p) => (p ? { ...p, order_number: v ? Number(v) : null } : p))}
                keyboardType="numeric"
              />
              <Input
                label="Notes"
                value={editing.notes ?? ''}
                onChangeText={(v) => setEditing((p) => (p ? { ...p, notes: v } : p))}
              />

              {editing.kind === 'special' ? (
                <>
                  <SelectSheet
                    label="Special type"
                    value={String((editing as any).job_type ?? '')}
                    placeholder="בחר…"
                    options={SPECIAL_JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    onChange={(v) =>
                      setEditing((p) =>
                        p && p.kind === 'special'
                          ? ({ ...p, job_type: v, battery_type: SPECIAL_JOB_TYPES.find((t) => t.value === v)?.needsBattery ? (p.battery_type ?? 'AA') : null } as any)
                          : p
                      )
                    }
                  />
                  {specialTypeMeta?.needsBattery ? (
                    <SelectSheet
                      label="Battery type"
                      value={String((editing as any).battery_type ?? 'AA')}
                      options={BATTERY_TYPES}
                      onChange={(v) => setEditing((p) => (p && p.kind === 'special' ? ({ ...p, battery_type: v } as any) : p))}
                    />
                  ) : null}
                </>
              ) : null}

              <Button title="שמור" onPress={saveEdit} />
              <Button title="סגור" variant="secondary" onPress={() => setEditOpen(false)} />
            </>
          )}
        </View>
      </ModalSheet>
    </Screen>
  );
}

