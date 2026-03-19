import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, SectionList, Text, View, Image } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, Pencil, Rocket, Search, Trash2 } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { OriginWindow, type OriginRect } from '../../components/OriginWindow';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobCardAction, JobChip } from '../../components/jobs/JobCard';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { yyyyMmDd } from '../../lib/time';
import { colors } from '../../theme/colors';
import type { AdminDrawerParamList } from '../../navigation/AdminDrawer';

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

type CustomerServicePoint = {
  id: string;
  customer_id: string;
  device_type: string;
  scent_type: string;
  refill_amount: number;
  notes?: string | null;
};

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
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [items, setItems] = useState<UnifiedJob[]>([]);

  const [filters, setFilters] = useState<Filters>({ date: '', status: '', kind: '', q: '' });

  const [selected, setSelected] = useState<UnifiedJob | null>(null);
  const [regularPoints, setRegularPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null })[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UnifiedJob | null>(null);
  const [editOriginRect, setEditOriginRect] = useState<OriginRect | null>(null);
  // ref stores the rect immediately from onPressIn (measureInWindow callback);
  // state is set when the modal actually opens so the animation starts from the right place
  const editOriginRectRef = useRef<OriginRect | null>(null);

  const [customerPointsOpen, setCustomerPointsOpen] = useState(false);
  const [customerPointsLoading, setCustomerPointsLoading] = useState(false);
  const [customerPointsUserId, setCustomerPointsUserId] = useState<string | null>(null);
  const [customerPoints, setCustomerPoints] = useState<CustomerServicePoint[]>([]);
  const [customerPointsOriginRect, setCustomerPointsOriginRect] = useState<OriginRect | null>(null);
  const customerPointsOriginRectRef = useRef<OriginRect | null>(null);

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

  const openCustomerPoints = async (job: UnifiedJob) => {
    const custId = job.customer_id ?? null;
    if (!custId) {
      Toast.show({ type: 'error', text1: 'אין לקוח למשימה זו' });
      return;
    }

    // Flush the latest captured rect into state right before opening
    setCustomerPointsOriginRect(customerPointsOriginRectRef.current);
    setCustomerPointsOpen(true);
    setCustomerPointsLoading(true);
    setCustomerPointsUserId(custId);
    setCustomerPoints([]);

    try {
      const { data, error } = await supabase
        .from('service_points')
        .select('id, customer_id, device_type, scent_type, refill_amount, notes')
        .eq('customer_id', custId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomerPoints((data ?? []) as CustomerServicePoint[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת נקודות שירות נכשלה', text2: e?.message ?? 'Unknown error' });
      setCustomerPoints([]);
    } finally {
      setCustomerPointsLoading(false);
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
    // Flush the latest captured rect into state right before opening
    setEditOriginRect(editOriginRectRef.current);
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

  const ui = useMemo(
    () => ({
      surface: '#FAF9FE',
      surfaceContainerHigh: '#E9E7ED',
      surfaceContainer: '#EEE DF3'.replace(' ', ''), // keep literal from design; avoid eslint complaining about spaces
      outlineVariant: '#C1C6D7',
      primary: '#0058BC',
      primary2: '#0070EB',
      text: colors.text,
      muted: colors.muted,
    }),
    []
  );

  const kindLabel = (k: JobKind) => (k === 'regular' ? 'רגילה' : k === 'installation' ? 'התקנה' : 'מיוחדת');

  const statusMeta = (s: JobStatus) =>
    s === 'completed'
      ? { label: 'הושלם', bg: 'rgba(34,197,94,0.16)', fg: '#166534' }
      : { label: 'ממתין', bg: 'rgba(249,115,22,0.16)', fg: '#9A3412' };

  const stats = useMemo(() => {
    const base = filtered;
    const pending = base.filter((x) => x.status === 'pending').length;
    const completed = base.filter((x) => x.status === 'completed').length;
    return { total: base.length, pending, completed };
  }, [filtered]);

  const shadowCardStyle = useMemo(
    () => ({
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    }),
    []
  );

  return (
    <Screen backgroundColor={ui.surface}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        stickySectionHeadersEnabled={false}
        style={{ marginTop: 4 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: ui.text, fontSize: 30, fontWeight: '900', textAlign: 'right' }}>ניהול משימות</Text>
                <Text style={{ color: '#414755', fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                  צפייה וניהול כל המשימות במערכת
                </Text>
              </View>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: '#D8E2FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Rocket size={26} color={ui.primary} />
              </View>
            </View>

            <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
              <Pressable
                onPress={() => navigation.navigate('JobExecution' satisfies keyof AdminDrawerParamList)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: ui.primary,
                    borderRadius: 999,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    shadowColor: ui.primary,
                    shadowOpacity: 0.18,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 3,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: '#fff', fontWeight: '900' }}>ביצוע משימה</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('AddJobs' satisfies keyof AdminDrawerParamList)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: ui.surfaceContainerHigh,
                    borderRadius: 999,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: ui.text, fontWeight: '900' }}>הוסף משימה</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
              {[
                { label: 'הושלמו', value: stats.completed, bg: 'rgba(34,197,94,0.12)', fg: '#166534' },
                { label: 'ממתינות', value: stats.pending, bg: 'rgba(249,115,22,0.12)', fg: '#9A3412' },
                { label: 'סה״כ', value: stats.total, bg: 'rgba(168,85,247,0.12)', fg: '#6B21A8' },
              ].map((x) => (
                <View
                  key={x.label}
                  style={{
                    minWidth: 128,
                    backgroundColor: x.bg,
                    borderRadius: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(193,198,215,0.35)',
                  }}
                >
                  <Text style={{ color: x.fg, fontWeight: '900', fontSize: 12, textAlign: 'right' }}>{x.label}</Text>
                  <Text style={{ color: x.fg, fontWeight: '900', fontSize: 24, textAlign: 'right', marginTop: 6 }}>
                    {x.value}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={{ gap: 10 }}>
              <Text style={{ color: ui.text, fontWeight: '900', fontSize: 18, textAlign: 'right' }}>סינון וחיפוש</Text>

              <View
                style={{
                  backgroundColor: ui.surfaceContainerHigh,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Search size={18} color="#717786" />
                <View style={{ flex: 1 }}>
                  <Input
                    label={undefined}
                    value={filters.q}
                    onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))}
                    placeholder="חיפוש לפי עובד או לקוח..."
                    style={{
                      borderWidth: 0,
                      paddingVertical: 0,
                      paddingHorizontal: 0,
                      backgroundColor: 'transparent',
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SelectSheet
                    label="סטטוס"
                    value={filters.status}
                    placeholder="הכל"
                    options={[
                      { value: '', label: 'הכל' },
                      { value: 'pending', label: 'ממתין' },
                      { value: 'completed', label: 'הושלם' },
                    ]}
                    onChange={(v) => setFilters((p) => ({ ...p, status: (v || '') as any }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectSheet
                    label="סוג"
                    value={filters.kind}
                    placeholder="הכל"
                    options={[
                      { value: '', label: 'הכל' },
                      { value: 'regular', label: 'רגילה' },
                      { value: 'installation', label: 'התקנה' },
                      { value: 'special', label: 'מיוחדת' },
                    ]}
                    onChange={(v) => setFilters((p) => ({ ...p, kind: (v || '') as any }))}
                  />
                </View>
              </View>

              <Input
                label="תאריך מבוקש (yyyy-MM-dd)"
                value={filters.date}
                onChangeText={(v) => setFilters((p) => ({ ...p, date: v }))}
                placeholder="2026-03-15"
              />

              <Text style={{ color: ui.muted, fontWeight: '800', textAlign: 'right' }}>
                מציג {filtered.length} משימות
              </Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <JobCard
            kind={item.kind}
            title={`${item.order_number ?? '—'} ${userMap.get(item.worker_id) ?? item.worker_id.slice(0, 6)}`}
            status={item.status}
            primaryText={item.customer_id ? `לקוח: ${userMap.get(item.customer_id) ?? item.customer_id.slice(0, 6)}` : 'לקוח: —'}
            description={item.notes ?? null}
            onPress={() => openJob(item)}
            faded={item.status === 'completed'}
            style={{ marginBottom: 12 }}
            actions={
              <>
                <JobCardAction
                  label="ערוך"
                  onPress={() => openEdit(item)}
                  onOriginRect={(r) => { editOriginRectRef.current = r; }}
                >
                  <Pencil size={20} color="#414755" />
                </JobCardAction>
                <JobCardAction
                  label="מחק"
                  variant="danger"
                  onPress={() => {
                    Alert.alert('מחיקת משימה', 'למחוק את המשימה?', [
                      { text: 'ביטול', style: 'cancel' },
                      { text: 'מחק', style: 'destructive', onPress: () => deleteJob(item) },
                    ]);
                  }}
                >
                  <Trash2 size={20} color={colors.danger} />
                </JobCardAction>
                <JobCardAction
                  label="נקודות לקוח"
                  disabled={!item.customer_id}
                  onPress={() => openCustomerPoints(item)}
                  onOriginRect={(r) => { customerPointsOriginRectRef.current = r; }}
                >
                  <Eye size={20} color="#414755" />
                </JobCardAction>
              </>
            }
            chips={
              <>
                <JobChip
                  text={kindLabel(item.kind)}
                  accent={item.kind === 'installation' ? 'purple' : item.kind === 'special' ? 'orange' : 'blue'}
                />
                <JobChip text={yyyyMmDd(item.date)} muted />
              </>
            }
          />
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

      <OriginWindow visible={editOpen} originRect={editOriginRect} onClose={() => setEditOpen(false)}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 22 }}
          showsVerticalScrollIndicator={false}
        >
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
                      onChange={(v) =>
                        setEditing((p) => (p && p.kind === 'special' ? ({ ...p, battery_type: v } as any) : p))
                      }
                    />
                  ) : null}
                </>
              ) : null}

              <Button title="שמור" onPress={saveEdit} />
              <Button title="סגור" variant="secondary" onPress={() => setEditOpen(false)} />
            </>
          )}
        </ScrollView>
      </OriginWindow>

      <OriginWindow
        visible={customerPointsOpen}
        originRect={customerPointsOriginRect}
        onClose={() => {
          setCustomerPointsOpen(false);
          setCustomerPointsUserId(null);
          setCustomerPoints([]);
          setCustomerPointsLoading(false);
        }}
      >
        <View style={{ flex: 1, padding: 14, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
            נקודות שירות ללקוח
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'right' }}>
            {customerPointsUserId ? (userMap.get(customerPointsUserId) ?? customerPointsUserId) : ''}
          </Text>

          {customerPointsLoading ? (
            <Text style={{ color: colors.muted, textAlign: 'right' }}>טוען…</Text>
          ) : (
            <FlatList
              data={customerPoints}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <Card>
                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.device_type}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                    ניחוח: {item.scent_type} • מילוי: {item.refill_amount}
                  </Text>
                  {!!item.notes && (
                    <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }} numberOfLines={2}>
                      הערה: {item.notes}
                    </Text>
                  )}
                </Card>
              )}
              ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות שירות ללקוח.</Text>}
            />
          )}

          <Button title="סגור" variant="secondary" onPress={() => setCustomerPointsOpen(false)} />
        </View>
      </OriginWindow>
    </Screen>
  );
}

