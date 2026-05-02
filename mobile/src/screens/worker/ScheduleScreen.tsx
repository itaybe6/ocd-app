import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  I18nManager,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { svgPathProperties } from 'svg-path-properties';
import { addDays } from 'date-fns';
import {
  Battery,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  ImagePlus,
  Layers,
  MapPin,
  Package,
  Phone,
  Sparkles,
  X,
} from 'lucide-react-native';
import { OriginWindow, type OriginRect } from '../../components/OriginWindow';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { yyyyMmDd } from '../../lib/time';
import { useAuth } from '../../state/AuthContext';
import { useLoading } from '../../state/LoadingContext';
import { getPublicUrl } from '../../lib/storage';
import { pickImageFromLibrary } from '../../lib/media';
import {
  completeUnifiedJob,
  uploadInstallationDeviceImage,
  uploadJobServicePointImage,
  uploadSpecialJobImage,
} from '../../lib/execution';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/** Worker schedule execute morph — shorter than default + opens before fetch (see `openExecute`). */
const SCHEDULE_EXEC_ORIGIN_MS = 280;

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  customer_id?: string | null;
  one_time_customer_id?: string | null;
  order_number?: number | null;
  notes?: string | null;
};

type UserLite = {
  id: string;
  name: string;
  avatar_url?: string | null;
  phone?: string | null;
  address?: string | null;
};
type OneTimeCustomerLite = { id: string; name: string; phone?: string | null; address?: string | null };

type JobServicePoint = {
  id: string;
  job_id: string;
  service_point_id: string;
  image_url?: string | null;
  custom_refill_amount?: number | null;
};
type ServicePoint = {
  id: string;
  device_type: string;
  scent_type: string;
  refill_amount: number;
  notes?: string | null;
};
type InstallationDevice = {
  id: string;
  installation_job_id: string;
  device_type?: string | null;
  image_url?: string | null;
};
type SpecialJob = {
  id: string;
  battery_type?: 'AA' | 'DC' | null;
  job_type?: string | null;
  image_url?: string | null;
};

const KIND_CONFIG = {
  regular:      { label: 'רגילה',  color: colors.primary },
  installation: { label: 'התקנה',  color: '#7C3AED'      },
  special:      { label: 'מיוחדת', color: '#EA580C'      },
} as const;

const INSTALL_ACCENT = '#7C3AED';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatHm(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseTimeToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Each job service point row = one physical point / device unit in the app model. */
function devicesAtPointsLabel(n: number): string {
  if (n <= 0) return '—';
  if (n === 1) return 'מכשיר אחד';
  return `${n} מכשירים`;
}

// ── Animated donut ───────────────────────────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path);

type AnimatedDonutProps = {
  width?: number;
  height?: number;
  radius?: number;
  strokeColor?: string;
  strokeInactiveColor?: string;
  strokeWidth?: number;
  current?: number;
  max?: number;
  duration?: number;
  delay?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function AnimatedDonut({
  width = 100,
  height = 144,
  radius = 100 * 0.4,
  strokeColor = colors.primary,
  strokeInactiveColor = '#E5E7EB',
  strokeWidth = 12,
  current = 0,
  max = 1,
  duration = 500,
  delay = 500,
  children,
  style,
}: AnimatedDonutProps) {
  const safeMax = max <= 0 ? 1 : max;
  const safeCurrent = Math.max(0, Math.min(current, safeMax));

  const d = `
    M ${width / 2} 0
    H ${width - radius}
    C ${width} 0, ${width} ${radius}, ${width} ${radius}
    V ${height - radius}
    C ${width} ${height}, ${width - radius} ${height}, ${width - radius} ${height}
    H ${radius}
    C 0 ${height}, 0 ${height - radius}, 0 ${height - radius}
    V ${radius}
    C 0 0, ${radius} 0, ${radius} 0
    H ${width / 2}
  `;

  const wRatio = strokeWidth ? 1 - strokeWidth / width : 1;
  const hRatio = strokeWidth ? 1 - strokeWidth / height : 1;

  const properties = new svgPathProperties(d);
  const length = properties.getTotalLength();
  const animatedValue = useSharedValue(length);

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(length - (safeCurrent * length) / safeMax, { duration }),
    );
  }, [delay, duration, length, safeCurrent, safeMax]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedValue.value,
  }));

  return (
    <View style={[style, { width, height }]}>
      <Svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <Path
          originX={width / 2}
          originY={height / 2}
          scaleX={wRatio}
          scaleY={hRatio}
          strokeWidth={strokeWidth}
          d={d}
          fill="transparent"
          stroke={strokeInactiveColor}
          strokeLinejoin="miter"
          strokeMiterlimit={0}
        />
        <AnimatedPath
          originX={width / 2}
          originY={height / 2}
          scaleX={wRatio}
          scaleY={hRatio}
          strokeWidth={strokeWidth}
          d={d}
          fill="transparent"
          stroke={strokeColor}
          strokeDasharray={length}
          strokeLinejoin="miter"
          strokeMiterlimit={0}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      <View
        style={{
          top: strokeWidth,
          left: strokeWidth,
          right: strokeWidth,
          bottom: strokeWidth,
          position: 'absolute',
          borderRadius: radius - strokeWidth * 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export function WorkerScheduleScreen() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const insets = useSafeAreaInsets();

  const [day, setDay] = useState(yyyyMmDd(new Date()));
  // Calendar view date — drives the displayed week/month only; doesn't trigger task fetching.
  const [viewDate, setViewDate] = useState(yyyyMmDd(new Date()));
  const [items, setItems] = useState<Unified[]>([]);
  const [customers, setCustomers] = useState<UserLite[]>([]);
  const [oneTimeCustomers, setOneTimeCustomers] = useState<OneTimeCustomerLite[]>([]);
  const [loading, setLoading] = useState(false);

  const [daySummary, setDaySummary] = useState<{
    scent: { key: string; amount: number }[];
    equipmentCount: number;
    batteries: { key: string; count: number }[];
  }>({ scent: [], equipmentCount: 0, batteries: [] });

  /** Per regular job: aggregated scent types → total ml for that job’s service points */
  const [jobScentSummaries, setJobScentSummaries] = useState<Record<string, { key: string; deviceCount: number }[]>>({});

  // Execute task — OriginWindow (same morph pattern as WorkerJobsScreen)
  const [execJob, setExecJob] = useState<Unified | null>(null);
  const [execOpen, setExecOpen] = useState(false);
  const [execOriginRect, setExecOriginRect] = useState<OriginRect | null>(null);
  const execOriginRectRef = useRef<OriginRect | null>(null);
  const execCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskRowRefs = useRef<Map<string, View>>(new Map());

  const [regularPoints, setRegularPoints] = useState<
    (JobServicePoint & { sp?: ServicePoint | null; localImageUri?: string | null; uploading?: boolean })[]
  >([]);
  const [installationDevices, setInstallationDevices] = useState<
    (InstallationDevice & { localImageUri?: string | null; uploading?: boolean })[]
  >([]);
  const [special, setSpecial] = useState<
    (SpecialJob & { localImageUri?: string | null; uploading?: boolean }) | null
  >(null);

  const customerMap = useMemo(() => new Map(customers.map((u) => [u.id, u.name])), [customers]);
  const customerById = useMemo(() => new Map(customers.map((u) => [u.id, u])), [customers]);
  const oneTimeMap = useMemo(() => new Map(oneTimeCustomers.map((c) => [c.id, c.name])), [oneTimeCustomers]);
  const oneTimeById = useMemo(() => new Map(oneTimeCustomers.map((c) => [c.id, c])), [oneTimeCustomers]);

  const parsedView = useMemo(() => {
    const d = new Date(`${viewDate}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [viewDate]);

  const todayStr = useMemo(() => yyyyMmDd(new Date()), []);

  const weekDates = useMemo(() => {
    const dow = parsedView.getDay();
    const sunday = addDays(parsedView, -dow);
    return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  }, [parsedView]);

  const weekScrollRef = useRef<ScrollView>(null);
  const [weekScrollWidth, setWeekScrollWidth] = useState(
    () => Dimensions.get('window').width - 26,
  );

  // In RTL: page 0 (left) = next week, page 2 (right) = previous week
  const threeWeeks = useMemo(
    () => [
      Array.from({ length: 7 }, (_, i) => addDays(weekDates[0], i + 7)),
      weekDates,
      Array.from({ length: 7 }, (_, i) => addDays(weekDates[0], i - 7)),
    ],
    [weekDates],
  );

  useEffect(() => {
    weekScrollRef.current?.scrollTo({ x: weekScrollWidth, animated: false });
  }, [weekDates, weekScrollWidth]);

  const calMonthLabel = useMemo(
    () => `${HE_MONTHS[parsedView.getMonth()]} ${parsedView.getFullYear()}`,
    [parsedView],
  );

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === 'completed').length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [items]);

  const oilTotals = useMemo(() => {
    const totalMl = daySummary.scent.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const liters = totalMl / 1000;
    const maxLiters = Math.max(20, Math.ceil(liters / 5) * 5 || 20);
    return { totalMl, liters, maxLiters };
  }, [daySummary.scent]);

  const fetchCustomers = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setCustomers([]);
      return;
    }
    const uniqueIds = Array.from(new Set(ids));
    const { data, error } = await supabase
      .from('users')
      .select('id, name, avatar_url, phone, address')
      .in('id', uniqueIds);
    if (!error) setCustomers((data ?? []) as any);
  }, []);

  const fetchOneTimeCustomers = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setOneTimeCustomers([]);
      return;
    }
    const uniqueIds = Array.from(new Set(ids));
    const { data, error } = await supabase
      .from('one_time_customers')
      .select('id, name, phone, address')
      .in('id', uniqueIds);
    if (!error) setOneTimeCustomers((data ?? []) as any);
  }, []);

  const fetchDay = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const [regRes, instRes, specRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, date, status, customer_id, one_time_customer_id, order_number, notes')
          .eq('worker_id', user.id)
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('installation_jobs')
          .select('id, date, status, customer_id, one_time_customer_id, order_number, notes, device_type')
          .eq('worker_id', user.id)
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('special_jobs')
          .select('id, date, status, customer_id, one_time_customer_id, order_number, notes')
          .eq('worker_id', user.id)
          .gte('date', start)
          .lte('date', end),
      ]);

      if (regRes.error) throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      const regs = (regRes.data ?? []).map((r: any) => ({ kind: 'regular', ...r }) as Unified);
      const insts = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const specs = (specRes.data ?? []).map((r: any) => ({ kind: 'special', ...r }) as Unified);

      const combined = [...regs, ...insts, ...specs].sort((a, b) => {
        const ao = a.order_number == null ? 1e9 : a.order_number;
        const bo = b.order_number == null ? 1e9 : b.order_number;
        if (ao !== bo) return ao - bo;
        return parseTimeToMinutes(a.date) - parseTimeToMinutes(b.date);
      });

      setItems(combined);

      const customerIds = combined.map((x) => x.customer_id).filter(Boolean) as string[];
      const oneTimeIds = combined.map((x) => x.one_time_customer_id).filter(Boolean) as string[];
      fetchCustomers(customerIds);
      fetchOneTimeCustomers(oneTimeIds);

      // Daily summaries — count ALL tasks of the day (pending + completed)
      const regularIds = combined.filter((x) => x.kind === 'regular').map((r) => r.id);
      const installationIds = combined.filter((x) => x.kind === 'installation').map((r) => r.id);
      const specialIds = combined.filter((x) => x.kind === 'special').map((r) => r.id);

      const safe = async <T,>(p: PromiseLike<{ data: T | null; error: any }>, fallback: T) => {
        const res = await p;
        if (res?.error) return fallback;
        return (res.data ?? fallback) as T;
      };

      let scentRows: { job_id: string; service_point_id: string; custom_refill_amount?: number | null }[] = [];
      if (regularIds.length) {
        scentRows = await safe(
          supabase
            .from('job_service_points')
            .select('job_id, service_point_id, custom_refill_amount')
            .in('job_id', regularIds),
          [],
        );
      }
      const spIds = Array.from(new Set(scentRows.map((r) => r.service_point_id)));
      const spData = spIds.length
        ? await safe(
            supabase.from('service_points').select('id, scent_type, refill_amount').in('id', spIds),
            [],
          )
        : [];
      const spMap = new Map((spData as any[]).map((sp) => [sp.id as string, sp]));
      const scentMap = new Map<string, number>();
      const perJobDevicesByScent = new Map<string, Map<string, number>>();
      const NO_NAME_KEY = '__no_name__';
      for (const r of scentRows) {
        const sp = spMap.get(r.service_point_id);
        const raw = String(sp?.scent_type ?? '').trim();
        const isMissing = !raw || raw.toLowerCase() === 'unknown';
        const key = isMissing ? NO_NAME_KEY : raw;
        const amt = Number(r.custom_refill_amount ?? sp?.refill_amount ?? 0);
        if (amt) {
          scentMap.set(key, (scentMap.get(key) ?? 0) + amt);
        }
        if (!perJobDevicesByScent.has(r.job_id)) perJobDevicesByScent.set(r.job_id, new Map());
        const jm = perJobDevicesByScent.get(r.job_id)!;
        jm.set(key, (jm.get(key) ?? 0) + 1);
      }
      const jobScentRecord: Record<string, { key: string; deviceCount: number }[]> = {};
      for (const [jid, jm] of perJobDevicesByScent) {
        jobScentRecord[jid] = Array.from(jm.entries())
          .map(([key, deviceCount]) => ({ key, deviceCount }))
          .sort((a, b) => b.deviceCount - a.deviceCount);
      }
      setJobScentSummaries(jobScentRecord);

      const instDevices = installationIds.length
        ? await safe(
            supabase.from('installation_devices').select('id').in('installation_job_id', installationIds),
            [],
          )
        : [];

      const specRows = specialIds.length
        ? await safe(
            supabase.from('special_jobs').select('id, job_type, battery_type').in('id', specialIds),
            [],
          )
        : [];
      const batteryMap = new Map<string, number>();
      for (const r of specRows as any[]) {
        if (!r?.battery_type) continue;
        const key = String(r.battery_type);
        batteryMap.set(key, (batteryMap.get(key) ?? 0) + 1);
      }

      setDaySummary({
        scent: Array.from(scentMap.entries())
          .map(([key, amount]) => ({ key, amount }))
          .sort((a, b) => b.amount - a.amount),
        equipmentCount: (instDevices as any[]).length,
        batteries: Array.from(batteryMap.entries()).map(([key, count]) => ({ key, count })),
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [day, user?.id, fetchCustomers, fetchOneTimeCustomers]);

  useFocusEffect(
    useCallback(() => {
      fetchDay();
    }, [fetchDay]),
  );

  const customerLabel = useCallback(
    (x: Unified) => {
      if (x.customer_id) return customerMap.get(x.customer_id) ?? x.customer_id.slice(0, 6);
      if (x.one_time_customer_id) return oneTimeMap.get(x.one_time_customer_id) ?? x.one_time_customer_id.slice(0, 6);
      return '—';
    },
    [customerMap, oneTimeMap],
  );

  const customerAddressLine = useCallback(
    (x: Unified): string | null => {
      if (x.customer_id) {
        const u = customerById.get(x.customer_id);
        const a = String(u?.address ?? '').trim();
        return a.length ? a : null;
      }
      if (x.one_time_customer_id) {
        const o = oneTimeById.get(x.one_time_customer_id);
        const a = String(o?.address ?? '').trim();
        return a.length ? a : null;
      }
      return null;
    },
    [customerById, oneTimeById],
  );

  const customerPhoneRaw = useCallback(
    (x: Unified): string | null => {
      if (x.customer_id) {
        const u = customerById.get(x.customer_id);
        const p = String(u?.phone ?? '').trim();
        return p.length ? p : null;
      }
      if (x.one_time_customer_id) {
        const o = oneTimeById.get(x.one_time_customer_id);
        const p = String(o?.phone ?? '').trim();
        return p.length ? p : null;
      }
      return null;
    },
    [customerById, oneTimeById],
  );

  const dialCustomerPhone = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const url = `tel:${trimmed.replace(/\s+/g, '')}`;
    void Linking.openURL(url).catch(() => {
      Toast.show({ type: 'error', text1: 'לא ניתן לחייג', text2: 'בדקו שהמספר תקין' });
    });
  }, []);

  const closeExec = useCallback(() => {
    setExecOpen(false);
    if (execCloseTimerRef.current) clearTimeout(execCloseTimerRef.current);
    execCloseTimerRef.current = setTimeout(() => {
      setExecJob(null);
      setRegularPoints([]);
      setInstallationDevices([]);
      setSpecial(null);
      setExecOriginRect(null);
      execOriginRectRef.current = null;
    }, SCHEDULE_EXEC_ORIGIN_MS + 48);
  }, []);

  // ── Open execute window (OriginWindow morph from task row, like WorkerJobsScreen) ──
  const openExecute = useCallback(async (it: Unified) => {
    setExecOriginRect(execOriginRectRef.current);
    setExecJob(it);
    setExecOpen(false);
    setRegularPoints([]);
    setInstallationDevices([]);
    setSpecial(null);

    // Open immediately on next tick so the morph starts while Supabase loads (same pattern as WorkerJobsScreen).
    setTimeout(() => setExecOpen(true), 0);

    try {
      if (it.kind === 'regular') {
        const { data: jsp, error } = await supabase
          .from('job_service_points')
          .select('id, job_id, service_point_id, image_url, custom_refill_amount')
          .eq('job_id', it.id);
        if (error) throw error;
        const rows = (jsp ?? []) as JobServicePoint[];
        const spIds = rows.map((r) => r.service_point_id);
        let spMap = new Map<string, ServicePoint>();
        if (spIds.length) {
          const { data: sps, error: spErr } = await supabase
            .from('service_points')
            .select('id, device_type, scent_type, refill_amount, notes')
            .in('id', spIds);
          if (spErr) throw spErr;
          spMap = new Map(((sps ?? []) as ServicePoint[]).map((sp) => [sp.id, sp]));
        }
        setRegularPoints(
          rows.map((r) => ({
            ...r,
            sp: spMap.get(r.service_point_id) ?? null,
            localImageUri: null,
            uploading: false,
          })),
        );
      }

      if (it.kind === 'installation') {
        const { data, error } = await supabase
          .from('installation_devices')
          .select('id, installation_job_id, device_type, image_url')
          .eq('installation_job_id', it.id);
        if (error) throw error;
        setInstallationDevices(
          ((data ?? []) as InstallationDevice[]).map((d) => ({ ...d, localImageUri: null, uploading: false })),
        );
      }

      if (it.kind === 'special') {
        const { data, error } = await supabase
          .from('special_jobs')
          .select('id, battery_type, job_type, image_url')
          .eq('id', it.id)
          .single();
        if (error) throw error;
        setSpecial({ ...(data as SpecialJob), localImageUri: null, uploading: false });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת פרטים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  }, []);

  const pick = async (onPicked: (uri: string) => void) => {
    const uri = await pickImageFromLibrary();
    if (uri) onPicked(uri);
  };

  const removeRegularImage = (id: string) => {
    setRegularPoints((prev) =>
      prev.map((x) => (x.id === id ? { ...x, localImageUri: null, image_url: null } : x)),
    );
  };

  const removeInstallationImage = (id: string) => {
    setInstallationDevices((prev) =>
      prev.map((x) => (x.id === id ? { ...x, localImageUri: null, image_url: null } : x)),
    );
  };

  const removeSpecialImage = () => {
    setSpecial((p) => (p ? { ...p, localImageUri: null, image_url: null } : p));
  };

  const complete = async () => {
    if (!execJob) return;
    try {
      setIsLoading(true);

      // Upload any locally-picked images before completing the job.
      if (execJob.kind === 'regular') {
        const snapshot = [...regularPoints];
        for (const p of snapshot) {
          if (p.localImageUri) {
            const storagePath = await uploadJobServicePointImage({
              jobId: execJob.id,
              jobServicePointId: p.id,
              servicePointId: p.service_point_id,
              localUri: p.localImageUri,
            });
            setRegularPoints((prev) =>
              prev.map((x) =>
                x.id === p.id ? { ...x, image_url: storagePath, localImageUri: null } : x,
              ),
            );
          }
        }
      } else if (execJob.kind === 'installation') {
        const snapshot = [...installationDevices];
        for (const d of snapshot) {
          if (d.localImageUri) {
            const storagePath = await uploadInstallationDeviceImage({
              installationJobId: execJob.id,
              installationDeviceId: d.id,
              localUri: d.localImageUri,
            });
            setInstallationDevices((prev) =>
              prev.map((x) =>
                x.id === d.id ? { ...x, image_url: storagePath, localImageUri: null } : x,
              ),
            );
          }
        }
      } else if (execJob.kind === 'special' && special?.localImageUri) {
        const storagePath = await uploadSpecialJobImage({
          specialJobId: special.id,
          localUri: special.localImageUri,
        });
        setSpecial((p) => (p ? { ...p, image_url: storagePath, localImageUri: null } : p));
      }

      await completeUnifiedJob(execJob.kind, execJob.id);
      setItems((prev) =>
        prev.map((x) =>
          x.kind === execJob.kind && x.id === execJob.id ? { ...x, status: 'completed' } : x,
        ),
      );
      Toast.show({ type: 'success', text1: 'המשימה הושלמה' });
      closeExec();
      fetchDay();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const summaries = useMemo(() => {
    const scent = new Map<string, number>();
    for (const p of regularPoints) {
      const st = p.sp?.scent_type ?? 'unknown';
      const amt = p.custom_refill_amount ?? p.sp?.refill_amount ?? 0;
      scent.set(st, (scent.get(st) ?? 0) + Number(amt));
    }
    const battery = new Map<string, number>();
    if (special?.battery_type) battery.set(special.battery_type, 1);
    return {
      scent: Array.from(scent.entries()).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v),
      equipmentCount: installationDevices.length,
      batteries: Array.from(battery.entries()).map(([k, v]) => ({ k, v })),
    };
  }, [regularPoints, installationDevices.length, special?.battery_type]);

  const isExecCompletable = useMemo(() => {
    if (!execJob) return false;
    if (execJob.status !== 'pending') return false;
    if (execJob.kind === 'regular') {
      if (!regularPoints.length) return true;
      return regularPoints.every((p) => !!p.image_url || !!p.localImageUri);
    }
    if (execJob.kind === 'installation') {
      if (!installationDevices.length) return true;
      return installationDevices.every((d) => !!d.image_url || !!d.localImageUri);
    }
    if (execJob.kind === 'special') {
      return !!special?.image_url || !!special?.localImageUri;
    }
    return false;
  }, [execJob, regularPoints, installationDevices, special?.image_url, special?.localImageUri]);

  // ── List header (calendar + oil card) ────
  const listHeader = useMemo(
    () => (
      <View style={{ gap: 11 }}>
        {/* ── Calendar Card ─────────────────────────────── */}
        <View style={st.calCard}>
          <View style={st.calMonthRow}>
            {/* RTL: left button = next month (changes view only) */}
            <Pressable
              onPress={() => {
                const d = new Date(`${viewDate}T00:00:00`);
                d.setDate(1);
                d.setMonth(d.getMonth() + 1);
                setViewDate(yyyyMmDd(d));
              }}
              style={({ pressed }) => [st.calNavBtn, pressed && { opacity: 0.5 }]}
              hitSlop={8}
            >
              <ChevronLeft size={18} color={colors.text} strokeWidth={2.5} />
            </Pressable>

            <Pressable
              onPress={() => {
                setViewDate(todayStr);
                setDay(todayStr);
              }}
              style={({ pressed }) => [st.calMonthLabelWrap, pressed && { opacity: 0.75 }]}
            >
              <Text style={st.calMonthText}>{calMonthLabel}</Text>
            </Pressable>

            {/* RTL: right button = previous month (changes view only) */}
            <Pressable
              onPress={() => {
                const d = new Date(`${viewDate}T00:00:00`);
                d.setDate(1);
                d.setMonth(d.getMonth() - 1);
                setViewDate(yyyyMmDd(d));
              }}
              style={({ pressed }) => [st.calNavBtn, pressed && { opacity: 0.5 }]}
              hitSlop={8}
            >
              <ChevronRight size={18} color={colors.text} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Day-of-week labels */}
          <View style={st.calDowRow}>
            {HE_DAYS.map((label) => (
              <View key={label} style={st.calDowCell}>
                <Text style={st.calDowText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Week strip – swipeable */}
          <ScrollView
            ref={weekScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setWeekScrollWidth(w);
            }}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              if (!weekScrollWidth) return;
              const page = Math.round(x / weekScrollWidth);
              // RTL: left page (0) = next week, right page (2) = previous week.
              // Only updates the visible week — does NOT trigger task fetching.
              if (page === 0) setViewDate(yyyyMmDd(addDays(parsedView, 7)));
              else if (page === 2) setViewDate(yyyyMmDd(addDays(parsedView, -7)));
            }}
          >
            {threeWeeks.map((week, pageIdx) => (
              <View key={pageIdx} style={[st.calWeekPage, { width: weekScrollWidth }]}>
                {week.map((d) => {
                  const ds = yyyyMmDd(d);
                  const isDayPicked = ds === day;
                  const isToday = ds === todayStr;
                  const isOtherMonth = d.getMonth() !== parsedView.getMonth();
                  return (
                    <Pressable
                      key={ds}
                      onPress={() => {
                        setDay(ds);
                        setViewDate(ds);
                      }}
                      style={st.calDayCell}
                    >
                      <View
                        style={[
                          st.calDayBubble,
                          isDayPicked && st.calDayBubbleSel,
                          isToday && !isDayPicked && st.calDayBubbleToday,
                        ]}
                      >
                        <Text
                          style={[
                            st.calDayNum,
                            isDayPicked && st.calDayNumSel,
                            isToday && !isDayPicked && st.calDayNumToday,
                            isOtherMonth && !isDayPicked && st.calDayNumFaded,
                          ]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                      <View style={[st.calDayDot, isDayPicked && st.calDayDotVisible]} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={st.calPrettyRow}>
            <View style={st.calStatsRow}>
              <View style={st.calStatItem}>
                <Text style={st.calStatNumber}>{stats.completed}</Text>
                <Text style={st.calStatLabel}>הושלמו</Text>
              </View>
              <View style={st.calStatDivider} />
              <View style={st.calStatItem}>
                <Text style={st.calStatNumber}>{stats.pending}</Text>
                <Text style={st.calStatLabel}>ממתינות</Text>
              </View>
              <View style={st.calStatDivider} />
              <View style={st.calStatItem}>
                <Text style={st.calStatNumber}>{stats.total}</Text>
                <Text style={st.calStatLabel}>סה״כ</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Oil card (light theme) ────────────────────── */}
        <View style={st.oilCard}>
          <View style={st.oilHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.oilTitle}>שמן להיום</Text>
              <Text style={st.oilSubtitle}>
                לפי סך המילויים בעבודות של היום • {items.length} משימות
              </Text>
            </View>
            <AnimatedDonut
              current={Number(oilTotals.liters.toFixed(2))}
              max={oilTotals.maxLiters}
              strokeColor={colors.primary}
              strokeInactiveColor="#EEF2F7"
              strokeWidth={6}
              width={78}
              height={108}
              radius={78 * 0.4}
              delay={350}
              duration={550}
            >
              <View style={st.oilDonutInner}>
                <Text style={st.oilDonutValue}>{oilTotals.liters.toFixed(1)}</Text>
                <View style={st.oilDivider} />
                <Text style={st.oilDonutMax}>{oilTotals.maxLiters}L</Text>
              </View>
            </AnimatedDonut>
          </View>

          <View style={st.oilMetaRow}>
            <View style={st.oilMetaPill}>
              <Text style={st.oilMetaLabel}>סה״כ</Text>
              <Text style={st.oilMetaValue}>{Math.round(oilTotals.totalMl)} מ״ל</Text>
            </View>
            <View style={st.oilMetaPill}>
              <Text style={st.oilMetaLabel}>התקנות</Text>
              <Text style={st.oilMetaValue}>{daySummary.equipmentCount} ציוד</Text>
            </View>
            <View style={st.oilMetaPill}>
              <Text style={st.oilMetaLabel}>סוללות</Text>
              <Text style={st.oilMetaValue}>
                {daySummary.batteries.map((b) => `${b.key}:${b.count}`).join(' • ') || '—'}
              </Text>
            </View>
          </View>

          {daySummary.scent.length ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={st.oilBreakdownTitle}>פירוט לפי ניחוח</Text>
              <View style={{ gap: 4 }}>
                {daySummary.scent.slice(0, 5).map((s) => (
                  <View key={s.key} style={st.oilBreakdownRow}>
                    <Text style={st.oilBreakdownValue}>{Math.round(s.amount)} מ״ל</Text>
                    <Text style={st.oilBreakdownKey}>{s.key}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

      </View>
    ),
    [
      calMonthLabel,
      day,
      viewDate,
      items.length,
      parsedView,
      stats,
      threeWeeks,
      todayStr,
      weekScrollWidth,
      daySummary,
      oilTotals,
    ],
  );

  return (
    <View style={st.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={st.listContent}
        refreshing={loading}
        onRefresh={fetchDay}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => {
          const isCompleted = item.status === 'completed';
          const kindConf = KIND_CONFIG[item.kind];
          const customer = customerLabel(item);
          const addressLine = customerAddressLine(item);
          const phone = customerPhoneRaw(item);
          const rowKey = `${item.kind}:${item.id}`;
          const scents = item.kind === 'regular' ? jobScentSummaries[item.id] : undefined;

          const taskTagsTop = (
            <View style={st.taskTagsCluster}>
              <View style={st.taskMetaRow}>
                <View style={st.taskTimePill}>
                  <Text style={st.taskTimeText}>{formatHm(item.date)}</Text>
                </View>
                <View style={st.kindChip}>
                  <Text style={st.kindChipText}>{kindConf.label}</Text>
                </View>
                <View style={st.statusChip}>
                  <View
                    style={[
                      st.statusDot,
                      { backgroundColor: isCompleted ? '#34C759' : '#FF9500' },
                    ]}
                  />
                  <Text style={st.statusChipText}>
                    {isCompleted ? 'הושלם' : 'ממתין'}
                  </Text>
                </View>
              </View>
            </View>
          );

          const taskCustomerTop = (
            <View style={st.taskHeaderCustomer}>
              <Text style={st.taskCustomer} numberOfLines={1}>
                {customer}
              </Text>
              {addressLine ? (
                <View style={st.taskAddressRow}>
                  <View style={st.taskAddressIconWrap}>
                    <MapPin size={11} color={colors.primary} strokeWidth={2.6} />
                  </View>
                  <Text style={st.taskAddressText} numberOfLines={2}>
                    {addressLine}
                  </Text>
                </View>
              ) : null}
            </View>
          );

          return (
            <Pressable
              onPressIn={() => {
                const v = taskRowRefs.current.get(rowKey);
                v?.measureInWindow((x, y, w, h) => {
                  if (w > 0 && h > 0) {
                    execOriginRectRef.current = { x, y, width: w, height: h, borderRadius: 20 };
                  }
                });
              }}
              onPress={() => void openExecute(item)}
              accessibilityRole="button"
              accessibilityLabel={`משימה: ${customer}`}
              style={({ pressed }) => [
                st.taskWrap,
                isCompleted && { opacity: 0.68 },
                pressed && { opacity: 0.95 },
              ]}
            >
              <View
                ref={(el) => {
                  if (el) taskRowRefs.current.set(rowKey, el);
                  else taskRowRefs.current.delete(rowKey);
                }}
                collapsable={false}
                style={st.taskInner}
              >
                <View style={st.taskBody}>
                  {/* Top row: tags top-left, customer + address top-right (order swaps with I18nManager.isRTL) */}
                  <View style={st.taskTopRow}>
                    {I18nManager.isRTL ? (
                      <>
                        {taskCustomerTop}
                        {taskTagsTop}
                      </>
                    ) : (
                      <>
                        {taskTagsTop}
                        {taskCustomerTop}
                      </>
                    )}
                  </View>

                  {!!item.notes && (
                    <Text style={st.taskNotes} numberOfLines={2}>
                      {item.notes}
                    </Text>
                  )}

                  {!!scents?.length && (
                    <View style={st.taskScentBlock}>
                      <View style={st.taskScentChipsRow}>
                        {scents.map((s) => {
                          const isMissingName = s.key === '__no_name__';
                          return (
                            <View key={s.key} style={st.taskScentChip}>
                              <View style={st.taskScentChipIcon}>
                                <Droplets size={11} color={colors.primary} strokeWidth={2.4} />
                              </View>
                              <View style={st.taskScentChipBody}>
                                <Text style={st.taskScentChipAmount}>{devicesAtPointsLabel(s.deviceCount)}</Text>
                                <Text style={st.taskScentChipName} numberOfLines={1}>
                                  {isMissingName ? 'ללא שם ניחוח' : s.key}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Footer: phone bottom-left (RTL: flex-end) */}
                  {phone ? (
                    <View style={st.taskFooter}>
                      <Pressable
                        onPress={() => dialCustomerPhone(phone)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="חיוג ללקוח"
                        style={({ pressed }) => [
                          st.taskPhoneBtn,
                          pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] },
                        ]}
                      >
                        <Phone size={16} color="#FFFFFF" strokeWidth={2.6} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIconWrap}>
              <CalendarDays size={26} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text style={st.emptyTitle}>אין משימות ליום הזה</Text>
            <Text style={st.emptySubtitle}>בחר תאריך אחר או רענן את המסך</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Execute task — OriginWindow (same morph as WorkerJobsScreen) ── */}
      <OriginWindow
        visible={execOpen}
        originRect={execOriginRect}
        onClose={closeExec}
        durationMs={SCHEDULE_EXEC_ORIGIN_MS}
        deferOpenByOneFrame={false}
        openedHeight={Math.min(screenHeight * 0.86, screenHeight - 40)}
        openedWidth={Math.min(screenWidth * 0.94, 440)}
      >
        {!!execJob && (() => {
          const phoneRaw = customerPhoneRaw(execJob);
          const addressLine = customerAddressLine(execJob);
          const kindColor = KIND_CONFIG[execJob.kind].color;
          const kindLabel = KIND_CONFIG[execJob.kind].label;
          const isCompleted = execJob.status === 'completed';
          const hasContact = !!phoneRaw || !!addressLine || !!execJob.one_time_customer_id;
          const hasQuickStats =
            (execJob.kind === 'regular' && regularPoints.length > 0) ||
            execJob.kind === 'installation' ||
            (execJob.kind === 'special' && !!special);

          return (
          <View style={{ flex: 1, minHeight: 0 }}>
            {/* ── Hero header ─────────────────────────── */}
            <View style={st.heroCard}>
              <View style={st.heroTopRow}>
                <View style={st.heroNameWrap}>
                  <Text style={st.heroName} numberOfLines={1}>
                    {customerLabel(execJob)}
                  </Text>
                  <View style={st.heroBadgeRow}>
                    <View style={st.heroTimePill}>
                      <Clock size={11} color="#1E3A8A" strokeWidth={2.4} />
                      <Text style={st.heroTimeText}>{formatHm(execJob.date)}</Text>
                    </View>
                    <View
                      style={[
                        st.heroKindPill,
                        {
                          backgroundColor: `${kindColor}15`,
                          borderColor: `${kindColor}30`,
                        },
                      ]}
                    >
                      <Text style={[st.heroKindText, { color: kindColor }]}>{kindLabel}</Text>
                    </View>
                    <View style={st.heroStatusPill}>
                      <View
                        style={[
                          st.heroStatusDot,
                          { backgroundColor: isCompleted ? '#16A34A' : '#F59E0B' },
                        ]}
                      />
                      <Text
                        style={[
                          st.heroStatusText,
                          { color: isCompleted ? '#16A34A' : '#B45309' },
                        ]}
                      >
                        {isCompleted ? 'הושלם' : 'ממתין'}
                      </Text>
                    </View>
                    {execJob.order_number != null && (
                      <View style={st.heroOrderPill}>
                        <Text style={st.heroOrderText}>#{execJob.order_number}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[st.heroAvatar, { backgroundColor: kindColor }]}>
                  {execJob.kind === 'regular' ? (
                    <Droplets size={22} color="#fff" strokeWidth={2.5} />
                  ) : execJob.kind === 'installation' ? (
                    <Package size={22} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <Sparkles size={22} color="#fff" strokeWidth={2.5} />
                  )}
                </View>
              </View>
              {!!execJob.one_time_customer_id && (
                <View style={st.heroOneTimeBanner}>
                  <Text style={st.heroOneTimeText}>לקוח חד־פעמי</Text>
                </View>
              )}
            </View>

            {/* Scrollable content */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ marginTop: 12, flex: 1, minHeight: 0 }}
              contentContainerStyle={{ paddingBottom: 12, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Contact card ─────────────────────── */}
              {hasContact && (
                <View style={st.contactCard}>
                  {phoneRaw ? (
                    <Pressable
                      onPress={() => dialCustomerPhone(phoneRaw)}
                      accessibilityRole="button"
                      accessibilityLabel="חיוג ללקוח"
                      style={({ pressed }) => [
                        st.contactRow,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={st.contactRowInfo}>
                        <Text style={st.contactLabel}>טלפון</Text>
                        <Text style={st.contactValue} numberOfLines={1}>
                          {phoneRaw}
                        </Text>
                      </View>
                      <View style={st.contactCallBtn} pointerEvents="none">
                        <Phone size={18} color="#FFFFFF" strokeWidth={2.4} />
                      </View>
                    </Pressable>
                  ) : execJob.one_time_customer_id ? (
                    <View style={st.contactRow}>
                      <View style={st.contactRowInfo}>
                        <Text style={st.contactLabel}>טלפון</Text>
                        <Text style={st.contactMuted}>לא נרשם במערכת</Text>
                      </View>
                      <View style={[st.contactCallBtn, st.contactCallBtnMuted]}>
                        <Phone size={18} color="#94A3B8" strokeWidth={2.2} />
                      </View>
                    </View>
                  ) : null}

                  {((phoneRaw && (addressLine || execJob.one_time_customer_id)) ||
                    (!phoneRaw && execJob.one_time_customer_id && addressLine)) && (
                    <View style={st.contactDivider} />
                  )}

                  {addressLine ? (
                    <View style={st.contactRow}>
                      <View style={st.contactRowInfo}>
                        <Text style={st.contactLabel}>כתובת</Text>
                        <Text style={st.contactValue}>{addressLine}</Text>
                      </View>
                      <View style={[st.contactIcon, st.contactIconAddress]}>
                        <MapPin size={18} color="#0F766E" strokeWidth={2.4} />
                      </View>
                    </View>
                  ) : execJob.one_time_customer_id ? (
                    <View style={st.contactRow}>
                      <View style={st.contactRowInfo}>
                        <Text style={st.contactLabel}>כתובת</Text>
                        <Text style={st.contactMuted}>לא נרשמה במערכת</Text>
                      </View>
                      <View style={[st.contactIcon, st.contactIconMuted]}>
                        <MapPin size={18} color="#94A3B8" strokeWidth={2.2} />
                      </View>
                    </View>
                  ) : null}
                </View>
              )}

              {/* ── Notes card ───────────────────────── */}
              {!!execJob.notes && (
                <View style={st.notesCard}>
                  <View style={st.notesHeader}>
                    <Text style={st.notesLabel}>הערות למשימה</Text>
                    <View style={st.notesIconBubble}>
                      <Text style={st.notesIconText}>!</Text>
                    </View>
                  </View>
                  <Text style={st.notesText}>{execJob.notes}</Text>
                </View>
              )}

              {/* ── Quick stat strip ─────────────────── */}
              {hasQuickStats ? (
                <View style={st.quickStatRow}>
                  {execJob.kind === 'regular' && (
                    <>
                      <View style={st.quickStat}>
                        <Layers size={13} color={colors.primary} strokeWidth={2.2} />
                        <Text style={st.quickStatValue}>{regularPoints.length}</Text>
                        <Text style={st.quickStatLabel}>נקודות</Text>
                      </View>
                      <View style={st.quickStatSep} />
                      <View style={st.quickStat}>
                        <Droplets size={13} color={colors.primary} strokeWidth={2.2} />
                        <Text style={st.quickStatValue}>
                          {summaries.scent.reduce((s, x) => s + x.v, 0)}
                        </Text>
                        <Text style={st.quickStatLabel}>מ״ל</Text>
                      </View>
                    </>
                  )}
                  {execJob.kind === 'installation' && (
                    <View style={st.quickStat}>
                      <Package size={13} color={INSTALL_ACCENT} strokeWidth={2.2} />
                      <Text style={st.quickStatValue}>{installationDevices.length}</Text>
                      <Text style={st.quickStatLabel}>מכשירים</Text>
                    </View>
                  )}
                  {execJob.kind === 'special' && special && (
                    <View style={st.quickStat}>
                      <Battery size={13} color={colors.primary} strokeWidth={2.2} />
                      <Text style={st.quickStatValue}>{special.battery_type ?? '—'}</Text>
                      <Text style={st.quickStatLabel}>סוללה</Text>
                    </View>
                  )}
                </View>
              ) : null}
              {execJob.kind === 'regular' ? (
                <View style={{ gap: 12 }}>
                  {regularPoints.length > 0 && (
                    <View style={st.spSectionHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.spSectionTitle}>נקודות שירות</Text>
                        <Text style={st.spSectionSubtitle}>
                          צלמו כל נקודה לאחר המילוי כדי לסמן את המשימה כהושלמה
                        </Text>
                      </View>
                      <View style={st.spSectionIconWrap}>
                        <Droplets size={16} color={colors.primary} strokeWidth={2.4} />
                      </View>
                    </View>
                  )}
                  {regularPoints.map((p, idx) => {
                    const current = p.image_url ? getPublicUrl(p.image_url) : null;
                    const previewUri = p.localImageUri ?? current;
                    return (
                      <View key={p.id} style={st.spCard}>
                        <View style={st.spCardHeader}>
                          <View style={st.spDeviceIcon}>
                            <Droplets size={14} color={colors.primary} strokeWidth={2.2} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.spDeviceName} numberOfLines={1}>
                              {p.sp?.device_type ?? `נקודה ${idx + 1}`}
                            </Text>
                            <Text style={st.spDeviceSub}>
                              נקודה {idx + 1} מתוך {regularPoints.length}
                            </Text>
                          </View>
                          {!!current && !p.localImageUri && (
                            <View style={st.spDoneBadge}>
                              <Check size={11} color="#16A34A" strokeWidth={2.6} />
                            </View>
                          )}
                        </View>

                        <View style={st.spMetaRow}>
                          <View style={st.spMetaItem}>
                            <Text style={st.spMetaLabel}>ניחוח</Text>
                            <Text style={st.spMetaValue} numberOfLines={1}>
                              {p.sp?.scent_type ?? '—'}
                            </Text>
                          </View>
                          <View style={st.spMetaSep} />
                          <View style={st.spMetaItem}>
                            <Text style={st.spMetaLabel}>מכשירים בנקודה</Text>
                            <Text style={st.spMetaValue}>{devicesAtPointsLabel(1)}</Text>
                          </View>
                        </View>

                        {previewUri ? (
                          <View style={st.spImageWrap}>
                            <Image source={{ uri: previewUri }} style={st.spImage} resizeMode="cover" />
                            <Pressable
                              onPress={() => removeRegularImage(p.id)}
                              hitSlop={10}
                              style={({ pressed }) => [
                                st.spImageRemoveBtn,
                                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="מחק תמונה"
                            >
                              <X size={14} color="#fff" strokeWidth={3} />
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() =>
                              pick((uri) =>
                                setRegularPoints((prev) =>
                                  prev.map((x) => (x.id === p.id ? { ...x, localImageUri: uri } : x)),
                                ),
                              )
                            }
                            style={({ pressed }) => [
                              st.spImagePlaceholder,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Camera size={22} color={colors.primary} strokeWidth={1.8} />
                            <Text style={st.spImagePlaceholderText}>לא הועלתה תמונה</Text>
                          </Pressable>
                        )}

                        <Pressable
                          onPress={() =>
                            pick((uri) =>
                              setRegularPoints((prev) =>
                                prev.map((x) => (x.id === p.id ? { ...x, localImageUri: uri } : x)),
                              ),
                            )
                          }
                          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
                        >
                          <View style={st.spPickBtn} pointerEvents="none">
                            <ImagePlus size={16} color={colors.primary} strokeWidth={2.4} />
                            <Text style={st.spPickBtnText}>
                              {previewUri ? 'החלף תמונה' : 'בחר תמונה'}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {execJob.kind === 'installation' ? (
                <View style={st.instSection}>
                  <View style={st.instSectionHead}>
                    <View style={st.instSectionIconWrap}>
                      <Package size={16} color={INSTALL_ACCENT} strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.instSectionTitle}>מכשירים להתקנה</Text>
                      <Text style={st.instSectionSubtitle}>
                        צלמו כל מכשיר לאחר ההתקנה כדי לסמן את המשימה כהושלמה
                      </Text>
                    </View>
                  </View>

                  {installationDevices.length === 0 ? (
                    <View style={st.instEmptyCard}>
                      <Package size={28} color={INSTALL_ACCENT} strokeWidth={2} />
                      <Text style={st.instEmptyTitle}>אין מכשירים משויכים</Text>
                      <Text style={st.instEmptySubtitle}>
                        אם אמורים להופיע מכשירים, רעננו את המסך או פנו למשרד
                      </Text>
                    </View>
                  ) : null}

                  {installationDevices.map((d, idx) => {
                    const current = d.image_url ? getPublicUrl(d.image_url) : null;
                    const previewUri = d.localImageUri ?? current;
                    return (
                      <View key={d.id} style={st.instDeviceCard}>
                        <View style={st.spCardHeader}>
                          <View style={st.instDeviceIconBubble}>
                            <Package size={14} color={INSTALL_ACCENT} strokeWidth={2.2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={st.instDeviceTitle} numberOfLines={1}>
                              {d.device_type ?? `מכשיר ${idx + 1}`}
                            </Text>
                            <Text style={st.instDeviceCaption}>
                              מכשיר {idx + 1} מתוך {installationDevices.length}
                            </Text>
                          </View>
                          {!!current && !d.localImageUri && (
                            <View style={st.spDoneBadge}>
                              <Check size={11} color="#16A34A" strokeWidth={2.6} />
                            </View>
                          )}
                        </View>

                        {previewUri ? (
                          <View style={st.spImageWrap}>
                            <Image source={{ uri: previewUri }} style={st.spImage} resizeMode="cover" />
                            <Pressable
                              onPress={() => removeInstallationImage(d.id)}
                              hitSlop={10}
                              style={({ pressed }) => [
                                st.spImageRemoveBtn,
                                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="מחק תמונה"
                            >
                              <X size={14} color="#fff" strokeWidth={3} />
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() =>
                              pick((uri) =>
                                setInstallationDevices((prev) =>
                                  prev.map((x) => (x.id === d.id ? { ...x, localImageUri: uri } : x)),
                                ),
                              )
                            }
                            style={({ pressed }) => [
                              st.instImagePlaceholder,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Camera size={22} color={INSTALL_ACCENT} strokeWidth={1.8} />
                            <Text style={st.instImagePlaceholderText}>לא הועלתה תמונה</Text>
                          </Pressable>
                        )}

                        <Pressable
                          onPress={() =>
                            pick((uri) =>
                              setInstallationDevices((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, localImageUri: uri } : x)),
                              ),
                            )
                          }
                          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
                        >
                          <View style={st.instPickBtn} pointerEvents="none">
                            <ImagePlus size={16} color={INSTALL_ACCENT} strokeWidth={2.4} />
                            <Text style={st.instPickBtnText}>
                              {previewUri ? 'החלף תמונה' : 'בחר תמונה'}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {execJob.kind === 'special' && special ? (
                <View style={{ gap: 12 }}>
                  <View style={[st.spSectionHead, { backgroundColor: 'rgba(234,88,12,0.06)', borderColor: 'rgba(234,88,12,0.16)' }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.spSectionTitle}>משימה מיוחדת</Text>
                      <Text style={st.spSectionSubtitle}>
                        צלמו את ההוכחה לביצוע המשימה כדי לסמן אותה כהושלמה
                      </Text>
                    </View>
                    <View style={[st.spSectionIconWrap, { backgroundColor: 'rgba(234,88,12,0.12)', borderColor: 'rgba(234,88,12,0.22)' }]}>
                      <Sparkles size={16} color="#EA580C" strokeWidth={2.4} />
                    </View>
                  </View>
                  <View style={st.spCard}>
                    <View style={st.spCardHeader}>
                      <View style={[st.spDeviceIcon, { backgroundColor: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.18)' }]}>
                        <Sparkles size={14} color="#EA580C" strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.spDeviceName} numberOfLines={1}>
                          {special.job_type ?? 'משימה מיוחדת'}
                        </Text>
                      </View>
                      {!!special.image_url && !special.localImageUri && (
                        <View style={st.spDoneBadge}>
                          <Check size={11} color="#16A34A" strokeWidth={2.6} />
                        </View>
                      )}
                    </View>

                    {special.battery_type ? (
                      <View style={st.spMetaRow}>
                        <View style={st.spMetaItem}>
                          <Text style={st.spMetaLabel}>סוללה</Text>
                          <Text style={st.spMetaValue}>{special.battery_type}</Text>
                        </View>
                      </View>
                    ) : null}

                    {(() => {
                      const previewUri =
                        special.localImageUri ?? (special.image_url ? getPublicUrl(special.image_url) : null);
                      return previewUri ? (
                        <View style={st.spImageWrap}>
                          <Image source={{ uri: previewUri }} style={st.spImage} resizeMode="cover" />
                          <Pressable
                            onPress={removeSpecialImage}
                            hitSlop={10}
                            style={({ pressed }) => [
                              st.spImageRemoveBtn,
                              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="מחק תמונה"
                          >
                            <X size={14} color="#fff" strokeWidth={3} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() =>
                            pick((uri) => setSpecial((p) => (p ? { ...p, localImageUri: uri } : p)))
                          }
                          style={({ pressed }) => [
                            st.spImagePlaceholder,
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Camera size={22} color={colors.primary} strokeWidth={1.8} />
                          <Text style={st.spImagePlaceholderText}>לא הועלתה תמונה</Text>
                        </Pressable>
                      );
                    })()}

                    <Pressable
                      onPress={() =>
                        pick((uri) => setSpecial((p) => (p ? { ...p, localImageUri: uri } : p)))
                      }
                      style={({ pressed }) => [pressed && { opacity: 0.88 }]}
                    >
                      <View style={st.spPickBtn} pointerEvents="none">
                        <ImagePlus size={16} color={colors.primary} strokeWidth={2.4} />
                        <Text style={st.spPickBtnText}>
                          {special.localImageUri || special.image_url ? 'החלף תמונה' : 'בחר תמונה'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={[st.detailsFooter, { paddingBottom: Math.max(12, insets.bottom) }]}>
              {execJob.status !== 'completed' ? (
                <Pressable
                  onPress={complete}
                  disabled={!isExecCompletable}
                  accessibilityRole="button"
                  accessibilityLabel="בצע משימה"
                  style={({ pressed }) => [
                    st.executeBtn,
                    !isExecCompletable && st.executeBtnDisabled,
                    pressed && isExecCompletable && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <Check
                    size={18}
                    color={isExecCompletable ? '#FFFFFF' : '#1E293B'}
                    strokeWidth={2.8}
                  />
                  <Text
                    style={[
                      st.executeBtnText,
                      !isExecCompletable && st.executeBtnTextDisabled,
                    ]}
                  >
                    בצע
                  </Text>
                </Pressable>
              ) : (
                <View style={st.completedBanner}>
                  <View style={st.completedBannerIcon}>
                    <Check size={14} color="#16A34A" strokeWidth={2.8} />
                  </View>
                  <Text style={st.completedBannerText}>המשימה הושלמה</Text>
                </View>
              )}
            </View>
          </View>
          );
        })()}
      </OriginWindow>
    </View>
  );
}

const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: 13,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 11,
  },

  // ── Calendar Card ──────────────────────────────────
  calCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  calNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  calMonthLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  calMonthText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  calDowRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 4,
    paddingBottom: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  calDowCell: { flex: 1, alignItems: 'center' },
  calDowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#AEAEB2',
    letterSpacing: 0.3,
  },
  calWeekPage: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  calDayCell: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 2, borderRadius: 12 },
  calDayBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayBubbleSel: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  calDayBubbleToday: { borderWidth: 1.5, borderColor: colors.primary },
  calDayNum: { fontSize: 15, fontWeight: '600', color: colors.text },
  calDayNumSel: { color: '#fff', fontWeight: '700' },
  calDayNumToday: { color: colors.primary, fontWeight: '700' },
  calDayNumFaded: { color: '#D1D1D6' },
  calDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0,
  },
  calDayDotVisible: { opacity: 1 },
  calPrettyRow: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  calStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  calStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  calStatNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  calStatLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
  calStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E5EA',
  },

  // ── Oil Card (LIGHT) ───────────────────────────────
  oilCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  oilHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  oilTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  oilSubtitle: {
    color: colors.muted,
    marginTop: 6,
    textAlign: 'right',
    lineHeight: 18,
    fontSize: 12,
    fontWeight: '600',
  },
  oilDonutInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  oilDonutValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  oilDivider: {
    height: 2,
    width: '58%',
    backgroundColor: '#E5E7EB',
    transform: [{ rotate: '-14deg' }],
  },
  oilDonutMax: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  oilMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  oilMetaPill: {
    flex: 1,
    backgroundColor: '#F6F7FB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  oilMetaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  oilMetaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  oilBreakdownTitle: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'right',
    fontSize: 13,
  },
  oilBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#EEF1F6',
  },
  oilBreakdownKey: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'right',
    fontSize: 12,
  },
  oilBreakdownValue: {
    color: colors.muted,
    fontWeight: '900',
    textAlign: 'left',
    fontSize: 12,
  },

  // ── Task Card ──────────────────────────────────────
  taskWrap: {
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  taskInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  taskBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  taskTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  taskHeaderCustomer: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 8,
  },
  taskTagsCluster: {
    flexShrink: 0,
    maxWidth: '52%',
    alignSelf: 'flex-start',
  },
  taskCustomer: {
    alignSelf: 'stretch',
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  taskAddressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  taskAddressIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskAddressText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  taskTimePill: {
    backgroundColor: '#F5F5F7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  taskTimeText: { fontSize: 11, fontWeight: '700', color: '#1E3A8A', letterSpacing: 0.4 },
  taskNotes: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'right',
    marginTop: 8,
    lineHeight: 17,
  },
  taskFooter: {
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  taskPhoneBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.32,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 3 },
    }),
  },
  taskMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  taskScentBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  taskScentChipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskScentChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '100%',
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  taskScentChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskScentChipBody: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  taskScentChipAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  taskScentChipName: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'right',
  },
  kindChip: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    backgroundColor: '#F5F5F7',
    borderColor: '#E8E8ED',
  },
  kindChipText: { fontSize: 11, fontWeight: '700', color: '#1E3A8A' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    backgroundColor: '#F5F5F7',
    borderColor: '#E8E8ED',
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusChipText: { fontSize: 10, fontWeight: '700', color: '#1E3A8A' },

  // ── Empty State ────────────────────────────────────
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(37,99,235,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  emptySubtitle: { color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // ── Modal: Hero header card ─────────────────────────
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  heroNameWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 8,
  },
  heroName: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
    letterSpacing: -0.3,
    alignSelf: 'stretch',
  },
  heroBadgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  heroTimePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(30,58,138,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,58,138,0.16)',
  },
  heroTimeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: 0.3,
  },
  heroKindPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  heroKindText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroStatusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroOrderPill: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroOrderText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },
  heroOneTimeBanner: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(124,58,237,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  heroOneTimeText: {
    fontSize: 11,
    fontWeight: '800',
    color: INSTALL_ACCENT,
  },

  // ── Modal: Contact card (phone + address) ───────────
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contactRowInfo: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 2,
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 21,
  },
  contactMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'right',
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  contactIconAddress: {
    backgroundColor: 'rgba(15,118,110,0.10)',
    borderColor: 'rgba(15,118,110,0.22)',
  },
  contactIconMuted: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  contactCallBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOpacity: 0.30, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  contactCallBtnMuted: {
    backgroundColor: '#F1F5F9',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  contactDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },
  quickStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quickStat: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickStatValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  quickStatSep: {
    width: 1,
    height: 22,
    backgroundColor: '#E5E7EB',
  },
  detailsFooter: {
    flexShrink: 0,
    paddingTop: 12,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 6 },
    }),
  },

  // ── Section header (inside modal) ──────────────────
  spSectionHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.14)',
  },
  spSectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  spSectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    lineHeight: 17,
  },

  // ── Service-point card (inside modal) ──────────────
  spCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    padding: 12,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  spCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  spDeviceIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spDeviceName: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'right',
  },
  spDeviceSub: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 1,
  },
  spDoneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 10,
  },
  spMetaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  spMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  spMetaValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  spMetaSep: {
    width: 1,
    height: 26,
    backgroundColor: '#E5E7EB',
  },
  spImageWrap: {
    position: 'relative',
    width: '100%',
  },
  spImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
  },
  spImageRemoveBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(17,24,39,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  spImagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 7,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.04)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(37,99,235,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  spImagePlaceholderText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  spPickBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(37,99,235,0.22)',
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  spPickBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },

  instSection: {
    gap: 12,
    marginTop: 2,
  },
  instSectionHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.14)',
  },
  instSectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  instSectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    lineHeight: 17,
  },
  instEmptyCard: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    borderStyle: 'dashed',
    gap: 8,
  },
  instEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  instEmptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 17,
  },
  instDeviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.16)',
    padding: 12,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: INSTALL_ACCENT, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  instDeviceIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(124,58,237,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instDeviceTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'right',
  },
  instDeviceCaption: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 1,
  },
  instImagePlaceholder: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.22)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(124,58,237,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  instImagePlaceholderText: {
    fontSize: 13,
    fontWeight: '700',
    color: INSTALL_ACCENT,
  },
  instPickBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.35)',
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
  instPickBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: INSTALL_ACCENT,
    letterSpacing: 0.2,
  },

  executeBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.32,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  executeBtnDisabled: {
    backgroundColor: '#CBD5E1',
    borderColor: '#94A3B8',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  executeBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  executeBtnTextDisabled: {
    color: '#1E293B',
  },
  completedBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.22)',
  },
  completedBannerIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22,163,74,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBannerText: {
    color: '#16A34A',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.2,
  },

  // ── Notes card (modal) ─────────────────────────────
  notesCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    gap: 8,
  },
  notesHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  notesIconBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  notesText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
    textAlign: 'right',
    lineHeight: 19,
  },

  // ── Service Points Window ──────────────────────────
  pointsHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  pointsIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pointsTitle: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'right' },
  pointsSubtitle: { fontSize: 12, fontWeight: '600', color: colors.muted, textAlign: 'right', marginTop: 1 },
  pointsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pointsLoadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pointsLoadingText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  pointsEmptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  pointsEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(37,99,235,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pointsEmptyText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  pointCard: {
    backgroundColor: colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  pointCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  pointDeviceIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointDeviceText: { color: colors.text, fontWeight: '800', fontSize: 14, textAlign: 'right', flex: 1 },
  pointCardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  pointMetaRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  pointMetaItem: { flex: 1, alignItems: 'center', gap: 2 },
  pointMetaLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  pointMetaValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  pointMetaSep: { width: 1, height: 28, backgroundColor: colors.border },
  pointNotes: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'right', lineHeight: 18 },
});
