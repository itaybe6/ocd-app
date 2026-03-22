import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, ScrollView, SectionList, StyleSheet, Text, View, Image, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { Entypo } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { OriginWindow, type OriginRect } from '../../components/OriginWindow';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobCardAction, JobChip } from '../../components/jobs/JobCard';
import { Avatar } from '../../components/ui/Avatar';
import { getPublicUrl } from '../../lib/storage';
import { pickImageFromLibrary } from '../../lib/media';
import { completeUnifiedJob, uploadJobServicePointImage } from '../../lib/execution';
import { supabase } from '../../lib/supabase';
import { timeSlots, toDate, yyyyMmDd } from '../../lib/time';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';
import { FabButton } from '../../components/ui/FabButton';

const { height: screenHeight } = Dimensions.get('window');

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
  | (BaseUnified & { kind: 'special'; job_type?: string | null; battery_type?: string | null; image_url?: string | null });

type UserLite = { id: string; name: string; role: 'admin' | 'worker' | 'customer'; avatar_url?: string | null };

type JobServicePoint = { id: string; job_id: string; service_point_id: string; image_url?: string | null; custom_refill_amount?: number | null };
type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };

type InstallationDevice = { id: string; installation_job_id: string; image_url?: string | null; device_name?: string | null };

type OneTimeCustomerPayload = { name: string; phone?: string; address?: string };
type CreateSelectedPoint = ServicePoint & { selected: boolean; custom_refill_amount: string }; // empty => none
type InstallationDeviceDraft = { device_name: string };

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

function combineDateTimeToIso(dateYmd: string, timeHm: string): string {
  // local time -> ISO (UTC)
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(d.getTime())) throw new Error('תאריך/שעה לא תקינים');
  return d.toISOString();
}

type Filters = {
  date: string; // yyyy-MM-dd or empty
  status: '' | JobStatus;
  tag: '' | JobTag;
  q: string;
};

export function JobsScreen() {
  const { setIsLoading } = useLoading();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [items, setItems] = useState<UnifiedJob[]>([]);

  const [filters, setFilters] = useState<Filters>({ date: '', status: '', tag: '', q: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selected, setSelected] = useState<UnifiedJob | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOriginRect, setDetailsOriginRect] = useState<OriginRect | null>(null);
  const detailsOriginRectRef = useRef<OriginRect | null>(null);
  const detailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [regularPoints, setRegularPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null })[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [execJob, setExecJob] = useState<UnifiedJob | null>(null);
  const [execOpen, setExecOpen] = useState(false);
  const [execPoints, setExecPoints] = useState<
    (JobServicePoint & { sp?: ServicePoint | null; localImageUri?: string | null; uploading?: boolean })[]
  >([]);
  const execCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<JobKind>('regular');
  const [createStatus, setCreateStatus] = useState<JobStatus>('pending');
  const [createDateYmd, setCreateDateYmd] = useState('');
  const [createTimeHm, setCreateTimeHm] = useState('09:00');
  const [createDatePickerOpen, setCreateDatePickerOpen] = useState(false);

  const [createWorkerId, setCreateWorkerId] = useState('');
  const [createCustomerId, setCreateCustomerId] = useState('');
  const [createUseOneTimeCustomer, setCreateUseOneTimeCustomer] = useState(false);
  const [createOneTimeCustomer, setCreateOneTimeCustomer] = useState<OneTimeCustomerPayload>({ name: '', phone: '', address: '' });

  const [createNotes, setCreateNotes] = useState('');
  const [createOrderNumber, setCreateOrderNumber] = useState('');

  const [createServicePoints, setCreateServicePoints] = useState<CreateSelectedPoint[]>([]);

  const [createSpecialJobType, setCreateSpecialJobType] = useState<string>(SPECIAL_JOB_TYPES[0].value);
  const [createBatteryType, setCreateBatteryType] = useState<string>('AA');
  const [createInstallationDevices, setCreateInstallationDevices] = useState<InstallationDeviceDraft[]>([{ device_name: '' }]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const userAvatarMap = useMemo(() => new Map(users.map((u) => [u.id, u.avatar_url ?? null])), [users]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('id, name, role, avatar_url');
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
      if (filters.tag === 'smell' && it.kind !== 'regular') return false;
      if (filters.tag === 'other' && it.kind === 'regular') return false;
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

  const closeExec = useCallback(() => {
    setExecOpen(false);
    if (execCloseTimerRef.current) clearTimeout(execCloseTimerRef.current);
    execCloseTimerRef.current = setTimeout(() => {
      setExecJob(null);
      setExecPoints([]);
    }, 520);
  }, []);

  const openJob = async (job: UnifiedJob, opts?: { mode?: 'view' | 'execute' }) => {
    const mode = opts?.mode ?? 'view';
    if (mode === 'execute') {
      setSelected(null);
      setDetailsOpen(false);
      setExecJob(job);
      setExecOpen(false);
      setExecPoints([]);
      setTimeout(() => setExecOpen(true), 0);
    } else {
      setSelected(job);
    }

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

  const openDetails = (job: UnifiedJob) => {
    // Flush the latest captured rect into state right before opening
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
      setImages([]);
      setPreviewImageUrl(null);
    }, 520);
  }, []);

  const pickExecImage = async (jobServicePointId: string) => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setExecPoints((prev) => prev.map((p) => (p.id === jobServicePointId ? { ...p, localImageUri: uri } : p)));
  };

  const uploadExecPoint = async (
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
        prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath, uploading: false, localImageUri: null } : x))
      );
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath } : x)));
      setImages((prev) => Array.from(new Set([...prev, getPublicUrl(storagePath)])));
      Toast.show({ type: 'success', text1: 'התמונה הועלתה' });
    } catch (e: any) {
      setExecPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const completeExecJob = async () => {
    if (!execJob || execJob.kind !== 'regular') return;
    try {
      setIsLoading(true);
      await completeUnifiedJob('regular', execJob.id);
      setItems((prev) => prev.map((j) => (j.kind === 'regular' && j.id === execJob.id ? { ...j, status: 'completed' } : j)));
      setExecJob((p) => (p ? { ...p, status: 'completed' } : p));
      Toast.show({ type: 'success', text1: 'המשימה הושלמה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
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

  const timeOptions = useMemo(
    () => timeSlots({ startHm: '08:00', endHm: '20:00', stepMinutes: 30 }).map((t) => ({ value: t, label: t })),
    []
  );
  const dateOptions = useMemo(() => {
    const base = new Date();
    const list: { value: string; label: string }[] = [];
    for (let i = 0; i <= 180; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const ymd = yyyyMmDd(d);
      list.push({ value: ymd, label: ymd });
    }
    return list;
  }, []);
  const createDateValue = useMemo(() => {
    if (!createDateYmd) return new Date();
    const d = toDate(createDateYmd);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [createDateYmd]);

  const createWorkerOptions = useMemo(
    () => users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name, avatarUrl: u.avatar_url ?? null })),
    [users]
  );
  const createCustomerOptions = useMemo(
    () => users.filter((u) => u.role === 'customer').map((u) => ({ value: u.id, label: u.name, avatarUrl: u.avatar_url ?? null })),
    [users]
  );

  const createSpecialTypeMeta = useMemo(
    () => SPECIAL_JOB_TYPES.find((t) => t.value === createSpecialJobType) ?? null,
    [createSpecialJobType]
  );

  const fetchCreateServicePoints = useCallback(async (custId: string) => {
    const { data, error } = await supabase
      .from('service_points')
      .select('id, device_type, scent_type, refill_amount')
      .eq('customer_id', custId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const list = (data ?? []) as ServicePoint[];
    setCreateServicePoints(
      list.map((sp) => ({
        ...sp,
        selected: true,
        custom_refill_amount: '',
      }))
    );
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    if (!createCustomerId || createUseOneTimeCustomer || createKind !== 'regular') {
      setCreateServicePoints([]);
      return;
    }
    fetchCreateServicePoints(createCustomerId).catch((e: any) => {
      Toast.show({ type: 'error', text1: 'טעינת נקודות שירות נכשלה', text2: e?.message ?? 'Unknown error' });
      setCreateServicePoints([]);
    });
  }, [createCustomerId, createUseOneTimeCustomer, createKind, createOpen, fetchCreateServicePoints]);

  const resetCreateFormMinimal = () => {
    setCreateNotes('');
    setCreateOrderNumber('');
  };

  const validateCreateCommon = () => {
    if (!createDateYmd.trim()) throw new Error('חסר תאריך (yyyy-MM-dd)');
    if (!createTimeHm.trim()) throw new Error('חסרה שעה (HH:mm)');
    if (!createWorkerId) throw new Error('חסר עובד');
    if (createKind !== 'special') {
      if (createUseOneTimeCustomer) {
        if (!createOneTimeCustomer.name.trim()) throw new Error('חסר שם לקוח חד-פעמי');
      } else {
        if (!createCustomerId) throw new Error('חסר לקוח');
      }
    }
  };

  const createOneTimeCustomerIfNeeded = async (): Promise<string | null> => {
    if (createKind === 'special') return null;
    if (!createUseOneTimeCustomer) return null;
    const payload = {
      name: createOneTimeCustomer.name.trim(),
      phone: createOneTimeCustomer.phone?.trim() || null,
      address: createOneTimeCustomer.address?.trim() || null,
    };
    const { data, error } = await supabase.from('one_time_customers').insert(payload).select('id').single();
    if (error) throw error;
    return (data as any).id as string;
  };

  const submitCreate = async () => {
    try {
      validateCreateCommon();
      setIsLoading(true);

      const dateIso = combineDateTimeToIso(createDateYmd.trim(), createTimeHm.trim());
      const oneTimeId = await createOneTimeCustomerIfNeeded();

      const common: any = {
        worker_id: createWorkerId,
        date: dateIso,
        status: createStatus,
        notes: createNotes.trim() || null,
        order_number: createOrderNumber ? Number(createOrderNumber) : null,
      };

      const customerFields =
        createKind === 'special'
          ? {}
          : {
              customer_id: createUseOneTimeCustomer ? null : createCustomerId,
              one_time_customer_id: createUseOneTimeCustomer ? oneTimeId : null,
            };

      if (createKind === 'regular') {
        const selected = createServicePoints.filter((p) => p.selected);
        if (!selected.length) throw new Error('בחר לפחות נקודת שירות אחת');

        const { data: job, error: jobErr } = await supabase.from('jobs').insert({ ...common, ...customerFields }).select('id').single();
        if (jobErr) throw jobErr;
        const jobId = (job as any).id as string;

        const jspRows = selected.map((p) => {
          const custom = p.custom_refill_amount ? Number(p.custom_refill_amount) : null;
          const differs = custom != null && custom !== p.refill_amount;
          return {
            job_id: jobId,
            service_point_id: p.id,
            custom_refill_amount: differs ? custom : null,
          };
        });

        const { error: jspErr } = await supabase.from('job_service_points').insert(jspRows);
        if (jspErr) throw jspErr;

        Toast.show({ type: 'success', text1: 'נוצרה משימת ריח' });
      }

      if (createKind === 'installation') {
        const { data: inst, error: instErr } = await supabase
          .from('installation_jobs')
          .insert({ ...common, ...customerFields })
          .select('id')
          .single();
        if (instErr) throw instErr;
        const instId = (inst as any).id as string;

        const devices = createInstallationDevices.map((d) => d.device_name.trim()).filter(Boolean);
        if (!devices.length) throw new Error('הוסף לפחות מכשיר אחד');
        const rows = devices.map((name) => ({ installation_job_id: instId, device_name: name }));
        const { error: devErr } = await supabase.from('installation_devices').insert(rows);
        if (devErr) throw devErr;

        Toast.show({ type: 'success', text1: 'נוצרה משימת התקנה' });
      }

      if (createKind === 'special') {
        const meta = createSpecialTypeMeta;
        const payload: any = {
          ...common,
          job_type: createSpecialJobType,
          battery_type: meta?.needsBattery ? createBatteryType : null,
        };
        const { error } = await supabase.from('special_jobs').insert(payload);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'נוצרה משימה מיוחדת' });
      }

      resetCreateFormMinimal();
      setCreateOpen(false);
      await fetchUnified();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'יצירה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
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
      surface: '#FAFAFC',
      surfaceLow: '#FFFFFF',
      surfaceContainerLow: '#F3F4F6',
      surfaceContainerHigh: '#EEF0F3',
      outline: 'rgba(15,23,42,0.10)',
      text: '#0F172A',
      muted: '#64748B',
      primary: '#0F172A', // neutral “ink” accent
    }),
    []
  );

  const tagLabel = (k: JobKind) => (k === 'regular' ? 'משימת ריח' : 'משימה אחרת');
  const tagChipText = (k: JobKind) => (k === 'regular' ? 'ריח' : 'אחרת');

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

  const isFiltersActive = useMemo(() => {
    return !!(filters.q.trim() || filters.status || filters.tag || filters.date.trim());
  }, [filters.date, filters.q, filters.status, filters.tag]);

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
          <View style={{ gap: 14, marginBottom: 16, paddingTop: 6 }}>
            {/* Stats bento (neutral) */}
            <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
              {[
                { label: 'הושלמו', value: stats.completed },
                { label: 'ממתינות', value: stats.pending },
                { label: 'סה״כ', value: stats.total },
              ].map((x) => (
                <View
                  key={x.label}
                  style={{
                    flex: 1,
                    backgroundColor: ui.surfaceContainerHigh,
                    borderRadius: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: ui.outline,
                  }}
                >
                  <Text style={{ color: ui.muted, fontWeight: '800', fontSize: 12, textAlign: 'right' }}>{x.label}</Text>
                  <Text style={{ color: ui.text, fontWeight: '900', fontSize: 24, textAlign: 'right', marginTop: 6 }}>
                    {x.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action row */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 }}>

                  {/* Inline search (always visible) */}
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: ui.surfaceContainerLow,
                      borderRadius: 18,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: ui.outline,
                    }}
                  >
                    <Search size={16} color="#9CA3AF" />
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
                        fontSize: 14,
                      }}
                    />
                  </View>

                  {/* Filter button */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setFiltersOpen(true)}
                    hitSlop={8}
                  >
                    {({ pressed }) => (
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: ui.surfaceContainerHigh,
                          borderWidth: 1,
                          borderColor: ui.outline,
                          opacity: pressed ? 0.82 : 1,
                          transform: [{ scale: pressed ? 0.93 : 1 }],
                          shadowColor: '#000',
                          shadowOpacity: 0.06,
                          shadowRadius: 14,
                          shadowOffset: { width: 0, height: 10 },
                          elevation: 3,
                        }}
                      >
                        <Entypo name="sound-mix" size={18} color={ui.text} />
                      </View>
                    )}
                  </Pressable>

                  {/* Add job button */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setCreateOpen(true)}
                    hitSlop={8}
                  >
                    {({ pressed }) => (
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: ui.text,
                          opacity: pressed ? 0.82 : 1,
                          transform: [{ scale: pressed ? 0.93 : 1 }],
                          shadowColor: '#000',
                          shadowOpacity: 0.14,
                          shadowRadius: 16,
                          shadowOffset: { width: 0, height: 12 },
                          elevation: 5,
                        }}
                      >
                        <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    )}
                  </Pressable>

                </View>
              </View>

              {isFiltersActive && (
                <Text style={{ color: ui.muted, fontWeight: '700', fontSize: 12, textAlign: 'right' }}>
                  {filtered.length} משימות • סינון פעיל
                </Text>
              )}
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
            title=""
            status={item.status}
            primaryNode={
              <View style={{ gap: 8, paddingTop: 2 }}>
                {/* Worker row — large avatar + bold name */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <Avatar
                    size={38}
                    uri={userAvatarMap.get(item.worker_id) ?? null}
                    name={userMap.get(item.worker_id) ?? ''}
                    style={{ backgroundColor: ui.surfaceContainerHigh }}
                  />
                  <Text
                    style={{
                      color: ui.text,
                      fontWeight: '700',
                      fontSize: 16,
                      textAlign: 'right',
                      flex: 1,
                      letterSpacing: -0.3,
                    }}
                    numberOfLines={1}
                  >
                    {userMap.get(item.worker_id) ?? item.worker_id.slice(0, 6)}
                  </Text>
                </View>

                {/* Customer name — no prefix */}
                {!!item.customer_id && (
                  <Text
                    style={{
                      color: ui.muted,
                      fontWeight: '500',
                      fontSize: 13,
                      textAlign: 'right',
                    }}
                    numberOfLines={1}
                  >
                    {userMap.get(item.customer_id) ?? item.customer_id.slice(0, 6)}
                  </Text>
                )}
              </View>
            }
            description={item.notes ?? null}
            onOriginRect={(r) => { detailsOriginRectRef.current = r; }}
            onPress={() => openDetails(item)}
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
              </>
            }
            chips={
              <>
                {item.order_number != null ? <JobChip text={`#${item.order_number}`} muted /> : null}
                <JobChip text={tagChipText(item.kind)} accent="neutral" />
                <JobChip text={yyyyMmDd(item.date)} muted />
                {item.kind === 'regular' && item.status === 'pending' ? (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); openJob(item, { mode: 'execute' }); }}>
                    {({ pressed }) => (
                      <View style={{
                        backgroundColor: ui.text,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        opacity: pressed ? 0.78 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>בצע</Text>
                      </View>
                    )}
                  </Pressable>
                ) : null}
              </>
            }
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={{ gap: 0, paddingBottom: 8 }}>

          {/* ── Header ── */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>סינון</Text>
            <Pressable
              onPress={() => setFilters({ date: '', status: '', tag: '', q: '' })}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: pressed ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.22)',
              })}
            >
              <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13 }}>נקה הכל</Text>
            </Pressable>
          </View>

          {/* ── Status chips ── */}
          <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>סטטוס</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 18 }}>
            {[
              { value: '' as const, label: 'הכל', bg: 'rgba(99,102,241,0.10)', activeBg: '#6366F1', border: 'rgba(99,102,241,0.25)', fg: '#6366F1' },
              { value: 'pending' as const, label: 'ממתין', bg: 'rgba(249,115,22,0.10)', activeBg: '#F97316', border: 'rgba(249,115,22,0.25)', fg: '#EA580C' },
              { value: 'completed' as const, label: 'הושלם', bg: 'rgba(34,197,94,0.10)', activeBg: '#22C55E', border: 'rgba(34,197,94,0.25)', fg: '#16A34A' },
            ].map((opt) => {
              const active = filters.status === opt.value;
              return (
                <Pressable
                  key={opt.value || 'all-status'}
                  onPress={() => setFilters((p) => ({ ...p, status: opt.value }))}
                >
                  {({ pressed }) => (
                    <View style={{
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 22,
                      backgroundColor: active ? opt.activeBg : opt.bg,
                      borderWidth: 1.5,
                      borderColor: active ? opt.activeBg : opt.border,
                      opacity: pressed ? 0.82 : 1,
                    }}>
                      <Text style={{ color: active ? '#FFFFFF' : opt.fg, fontWeight: '800', fontSize: 13 }}>{opt.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* ── Kind chips ── */}
          <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>סוג משימה</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 18 }}>
            {[
              { value: '' as const, label: 'הכל', bg: 'rgba(99,102,241,0.10)', activeBg: '#6366F1', border: 'rgba(99,102,241,0.25)', fg: '#6366F1' },
              { value: 'smell' as const, label: 'ריח', bg: 'rgba(0,88,188,0.08)', activeBg: '#0058BC', border: 'rgba(0,88,188,0.22)', fg: '#0058BC' },
              { value: 'other' as const, label: 'אחרת', bg: 'rgba(234,88,12,0.08)', activeBg: '#EA580C', border: 'rgba(234,88,12,0.22)', fg: '#EA580C' },
            ].map((opt) => {
              const active = filters.tag === opt.value;
              return (
                <Pressable
                  key={opt.value || 'all-kind'}
                  onPress={() => setFilters((p) => ({ ...p, tag: opt.value }))}
                >
                  {({ pressed }) => (
                    <View style={{
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 22,
                      backgroundColor: active ? opt.activeBg : opt.bg,
                      borderWidth: 1.5,
                      borderColor: active ? opt.activeBg : opt.border,
                      opacity: pressed ? 0.82 : 1,
                    }}>
                      <Text style={{ color: active ? '#FFFFFF' : opt.fg, fontWeight: '800', fontSize: 13 }}>{opt.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* ── Date ── */}
          <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>תאריך</Text>
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 10,
            backgroundColor: '#F3F4F6',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 11,
            marginBottom: 22,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.06)',
          }}>
            <CalendarDays size={17} color="#9CA3AF" />
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

          {/* ── Footer count + close ── */}
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.06)',
          }}>
            <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>
              {filtered.length} תוצאות
            </Text>
            <Pressable
              onPress={() => setFiltersOpen(false)}
            >
              {({ pressed }) => (
                <View style={{
                  paddingHorizontal: 28,
                  paddingVertical: 12,
                  borderRadius: 22,
                  backgroundColor: pressed ? 'rgba(0,88,188,0.88)' : '#0058BC',
                  shadowColor: '#0058BC',
                  shadowOpacity: 0.28,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>הצג תוצאות</Text>
                </View>
              )}
            </Pressable>
          </View>

        </View>
      </ModalSheet>

      <OriginWindow visible={detailsOpen} originRect={detailsOriginRect} onClose={closeDetails}>
        {!!selected && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, padding: 14, paddingBottom: 22 }}>
            {/* Summary card (like screenshot) */}
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
              {/* Title row + pills */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                  <Text style={{ color: ui.text, fontSize: 18, fontWeight: '900', textAlign: 'right', letterSpacing: -0.3 }}>
                    {tagLabel(selected.kind)} - #{selected.order_number ?? '—'}
                  </Text>
                  <View
                    style={{
                      backgroundColor: 'rgba(99,102,241,0.10)',
                      borderColor: 'rgba(99,102,241,0.20)',
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: '#4F46E5', fontWeight: '900', fontSize: 11 }}>{tagChipText(selected.kind)}</Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: selected.status === 'completed' ? 'rgba(34,197,94,0.10)' : 'rgba(248,113,113,0.10)',
                    borderColor: selected.status === 'completed' ? 'rgba(34,197,94,0.18)' : 'rgba(248,113,113,0.18)',
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: selected.status === 'completed' ? '#15803D' : '#B91C1C',
                      fontWeight: '900',
                      fontSize: 12,
                    }}
                  >
                    {statusMeta(selected.status).label}
                  </Text>
                </View>
              </View>

              {/* Customer */}
              <Text style={{ color: '#2563EB', fontWeight: '800', textAlign: 'right' }} numberOfLines={2}>
                {selected.customer_id ? `לקוח: ${userMap.get(selected.customer_id) ?? selected.customer_id.slice(0, 6)}` : 'לקוח: —'}
              </Text>

              {/* Worker */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <Avatar
                  size={34}
                  uri={userAvatarMap.get(selected.worker_id) ?? null}
                  name={userMap.get(selected.worker_id) ?? ''}
                  style={{ backgroundColor: '#fff' }}
                />
                <Text style={{ color: ui.muted, textAlign: 'right', fontWeight: '800', flex: 1 }} numberOfLines={1}>
                  {userMap.get(selected.worker_id) ?? selected.worker_id.slice(0, 6)}
                </Text>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => openEdit(selected)} hitSlop={10}>
                    {({ pressed }) => (
                      <View style={{ opacity: pressed ? 0.6 : 1 }}>
                        <Pencil size={20} color={ui.muted} />
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert('מחיקת משימה', 'למחוק את המשימה?', [
                        { text: 'ביטול', style: 'cancel' },
                        { text: 'מחק', style: 'destructive', onPress: () => deleteJob(selected) },
                      ]);
                    }}
                    hitSlop={10}
                  >
                    {({ pressed }) => (
                      <View style={{ opacity: pressed ? 0.6 : 1 }}>
                        <Trash2 size={20} color="#B91C1C" />
                      </View>
                    )}
                  </Pressable>
                </View>

                {selected.kind === 'regular' && selected.status === 'pending' ? (
                  <Pressable
                    onPress={() => openJob(selected, { mode: 'execute' })}
                    style={({ pressed }) => ({
                      backgroundColor: '#0B2E5E',
                      borderRadius: 16,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      opacity: pressed ? 0.86 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', textAlign: 'right' }}>בצע משימה</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
              </View>
            </View>

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
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                            {item.sp?.device_type ?? item.service_point_id}
                          </Text>
                          <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                            ניחוח: {item.sp?.scent_type ?? '-'} • מילוי: {item.custom_refill_amount ?? item.sp?.refill_amount ?? '-'}
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

      <ModalSheet
        visible={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateDatePickerOpen(false);
        }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button title="צור" fullWidth={false} onPress={submitCreate} />
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>הוספת משימה</Text>
          </View>

          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>בסיס</Text>
            <View style={{ gap: 10 }}>
              <SelectSheet
                label="סוג משימה"
                value={createKind}
                options={[
                  { value: 'regular', label: 'ריח' },
                  { value: 'installation', label: 'התקנה' },
                  { value: 'special', label: 'מיוחדת' },
                ]}
                onChange={(v) => setCreateKind(v as JobKind)}
              />
              <SelectSheet
                label="סטטוס"
                value={createStatus}
                options={[
                  { value: 'pending', label: 'ממתין' },
                  { value: 'completed', label: 'הושלם' },
                ]}
                onChange={(v) => setCreateStatus(v as JobStatus)}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  {Platform.OS === 'web' ? (
                    <SelectSheet
                      label="תאריך"
                      value={createDateYmd}
                      placeholder="בחר תאריך…"
                      options={dateOptions}
                      onChange={setCreateDateYmd}
                    />
                  ) : (
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>תאריך</Text>
                      <Pressable
                        onPress={() => {
                          if (Platform.OS === 'android') {
                            DateTimePickerAndroid.open({
                              value: createDateValue,
                              mode: 'date',
                              is24Hour: true,
                              onChange: (_event, selectedDate) => {
                                if (!selectedDate) return;
                                setCreateDateYmd(yyyyMmDd(selectedDate));
                              },
                            });
                            return;
                          }
                          setCreateDatePickerOpen(true);
                        }}
                        style={{
                          backgroundColor: colors.elevated,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderRadius: 14,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <CalendarDays size={18} color={colors.muted} />
                        <Text style={{ color: createDateYmd ? colors.text : colors.muted, fontWeight: '800', flex: 1, textAlign: 'right' }}>
                          {createDateYmd ? createDateYmd : 'בחר תאריך…'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <SelectSheet
                    label="שעה"
                    value={createTimeHm}
                    placeholder="בחר שעה…"
                    options={timeOptions}
                    onChange={setCreateTimeHm}
                  />
                </View>
              </View>

              <SelectSheet
                label="עובד"
                value={createWorkerId}
                placeholder="בחר עובד…"
                options={createWorkerOptions}
                onChange={setCreateWorkerId}
              />

              <Pressable
                onPress={() => setCreateUseOneTimeCustomer((p) => !p)}
                disabled={createKind === 'special'}
                style={{
                  backgroundColor: createKind === 'special' ? colors.border : createUseOneTimeCustomer ? colors.primary : colors.elevated,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'right' }}>
                  {createKind === 'special'
                    ? 'לקוח חד-פעמי: לא רלוונטי'
                    : createUseOneTimeCustomer
                      ? 'לקוח חד-פעמי: פעיל'
                      : 'לקוח חד-פעמי: כבוי'}
                </Text>
              </Pressable>

              {createKind === 'special' ? null : createUseOneTimeCustomer ? (
                <View style={{ gap: 10 }}>
                  <Input label="שם" value={createOneTimeCustomer.name} onChangeText={(v) => setCreateOneTimeCustomer((p) => ({ ...p, name: v }))} />
                  <Input
                    label="טלפון"
                    value={createOneTimeCustomer.phone ?? ''}
                    onChangeText={(v) => setCreateOneTimeCustomer((p) => ({ ...p, phone: v }))}
                    keyboardType="phone-pad"
                  />
                  <Input label="כתובת" value={createOneTimeCustomer.address ?? ''} onChangeText={(v) => setCreateOneTimeCustomer((p) => ({ ...p, address: v }))} />
                </View>
              ) : (
                <SelectSheet
                  label="לקוח"
                  value={createCustomerId}
                  placeholder="בחר לקוח…"
                  options={createCustomerOptions}
                  onChange={setCreateCustomerId}
                />
              )}

              <Input label="מספר הזמנה (אופציונלי)" value={createOrderNumber} onChangeText={setCreateOrderNumber} keyboardType="numeric" />
              <Input label="הערות (אופציונלי)" value={createNotes} onChangeText={setCreateNotes} />
            </View>
          </Card>

          {createKind === 'regular' ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>נקודות שירות</Text>
              {!createCustomerId && !createUseOneTimeCustomer ? (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>בחר לקוח כדי לטעון נקודות שירות.</Text>
              ) : createUseOneTimeCustomer ? (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>לקוח חד-פעמי לא כולל נקודות שירות קבועות.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {createServicePoints.map((p) => (
                    <View key={p.id} style={{ gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Pressable
                        onPress={() => setCreateServicePoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, selected: !x.selected } : x)))}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <Text style={{ color: p.selected ? colors.success : colors.muted, fontWeight: '900' }}>
                          {p.selected ? 'נבחר' : 'לא נבחר'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{p.device_type}</Text>
                          <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>
                            ניחוח: {p.scent_type} • ברירת מחדל: {p.refill_amount}
                          </Text>
                        </View>
                      </Pressable>
                      {p.selected ? (
                        <Input
                          label="כמות מילוי מותאמת (אופציונלי)"
                          value={p.custom_refill_amount}
                          onChangeText={(v) => setCreateServicePoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, custom_refill_amount: v } : x)))}
                          keyboardType="numeric"
                          placeholder={String(p.refill_amount)}
                        />
                      ) : null}
                    </View>
                  ))}
                  {!createServicePoints.length ? (
                    <Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות שירות ללקוח.</Text>
                  ) : null}
                </View>
              )}
            </Card>
          ) : null}

          {createKind === 'installation' ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>מכשירים להתקנה</Text>
              <View style={{ gap: 10 }}>
                {createInstallationDevices.map((d, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={`מכשיר #${idx + 1}`}
                        value={d.device_name}
                        onChangeText={(v) => setCreateInstallationDevices((prev) => prev.map((x, i) => (i === idx ? { ...x, device_name: v } : x)))}
                        placeholder="Device name"
                      />
                    </View>
                    <Pressable
                      onPress={() => setCreateInstallationDevices((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={createInstallationDevices.length <= 1}
                      style={{
                        backgroundColor: createInstallationDevices.length <= 1 ? colors.border : colors.danger,
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>מחק</Text>
                    </Pressable>
                  </View>
                ))}
                <Button
                  title="הוסף מכשיר"
                  variant="secondary"
                  onPress={() => setCreateInstallationDevices((prev) => [...prev, { device_name: '' }])}
                />
              </View>
            </Card>
          ) : null}

          {createKind === 'special' ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>משימה מיוחדת</Text>
              <View style={{ gap: 10 }}>
                <SelectSheet
                  label="סוג מיוחד"
                  value={createSpecialJobType}
                  options={SPECIAL_JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  onChange={setCreateSpecialJobType}
                />
                {createSpecialTypeMeta?.needsBattery ? (
                  <SelectSheet label="סוג סוללה" value={createBatteryType} options={BATTERY_TYPES} onChange={setCreateBatteryType} />
                ) : null}
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </ModalSheet>

      <ModalSheet visible={createDatePickerOpen} onClose={() => setCreateDatePickerOpen(false)}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button title="סגור" variant="secondary" fullWidth={false} onPress={() => setCreateDatePickerOpen(false)} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>בחירת תאריך</Text>
          </View>

          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10 }}>
            <DateTimePicker
              value={createDateValue}
              mode="date"
              display="inline"
              themeVariant="light"
              onChange={(_event, selectedDate) => {
                if (!selectedDate) return;
                setCreateDateYmd(yyyyMmDd(selectedDate));
              }}
            />
          </View>

          {!!createDateYmd && (
            <Button
              title="אישור"
              onPress={() => {
                setCreateDatePickerOpen(false);
              }}
            />
          )}
        </View>
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

      {!!execJob ? (
        <>
          {execOpen ? (
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeExec}>
              <View style={stylesExecBackdrop.backdrop} />
            </Pressable>
          ) : null}

          <FabButton
            isOpen={execOpen}
            onPress={() => (execOpen ? closeExec() : setExecOpen(true))}
            openedSize={Math.min(420, Math.max(320, Dimensions.get('window').width * 0.92))}
            panelStyle={{
              right: 12,
              maxHeight: screenHeight * 0.84,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            fabStyle={{ backgroundColor: colors.primary }}
            openIconName="controller-play"
          >
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                ביצוע משימה
              </Text>
              <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>
                #{execJob.order_number ?? '—'} • סטטוס: {execJob.status}
              </Text>
            </View>

            <FlatList
              data={execPoints}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: screenHeight * 0.52 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 6, paddingTop: 2 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const currentImageUrl = item.image_url ? getPublicUrl(item.image_url) : null;
                const previewUri = item.localImageUri ?? currentImageUrl ?? null;
                const refill = item.custom_refill_amount ?? item.sp?.refill_amount ?? null;
                return (
                  <Card style={{ gap: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }} numberOfLines={2}>
                      {item.sp?.device_type ?? `נקודה ${item.service_point_id.slice(0, 6)}`}
                    </Text>
                    <Text style={{ color: colors.muted, textAlign: 'right' }}>
                      ניחוח: {item.sp?.scent_type ?? '-'} • מילוי: {refill ?? '-'}
                    </Text>

                    {previewUri ? (
                      <Image
                        source={{ uri: previewUri }}
                        style={{ width: '100%', height: 150, borderRadius: 14 }}
                        resizeMode="cover"
                      />
                    ) : null}

                    <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button title="בחר תמונה" variant="secondary" onPress={() => pickExecImage(item.id)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title={item.uploading ? 'מעלה…' : 'העלה'}
                          disabled={!!item.uploading}
                          onPress={() => uploadExecPoint(item)}
                        />
                      </View>
                    </View>
                  </Card>
                );
              }}
              ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות.</Text>}
            />

            <View style={{ gap: 10 }}>
              <Button
                title={execJob.status === 'completed' ? 'כבר הושלם' : 'סיים משימה'}
                disabled={execJob.status === 'completed'}
                onPress={completeExecJob}
              />
              <Button title="סגור" variant="secondary" onPress={closeExec} />
            </View>
          </FabButton>
        </>
      ) : null}
    </Screen>
  );
}

const stylesExecBackdrop = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});


