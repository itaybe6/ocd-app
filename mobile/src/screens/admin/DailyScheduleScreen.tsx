import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { addDays, format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  Eye,
  Layers,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { Entypo } from '@expo/vector-icons';
import { AdminCreateJobSheet, ADMIN_SPECIAL_JOB_TYPES, BATTERY_TYPES } from '../../components/jobs/AdminCreateJobSheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { OriginWindow, type OriginRect } from '../../components/OriginWindow';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { Avatar } from '../../components/ui/Avatar';
import { completeUnifiedJob, uploadJobServicePointImage } from '../../lib/execution';
import { flushScheduledPushJobs } from '../../lib/pushAdmin';
import { pickImageFromLibrary } from '../../lib/media';
import { jobImageDisplayUri } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { toDate, yyyyMmDd } from '../../lib/time';
import { useLoading } from '../../state/LoadingContext';

const { height: screenHeight } = Dimensions.get('window');

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  worker_id: string;
  customer_id?: string | null;
  one_time_customer_id?: string | null;
  order_number?: number | null;
  notes?: string | null;
  /** installation_jobs */
  device_type?: string | null;
  /** special_jobs */
  job_type?: string | null;
  battery_type?: string | null;
};

type UserLite = { id: string; name: string; role: 'admin' | 'worker' | 'customer'; avatar_url?: string | null };
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

function updateIsoTime(iso: string, timeHm: string): string {
  const d = new Date(iso);
  const [hh, mm] = timeHm.split(':').map((x) => Number(x));
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.toISOString();
}

const KIND_CONFIG = {
  regular:      { label: 'רגילה',  color: colors.primary },
  installation: { label: 'התקנה',  color: '#7C3AED'      },
  special:      { label: 'מיוחדת', color: '#EA580C'      },
} as const;

export function DailyScheduleScreen() {
  const { setIsLoading } = useLoading();
  const [day, setDay] = useState(yyyyMmDd(new Date()));
  const [users, setUsers] = useState<UserLite[]>([]);
  const [oneTimeCustomers, setOneTimeCustomers] = useState<OneTimeCustomerLite[]>([]);
  const [workerId, setWorkerId] = useState('');
  const [items, setItems] = useState<Unified[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [workerFilterOpen, setWorkerFilterOpen] = useState(false);
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<Unified | null>(null);

  const [edit, setEdit] = useState<Unified | null>(null);
  const [newTime, setNewTime] = useState('09:00');
  const [newWorkerId, setNewWorkerId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSpecialJobType, setEditSpecialJobType] = useState<string>(ADMIN_SPECIAL_JOB_TYPES[0]?.value ?? 'batteries');
  const [editBatteryType, setEditBatteryType] = useState<string>('AA');

  /** חלון ביצוע משימה — מבנה ועיצוב כמו ב-JobsScreen */
  const [executeJob, setExecuteJob] = useState<Unified | null>(null);
  const [execPoints, setExecPoints] = useState<
    (JobServicePoint & { sp?: ServicePoint | null; localImageUri?: string | null; uploading?: boolean })[]
  >([]);
  const [execPointsLoading, setExecPointsLoading] = useState(false);

  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsJob, setPointsJob] = useState<Unified | null>(null);
  const [pointsOriginRect, setPointsOriginRect] = useState<OriginRect | null>(null);
  const pointsOriginRectRef = useRef<OriginRect | null>(null);
  const [jobPoints, setJobPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null })[]>([]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const userAvatarMap = useMemo(() => new Map(users.map((u) => [u.id, u.avatar_url ?? null])), [users]);
  const oneTimeMap = useMemo(() => new Map(oneTimeCustomers.map((c) => [c.id, c.name])), [oneTimeCustomers]);

  const editSpecialMeta = useMemo(
    () => ADMIN_SPECIAL_JOB_TYPES.find((t) => t.value === editSpecialJobType) ?? null,
    [editSpecialJobType],
  );

  const ui = useMemo(
    () => ({
      text: '#1C1C1E',
      secondary: '#3C3C43',
      tertiary: '#8E8E93',
      muted: '#8E8E93',
      outline: 'rgba(60,60,67,0.10)',
      fill: 'rgba(120,120,128,0.12)',
    }),
    [],
  );

  const filteredItems = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return items;
    const specialTypeLabel = (code: string | null | undefined) =>
      ADMIN_SPECIAL_JOB_TYPES.find((t) => t.value === (code ?? ''))?.label ?? '';
    return items.filter((it) => {
      const workerName = userMap.get(it.worker_id) ?? '';
      const cust =
        it.customer_id
          ? (userMap.get(it.customer_id) ?? it.customer_id.slice(0, 6))
          : it.one_time_customer_id
            ? (oneTimeMap.get(it.one_time_customer_id) ?? it.one_time_customer_id.slice(0, 6))
            : '—';
      const kindLabel = KIND_CONFIG[it.kind].label;
      const haystack = [
        it.id.toLowerCase(),
        workerName.toLowerCase(),
        cust.toLowerCase(),
        String(it.order_number ?? ''),
        String(it.notes ?? '').toLowerCase(),
        kindLabel.toLowerCase(),
        formatHm(it.date),
      ];
      if (it.kind === 'installation' && it.device_type) haystack.push(String(it.device_type).toLowerCase());
      if (it.kind === 'special') {
        const jt = String(it.job_type ?? '');
        haystack.push(jt.toLowerCase(), specialTypeLabel(it.job_type).toLowerCase());
      }
      return haystack.some((s) => s.includes(q));
    });
  }, [items, searchQ, userMap, oneTimeMap]);

  const isSearchActive = !!searchQ.trim();

  const parsedDay = useMemo(() => {
    const d = new Date(`${day}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [day]);

  const todayStr = useMemo(() => yyyyMmDd(new Date()), []);

  const weekDates = useMemo(() => {
    const dow = parsedDay.getDay();
    const sunday = addDays(parsedDay, -dow);
    return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  }, [parsedDay]);

  const weekScrollRef = useRef<ScrollView>(null);
  const [weekScrollWidth, setWeekScrollWidth] = useState(
    () => Dimensions.get('window').width - 26,
  );

  // In RTL: page 0 (left) = next week, page 2 (right) = previous week — same as WorkerScheduleScreen.
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
    () => `${HE_MONTHS[parsedDay.getMonth()]} ${parsedDay.getFullYear()}`,
    [parsedDay],
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

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('id, name, role, avatar_url').order('name');
    if (!error) setUsers((data ?? []) as any);
  }, []);

  const fetchOneTimeCustomers = useCallback(async (ids: string[]) => {
    if (!ids.length) { setOneTimeCustomers([]); return; }
    const uniqueIds = Array.from(new Set(ids));
    const { data, error } = await supabase.from('one_time_customers').select('id, name').in('id', uniqueIds);
    if (!error) setOneTimeCustomers((data ?? []) as any);
  }, []);

  const fetchDay = useCallback(async () => {
    try {
      setLoading(true);
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end   = new Date(`${day}T23:59:59`).toISOString();

      const baseFilter = (q: any) => {
        q = q.gte('date', start).lte('date', end);
        if (workerId) q = q.eq('worker_id', workerId);
        return q;
      };

      const [regRes, instRes, specRes] = await Promise.all([
        baseFilter(supabase.from('jobs').select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes')),
        baseFilter(
          supabase
            .from('installation_jobs')
            .select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes, device_type')
        ),
        baseFilter(
          supabase
            .from('special_jobs')
            .select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes, job_type, battery_type')
        ),
      ]);

      if (regRes.error)  throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      const regs  = (regRes.data  ?? []).map((r: any) => ({ kind: 'regular',      ...r }) as Unified);
      const insts = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const specs = (specRes.data ?? []).map((r: any) => ({ kind: 'special',      ...r }) as Unified);

      const combined = [...regs, ...insts, ...specs].sort((a, b) => {
        const ao = a.order_number == null ? 1e9 : a.order_number;
        const bo = b.order_number == null ? 1e9 : b.order_number;
        if (ao !== bo) return ao - bo;
        return parseTimeToMinutes(a.date) - parseTimeToMinutes(b.date);
      });

      setItems(combined);
      const oneTimeIds = combined.map((x) => x.one_time_customer_id).filter(Boolean) as string[];
      fetchOneTimeCustomers(oneTimeIds);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [day, fetchOneTimeCustomers, workerId]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
      fetchDay();
    }, [fetchDay, fetchUsers]),
  );

  const customerLabel = useCallback(
    (x: Unified) => {
      if (x.customer_id)           return userMap.get(x.customer_id)                ?? x.customer_id.slice(0, 6);
      if (x.one_time_customer_id)  return oneTimeMap.get(x.one_time_customer_id)    ?? x.one_time_customer_id.slice(0, 6);
      return '—';
    },
    [oneTimeMap, userMap],
  );

  const openJobPoints = useCallback(async (job: Unified) => {
    setPointsOriginRect(pointsOriginRectRef.current);
    setPointsOpen(true);
    setPointsLoading(true);
    setPointsJob(job);
    setJobPoints([]);

    if (job.kind !== 'regular') { setPointsLoading(false); return; }

    try {
      const { data: jsp, error: jspErr } = await supabase
        .from('job_service_points')
        .select('id, job_id, service_point_id, custom_refill_amount')
        .eq('job_id', job.id);
      if (jspErr) throw jspErr;

      const rows  = (jsp ?? []) as JobServicePoint[];
      const spIds = rows.map((r) => r.service_point_id);
      let spMap   = new Map<string, ServicePoint>();

      if (spIds.length) {
        const { data: sps, error: spErr } = await supabase
          .from('service_points')
          .select('id, device_type, scent_type, refill_amount, notes')
          .in('id', spIds);
        if (spErr) throw spErr;
        spMap = new Map(((sps ?? []) as ServicePoint[]).map((sp) => [sp.id, sp]));
      }

      setJobPoints(rows.map((r) => ({ ...r, sp: spMap.get(r.service_point_id) ?? null })));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת נקודות נכשלה', text2: e?.message ?? 'Unknown error' });
      setJobPoints([]);
    } finally {
      setPointsLoading(false);
    }
  }, []);

  const tableForKind = (k: Kind) => (k === 'regular' ? 'jobs' : k === 'installation' ? 'installation_jobs' : 'special_jobs');

  const closeExecuteModal = useCallback(() => {
    setExecuteJob(null);
    setExecPoints([]);
    setExecPointsLoading(false);
  }, []);

  useEffect(() => {
    if (!executeJob) {
      setExecPoints([]);
      setExecPointsLoading(false);
      return;
    }
    if (executeJob.kind !== 'regular') {
      setExecPoints([]);
      setExecPointsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setExecPointsLoading(true);
      try {
        const { data: jsp, error: jspErr } = await supabase
          .from('job_service_points')
          .select('id, job_id, service_point_id, image_url, custom_refill_amount')
          .eq('job_id', executeJob.id);
        if (jspErr) throw jspErr;
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
        if (!cancelled) {
          setExecPoints(
            rows.map((r) => ({
              ...r,
              sp: spMap.get(r.service_point_id) ?? null,
              localImageUri: null,
              uploading: false,
            })),
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          Toast.show({ type: 'error', text1: 'טעינת נקודות נכשלה', text2: e?.message ?? 'Unknown error' });
          setExecPoints([]);
        }
      } finally {
        if (!cancelled) setExecPointsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [executeJob]);

  const pickExecImage = async (jobServicePointId: string) => {
    const uri = await pickImageFromLibrary({ quality: 0.88 });
    if (!uri) return;
    setExecPoints((prev) => prev.map((p) => (p.id === jobServicePointId ? { ...p, localImageUri: uri } : p)));
  };

  const removeExecImage = (jobServicePointId: string) => {
    setExecPoints((prev) =>
      prev.map((p) =>
        p.id === jobServicePointId ? { ...p, localImageUri: null, image_url: null } : p,
      ),
    );
  };

  const isExecCompletable = useMemo(() => {
    if (!executeJob) return false;
    if (executeJob.status !== 'pending') return false;
    if (executeJob.kind !== 'regular') return true;
    if (!execPoints.length) return true;
    return execPoints.every((p) => !!p.image_url || !!p.localImageUri);
  }, [executeJob, execPoints]);

  const markExecuteCompleted = async () => {
    if (!executeJob || executeJob.status !== 'pending') return;
    try {
      setIsLoading(true);

      // Upload everything the user picked locally before flipping the job to completed.
      if (executeJob.kind === 'regular') {
        const snapshot = [...execPoints];
        for (const p of snapshot) {
          if (!p.localImageUri) continue;
          const storagePath = await uploadJobServicePointImage({
            jobId: executeJob.id,
            jobServicePointId: p.id,
            servicePointId: p.service_point_id,
            localUri: p.localImageUri,
          });
          setExecPoints((prev) =>
            prev.map((x) =>
              x.id === p.id ? { ...x, image_url: storagePath, localImageUri: null } : x,
            ),
          );
        }
      }

      await completeUnifiedJob(executeJob.kind, executeJob.id);
      setItems((prev) =>
        prev.map((x) => (x.kind === executeJob.kind && x.id === executeJob.id ? { ...x, status: 'completed' } : x)),
      );
      setExecuteJob((j) => (j && j.id === executeJob.id ? { ...j, status: 'completed' } : j));
      Toast.show({ type: 'success', text1: 'המשימה הושלמה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRevertToPending = () => {
    if (!executeJob || executeJob.status !== 'completed') return;
    const jobId = executeJob.id;
    const jobKind = executeJob.kind;
    Alert.alert('החזרת משימה', 'לסמן את המשימה שוב כממתינה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'החזר',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLoading(true);
            const t = tableForKind(jobKind);
            const { error } = await supabase.from(t).update({ status: 'pending' }).eq('id', jobId);
            if (error) throw error;
            setItems((prev) => prev.map((x) => (x.kind === jobKind && x.id === jobId ? { ...x, status: 'pending' } : x)));
            setExecuteJob((j) => (j && j.id === jobId ? { ...j, status: 'pending' } : j));
            Toast.show({ type: 'success', text1: 'המשימה סומנה כממתינה' });
          } catch (e: any) {
            Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const saveEdit = async () => {
    if (!edit) return;
    try {
      setIsLoading(true);
      const table = tableForKind(edit.kind);
      const updatedIso = updateIsoTime(edit.date, newTime.trim());
      const patch: Record<string, any> = { date: updatedIso };
      if (newWorkerId && newWorkerId !== edit.worker_id) patch.worker_id = newWorkerId;
      const notesTrim = editNotes.trim();
      patch.notes = notesTrim.length ? notesTrim : null;
      if (edit.kind === 'special') {
        patch.job_type = editSpecialJobType;
        patch.battery_type = editSpecialMeta?.needsBattery ? editBatteryType : null;
      }
      const { error } = await supabase.from(table).update(patch).eq('id', edit.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((x) => {
          if (x.kind !== edit.kind || x.id !== edit.id) return x;
          const base = {
            ...x,
            date: updatedIso,
            worker_id: newWorkerId || edit.worker_id,
            notes: notesTrim.length ? notesTrim : null,
          };
          if (edit.kind !== 'special') return base;
          return {
            ...base,
            job_type: editSpecialJobType,
            battery_type: editSpecialMeta?.needsBattery ? editBatteryType : null,
          };
        }),
      );
      setEdit(null);
      Toast.show({ type: 'success', text1: 'המשימה עודכנה' });
      try {
        await flushScheduledPushJobs();
      } catch {
        /* תור push — מעובד גם ע״י cron */
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const closePoints = useCallback(() => {
    setPointsOpen(false);
    setPointsLoading(false);
    setPointsJob(null);
    setJobPoints([]);
  }, []);

  const deleteJob = useCallback(
    async (job: Unified) => {
      try {
        setIsLoading(true);
        if (job.kind === 'regular') {
          const { error: jspErr } = await supabase.from('job_service_points').delete().eq('job_id', job.id);
          if (jspErr) throw jspErr;
          const { error } = await supabase.from('jobs').delete().eq('id', job.id);
          if (error) throw error;
        } else if (job.kind === 'installation') {
          const { error: dErr } = await supabase.from('installation_devices').delete().eq('installation_job_id', job.id);
          if (dErr) throw dErr;
          const { error } = await supabase.from('installation_jobs').delete().eq('id', job.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('special_jobs').delete().eq('id', job.id);
          if (error) throw error;
        }

        setItems((prev) => prev.filter((x) => !(x.kind === job.kind && x.id === job.id)));
        setExecuteJob((j) => (j && j.kind === job.kind && j.id === job.id ? null : j));
        setEdit((e) => (e && e.kind === job.kind && e.id === job.id ? null : e));
        if (pointsJob && pointsJob.kind === job.kind && pointsJob.id === job.id) {
          closePoints();
        }

        Toast.show({ type: 'success', text1: 'נמחק' });
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
      } finally {
        setIsLoading(false);
      }
    },
    [closePoints, pointsJob],
  );

  const listHeader = useMemo(
    () => (
      <View style={{ gap: 11 }}>
        {/* ── Calendar Card ─────────────────────────────── */}
        <View style={st.calCard}>
          <View style={st.calMonthRow}>
            {/* RTL: left button = next month */}
            <Pressable
              onPress={() => {
                const d = new Date(`${day}T00:00:00`);
                d.setDate(1);
                d.setMonth(d.getMonth() + 1);
                setDay(yyyyMmDd(d));
              }}
              style={({ pressed }) => [st.calNavBtn, pressed && { opacity: 0.5 }]}
              hitSlop={8}
            >
              <ChevronLeft size={18} color={colors.text} strokeWidth={2.5} />
            </Pressable>

            <Pressable
              onPress={() => setDay(todayStr)}
              style={({ pressed }) => [st.calMonthLabelWrap, pressed && { opacity: 0.75 }]}
            >
              <Text style={st.calMonthText}>{calMonthLabel}</Text>
            </Pressable>

            {/* RTL: right button = previous month */}
            <Pressable
              onPress={() => {
                const d = new Date(`${day}T00:00:00`);
                d.setDate(1);
                d.setMonth(d.getMonth() - 1);
                setDay(yyyyMmDd(d));
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
              if (page === 0) setDay(yyyyMmDd(addDays(parsedDay, 7)));
              else if (page === 2) setDay(yyyyMmDd(addDays(parsedDay, -7)));
            }}
          >
            {threeWeeks.map((week, pageIdx) => (
              <View key={pageIdx} style={[st.calWeekPage, { width: weekScrollWidth }]}>
                {week.map((d) => {
                  const ds = yyyyMmDd(d);
                  const isSelected   = ds === day;
                  const isToday      = ds === todayStr;
                  const isOtherMonth = d.getMonth() !== parsedDay.getMonth();
                  return (
                    <Pressable key={ds} onPress={() => setDay(ds)} style={st.calDayCell}>
                      <View style={[
                        st.calDayBubble,
                        isSelected && st.calDayBubbleSel,
                        isToday && !isSelected && st.calDayBubbleToday,
                      ]}>
                        <Text style={[
                          st.calDayNum,
                          isSelected && st.calDayNumSel,
                          isToday && !isSelected && st.calDayNumToday,
                          isOtherMonth && !isSelected && st.calDayNumFaded,
                        ]}>
                          {d.getDate()}
                        </Text>
                      </View>
                      <View style={[st.calDayDot, isSelected && st.calDayDotVisible]} />
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

        {/* ── חיפוש + סינון עובד + הוספת משימה (כמו JobsScreen) ── */}
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
              value={searchQ}
              onChangeText={setSearchQ}
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

          <Pressable accessibilityRole="button" onPress={() => setWorkerFilterOpen(true)} hitSlop={8}>
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

          <Pressable accessibilityRole="button" onPress={() => setCreateOpen(true)} hitSlop={8}>
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
                <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            )}
          </Pressable>
        </View>

        {isSearchActive && (
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
              {filteredItems.length} תוצאות
            </Text>
          </View>
        )}

      </View>
    ),
    [
      calMonthLabel,
      day,
      filteredItems.length,
      isSearchActive,
      parsedDay,
      searchQ,
      stats,
      threeWeeks,
      todayStr,
      weekDates,
      weekScrollWidth,
      ui.muted,
    ],
  );

  return (
    <View style={st.screen}>
      <FlatList
        data={filteredItems}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={st.listContent}
        refreshing={loading}
        onRefresh={() => { fetchUsers(); fetchDay(); }}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => {
          const isCompleted = item.status === 'completed';
          const kindConf    = KIND_CONFIG[item.kind];
          const workerName  = userMap.get(item.worker_id) ?? item.worker_id.slice(0, 6);

          return (
            <View style={[st.taskWrap, isCompleted && { opacity: 0.68 }]}>
              <View style={st.taskInner}>

                {/* Body */}
                <View style={st.taskBody}>
                  {/* Row 1: avatar + worker name (right) | kind chip + time + status (left) */}
                  <View style={st.taskTopRow}>
                    <View style={st.taskWho}>
                      <Avatar
                        size={24}
                        uri={userAvatarMap.get(item.worker_id) ?? null}
                        name={workerName}
                      />
                      <Text style={st.taskWorkerName} numberOfLines={1}>{workerName}</Text>
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
                        <Text style={st.statusChipText}>
                          {isCompleted ? 'הושלם' : 'ממתין'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Row 2: customer / location */}
                  <Text style={st.taskCustomer} numberOfLines={1}>
                    {customerLabel(item)}
                  </Text>

                  {!!item.notes && (
                    <Text style={st.taskNotes} numberOfLines={1}>{item.notes}</Text>
                  )}
                </View>

                {/* Action strip */}
                <View style={st.taskActions}>
                  {/* Complete / done button */}
                  <Pressable
                    style={[st.tcBtn, isCompleted && st.tcBtnDone]}
                    onPress={() => setExecuteJob(item)}
                    accessibilityLabel="ביצוע משימה"
                  >
                    {isCompleted
                      ? <Check size={15} color='#34C759' strokeWidth={2.2} />
                      : <ArrowUpRight size={15} color='#1E3A8A' strokeWidth={2.2} />
                    }
                  </Pressable>

                  {/* Delete button */}
                  <Pressable
                    style={st.tcBtn}
                    accessibilityLabel="מחיקה"
                    onPress={() => setDeleteConfirmJob(item)}
                  >
                    <Trash2 size={14} color='#1E3A8A' strokeWidth={2} />
                  </Pressable>

                  {/* Edit / pencil button */}
                  <Pressable
                    style={st.tcBtn}
                    onPress={() => {
                      setEdit(item);
                      setNewTime(formatHm(item.date));
                      setNewWorkerId(item.worker_id);
                      setEditNotes(item.notes ?? '');
                      if (item.kind === 'special') {
                        setEditSpecialJobType(
                          item.job_type && ADMIN_SPECIAL_JOB_TYPES.some((t) => t.value === item.job_type)
                            ? item.job_type!
                            : ADMIN_SPECIAL_JOB_TYPES[0]!.value,
                        );
                        setEditBatteryType(item.battery_type === 'DC' ? 'DC' : 'AA');
                      }
                    }}
                    accessibilityLabel="עריכה"
                  >
                    <Pencil size={14} color='#1E3A8A' strokeWidth={2} />
                  </Pressable>

                  <View style={{ flex: 1 }} />
                </View>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        ListEmptyComponent={
          items.length === 0 ? (
            <View style={st.emptyWrap}>
              <View style={st.emptyIconWrap}>
                <CalendarDays size={26} color={colors.muted} strokeWidth={1.5} />
              </View>
              <Text style={st.emptyTitle}>אין משימות ליום הזה</Text>
              <Text style={st.emptySubtitle}>שייך תבנית לתאריך ליצירת משימות</Text>
            </View>
          ) : (
            <View style={st.emptyWrap}>
              <View style={st.emptyIconWrap}>
                <Search size={26} color={colors.muted} strokeWidth={1.5} />
              </View>
              <Text style={st.emptyTitle}>לא נמצאו תוצאות</Text>
              <Text style={st.emptySubtitle}>נסו מילת חיפוש אחרת</Text>
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Edit task modal — redesigned ─── */}
      <ModalSheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        containerStyle={{ maxHeight: screenHeight * 0.92 }}
      >
        {!!edit && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* ── Header ── */}
            <View style={st.editHdr}>
              <View style={st.editHdrLeft}>
                <View style={[st.editHdrKindDot, { backgroundColor: KIND_CONFIG[edit.kind].color }]} />
                <View>
                  <Text style={st.editHdrTitle}>עריכת משימה</Text>
                  <Text style={st.editHdrSub}>{KIND_CONFIG[edit.kind].label}{edit.order_number != null ? ` · #${edit.order_number}` : ''}</Text>
                </View>
              </View>
              <Pressable onPress={() => setEdit(null)} hitSlop={12}>
                {({ pressed }) => (
                  <View style={[st.jbExecCloseBtn, pressed && { opacity: 0.75 }]}>
                    <Text style={st.jbExecCloseBtnText}>✕</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* ── Customer + status info strip ── */}
            <View style={st.editInfoStrip}>
              <View style={st.editInfoItem}>
                <Text style={st.editInfoLabel}>לקוח</Text>
                <Text style={st.editInfoValue} numberOfLines={1}>{customerLabel(edit)}</Text>
              </View>
              <View style={st.editInfoDivider} />
              <View style={st.editInfoItem}>
                <Text style={st.editInfoLabel}>סטטוס</Text>
                <View style={[st.editStatusPill, edit.status === 'completed' ? st.editStatusDone : st.editStatusPending]}>
                  <View style={[st.editStatusDot, { backgroundColor: edit.status === 'completed' ? '#34C759' : '#FF9500' }]} />
                  <Text style={[st.editStatusText, { color: edit.status === 'completed' ? '#248A3D' : '#C93400' }]}>
                    {edit.status === 'completed' ? 'הושלם' : 'ממתין'}
                  </Text>
                </View>
              </View>
              <View style={st.editInfoDivider} />
              <View style={st.editInfoItem}>
                <Text style={st.editInfoLabel}>שעה נוכחית</Text>
                <View style={st.editCurrentTimePill}>
                  <Clock size={12} color="#007AFF" strokeWidth={2.5} />
                  <Text style={st.editCurrentTimeText}>{formatHm(edit.date)}</Text>
                </View>
              </View>
            </View>

            {/* ── סוג משימה (מיוחדת / התקנה) ── */}
            {edit.kind === 'special' ? (
              <View style={st.editSection}>
                <View style={st.editSectionTitleRow}>
                  <Sparkles size={16} color={KIND_CONFIG.special.color} strokeWidth={2.2} />
                  <Text style={st.editSectionTitle}>סוג משימה מיוחדת</Text>
                </View>
                <View style={{ gap: 12 }}>
                  <SelectSheet
                    label="סוג הפעולה"
                    value={editSpecialJobType}
                    options={ADMIN_SPECIAL_JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    onChange={setEditSpecialJobType}
                  />
                  {editSpecialMeta?.needsBattery ? (
                    <SelectSheet label="סוג סוללה" value={editBatteryType} options={BATTERY_TYPES} onChange={setEditBatteryType} />
                  ) : null}
                </View>
              </View>
            ) : null}

            {edit.kind === 'installation' && !!edit.device_type ? (
              <View style={st.editSection}>
                <View style={st.editSectionTitleRow}>
                  <Layers size={16} color={KIND_CONFIG.installation.color} strokeWidth={2.2} />
                  <Text style={st.editSectionTitle}>מכשיר / סוג התקנה</Text>
                </View>
                <View style={st.editKindDetailCard}>
                  <Text style={st.editKindDetailValue}>{edit.device_type}</Text>
                </View>
              </View>
            ) : null}

            {/* ── הערות — עריכה ── */}
            <View style={st.editSection}>
              <View style={st.editSectionTitleRow}>
                <Pencil size={16} color="#007AFF" strokeWidth={2.2} />
                <Text style={st.editSectionTitle}>הערות למשימה</Text>
              </View>
              <Input
                label={undefined}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="הוסיפו הערות לעובד…"
                multiline
                textAlignVertical="top"
                numberOfLines={5}
                style={{ minHeight: 110, paddingTop: 12 }}
              />
            </View>

            {/* ── Section: עריכת שעה ── */}
            <View style={st.editSection}>
              <View style={st.editSectionTitleRow}>
                <Clock size={16} color="#007AFF" strokeWidth={2.2} />
                <Text style={st.editSectionTitle}>שעת ביצוע</Text>
              </View>
              <View style={st.editTimeGrid}>
                {[
                  '07:00','07:30','08:00','08:30','09:00','09:30',
                  '10:00','10:30','11:00','11:30','12:00','12:30',
                  '13:00','13:30','14:00','14:30','15:00','15:30',
                  '16:00','16:30','17:00','17:30','18:00','18:30',
                  '19:00','19:30','20:00',
                ].map((t) => {
                  const isSel = newTime === t;
                  return (
                    <Pressable key={t} onPress={() => setNewTime(t)} style={[st.editTimeBtn, isSel && st.editTimeBtnSel]}>
                      <Text style={[st.editTimeBtnText, isSel && st.editTimeBtnTextSel]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Section: בחירת עובד ── */}
            <View style={st.editSection}>
              <View style={st.editSectionTitleRow}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>W</Text>
                </View>
                <Text style={st.editSectionTitle}>עובד מבצע</Text>
              </View>
              <View style={st.editWorkerList}>
                {users.filter((u) => u.role === 'worker' || u.role === 'admin').map((u) => {
                  const isSel = (newWorkerId || edit.worker_id) === u.id;
                  return (
                    <Pressable key={u.id} onPress={() => setNewWorkerId(u.id)}>
                      {({ pressed }) => (
                        <View style={[st.editWorkerCard, isSel && st.editWorkerCardSel, pressed && !isSel && { opacity: 0.7 }]}>
                          <Avatar
                            size={40}
                            uri={u.avatar_url ?? null}
                            name={u.name}
                            style={isSel ? { borderWidth: 2.5, borderColor: '#007AFF' } : { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)' }}
                          />
                          <Text style={[st.editWorkerCardName, isSel && st.editWorkerCardNameSel]} numberOfLines={1}>{u.name}</Text>
                          {isSel && (
                            <View style={st.editWorkerCheckBubble}>
                              <Check size={13} color="#fff" strokeWidth={3} />
                            </View>
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Action buttons ── */}
            <View style={st.editActions}>
              <Pressable onPress={saveEdit} style={{ flex: 2 }}>
                {({ pressed }) => (
                  <View style={[st.editSaveBtn, pressed && { opacity: 0.9 }]}>
                    <Check size={18} color="#fff" strokeWidth={2.5} />
                    <Text style={st.editSaveBtnText}>שמור שינויים</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => setEdit(null)} style={{ flex: 1 }}>
                {({ pressed }) => (
                  <View style={[st.editCancelBtn, pressed && { opacity: 0.75 }]}>
                    <Text style={st.editCancelBtnText}>ביטול</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </ModalSheet>

      {/* ── Execute task — עיצוב כמו JobsScreen (בצע משימה) ─ */}
      <ModalSheet
        visible={!!executeJob}
        onClose={closeExecuteModal}
        containerStyle={{ maxHeight: screenHeight * 0.82 }}
      >
        {!!executeJob && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 34 }}
          >
            <View style={st.jbExecHeaderWrap}>
              <View style={st.jbExecHeaderRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={st.jbExecTitle}>ביצוע משימה</Text>
                  <View style={st.jbExecBadgeRow}>
                    {executeJob.order_number != null && (
                      <View style={st.jbExecOrderBadge}>
                        <Text style={st.jbExecOrderBadgeText}>#{executeJob.order_number}</Text>
                      </View>
                    )}
                    <View
                      style={[
                        st.jbExecStatusBadge,
                        executeJob.status === 'completed' ? st.jbExecStatusBadgeDone : null,
                      ]}
                    >
                      <View
                        style={[
                          st.jbExecStatusDot,
                          { backgroundColor: executeJob.status === 'completed' ? '#34C759' : '#FF9500' },
                        ]}
                      />
                      <Text
                        style={[
                          st.jbExecStatusText,
                          { color: executeJob.status === 'completed' ? '#248A3D' : '#C93400' },
                        ]}
                      >
                        {executeJob.status === 'completed' ? 'הושלם' : 'ממתין'}
                      </Text>
                    </View>
                    <View
                      style={[
                        st.jbExecKindBadge,
                        executeJob.kind === 'regular' && st.jbExecKindRegular,
                        executeJob.kind === 'installation' && st.jbExecKindInstall,
                        executeJob.kind === 'special' && st.jbExecKindSpecial,
                      ]}
                    >
                      <Text style={[st.jbExecKindBadgeText, { color: KIND_CONFIG[executeJob.kind].color }]}>
                        {KIND_CONFIG[executeJob.kind].label}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable onPress={closeExecuteModal} hitSlop={12}>
                  {({ pressed }) => (
                    <View style={[st.jbExecCloseBtn, pressed && { opacity: 0.75 }]}>
                      <Text style={st.jbExecCloseBtnText}>✕</Text>
                    </View>
                  )}
                </Pressable>
              </View>
              <View style={st.jbExecHeaderDivider} />
            </View>

            <View style={st.jbExecSummaryCard}>
              <Text style={st.jbExecCustomerLine} numberOfLines={2}>
                לקוח: {customerLabel(executeJob)}
              </Text>
              <View style={st.jbExecWorkerRow}>
                <Avatar
                  size={36}
                  uri={userAvatarMap.get(executeJob.worker_id) ?? null}
                  name={userMap.get(executeJob.worker_id) ?? ''}
                  style={{ borderWidth: 2, borderColor: 'rgba(0,0,0,0.04)' }}
                />
                <Text style={st.jbExecWorkerName} numberOfLines={1}>
                  {userMap.get(executeJob.worker_id) ?? executeJob.worker_id.slice(0, 6)}
                </Text>
              </View>
              <View style={st.jbExecMetaRow}>
                <Clock size={14} color="#8E8E93" strokeWidth={2} />
                <Text style={st.jbExecMetaText}>{formatHm(executeJob.date)}</Text>
              </View>
              {!!executeJob.notes && (
                <Text style={st.jbExecNotes} numberOfLines={3}>
                  {executeJob.notes}
                </Text>
              )}
            </View>

            {executeJob.kind === 'regular' ? (
              execPointsLoading ? (
                <View style={st.jbExecPointsLoading}>
                  <Text style={st.jbExecPointsLoadingText}>טוען נקודות שירות…</Text>
                </View>
              ) : execPoints.length === 0 ? (
                <View style={st.jbExecEmptyPoints}>
                  <View style={st.jbExecEmptyPointsIcon}>
                    <Droplets size={24} color="#8E8E93" />
                  </View>
                  <Text style={st.jbExecEmptyPointsText}>אין נקודות שירות</Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <Text style={st.jbExecSectionLabel}>נקודות שירות ({execPoints.length})</Text>
                  {execPoints.map((item) => {
                    const currentImageUrl = jobImageDisplayUri(item.image_url);
                    const previewUri = item.localImageUri ?? currentImageUrl ?? null;
                    const refill = item.custom_refill_amount ?? item.sp?.refill_amount ?? null;
                    const hasImage = !!item.image_url;
                    const canEdit = executeJob.status === 'pending';

                    return (
                      <View key={item.id} style={st.jbExecPointCard}>
                        <View style={st.jbExecPointCardHeader}>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={st.jbExecPointTitle} numberOfLines={1}>
                              {item.sp?.device_type ?? `נקודה ${item.service_point_id.slice(0, 6)}`}
                            </Text>
                            <View style={st.jbExecPointSubRow}>
                              <Droplets size={12} color="#8E8E93" />
                              <Text style={st.jbExecPointSubText}>
                                {item.sp?.scent_type ?? '—'} · {refill ?? '—'} מ״ל
                              </Text>
                            </View>
                          </View>
                          {hasImage && (
                            <View style={st.jbExecPointDoneDot}>
                              <Text style={st.jbExecPointDoneCheck}>✓</Text>
                            </View>
                          )}
                        </View>

                        {!!previewUri ? (
                          <View style={st.jbExecPointImageWrap}>
                            <Image
                              source={{ uri: previewUri }}
                              style={st.jbExecPointImage}
                              resizeMode="cover"
                            />
                            {canEdit && (
                              <Pressable
                                onPress={() => removeExecImage(item.id)}
                                hitSlop={10}
                                style={({ pressed }) => [
                                  st.jbExecPointRemoveBtn,
                                  pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel="מחק תמונה"
                              >
                                <X size={14} color="#fff" strokeWidth={3} />
                              </Pressable>
                            )}
                          </View>
                        ) : (
                          <Pressable
                            onPress={canEdit ? () => pickExecImage(item.id) : undefined}
                            disabled={!canEdit}
                          >
                            <View style={st.jbExecPointPlaceholder}>
                              <Eye size={20} color="#C7C7CC" />
                              <Text style={st.jbExecPointPlaceholderText}>טרם הועלתה תמונה</Text>
                            </View>
                          </Pressable>
                        )}

                        {canEdit && (
                          <View style={st.jbExecPointActions}>
                            <Pressable onPress={() => pickExecImage(item.id)} style={{ flex: 1 }}>
                              {({ pressed }) => (
                                <View style={[st.jbExecPickBtn, pressed && { opacity: 0.92 }]}>
                                  <Eye size={15} color="#3C3C43" />
                                  <Text style={st.jbExecPickBtnText}>
                                    {previewUri ? 'החלף תמונה' : 'בחר תמונה'}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={st.jbExecEmptyPoints}>
                <View style={st.jbExecEmptyPointsIcon}>
                  <Layers size={22} color="#8E8E93" strokeWidth={1.5} />
                </View>
                <Text style={st.jbExecEmptyPointsText}>אין נקודות למשימה זו</Text>
              </View>
            )}

            <View style={{ marginTop: 24 }}>
              {executeJob.status === 'completed' ? (
                <View style={st.jbExecDoneBanner}>
                  <View style={st.jbExecDoneIcon}>
                    <Text style={st.jbExecDoneIconText}>✓</Text>
                  </View>
                  <Text style={st.jbExecDoneLabel}>המשימה הושלמה</Text>
                </View>
              ) : (
                <Pressable
                  onPress={markExecuteCompleted}
                  disabled={!isExecCompletable}
                  accessibilityLabel="סיים משימה"
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        st.jbExecCompleteBtn,
                        !isExecCompletable && { opacity: 0.5 },
                        pressed && isExecCompletable && { opacity: 0.92 },
                      ]}
                    >
                      <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={st.jbExecCompleteBtnText}>סיים משימה</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>

            {executeJob.status === 'completed' && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Button title="סגור" variant="secondary" style={{ borderRadius: 14 }} onPress={closeExecuteModal} />
                <Button title="החזר לממתין" variant="danger" style={{ borderRadius: 14 }} onPress={confirmRevertToPending} />
              </View>
            )}
          </ScrollView>
        )}
      </ModalSheet>

      {/* ── Service Points Window ───────────────────────── */}
      <OriginWindow visible={pointsOpen} originRect={pointsOriginRect} onClose={closePoints}>
        <View style={{ flex: 1, padding: 14 }}>
          <View style={st.jbExecHeaderWrap}>
            <View style={st.jbExecHeaderRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.jbExecTitle}>נקודות שירות</Text>
                {!!pointsJob && (
                  <Text style={st.jbPointsSheetSubtitle} numberOfLines={1}>
                    {customerLabel(pointsJob)} · {userMap.get(pointsJob.worker_id) ?? pointsJob.worker_id.slice(0, 6)}
                  </Text>
                )}
              </View>
              <Pressable onPress={closePoints} hitSlop={12}>
                {({ pressed }) => (
                  <View style={[st.jbExecCloseBtn, pressed && { opacity: 0.75 }]}>
                    <Text style={st.jbExecCloseBtnText}>✕</Text>
                  </View>
                )}
              </Pressable>
            </View>
            <View style={st.jbExecHeaderDivider} />
          </View>

          {!!pointsJob && pointsJob.kind === 'regular' && (
            <View style={[st.jbExecSummaryCard, { marginTop: 12, marginBottom: 12 }]}>
              <Text style={st.jbExecCustomerLine} numberOfLines={2}>
                לקוח: {customerLabel(pointsJob)}
              </Text>
              <View style={st.jbExecWorkerRow}>
                <Avatar
                  size={36}
                  uri={userAvatarMap.get(pointsJob.worker_id) ?? null}
                  name={userMap.get(pointsJob.worker_id) ?? ''}
                  style={{ borderWidth: 2, borderColor: 'rgba(0,0,0,0.04)' }}
                />
                <Text style={st.jbExecWorkerName} numberOfLines={1}>
                  {userMap.get(pointsJob.worker_id) ?? pointsJob.worker_id.slice(0, 6)}
                </Text>
              </View>
            </View>
          )}

          {pointsLoading ? (
            <View style={st.jbExecPointsLoading}>
              <Text style={st.jbExecPointsLoadingText}>טוען נקודות שירות…</Text>
            </View>
          ) : pointsJob?.kind !== 'regular' ? (
            <View style={st.jbExecEmptyPoints}>
              <View style={st.jbExecEmptyPointsIcon}>
                <Layers size={22} color="#8E8E93" strokeWidth={1.5} />
              </View>
              <Text style={st.jbExecEmptyPointsText}>אין נקודות למשימה זו</Text>
            </View>
          ) : (
            <FlatList
              data={jobPoints}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <View style={st.jbExecPointCard}>
                  <View style={st.jbExecPointCardHeader}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={st.jbExecPointTitle} numberOfLines={1}>
                        {item.sp?.device_type ?? item.service_point_id}
                      </Text>
                      <View style={st.jbExecPointSubRow}>
                        <Droplets size={12} color="#8E8E93" />
                        <Text style={st.jbExecPointSubText}>
                          ניחוח: {item.sp?.scent_type ?? '-'} · מילוי: {item.custom_refill_amount ?? item.sp?.refill_amount ?? '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {!!item.sp?.notes && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                      <View style={st.jbPointInlineDivider} />
                      <Text style={st.jbExecNotes} numberOfLines={3}>
                        {item.sp.notes}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={st.jbExecEmptyPoints}>
                  <View style={st.jbExecEmptyPointsIcon}>
                    <Layers size={22} color="#8E8E93" strokeWidth={1.5} />
                  </View>
                  <Text style={st.jbExecEmptyPointsText}>אין נקודות למשימה זו</Text>
                </View>
              }
            />
          )}

          <Button title="סגור" variant="secondary" onPress={closePoints} style={{ borderRadius: 14, marginTop: 8 }} />
        </View>
      </OriginWindow>

      <AdminCreateJobSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchDay}
        initialDateYmd={day}
        users={users}
      />

      <ModalSheet visible={!!deleteConfirmJob} onClose={() => setDeleteConfirmJob(null)} containerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 }}>
        {!!deleteConfirmJob && (
          <View style={{ width: '100%', alignItems: 'stretch' }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <Text
                style={{
                  flex: 1,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  fontSize: 20,
                  fontWeight: '900',
                  color: colors.text,
                  letterSpacing: -0.3,
                }}
                numberOfLines={2}
              >
                מחיקת משימה
              </Text>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,59,48,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={22} color="#FF3B30" strokeWidth={2.2} />
              </View>
            </View>

            <Text
              style={{
                textAlign: 'right',
                writingDirection: 'rtl',
                fontSize: 15,
                fontWeight: '500',
                color: colors.muted,
                lineHeight: 22,
                marginBottom: 14,
              }}
            >
              האם למחוק את המשימה? הפעולה אינה הפיכה.
            </Text>

            <View
              style={{
                backgroundColor: colors.elevated,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View
                  style={[
                    st.jbExecKindBadge,
                    deleteConfirmJob.kind === 'regular' && st.jbExecKindRegular,
                    deleteConfirmJob.kind === 'installation' && st.jbExecKindInstall,
                    deleteConfirmJob.kind === 'special' && st.jbExecKindSpecial,
                  ]}
                >
                  <Text style={[st.jbExecKindBadgeText, { color: KIND_CONFIG[deleteConfirmJob.kind].color }]}>
                    {KIND_CONFIG[deleteConfirmJob.kind].label}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color="#8E8E93" strokeWidth={2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' }}>
                    {formatHm(deleteConfirmJob.date)}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' }} numberOfLines={2}>
                לקוח: {customerLabel(deleteConfirmJob)}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, textAlign: 'right', writingDirection: 'rtl' }} numberOfLines={1}>
                עובד: {userMap.get(deleteConfirmJob.worker_id) ?? deleteConfirmJob.worker_id.slice(0, 8)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 22 }}>
              <Pressable
                onPress={() => {
                  const j = deleteConfirmJob;
                  setDeleteConfirmJob(null);
                  void deleteJob(j);
                }}
                style={{ flex: 1 }}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: pressed ? 'rgba(255,59,48,0.92)' : '#FF3B30',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...Platform.select({
                        ios: { shadowColor: '#FF3B30', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
                        android: { elevation: 3 },
                      }),
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, textAlign: 'center', writingDirection: 'rtl' }}>מחק</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => setDeleteConfirmJob(null)} style={{ flex: 1 }}>
                {({ pressed }) => (
                  <View
                    style={{
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: pressed ? 'rgba(120,120,128,0.14)' : 'rgba(120,120,128,0.10)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', writingDirection: 'rtl' }}>ביטול</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ModalSheet>

      <ModalSheet visible={workerFilterOpen} onClose={() => setWorkerFilterOpen(false)}>
        <View style={{ gap: 0, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ color: ui.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>סינון עובד</Text>
            <Pressable
              onPress={() => setWorkerId('')}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: pressed ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)',
              })}
            >
              <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 14 }}>נקה</Text>
            </Pressable>
          </View>

          <Text style={{ color: ui.secondary, fontWeight: '600', fontSize: 13, textAlign: 'right', marginBottom: 10 }}>עובד</Text>
          <ScrollView
            style={{ maxHeight: 340 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {[
              { id: '', label: 'הכל', avatarUrl: null as string | null },
              ...users
                .filter((u) => u.role === 'worker')
                .map((u) => ({ id: u.id, label: u.name, avatarUrl: u.avatar_url ?? null })),
            ].map((row) => {
              const selected = workerId === row.id;
              return (
                <Pressable key={row.id || 'all'} onPress={() => setWorkerId(row.id)}>
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: selected ? 'rgba(0,122,255,0.12)' : ui.fill,
                        borderWidth: selected ? 1.5 : 0,
                        borderColor: selected ? '#007AFF' : 'transparent',
                        opacity: pressed ? 0.88 : 1,
                      }}
                    >
                      {row.id ? (
                        <Avatar size={32} uri={row.avatarUrl} name={row.label} />
                      ) : (
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(120,120,128,0.14)' }} />
                      )}
                      <Text
                        style={{
                          flex: 1,
                          textAlign: 'right',
                          fontWeight: selected ? '800' : '600',
                          color: selected ? '#007AFF' : ui.text,
                          fontSize: 15,
                        }}
                        numberOfLines={1}
                      >
                        {row.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 16,
              marginTop: 8,
              borderTopWidth: 1,
              borderTopColor: ui.outline,
            }}
          >
            <Text style={{ color: ui.secondary, fontWeight: '600', fontSize: 14 }}>
              {items.length} משימות ביום
            </Text>
            <Pressable onPress={() => setWorkerFilterOpen(false)}>
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
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 2 } },
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
  todayPill: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  todayPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  calDowRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 4,
    paddingBottom: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  calDowCell: {
    flex: 1,
    alignItems: 'center',
  },
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
  calDayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    borderRadius: 12,
  },
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
      ios:     { shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  calDayBubbleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  calDayNum: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  calDayNumSel: {
    color: '#fff',
    fontWeight: '700',
  },
  calDayNumToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  calDayNumFaded: {
    color: '#D1D1D6',
  },
  calDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0,
  },
  calDayDotVisible: {
    opacity: 1,
  },
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

  // ── Stats Card ─────────────────────────────────────
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginBottom: 2,
  },
  statNumber: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 30,
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
  },
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
      ios:     { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 3 } },
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
  taskBody: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
  },
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
  taskTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
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
  taskTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
    letterSpacing: 0.4,
  },
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
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  kindChip: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    backgroundColor: 'rgba(30,58,138,0.07)',
    borderColor: 'rgba(30,58,138,0.15)',
  },
  kindChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
  },
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
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  tcBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(30,58,138,0.16)',
    backgroundColor: 'rgba(30,58,138,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tcBtnDone: {
    borderColor: 'rgba(52,199,89,0.30)',
    backgroundColor: 'rgba(52,199,89,0.08)',
  },

  // ── Empty State ────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(37,99,235,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Execute modal (JobsScreen-style) ───────────────
  jbExecHeaderWrap: {
    paddingBottom: 20,
  },
  jbExecHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  jbExecTitle: {
    color: '#1C1C1E',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.6,
  },
  jbExecBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  jbExecOrderBadge: {
    backgroundColor: 'rgba(120,120,128,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  jbExecOrderBadgeText: {
    color: '#8E8E93',
    fontWeight: '700',
    fontSize: 13,
  },
  jbExecStatusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,149,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  jbExecStatusBadgeDone: {
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  jbExecStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  jbExecStatusText: {
    fontWeight: '600',
    fontSize: 13,
  },
  jbExecKindBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jbExecKindRegular: {
    backgroundColor: 'rgba(0,122,255,0.10)',
  },
  jbExecKindInstall: {
    backgroundColor: 'rgba(175,82,222,0.10)',
  },
  jbExecKindSpecial: {
    backgroundColor: 'rgba(255,149,0,0.10)',
  },
  jbExecKindBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  jbExecCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jbExecCloseBtnText: {
    fontSize: 14,
    color: '#3C3C43',
    fontWeight: '600',
    marginTop: -1,
  },
  jbExecHeaderDivider: {
    height: 1,
    backgroundColor: 'rgba(60,60,67,0.08)',
  },
  jbExecSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.06)',
    padding: 16,
    gap: 12,
    marginBottom: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 1 },
    }),
  },
  jbExecCustomerLine: {
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'right',
    fontSize: 15,
  },
  jbExecWorkerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  jbExecWorkerName: {
    color: '#8E8E93',
    textAlign: 'right',
    fontWeight: '600',
    flex: 1,
    fontSize: 15,
  },
  jbExecMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  jbExecMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  jbExecNotes: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'right',
    lineHeight: 19,
  },
  jbExecPointsLoading: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  jbExecPointsLoadingText: {
    color: '#8E8E93',
    fontWeight: '600',
    fontSize: 14,
  },
  jbExecEmptyPoints: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  jbExecEmptyPointsIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jbExecEmptyPointsText: {
    color: '#8E8E93',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
  },
  jbExecSectionLabel: {
    color: '#8E8E93',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  jbExecPointCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.06)',
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 1 },
    }),
  },
  jbExecPointCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 12,
  },
  jbExecPointTitle: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  jbExecPointSubRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  jbExecPointSubText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  jbExecPointDoneDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(52,199,89,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jbExecPointDoneCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
  jbExecPointImageWrap: {
    position: 'relative',
    marginHorizontal: 14,
    marginBottom: 12,
  },
  jbExecPointImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(120,120,128,0.08)',
  },
  jbExecPointRemoveBtn: {
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
  jbExecPointPlaceholder: {
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
  },
  jbExecPointPlaceholderText: {
    color: '#C7C7CC',
    fontSize: 13,
    fontWeight: '500',
  },
  jbExecPointActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  jbExecPickBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(120,120,128,0.08)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  jbExecPickBtnText: {
    color: '#3C3C43',
    fontWeight: '600',
    fontSize: 14,
  },
  jbExecUploadBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,122,255,0.10)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  jbExecUploadBtnText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  jbExecDoneBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,199,89,0.10)',
    borderRadius: 14,
    paddingVertical: 16,
  },
  jbExecDoneIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jbExecDoneIconText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  jbExecDoneLabel: {
    color: '#248A3D',
    fontWeight: '700',
    fontSize: 16,
  },
  jbExecCompleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    ...Platform.select({
      ios:     { shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
    }),
  },
  jbExecCompleteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  jbPointsSheetSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'right',
  },
  jbPointInlineDivider: {
    height: 1,
    backgroundColor: 'rgba(60,60,67,0.08)',
    marginBottom: 10,
  },

  // ── Edit task modal ────────────────────────────────
  editHdr: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(60,60,67,0.08)',
    marginBottom: 16,
  },
  editHdrLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  editHdrKindDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  editHdrTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
    letterSpacing: -0.4,
  },
  editHdrSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 2,
  },
  editInfoStrip: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.10)',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 20,
    ...Platform.select({
      ios:     { shadowColor: '#2563EB', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 1 },
    }),
  },
  editInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  editInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  editInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  editInfoDivider: {
    width: 1,
    backgroundColor: 'rgba(60,60,67,0.10)',
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  editStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editStatusDone: {
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  editStatusPending: {
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  editStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  editStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editCurrentTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,122,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editCurrentTimeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#007AFF',
    letterSpacing: 0.5,
  },
  editSection: {
    marginBottom: 20,
  },
  editSectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  editSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
  },
  editTimeGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  editTimeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.06)',
    minWidth: 68,
    alignItems: 'center',
  },
  editTimeBtnSel: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    ...Platform.select({
      ios:     { shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  editTimeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C3C43',
    letterSpacing: 0.3,
  },
  editTimeBtnTextSel: {
    color: '#FFFFFF',
  },
  editWorkerList: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  editWorkerCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.08)',
    minWidth: 82,
    position: 'relative',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  editWorkerCardSel: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0,122,255,0.04)',
    ...Platform.select({
      ios:     { shadowColor: '#007AFF', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  editWorkerCardName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3C3C43',
    textAlign: 'center',
    maxWidth: 80,
  },
  editWorkerCardNameSel: {
    color: '#007AFF',
  },
  editWorkerCheckBubble: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editActions: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
  },
  editSaveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 17,
    ...Platform.select({
      ios:     { shadowColor: '#007AFF', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 5 },
    }),
  },
  editSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  editCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,120,128,0.10)',
    borderRadius: 16,
    paddingVertical: 17,
  },
  editCancelBtnText: {
    color: '#3C3C43',
    fontWeight: '700',
    fontSize: 15,
  },

  editKindDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.08)',
    padding: 14,
    gap: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 1 },
    }),
  },
  editKindDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    textAlign: 'right',
  },
  editKindDetailValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
    lineHeight: 22,
  },
  editKindDetailDivider: {
    height: 1,
    backgroundColor: 'rgba(60,60,67,0.08)',
    marginVertical: 10,
  },
});
