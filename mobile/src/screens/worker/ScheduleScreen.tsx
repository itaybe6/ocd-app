import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
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
import { addDays, format } from 'date-fns';
import { he } from 'date-fns/locale';
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
  Package,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { OriginWindow, ORIGIN_WINDOW_DEFAULT_DURATION_MS, type OriginRect } from '../../components/OriginWindow';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { toDate, yyyyMmDd } from '../../lib/time';
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

type UserLite = { id: string; name: string; avatar_url?: string | null };
type OneTimeCustomerLite = { id: string; name: string };

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
  device_name?: string | null;
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
  const [jobScentSummaries, setJobScentSummaries] = useState<Record<string, { key: string; amount: number }[]>>({});

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
  const oneTimeMap = useMemo(() => new Map(oneTimeCustomers.map((c) => [c.id, c.name])), [oneTimeCustomers]);

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

  const prettyDay = useMemo(() => {
    const d = toDate(day);
    return format(d, 'EEEE, dd/MM/yyyy', { locale: he });
  }, [day]);

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
      .select('id, name, avatar_url')
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
      .select('id, name')
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
          .select('id, date, status, customer_id, one_time_customer_id, order_number, notes')
          .eq('worker_id', user.id)
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('special_jobs')
          .select('id, date, status, order_number, notes')
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
      const perJobScent = new Map<string, Map<string, number>>();
      const NO_NAME_KEY = '__no_name__';
      for (const r of scentRows) {
        const sp = spMap.get(r.service_point_id);
        const raw = String(sp?.scent_type ?? '').trim();
        const isMissing = !raw || raw.toLowerCase() === 'unknown';
        const key = isMissing ? NO_NAME_KEY : raw;
        const amt = Number(r.custom_refill_amount ?? sp?.refill_amount ?? 0);
        if (!amt) continue;
        scentMap.set(key, (scentMap.get(key) ?? 0) + amt);
        if (!perJobScent.has(r.job_id)) perJobScent.set(r.job_id, new Map());
        const jm = perJobScent.get(r.job_id)!;
        jm.set(key, (jm.get(key) ?? 0) + amt);
      }
      const jobScentRecord: Record<string, { key: string; amount: number }[]> = {};
      for (const [jid, jm] of perJobScent) {
        jobScentRecord[jid] = Array.from(jm.entries())
          .map(([key, amount]) => ({ key, amount }))
          .sort((a, b) => b.amount - a.amount);
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
    }, ORIGIN_WINDOW_DEFAULT_DURATION_MS + 48);
  }, []);

  // ── Open execute window (OriginWindow morph from task row, like WorkerJobsScreen) ──
  const openExecute = useCallback(async (it: Unified) => {
    setExecOriginRect(execOriginRectRef.current);
    setExecJob(it);
    setExecOpen(false);
    setRegularPoints([]);
    setInstallationDevices([]);
    setSpecial(null);

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
          .select('id, installation_job_id, device_name, image_url')
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
    } finally {
      setTimeout(() => setExecOpen(true), 0);
    }
  }, []);

  const pick = async (onPicked: (uri: string) => void) => {
    const uri = await pickImageFromLibrary();
    if (uri) onPicked(uri);
  };

  const uploadRegularPoint = async (p: (typeof regularPoints)[number]) => {
    if (!execJob) return;
    if (!p.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadJobServicePointImage({
        jobId: execJob.id,
        jobServicePointId: p.id,
        servicePointId: p.service_point_id,
        localUri: p.localImageUri,
      });
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath, uploading: false } : x)));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const uploadInstallationDevice = async (d: (typeof installationDevices)[number]) => {
    if (!execJob) return;
    if (!d.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadInstallationDeviceImage({
        installationJobId: execJob.id,
        installationDeviceId: d.id,
        localUri: d.localImageUri,
      });
      setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, image_url: storagePath, uploading: false } : x)));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const uploadSpecial = async () => {
    if (!execJob || !special) return;
    if (!special.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setSpecial((p) => (p ? { ...p, uploading: true } : p));
      const storagePath = await uploadSpecialJobImage({ specialJobId: special.id, localUri: special.localImageUri });
      setSpecial((p) => (p ? { ...p, image_url: storagePath, uploading: false } : p));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setSpecial((p) => (p ? { ...p, uploading: false } : p));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const complete = async () => {
    if (!execJob) return;
    try {
      setIsLoading(true);
      await completeUnifiedJob(execJob.kind, execJob.id);
      setItems((prev) =>
        prev.map((x) =>
          x.kind === execJob.kind && x.id === execJob.id ? { ...x, status: 'completed' } : x,
        ),
      );
      Toast.show({ type: 'success', text1: 'הושלם' });
      closeExec();
      // refresh totals
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
      return regularPoints.every((p) => !!p.image_url);
    }
    if (execJob.kind === 'installation') {
      if (!installationDevices.length) return true;
      return installationDevices.every((d) => !!d.image_url);
    }
    if (execJob.kind === 'special') {
      return !!special?.image_url;
    }
    return false;
  }, [execJob, regularPoints, installationDevices, special?.image_url]);

  // ── List header (calendar + oil card + filter + stats) ────
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
            <Text style={st.calPrettyText}>{prettyDay}</Text>
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

        {/* ── Stats Card ────────────────────────────────── */}
        {items.length > 0 && (
          <View style={st.statsCard}>
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: '#34C759' }]} />
              <Text style={[st.statNumber, { color: '#34C759' }]}>{stats.completed}</Text>
              <Text style={st.statLabel}>הושלמו</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: '#FF9500' }]} />
              <Text style={[st.statNumber, { color: '#FF9500' }]}>{stats.pending}</Text>
              <Text style={st.statLabel}>ממתינות</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: '#C7C7CC' }]} />
              <Text style={[st.statNumber, { color: colors.text }]}>{stats.total}</Text>
              <Text style={st.statLabel}>סה״כ</Text>
            </View>
          </View>
        )}
      </View>
    ),
    [
      calMonthLabel,
      day,
      viewDate,
      items.length,
      parsedView,
      prettyDay,
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
          const rowKey = `${item.kind}:${item.id}`;
          const scents = item.kind === 'regular' ? jobScentSummaries[item.id] : undefined;

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
                  <View style={st.taskTopRow}>
                    <View style={st.taskWho}>
                      <Avatar size={24} uri={user?.avatar_url ?? null} name={user?.name ?? ''} />
                      <Text style={st.taskWorkerName} numberOfLines={1}>
                        {user?.name?.trim() || 'אני'}
                      </Text>
                    </View>
                    <View style={st.taskTopLeft}>
                      <View style={st.taskTimePill}>
                        <Text style={st.taskTimeText}>{formatHm(item.date)}</Text>
                      </View>
                      <View style={st.kindChip}>
                        <Text style={st.kindChipText}>{kindConf.label}</Text>
                      </View>
                      <View style={st.statusChip}>
                        <View style={[st.statusDot, { backgroundColor: isCompleted ? '#34C759' : '#FF9500' }]} />
                        <Text style={st.statusChipText}>{isCompleted ? 'הושלם' : 'ממתין'}</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={st.taskCustomer} numberOfLines={1}>
                    {customer}
                  </Text>

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
                                <Text style={st.taskScentChipAmount}>{Math.round(s.amount)} מ״ל</Text>
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
        durationMs={ORIGIN_WINDOW_DEFAULT_DURATION_MS}
        openedHeight={Math.min(screenHeight * 0.86, screenHeight - 40)}
        openedWidth={Math.min(screenWidth * 0.94, 440)}
      >
        {!!execJob && (
          <View style={{ flex: 1, flexShrink: 1 }}>
            {/* Header */}
            <View style={st.detailsHeader}>
              <View style={[st.detailsIconBubble, { backgroundColor: KIND_CONFIG[execJob.kind].color }]}>
                {execJob.kind === 'regular' ? (
                  <Droplets size={18} color="#fff" strokeWidth={2.5} />
                ) : execJob.kind === 'installation' ? (
                  <Package size={18} color="#fff" strokeWidth={2.5} />
                ) : (
                  <Sparkles size={18} color="#fff" strokeWidth={2.5} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.detailsTitle} numberOfLines={1}>
                  {customerLabel(execJob)}
                </Text>
                <View style={st.detailsSubRow}>
                  <View style={st.detailsTimePill}>
                    <Clock size={11} color="#1E3A8A" strokeWidth={2.2} />
                    <Text style={st.detailsTimeText}>{formatHm(execJob.date)}</Text>
                  </View>
                  <View style={[st.detailsKindPill, { backgroundColor: `${KIND_CONFIG[execJob.kind].color}15`, borderColor: `${KIND_CONFIG[execJob.kind].color}30` }]}>
                    <Text style={[st.detailsKindText, { color: KIND_CONFIG[execJob.kind].color }]}>
                      {KIND_CONFIG[execJob.kind].label}
                    </Text>
                  </View>
                  {execJob.order_number != null && (
                    <View style={st.detailsOrderPill}>
                      <Text style={st.detailsOrderText}>#{execJob.order_number}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Quick stat strip */}
            {(execJob.kind === 'regular' && regularPoints.length > 0) ||
            (execJob.kind === 'installation' && installationDevices.length > 0) ||
            (execJob.kind === 'special' && !!special) ? (
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
                    <Package size={13} color={colors.primary} strokeWidth={2.2} />
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

            {/* Scrollable content */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ marginTop: 14, flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {execJob.kind === 'regular' ? (
                <View style={{ gap: 10 }}>
                  <Text style={st.sectionTitle}>נקודות שירות</Text>
                  {regularPoints.map((p, idx) => {
                    const current = p.image_url ? getPublicUrl(p.image_url) : null;
                    const previewUri = p.localImageUri ?? current;
                    const refill = p.custom_refill_amount ?? p.sp?.refill_amount ?? null;
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
                            <Text style={st.spMetaLabel}>כמות מילוי</Text>
                            <Text style={st.spMetaValue}>
                              {refill != null ? `${refill} מ״ל` : '—'}
                            </Text>
                          </View>
                        </View>

                        {previewUri ? (
                          <Image source={{ uri: previewUri }} style={st.spImage} resizeMode="cover" />
                        ) : (
                          <View style={st.spImagePlaceholder}>
                            <Camera size={20} color={colors.muted} strokeWidth={1.6} />
                            <Text style={st.spImagePlaceholderText}>לא הועלתה תמונה</Text>
                          </View>
                        )}

                        <View style={st.spActionRow}>
                          <Pressable
                            onPress={() =>
                              pick((uri) =>
                                setRegularPoints((prev) =>
                                  prev.map((x) => (x.id === p.id ? { ...x, localImageUri: uri } : x)),
                                ),
                              )
                            }
                            style={({ pressed }) => [st.spActionBtn, pressed && { opacity: 0.7 }]}
                          >
                            <ImagePlus size={14} color="#1E3A8A" strokeWidth={2.2} />
                            <Text style={st.spActionBtnText}>בחר תמונה</Text>
                          </Pressable>
                          <Pressable
                            disabled={p.uploading || !p.localImageUri}
                            onPress={() => uploadRegularPoint(p)}
                            style={({ pressed }) => [
                              st.spActionBtnPrimary,
                              (!p.localImageUri || p.uploading) && { opacity: 0.5 },
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Upload size={14} color="#fff" strokeWidth={2.4} />
                            <Text style={st.spActionBtnPrimaryText}>
                              {p.uploading ? 'מעלה…' : 'העלה'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {execJob.kind === 'installation' ? (
                <View style={{ gap: 10 }}>
                  <Text style={st.sectionTitle}>מכשירים</Text>
                  {installationDevices.map((d, idx) => {
                    const current = d.image_url ? getPublicUrl(d.image_url) : null;
                    const previewUri = d.localImageUri ?? current;
                    return (
                      <View key={d.id} style={st.spCard}>
                        <View style={st.spCardHeader}>
                          <View style={[st.spDeviceIcon, { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.18)' }]}>
                            <Package size={14} color="#7C3AED" strokeWidth={2.2} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.spDeviceName} numberOfLines={1}>
                              {d.device_name ?? `מכשיר ${idx + 1}`}
                            </Text>
                            <Text style={st.spDeviceSub}>
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
                          <Image source={{ uri: previewUri }} style={st.spImage} resizeMode="cover" />
                        ) : (
                          <View style={st.spImagePlaceholder}>
                            <Camera size={20} color={colors.muted} strokeWidth={1.6} />
                            <Text style={st.spImagePlaceholderText}>לא הועלתה תמונה</Text>
                          </View>
                        )}

                        <View style={st.spActionRow}>
                          <Pressable
                            onPress={() =>
                              pick((uri) =>
                                setInstallationDevices((prev) =>
                                  prev.map((x) => (x.id === d.id ? { ...x, localImageUri: uri } : x)),
                                ),
                              )
                            }
                            style={({ pressed }) => [st.spActionBtn, pressed && { opacity: 0.7 }]}
                          >
                            <ImagePlus size={14} color="#1E3A8A" strokeWidth={2.2} />
                            <Text style={st.spActionBtnText}>בחר תמונה</Text>
                          </Pressable>
                          <Pressable
                            disabled={d.uploading || !d.localImageUri}
                            onPress={() => uploadInstallationDevice(d)}
                            style={({ pressed }) => [
                              st.spActionBtnPrimary,
                              (!d.localImageUri || d.uploading) && { opacity: 0.5 },
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Upload size={14} color="#fff" strokeWidth={2.4} />
                            <Text style={st.spActionBtnPrimaryText}>
                              {d.uploading ? 'מעלה…' : 'העלה'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {execJob.kind === 'special' && special ? (
                <View style={{ gap: 10 }}>
                  <Text style={st.sectionTitle}>משימה מיוחדת</Text>
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

                    {special.localImageUri ? (
                      <Image source={{ uri: special.localImageUri }} style={st.spImage} resizeMode="cover" />
                    ) : special.image_url ? (
                      <Image source={{ uri: getPublicUrl(special.image_url) }} style={st.spImage} resizeMode="cover" />
                    ) : (
                      <View style={st.spImagePlaceholder}>
                        <Camera size={20} color={colors.muted} strokeWidth={1.6} />
                        <Text style={st.spImagePlaceholderText}>לא הועלתה תמונה</Text>
                      </View>
                    )}

                    <View style={st.spActionRow}>
                      <Pressable
                        onPress={() =>
                          pick((uri) => setSpecial((p) => (p ? { ...p, localImageUri: uri } : p)))
                        }
                        style={({ pressed }) => [st.spActionBtn, pressed && { opacity: 0.7 }]}
                      >
                        <ImagePlus size={14} color="#1E3A8A" strokeWidth={2.2} />
                        <Text style={st.spActionBtnText}>בחר תמונה</Text>
                      </Pressable>
                      <Pressable
                        disabled={special.uploading || !special.localImageUri}
                        onPress={uploadSpecial}
                        style={({ pressed }) => [
                          st.spActionBtnPrimary,
                          (!special.localImageUri || special.uploading) && { opacity: 0.5 },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Upload size={14} color="#fff" strokeWidth={2.4} />
                        <Text style={st.spActionBtnPrimaryText}>
                          {special.uploading ? 'מעלה…' : 'העלה'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

              {!!execJob.notes && (
                <View style={st.notesCard}>
                  <Text style={st.notesLabel}>הערות</Text>
                  <Text style={st.notesText}>{execJob.notes}</Text>
                </View>
              )}
            </ScrollView>

            <View style={[st.detailsFooter, { paddingBottom: Math.max(12, insets.bottom) }]}>
              {execJob.status !== 'completed' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    title="סגור"
                    variant="secondary"
                    fullWidth={false}
                    style={{ flex: 1, borderRadius: 14 }}
                    onPress={closeExec}
                  />
                  <Pressable
                    onPress={complete}
                    disabled={!isExecCompletable}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      borderRadius: 14,
                      paddingVertical: 14,
                      backgroundColor: !isExecCompletable
                        ? 'rgba(37,99,235,0.35)'
                        : pressed
                          ? 'rgba(37,99,235,0.88)'
                          : colors.primary,
                      opacity: 1,
                    })}
                  >
                    <Play size={17} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>סיים משימה</Text>
                  </Pressable>
                </View>
              ) : (
                <Button title="סגור" variant="secondary" style={{ borderRadius: 14 }} onPress={closeExec} />
              )}
            </View>
          </View>
        )}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  calPrettyText: { fontSize: 12, fontWeight: '700', color: colors.muted },

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

  // ── Stats Card ─────────────────────────────────────
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDot: { width: 7, height: 7, borderRadius: 3.5, marginBottom: 2 },
  statNumber: { fontSize: 27, fontWeight: '800', lineHeight: 30, color: colors.text },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: '500' },
  statDivider: {
    width: 1,
    height: '70%' as any,
    backgroundColor: '#F0F0F5',
    alignSelf: 'center',
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
  taskBody: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13 },
  taskTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskWho: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginLeft: 8,
  },
  taskTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskWorkerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    flex: 1,
    textAlign: 'right',
  },
  taskTimePill: {
    backgroundColor: 'rgba(30,58,138,0.07)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,58,138,0.15)',
  },
  taskTimeText: { fontSize: 11, fontWeight: '700', color: '#1E3A8A', letterSpacing: 0.4 },
  taskCustomer: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
  },
  taskNotes: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'right',
    marginTop: 5,
    lineHeight: 17,
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
    backgroundColor: 'rgba(30,58,138,0.07)',
    borderColor: 'rgba(30,58,138,0.15)',
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
    backgroundColor: 'rgba(30,58,138,0.07)',
    borderColor: 'rgba(30,58,138,0.15)',
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

  // ── Modal sheet (job details) ──────────────────────
  detailsHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  detailsIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  detailsSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  detailsTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(30,58,138,0.07)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,58,138,0.15)',
  },
  detailsTimeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: 0.4,
  },
  detailsKindPill: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  detailsKindText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailsOrderPill: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailsOrderText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },
  quickStatRow: {
    marginTop: 14,
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
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'right',
    fontSize: 14,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  detailsFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
    backgroundColor: colors.card,
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
  spImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  spImagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 7,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  spImagePlaceholderText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  spActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  spActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(30,58,138,0.16)',
    backgroundColor: 'rgba(30,58,138,0.07)',
  },
  spActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  spActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  spActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  // ── Notes card (modal) ─────────────────────────────
  notesCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    gap: 4,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'right',
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
