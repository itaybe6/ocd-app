import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Droplets, Eye, Play, Search } from 'lucide-react-native';
import { Entypo } from '@expo/vector-icons';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { OriginWindow, ORIGIN_WINDOW_DEFAULT_DURATION_MS, type OriginRect } from '../../components/OriginWindow';
import { AdminStyleJobRow } from '../../components/jobs/AdminStyleJobRow';
import { Avatar } from '../../components/ui/Avatar';
import { getPublicUrl } from '../../lib/storage';
import { pickImageFromLibrary } from '../../lib/media';
import {
  completeUnifiedJob,
  uploadInstallationDeviceImage,
  uploadJobServicePointImage,
  uploadSpecialJobImage,
} from '../../lib/execution';
import { supabase } from '../../lib/supabase';
import { yyyyMmDd } from '../../lib/time';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';
import { useAuth } from '../../state/AuthContext';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

/** Snappier morph than `ORIGIN_WINDOW_DEFAULT_DURATION_MS` — worker task details only */
const WORKER_JOB_DETAILS_ORIGIN_MS = 260;

const jsStat = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  textBlock: { alignItems: 'flex-end' },
  label: {
    color: colors.adminHeader,
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'right',
  },
  value: {
    color: colors.adminHeader,
    fontWeight: '900',
    fontSize: 24,
    textAlign: 'right',
    marginTop: 4,
    letterSpacing: -0.5,
  },
});

function JobsStatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={jsStat.card}>
      <View style={jsStat.textBlock}>
        <Text style={jsStat.label}>{label}</Text>
        <Text style={jsStat.value}>{value}</Text>
      </View>
    </View>
  );
}

type JobStatus = 'pending' | 'completed';
type JobKind = 'regular' | 'installation' | 'special';
type JobTag = 'smell' | 'other';

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
  | (BaseUnified & {
      kind: 'special';
      job_type?: string | null;
      battery_type?: string | null;
      image_url?: string | null;
    });

type UserLite = { id: string; name: string; role: 'admin' | 'worker' | 'customer'; avatar_url?: string | null };

type JobServicePoint = {
  id: string;
  job_id: string;
  service_point_id: string;
  image_url?: string | null;
  custom_refill_amount?: number | null;
};
type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };

type InstallationDevice = {
  id: string;
  installation_job_id: string;
  image_url?: string | null;
  device_type?: string | null;
};

const SPECIAL_JOB_TYPE_LABELS: Record<string, string> = {
  batteries: 'החלפת סוללות',
  device_issue: 'תקלה במכשיר',
  customer_request: 'בקשת לקוח',
  other: 'אחר',
};

/** Measures on press-in so OriginWindow can open from the same control (details → execute). */
function ExecOriginButton({
  originRef,
  onPressMeasured,
  accessibilityLabel,
  innerStyle,
  children,
}: {
  originRef: React.MutableRefObject<OriginRect | null>;
  onPressMeasured: () => void;
  accessibilityLabel?: string;
  innerStyle: ViewStyle;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<View>(null);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPressIn={() => {
        wrapRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) originRef.current = { x, y, width, height };
        });
      }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPressMeasured();
      }}
    >
      {({ pressed }) => (
        <View ref={wrapRef} collapsable={false} style={[innerStyle, { opacity: pressed ? 0.7 : 1 }]}>
          {children}
        </View>
      )}
    </Pressable>
  );
}

type Filters = {
  date: string; // yyyy-MM-dd or empty
  status: '' | JobStatus;
  tag: '' | JobTag;
  q: string;
};

export function WorkerJobsScreen() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<UserLite[]>([]);
  const [items, setItems] = useState<UnifiedJob[]>([]);

  const [filters, setFilters] = useState<Filters>({ date: '', status: '', tag: '', q: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selected, setSelected] = useState<UnifiedJob | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOriginRect, setDetailsOriginRect] = useState<OriginRect | null>(null);
  const detailsOriginRectRef = useRef<OriginRect | null>(null);
  const detailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [regularPoints, setRegularPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null })[]>([]);
  const [installationDevices, setInstallationDevices] = useState<InstallationDevice[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [execJob, setExecJob] = useState<UnifiedJob | null>(null);
  const [execOpen, setExecOpen] = useState(false);
  const [execOriginRect, setExecOriginRect] = useState<OriginRect | null>(null);
  const execOriginRectRef = useRef<OriginRect | null>(null);
  const [execPoints, setExecPoints] = useState<
    (JobServicePoint & { sp?: ServicePoint | null; localImageUri?: string | null; uploading?: boolean })[]
  >([]);
  const [execDevices, setExecDevices] = useState<
    (InstallationDevice & { localImageUri?: string | null; uploading?: boolean })[]
  >([]);
  const [execSpecialImageUrl, setExecSpecialImageUrl] = useState<string | null>(null);
  const [execSpecialLocalUri, setExecSpecialLocalUri] = useState<string | null>(null);
  const [execSpecialUploading, setExecSpecialUploading] = useState(false);
  const execCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const customerMap = useMemo(() => new Map(customers.map((u) => [u.id, u.name])), [customers]);

  const fetchCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, avatar_url')
      .eq('role', 'customer');
    if (!error) setCustomers((data ?? []) as UserLite[]);
  }, []);

  const fetchUnified = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      const [regRes, instRes, specRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes')
          .eq('worker_id', user.id),
        supabase
          .from('installation_jobs')
          .select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes, device_type')
          .eq('worker_id', user.id),
        supabase
          .from('special_jobs')
          .select(
            'id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes, job_type, battery_type, image_url'
          )
          .eq('worker_id', user.id),
      ]);

      if (regRes.error) throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      const regular = ((regRes.data ?? []) as any[]).map(
        (r) => ({ kind: 'regular', ...r }) as UnifiedJob
      );
      const installation = ((instRes.data ?? []) as any[]).map(
        (r) => ({ kind: 'installation', ...r }) as UnifiedJob
      );
      const special = ((specRes.data ?? []) as any[]).map(
        (r) => ({ kind: 'special', ...r }) as UnifiedJob
      );

      const combined = [...regular, ...installation, ...special].sort((a, b) => (a.date < b.date ? 1 : -1));
      setItems(combined);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת משימות נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useFocusEffect(
    useCallback(() => {
      fetchUnified();
    }, [fetchUnified])
  );

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((it) => {
      if (filters.tag === 'smell' && it.kind !== 'regular') return false;
      if (filters.tag === 'other' && it.kind === 'regular') return false;
      if (filters.status && it.status !== filters.status) return false;
      if (filters.date) {
        const key = yyyyMmDd(it.date);
        if (key !== filters.date) return false;
      }
      if (!q) return true;
      const customerName = it.customer_id ? customerMap.get(it.customer_id) ?? '' : '';
      return (
        it.id.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        String(it.order_number ?? '').includes(q) ||
        String((it as any).job_type ?? '').toLowerCase().includes(q)
      );
    });
  }, [filters, items, customerMap]);

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

  const closeExec = useCallback(() => {
    setExecOpen(false);
    if (execCloseTimerRef.current) clearTimeout(execCloseTimerRef.current);
    execCloseTimerRef.current = setTimeout(() => {
      setExecJob(null);
      setExecPoints([]);
      setExecDevices([]);
      setExecSpecialImageUrl(null);
      setExecSpecialLocalUri(null);
      setExecSpecialUploading(false);
      setExecOriginRect(null);
      execOriginRectRef.current = null;
    }, ORIGIN_WINDOW_DEFAULT_DURATION_MS + 48);
  }, []);

  const openJob = async (job: UnifiedJob, opts?: { mode?: 'view' | 'execute' }) => {
    const mode = opts?.mode ?? 'view';
    if (mode === 'execute') {
      setSelected(null);
      setDetailsOpen(false);
      setExecJob(job);
      setExecOpen(false);
      setExecPoints([]);
      setExecDevices([]);
      setExecSpecialImageUrl(null);
      setExecSpecialLocalUri(null);
      setExecSpecialUploading(false);
      setTimeout(() => setExecOpen(true), 0);
    } else {
      setSelected(job);
    }

    setRegularPoints([]);
    setInstallationDevices([]);
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

        const enriched = rows.map((r) => ({ ...r, sp: spMap.get(r.service_point_id) ?? null }));
        setRegularPoints(enriched);
        if (mode === 'execute') {
          setExecPoints(enriched.map((r) => ({ ...r, localImageUri: null, uploading: false })));
        }
        const urls = rows
          .map((r) => r.image_url)
          .filter(Boolean)
          .map((p) => getPublicUrl(p!));
        setImages(urls);
      }

      if (job.kind === 'special') {
        const p = (job as any).image_url as string | null | undefined;
        setImages(p ? [getPublicUrl(p)] : []);
        if (mode === 'execute') {
          setExecSpecialImageUrl(p ?? null);
        }
      }

      if (job.kind === 'installation') {
        const { data, error } = await supabase
          .from('installation_devices')
          .select('id, installation_job_id, image_url, device_type')
          .eq('installation_job_id', job.id);
        if (error) throw error;
        const devs = ((data ?? []) as InstallationDevice[]);
        setInstallationDevices(devs);
        if (mode === 'execute') {
          setExecDevices(devs.map((d) => ({ ...d, localImageUri: null, uploading: false })));
        }
        const urls = devs
          .map((d) => d.image_url)
          .filter(Boolean)
          .map((p) => getPublicUrl(p!));
        setImages(urls);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת פרטים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const openDetails = (job: UnifiedJob) => {
    setDetailsOriginRect(detailsOriginRectRef.current);
    setDetailsOpen(true);
    void openJob(job, { mode: 'view' });
  };

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    setPreviewImageUrl(null);
    if (detailsCloseTimerRef.current) clearTimeout(detailsCloseTimerRef.current);
    detailsCloseTimerRef.current = setTimeout(() => {
      setSelected(null);
      setDetailsOriginRect(null);
      setRegularPoints([]);
      setInstallationDevices([]);
      setImages([]);
      setPreviewImageUrl(null);
    }, WORKER_JOB_DETAILS_ORIGIN_MS + 48);
  }, []);

  const pickExecRegularImage = async (jobServicePointId: string) => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setExecPoints((prev) =>
      prev.map((p) => (p.id === jobServicePointId ? { ...p, localImageUri: uri } : p))
    );
  };

  const uploadExecRegularPoint = async (
    p: JobServicePoint & { localImageUri?: string | null; uploading?: boolean }
  ) => {
    if (!execJob || execJob.kind !== 'regular') return;
    if (!p.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setExecPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadJobServicePointImage({
        jobId: execJob.id,
        jobServicePointId: p.id,
        servicePointId: p.service_point_id,
        localUri: p.localImageUri,
      });
      setExecPoints((prev) =>
        prev.map((x) =>
          x.id === p.id ? { ...x, image_url: storagePath, uploading: false, localImageUri: null } : x
        )
      );
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath } : x)));
      setImages((prev) => Array.from(new Set([...prev, getPublicUrl(storagePath)])));
      Toast.show({ type: 'success', text1: 'התמונה הועלתה' });
    } catch (e: any) {
      setExecPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const pickExecInstallationImage = async (deviceId: string) => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setExecDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, localImageUri: uri } : d))
    );
  };

  const uploadExecInstallationDevice = async (
    d: InstallationDevice & { localImageUri?: string | null; uploading?: boolean }
  ) => {
    if (!execJob || execJob.kind !== 'installation') return;
    if (!d.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setExecDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadInstallationDeviceImage({
        installationJobId: execJob.id,
        installationDeviceId: d.id,
        localUri: d.localImageUri,
      });
      setExecDevices((prev) =>
        prev.map((x) =>
          x.id === d.id ? { ...x, image_url: storagePath, uploading: false, localImageUri: null } : x
        )
      );
      setInstallationDevices((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, image_url: storagePath } : x))
      );
      setImages((prev) => Array.from(new Set([...prev, getPublicUrl(storagePath)])));
      Toast.show({ type: 'success', text1: 'התמונה הועלתה' });
    } catch (e: any) {
      setExecDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const pickExecSpecialImage = async () => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setExecSpecialLocalUri(uri);
  };

  const uploadExecSpecialImage = async () => {
    if (!execJob || execJob.kind !== 'special') return;
    if (!execSpecialLocalUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setExecSpecialUploading(true);
      const storagePath = await uploadSpecialJobImage({
        specialJobId: execJob.id,
        localUri: execSpecialLocalUri,
      });
      setExecSpecialImageUrl(storagePath);
      setExecSpecialLocalUri(null);
      setImages((prev) => Array.from(new Set([...prev, getPublicUrl(storagePath)])));
      setItems((prev) =>
        prev.map((j) =>
          j.kind === 'special' && j.id === execJob.id ? ({ ...j, image_url: storagePath } as UnifiedJob) : j
        )
      );
      Toast.show({ type: 'success', text1: 'התמונה הועלתה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setExecSpecialUploading(false);
    }
  };

  const completeExecJob = async () => {
    if (!execJob) return;
    try {
      setIsLoading(true);
      await completeUnifiedJob(execJob.kind, execJob.id);
      setItems((prev) =>
        prev.map((j) =>
          j.kind === execJob.kind && j.id === execJob.id ? { ...j, status: 'completed' } : j
        )
      );
      setExecJob((p) => (p ? { ...p, status: 'completed' } : p));
      Toast.show({ type: 'success', text1: 'המשימה הושלמה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const ui = useMemo(
    () => ({
      surface: '#F2F2F7',
      surfaceLow: '#FFFFFF',
      surfaceContainerLow: 'rgba(120,120,128,0.12)',
      surfaceContainerHigh: 'rgba(120,120,128,0.08)',
      outline: 'rgba(60,60,67,0.10)',
      text: '#1C1C1E',
      muted: '#8E8E93',
      primary: colors.adminHeader,
      secondary: '#3C3C43',
      tertiary: '#8E8E93',
      fill: 'rgba(120,120,128,0.12)',
    }),
    []
  );

  const tagChipText = (k: JobKind) => (k === 'regular' ? 'ריח' : 'אחרת');

  const statusMeta = (s: JobStatus) =>
    s === 'completed'
      ? { label: 'הושלם', bg: 'rgba(52,199,89,0.10)', fg: '#248A3D' }
      : { label: 'ממתין', bg: 'rgba(255,149,0,0.10)', fg: '#C93400' };

  const stats = useMemo(() => {
    const base = filtered;
    const pending = base.filter((x) => x.status === 'pending').length;
    const completed = base.filter((x) => x.status === 'completed').length;
    return { total: base.length, pending, completed };
  }, [filtered]);

  const isFiltersActive = useMemo(() => {
    return !!(filters.q.trim() || filters.status || filters.tag || filters.date.trim());
  }, [filters.date, filters.q, filters.status, filters.tag]);

  const workerName = user?.name?.trim() || 'משימה';
  const workerAvatar = user?.avatar_url ?? null;

  const isExecCompletable = useMemo(() => {
    if (!execJob) return false;
    if (execJob.status !== 'pending') return false;
    if (execJob.kind === 'regular') {
      if (!execPoints.length) return true;
      return execPoints.every((p) => !!p.image_url);
    }
    if (execJob.kind === 'installation') {
      if (!execDevices.length) return true;
      return execDevices.every((d) => !!d.image_url);
    }
    if (execJob.kind === 'special') {
      return !!execSpecialImageUrl;
    }
    return false;
  }, [execJob, execPoints, execDevices, execSpecialImageUrl]);

  return (
    <View style={{ flex: 1, backgroundColor: ui.surface }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        stickySectionHeadersEnabled={false}
        style={{ marginTop: 0 }}
        ItemSeparatorComponent={() => <View style={{ height: 36 }} />}
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16, paddingTop: 16 }}
        ListHeaderComponent={
          <View style={{ gap: 20, marginBottom: 12 }}>
            {/* Stats */}
            <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
              <JobsStatCard label="סה״כ" value={stats.total} />
              <JobsStatCard label="ממתינות" value={stats.pending} />
              <JobsStatCard label="הושלמו" value={stats.completed} />
            </View>

            {/* Search + Filter button */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  height: 44,
                }}
              >
                <Search size={16} color={ui.muted} />
                <Input
                  label={undefined}
                  value={filters.q}
                  onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))}
                  placeholder="חיפוש…"
                  style={{
                    flex: 1,
                    borderWidth: 0,
                    paddingVertical: 0,
                    paddingHorizontal: 0,
                    backgroundColor: 'transparent',
                    fontSize: 15,
                  }}
                />
              </View>

              <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(true)} hitSlop={8}>
                {({ pressed }) => (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.adminHeader,
                      opacity: pressed ? 0.7 : 1,
                      shadowColor: colors.adminHeader,
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }}
                  >
                    <Entypo name="sound-mix" size={18} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            </View>

            {isFiltersActive && (
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(0,122,255,0.08)',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  alignSelf: 'flex-end',
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#007AFF' }} />
                <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 13 }}>
                  {filtered.length} תוצאות
                </Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingTop: 20,
              paddingBottom: 10,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: ui.text,
                fontWeight: '800',
                fontSize: 20,
                textAlign: 'right',
                letterSpacing: -0.4,
              }}
            >
              {section.title}
            </Text>
            <View
              style={{
                backgroundColor: ui.fill,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: ui.secondary, fontWeight: '600', fontSize: 12 }}>
                {section.data.length}
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const customerName = item.customer_id
            ? customerMap.get(item.customer_id) ?? item.customer_id.slice(0, 6)
            : null;
          const titleLine = customerName ?? `הזמנה מס׳ ${item.order_number ?? '—'}`;

          return (
            <AdminStyleJobRow
              kind={item.kind}
              status={item.status}
              date={item.date}
              avatarUri={workerAvatar}
              topRightLabel={workerName}
              titleLine={titleLine}
              notes={item.notes ?? null}
              onPress={() => openDetails(item)}
              onPressInCapture={(rect) => {
                detailsOriginRectRef.current = rect;
              }}
              showFooter={false}
            />
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: ui.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Droplets size={28} color={ui.tertiary} />
            </View>
            <Text style={{ color: ui.secondary, fontWeight: '600', fontSize: 16, textAlign: 'center' }}>
              אין משימות
            </Text>
            <Text style={{ color: ui.tertiary, fontWeight: '400', fontSize: 14, textAlign: 'center' }}>
              {loading ? 'טוען…' : 'לא נמצאו משימות עבורך'}
            </Text>
          </View>
        }
      />

      {/* Filters modal */}
      <ModalSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={{ gap: 0, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}
          >
            <Text style={{ color: ui.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>סינון</Text>
            <Pressable
              onPress={() => setFilters({ date: '', status: '', tag: '', q: '' })}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: pressed ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)',
              })}
            >
              <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 14 }}>נקה הכל</Text>
            </Pressable>
          </View>

          <Text
            style={{ color: ui.secondary, fontWeight: '600', fontSize: 13, textAlign: 'right', marginBottom: 10 }}
          >
            סטטוס
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 20 }}>
            {[
              { value: '' as const, label: 'הכל', color: '#007AFF', bg: 'rgba(0,122,255,0.10)' },
              { value: 'pending' as const, label: 'ממתין', color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
              { value: 'completed' as const, label: 'הושלם', color: '#34C759', bg: 'rgba(52,199,89,0.10)' },
            ].map((opt) => {
              const active = filters.status === opt.value;
              return (
                <Pressable
                  key={opt.value || 'all-status'}
                  onPress={() => setFilters((p) => ({ ...p, status: opt.value }))}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: active ? opt.color : opt.bg,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : opt.color, fontWeight: '600', fontSize: 14 }}>
                        {opt.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text
            style={{ color: ui.secondary, fontWeight: '600', fontSize: 13, textAlign: 'right', marginBottom: 10 }}
          >
            סוג משימה
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 20 }}>
            {[
              { value: '' as const, label: 'הכל', color: '#007AFF', bg: 'rgba(0,122,255,0.10)' },
              { value: 'smell' as const, label: 'ריח', color: '#007AFF', bg: 'rgba(0,122,255,0.10)' },
              { value: 'other' as const, label: 'אחרת', color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
            ].map((opt) => {
              const active = filters.tag === opt.value;
              return (
                <Pressable
                  key={opt.value || 'all-kind'}
                  onPress={() => setFilters((p) => ({ ...p, tag: opt.value }))}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: active ? opt.color : opt.bg,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : opt.color, fontWeight: '600', fontSize: 14 }}>
                        {opt.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text
            style={{ color: ui.secondary, fontWeight: '600', fontSize: 13, textAlign: 'right', marginBottom: 10 }}
          >
            תאריך
          </Text>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
              backgroundColor: ui.fill,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 24,
            }}
          >
            <CalendarDays size={17} color={ui.tertiary} />
            <Input
              label={undefined}
              value={filters.date}
              onChangeText={(v) => setFilters((p) => ({ ...p, date: v }))}
              placeholder="2026-03-15"
              style={{
                flex: 1,
                borderWidth: 0,
                paddingVertical: 0,
                paddingHorizontal: 0,
                backgroundColor: 'transparent',
                fontSize: 15,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: ui.outline,
            }}
          >
            <Text style={{ color: ui.secondary, fontWeight: '600', fontSize: 14 }}>
              {filtered.length} תוצאות
            </Text>
            <Pressable onPress={() => setFiltersOpen(false)}>
              {({ pressed }) => (
                <View
                  style={{
                    paddingHorizontal: 28,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: pressed ? 'rgba(0,122,255,0.85)' : '#007AFF',
                    shadowColor: '#007AFF',
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>הצג תוצאות</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ModalSheet>

      {/* Details modal */}
      <OriginWindow
        visible={detailsOpen}
        originRect={detailsOriginRect}
        onClose={closeDetails}
        durationMs={WORKER_JOB_DETAILS_ORIGIN_MS}
        deferOpenByOneFrame={false}
      >
        {!!selected && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 14, padding: 14, paddingBottom: 22 }}
          >
            {/* Summary card */}
            <View
              style={{
                backgroundColor: ui.surfaceLow,
                borderRadius: 22,
                padding: 16,
                borderWidth: 1,
                borderColor: ui.outline,
                shadowColor: '#0F172A',
                shadowOpacity: 0.06,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 16 },
                elevation: 3,
                gap: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 8,
                  width: '100%',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor:
                      selected.status === 'completed' ? 'rgba(52,199,89,0.10)' : 'rgba(255,149,0,0.10)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor: selected.status === 'completed' ? '#34C759' : '#FF9500',
                    }}
                  />
                  <Text
                    style={{
                      color: selected.status === 'completed' ? '#248A3D' : '#C93400',
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {statusMeta(selected.status).label}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor:
                      selected.kind === 'installation'
                        ? 'rgba(175,82,222,0.10)'
                        : selected.kind === 'special'
                          ? 'rgba(255,149,0,0.10)'
                          : 'rgba(0,122,255,0.10)',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      color:
                        selected.kind === 'installation'
                          ? '#AF52DE'
                          : selected.kind === 'special'
                            ? '#FF9500'
                            : '#007AFF',
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {tagChipText(selected.kind)}
                  </Text>
                </View>
              </View>

              {/* Customer */}
              {selected.kind !== 'special' ? (
                <Text
                  style={{ color: '#007AFF', fontWeight: '600', textAlign: 'right', fontSize: 15 }}
                  numberOfLines={2}
                >
                  {selected.customer_id
                    ? `לקוח: ${customerMap.get(selected.customer_id) ?? selected.customer_id.slice(0, 6)}`
                    : 'לקוח: —'}
                </Text>
              ) : null}

              {/* Special: job type */}
              {selected.kind === 'special' && (selected as any).job_type ? (
                <Text
                  style={{ color: '#FF9500', fontWeight: '600', textAlign: 'right', fontSize: 15 }}
                  numberOfLines={2}
                >
                  {SPECIAL_JOB_TYPE_LABELS[(selected as any).job_type as string] ?? (selected as any).job_type}
                  {(selected as any).battery_type ? ` · ${(selected as any).battery_type}` : ''}
                </Text>
              ) : null}

              {/* Worker */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <Avatar
                  size={36}
                  uri={workerAvatar}
                  name={workerName}
                  style={{ borderWidth: 2, borderColor: 'rgba(0,0,0,0.04)' }}
                />
                <Text
                  style={{ color: ui.secondary, textAlign: 'right', fontWeight: '600', flex: 1, fontSize: 15 }}
                  numberOfLines={1}
                >
                  {workerName}
                </Text>
              </View>

              {/* Order number / notes */}
              {selected.order_number != null ? (
                <Text style={{ color: ui.tertiary, textAlign: 'right', fontSize: 13, fontWeight: '600' }}>
                  הזמנה מס׳ {selected.order_number}
                </Text>
              ) : null}

              {!!selected.notes?.trim() && (
                <Text style={{ color: ui.secondary, textAlign: 'right', fontSize: 14, lineHeight: 20 }}>
                  {selected.notes}
                </Text>
              )}

              {selected.status === 'pending' ? (
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    marginTop: 4,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: ui.outline,
                  }}
                >
                  <ExecOriginButton
                    originRef={execOriginRectRef}
                    accessibilityLabel="בצע משימה"
                    innerStyle={{
                      minHeight: 44,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.adminHeader,
                      shadowColor: colors.adminHeader,
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }}
                    onPressMeasured={() => {
                      setExecOriginRect(execOriginRectRef.current);
                      void openJob(selected, { mode: 'execute' });
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15, textAlign: 'right' }}>
                      בצע משימה
                    </Text>
                  </ExecOriginButton>
                </View>
              ) : null}
            </View>

            {/* Regular: service points */}
            {selected.kind === 'regular' ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>נקודות שירות</Text>
                <FlatList
                  data={regularPoints}
                  keyExtractor={(i) => i.id}
                  contentContainerStyle={{ gap: 10 }}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <Card>
                      <View
                        style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                            {item.sp?.device_type ?? item.service_point_id}
                          </Text>
                          <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                            ניחוח: {item.sp?.scent_type ?? '-'} • מילוי:{' '}
                            {item.custom_refill_amount ?? item.sp?.refill_amount ?? '-'}
                          </Text>
                        </View>
                        {!!item.image_url && (
                          <Pressable
                            onPress={() => setPreviewImageUrl(getPublicUrl(item.image_url!))}
                            hitSlop={10}
                          >
                            {({ pressed }) => (
                              <View
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: pressed ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.10)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: 8,
                                  borderWidth: 1,
                                  borderColor: 'rgba(37,99,235,0.18)',
                                }}
                              >
                                <Eye size={18} color="#2563EB" />
                              </View>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </Card>
                  )}
                  ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות.</Text>}
                />
              </View>
            ) : null}

            {/* Installation: devices */}
            {selected.kind === 'installation' ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>מכשירים</Text>
                <FlatList
                  data={installationDevices}
                  keyExtractor={(i) => i.id}
                  contentContainerStyle={{ gap: 10 }}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <Card>
                      <View
                        style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1 }}>
                          {item.device_type ?? 'מכשיר'}
                        </Text>
                        {!!item.image_url && (
                          <Pressable
                            onPress={() => setPreviewImageUrl(getPublicUrl(item.image_url!))}
                            hitSlop={10}
                          >
                            {({ pressed }) => (
                              <View
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: pressed ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.10)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: 8,
                                  borderWidth: 1,
                                  borderColor: 'rgba(37,99,235,0.18)',
                                }}
                              >
                                <Eye size={18} color="#2563EB" />
                              </View>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </Card>
                  )}
                  ListEmptyComponent={
                    <Text style={{ color: colors.muted, textAlign: 'right' }}>אין מכשירים.</Text>
                  }
                />
              </View>
            ) : null}

            {/* Images */}
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונות</Text>
              {images.length ? (
                <View style={{ gap: 10 }}>
                  {images.map((u) => (
                    <Card key={u}>
                      <Pressable onPress={() => setPreviewImageUrl(u)}>
                        {({ pressed }) => (
                          <View style={{ position: 'relative', opacity: pressed ? 0.95 : 1 }}>
                            <Image
                              source={{ uri: u }}
                              style={{ width: '100%', height: 190, borderRadius: 14 }}
                              resizeMode="cover"
                            />
                            <View
                              style={{
                                position: 'absolute',
                                top: 10,
                                left: 10,
                                width: 36,
                                height: 36,
                                borderRadius: 12,
                                backgroundColor: 'rgba(255,255,255,0.78)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(15,23,42,0.10)',
                              }}
                            >
                              <Eye size={18} color="#0F172A" />
                            </View>
                          </View>
                        )}
                      </Pressable>
                    </Card>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונות.</Text>
              )}
            </View>

            <Button title="סגור" variant="secondary" onPress={closeDetails} />
          </ScrollView>
        )}
      </OriginWindow>

      {/* Image preview modal */}
      <ModalSheet visible={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)}>
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Pressable onPress={() => setPreviewImageUrl(null)} hitSlop={12}>
              {({ pressed }) => (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: pressed ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.muted, fontWeight: '800' }}>✕</Text>
                </View>
              )}
            </Pressable>
          </View>

          {!!previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={{ width: '100%', height: 340, borderRadius: 18 }}
              resizeMode="cover"
            />
          )}
        </View>
      </ModalSheet>

      {/* Execute — OriginWindow morph (same as task details), not bottom sheet */}
      <OriginWindow
        visible={execOpen}
        originRect={execOriginRect}
        onClose={closeExec}
        durationMs={ORIGIN_WINDOW_DEFAULT_DURATION_MS}
        openedHeight={Math.min(screenHeight * 0.86, screenHeight - 40)}
        openedWidth={Math.min(screenWidth * 0.94, 440)}
      >
        {!!execJob && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 34, paddingHorizontal: 12, paddingTop: 4 }}
          >
            {/* Header (close control is OriginWindow toolbar) */}
            <View style={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 16 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    style={{
                      color: '#1C1C1E',
                      fontSize: 24,
                      fontWeight: '800',
                      textAlign: 'right',
                      letterSpacing: -0.6,
                    }}
                  >
                    ביצוע משימה
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    {execJob.order_number != null && (
                      <View
                        style={{
                          backgroundColor: 'rgba(120,120,128,0.08)',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: '#8E8E93', fontWeight: '700', fontSize: 13 }}>
                          #{execJob.order_number}
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor:
                          execJob.status === 'completed' ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: execJob.status === 'completed' ? '#34C759' : '#FF9500',
                        }}
                      />
                      <Text
                        style={{
                          color: execJob.status === 'completed' ? '#248A3D' : '#C93400',
                          fontWeight: '600',
                          fontSize: 13,
                        }}
                      >
                        {execJob.status === 'completed' ? 'הושלם' : 'ממתין'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: 'rgba(60,60,67,0.08)' }} />
            </View>

            {/* Regular job: service points */}
            {execJob.kind === 'regular' ? (
              execPoints.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: 'rgba(120,120,128,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Droplets size={24} color="#8E8E93" />
                  </View>
                  <Text style={{ color: '#8E8E93', fontWeight: '500', fontSize: 15, textAlign: 'center' }}>
                    אין נקודות שירות
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <Text
                    style={{
                      color: '#8E8E93',
                      fontWeight: '600',
                      fontSize: 13,
                      textAlign: 'right',
                      marginBottom: 2,
                      paddingHorizontal: 2,
                    }}
                  >
                    נקודות שירות ({execPoints.length})
                  </Text>

                  {execPoints.map((item) => {
                    const currentImageUrl = item.image_url ? getPublicUrl(item.image_url) : null;
                    const previewUri = item.localImageUri ?? currentImageUrl ?? null;
                    const refill = item.custom_refill_amount ?? item.sp?.refill_amount ?? null;
                    const hasImage = !!item.image_url;

                    return (
                      <View
                        key={item.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(60,60,67,0.06)',
                          shadowColor: '#000',
                          shadowOpacity: 0.04,
                          shadowRadius: 12,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 14,
                            paddingBottom: 12,
                          }}
                        >
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text
                              style={{
                                color: '#1C1C1E',
                                fontWeight: '700',
                                fontSize: 16,
                                textAlign: 'right',
                                letterSpacing: -0.2,
                              }}
                              numberOfLines={1}
                            >
                              {item.sp?.device_type ?? `נקודה ${item.service_point_id.slice(0, 6)}`}
                            </Text>
                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                              <Droplets size={12} color="#8E8E93" />
                              <Text
                                style={{ color: '#8E8E93', fontSize: 13, fontWeight: '500', textAlign: 'right' }}
                              >
                                {item.sp?.scent_type ?? '—'} · {refill ?? '—'} מ״ל
                              </Text>
                            </View>
                          </View>

                          {hasImage && (
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: 'rgba(52,199,89,0.12)',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 14 }}>✓</Text>
                            </View>
                          )}
                        </View>

                        {!!previewUri ? (
                          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
                            <Image
                              source={{ uri: previewUri }}
                              style={{
                                width: '100%',
                                height: 180,
                                borderRadius: 12,
                                backgroundColor: 'rgba(120,120,128,0.08)',
                              }}
                              resizeMode="cover"
                            />
                          </View>
                        ) : (
                          <View
                            style={{
                              marginHorizontal: 14,
                              marginBottom: 12,
                              height: 100,
                              borderRadius: 12,
                              backgroundColor: 'rgba(120,120,128,0.04)',
                              borderWidth: 1.5,
                              borderColor: 'rgba(120,120,128,0.08)',
                              borderStyle: 'dashed',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <Eye size={20} color="#C7C7CC" />
                            <Text style={{ color: '#C7C7CC', fontSize: 13, fontWeight: '500' }}>
                              טרם הועלתה תמונה
                            </Text>
                          </View>
                        )}

                        {execJob.status === 'pending' ? (
                          <View
                            style={{
                              flexDirection: 'row-reverse',
                              gap: 8,
                              paddingHorizontal: 14,
                              paddingBottom: 14,
                            }}
                          >
                            <Pressable
                              onPress={() => pickExecRegularImage(item.id)}
                              style={{ flex: 1 }}
                            >
                              {({ pressed }) => (
                                <View
                                  style={{
                                    flexDirection: 'row-reverse',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    backgroundColor: pressed
                                      ? 'rgba(120,120,128,0.16)'
                                      : 'rgba(120,120,128,0.08)',
                                    borderRadius: 12,
                                    paddingVertical: 11,
                                  }}
                                >
                                  <Eye size={15} color="#3C3C43" />
                                  <Text style={{ color: '#3C3C43', fontWeight: '600', fontSize: 14 }}>
                                    בחר תמונה
                                  </Text>
                                </View>
                              )}
                            </Pressable>

                            <Pressable
                              onPress={() => uploadExecRegularPoint(item)}
                              disabled={!!item.uploading}
                              style={{ flex: 1, opacity: item.uploading ? 0.6 : 1 }}
                            >
                              {({ pressed }) => (
                                <View
                                  style={{
                                    flexDirection: 'row-reverse',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    backgroundColor: item.uploading
                                      ? 'rgba(0,122,255,0.06)'
                                      : pressed
                                        ? 'rgba(0,122,255,0.18)'
                                        : 'rgba(0,122,255,0.10)',
                                    borderRadius: 12,
                                    paddingVertical: 11,
                                  }}
                                >
                                  <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 14 }}>
                                    {item.uploading ? 'מעלה…' : 'העלה'}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )
            ) : null}

            {/* Installation job: devices */}
            {execJob.kind === 'installation' ? (
              execDevices.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: 'rgba(120,120,128,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Droplets size={24} color="#8E8E93" />
                  </View>
                  <Text style={{ color: '#8E8E93', fontWeight: '500', fontSize: 15, textAlign: 'center' }}>
                    אין מכשירים
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <Text
                    style={{
                      color: '#8E8E93',
                      fontWeight: '600',
                      fontSize: 13,
                      textAlign: 'right',
                      marginBottom: 2,
                      paddingHorizontal: 2,
                    }}
                  >
                    מכשירים ({execDevices.length})
                  </Text>

                  {execDevices.map((d) => {
                    const currentImageUrl = d.image_url ? getPublicUrl(d.image_url) : null;
                    const previewUri = d.localImageUri ?? currentImageUrl ?? null;
                    const hasImage = !!d.image_url;

                    return (
                      <View
                        key={d.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(60,60,67,0.06)',
                          shadowColor: '#000',
                          shadowOpacity: 0.04,
                          shadowRadius: 12,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 14,
                            paddingBottom: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: '#1C1C1E',
                              fontWeight: '700',
                              fontSize: 16,
                              textAlign: 'right',
                              letterSpacing: -0.2,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {d.device_type ?? 'מכשיר'}
                          </Text>

                          {hasImage && (
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: 'rgba(52,199,89,0.12)',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 14 }}>✓</Text>
                            </View>
                          )}
                        </View>

                        {!!previewUri ? (
                          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
                            <Image
                              source={{ uri: previewUri }}
                              style={{
                                width: '100%',
                                height: 180,
                                borderRadius: 12,
                                backgroundColor: 'rgba(120,120,128,0.08)',
                              }}
                              resizeMode="cover"
                            />
                          </View>
                        ) : (
                          <View
                            style={{
                              marginHorizontal: 14,
                              marginBottom: 12,
                              height: 100,
                              borderRadius: 12,
                              backgroundColor: 'rgba(120,120,128,0.04)',
                              borderWidth: 1.5,
                              borderColor: 'rgba(120,120,128,0.08)',
                              borderStyle: 'dashed',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <Eye size={20} color="#C7C7CC" />
                            <Text style={{ color: '#C7C7CC', fontSize: 13, fontWeight: '500' }}>
                              טרם הועלתה תמונה
                            </Text>
                          </View>
                        )}

                        {execJob.status === 'pending' ? (
                          <View
                            style={{
                              flexDirection: 'row-reverse',
                              gap: 8,
                              paddingHorizontal: 14,
                              paddingBottom: 14,
                            }}
                          >
                            <Pressable
                              onPress={() => pickExecInstallationImage(d.id)}
                              style={{ flex: 1 }}
                            >
                              {({ pressed }) => (
                                <View
                                  style={{
                                    flexDirection: 'row-reverse',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    backgroundColor: pressed
                                      ? 'rgba(120,120,128,0.16)'
                                      : 'rgba(120,120,128,0.08)',
                                    borderRadius: 12,
                                    paddingVertical: 11,
                                  }}
                                >
                                  <Eye size={15} color="#3C3C43" />
                                  <Text style={{ color: '#3C3C43', fontWeight: '600', fontSize: 14 }}>
                                    בחר תמונה
                                  </Text>
                                </View>
                              )}
                            </Pressable>

                            <Pressable
                              onPress={() => uploadExecInstallationDevice(d)}
                              disabled={!!d.uploading}
                              style={{ flex: 1, opacity: d.uploading ? 0.6 : 1 }}
                            >
                              {({ pressed }) => (
                                <View
                                  style={{
                                    flexDirection: 'row-reverse',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    backgroundColor: d.uploading
                                      ? 'rgba(0,122,255,0.06)'
                                      : pressed
                                        ? 'rgba(0,122,255,0.18)'
                                        : 'rgba(0,122,255,0.10)',
                                    borderRadius: 12,
                                    paddingVertical: 11,
                                  }}
                                >
                                  <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 14 }}>
                                    {d.uploading ? 'מעלה…' : 'העלה'}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )
            ) : null}

            {/* Special job: single image */}
            {execJob.kind === 'special' ? (
              <View style={{ gap: 12 }}>
                <Text
                  style={{
                    color: '#8E8E93',
                    fontWeight: '600',
                    fontSize: 13,
                    textAlign: 'right',
                    marginBottom: 2,
                    paddingHorizontal: 2,
                  }}
                >
                  תמונת ביצוע
                </Text>

                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(60,60,67,0.06)',
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 1,
                    overflow: 'hidden',
                  }}
                >
                  {(() => {
                    const currentImageUrl = execSpecialImageUrl ? getPublicUrl(execSpecialImageUrl) : null;
                    const previewUri = execSpecialLocalUri ?? currentImageUrl ?? null;
                    const hasImage = !!execSpecialImageUrl;

                    return (
                      <>
                        <View
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 14,
                            paddingBottom: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: '#1C1C1E',
                              fontWeight: '700',
                              fontSize: 16,
                              textAlign: 'right',
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {SPECIAL_JOB_TYPE_LABELS[(execJob as any).job_type as string] ??
                              (execJob as any).job_type ??
                              'משימה מיוחדת'}
                          </Text>

                          {hasImage && (
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: 'rgba(52,199,89,0.12)',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 14 }}>✓</Text>
                            </View>
                          )}
                        </View>

                        {!!previewUri ? (
                          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
                            <Image
                              source={{ uri: previewUri }}
                              style={{
                                width: '100%',
                                height: 180,
                                borderRadius: 12,
                                backgroundColor: 'rgba(120,120,128,0.08)',
                              }}
                              resizeMode="cover"
                            />
                          </View>
                        ) : (
                          <View
                            style={{
                              marginHorizontal: 14,
                              marginBottom: 12,
                              height: 100,
                              borderRadius: 12,
                              backgroundColor: 'rgba(120,120,128,0.04)',
                              borderWidth: 1.5,
                              borderColor: 'rgba(120,120,128,0.08)',
                              borderStyle: 'dashed',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <Eye size={20} color="#C7C7CC" />
                            <Text style={{ color: '#C7C7CC', fontSize: 13, fontWeight: '500' }}>
                              טרם הועלתה תמונה
                            </Text>
                          </View>
                        )}

                        {execJob.status === 'pending' ? (
                          <View
                            style={{
                              flexDirection: 'row-reverse',
                              gap: 8,
                              paddingHorizontal: 14,
                              paddingBottom: 14,
                            }}
                          >
                            <Pressable onPress={pickExecSpecialImage} style={{ flex: 1 }}>
                              {({ pressed }) => (
                                <View
                                  style={{
                                    flexDirection: 'row-reverse',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    backgroundColor: pressed
                                      ? 'rgba(120,120,128,0.16)'
                                      : 'rgba(120,120,128,0.08)',
                                    borderRadius: 12,
                                    paddingVertical: 11,
                                  }}
                                >
                                  <Eye size={15} color="#3C3C43" />
                                  <Text style={{ color: '#3C3C43', fontWeight: '600', fontSize: 14 }}>
                                    בחר תמונה
                                  </Text>
                                </View>
                              )}
                            </Pressable>

                            <Pressable
                              onPress={uploadExecSpecialImage}
                              disabled={execSpecialUploading}
                              style={{ flex: 1, opacity: execSpecialUploading ? 0.6 : 1 }}
                            >
                              {({ pressed }) => (
                                <View
                                  style={{
                                    flexDirection: 'row-reverse',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    backgroundColor: execSpecialUploading
                                      ? 'rgba(0,122,255,0.06)'
                                      : pressed
                                        ? 'rgba(0,122,255,0.18)'
                                        : 'rgba(0,122,255,0.10)',
                                    borderRadius: 12,
                                    paddingVertical: 11,
                                  }}
                                >
                                  <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 14 }}>
                                    {execSpecialUploading ? 'מעלה…' : 'העלה'}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          </View>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              </View>
            ) : null}

            {/* Complete button */}
            <View style={{ marginTop: 24 }}>
              {execJob.status === 'completed' ? (
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: 'rgba(52,199,89,0.10)',
                    borderRadius: 14,
                    paddingVertical: 16,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#34C759',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>✓</Text>
                  </View>
                  <Text style={{ color: '#248A3D', fontWeight: '700', fontSize: 16 }}>המשימה הושלמה</Text>
                </View>
              ) : (
                <Pressable
                  onPress={completeExecJob}
                  disabled={!isExecCompletable}
                  style={({ pressed }) => ({
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: !isExecCompletable
                      ? 'rgba(0,122,255,0.35)'
                      : pressed
                        ? 'rgba(0,122,255,0.85)'
                        : '#007AFF',
                    borderRadius: 14,
                    paddingVertical: 16,
                    shadowColor: '#007AFF',
                    shadowOpacity: !isExecCompletable ? 0 : 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: !isExecCompletable ? 0 : 4,
                  })}
                >
                  <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                  <Text
                    style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17, letterSpacing: -0.2 }}
                  >
                    סיים משימה
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}
      </OriginWindow>
    </View>
  );
}
