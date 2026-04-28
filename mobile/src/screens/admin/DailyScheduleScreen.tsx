import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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
  Layers,
  ListFilter,
  Pencil,
  Trash2,
  X,
} from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { ModalSheet } from '../../components/ModalSheet';
import { OriginWindow, type OriginRect } from '../../components/OriginWindow';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { toDate, yyyyMmDd } from '../../lib/time';
import { useLoading } from '../../state/LoadingContext';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';
type FilterType = 'all' | 'pending' | 'completed';

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',       label: 'הכל'    },
  { value: 'pending',   label: 'ממתין'  },
  { value: 'completed', label: 'הושלם'  },
];

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
};

type UserLite = { id: string; name: string; role: 'admin' | 'worker' | 'customer'; avatar_url?: string | null };
type OneTimeCustomerLite = { id: string; name: string };

type JobServicePoint = {
  id: string;
  job_id: string;
  service_point_id: string;
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
  const [filter, setFilter] = useState<FilterType>('all');

  const [edit, setEdit] = useState<Unified | null>(null);
  const [newTime, setNewTime] = useState('09:00');

  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsJob, setPointsJob] = useState<Unified | null>(null);
  const [pointsOriginRect, setPointsOriginRect] = useState<OriginRect | null>(null);
  const pointsOriginRectRef = useRef<OriginRect | null>(null);
  const [jobPoints, setJobPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null })[]>([]);

  const workerOptions = useMemo(
    () => [
      { value: '', label: 'הכל' },
      ...users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name, avatarUrl: u.avatar_url ?? null })),
    ],
    [users],
  );

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const userAvatarMap = useMemo(() => new Map(users.map((u) => [u.id, u.avatar_url ?? null])), [users]);
  const oneTimeMap = useMemo(() => new Map(oneTimeCustomers.map((c) => [c.id, c.name])), [oneTimeCustomers]);

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

  const filteredItems = useMemo(() => {
    if (filter === 'pending')   return items.filter((i) => i.status === 'pending');
    if (filter === 'completed') return items.filter((i) => i.status === 'completed');
    return items;
  }, [items, filter]);

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
        baseFilter(supabase.from('installation_jobs').select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes')),
        baseFilter(supabase.from('special_jobs').select('id, date, status, worker_id, order_number, notes')),
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

  const saveTime = async () => {
    if (!edit) return;
    if (edit.kind !== 'regular') {
      Toast.show({ type: 'error', text1: 'עריכת שעה זמינה כרגע רק למשימות regular' });
      return;
    }
    try {
      setIsLoading(true);
      const updatedIso = updateIsoTime(edit.date, newTime.trim());
      const { error } = await supabase.from('jobs').update({ date: updatedIso }).eq('id', edit.id);
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.kind === 'regular' && x.id === edit.id ? { ...x, date: updatedIso } : x)));
      setEdit(null);
      Toast.show({ type: 'success', text1: 'עודכן' });
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

  const listHeader = useMemo(
    () => (
      <View style={{ gap: 11 }}>
        {/* ── Calendar Card ─────────────────────────────── */}
        <View style={st.calCard}>
          <View style={st.calMonthRow}>
            <Pressable
              onPress={() => { const d = new Date(`${day}T00:00:00`); d.setDate(1); d.setMonth(d.getMonth() - 1); setDay(yyyyMmDd(d)); }}
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

            <Pressable
              onPress={() => { const d = new Date(`${day}T00:00:00`); d.setDate(1); d.setMonth(d.getMonth() + 1); setDay(yyyyMmDd(d)); }}
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

          {/* Week strip */}
          <View style={st.calWeekRow}>
            <Pressable
              onPress={() => setDay(yyyyMmDd(addDays(parsedDay, -7)))}
              style={({ pressed }) => [st.calWeekNav, pressed && { opacity: 0.5 }]}
            >
              <ChevronLeft size={15} color='#C7C7CC' strokeWidth={2.5} />
            </Pressable>

            <View style={{ flex: 1, flexDirection: 'row' }}>
              {weekDates.map((d) => {
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

            <Pressable
              onPress={() => setDay(yyyyMmDd(addDays(parsedDay, 7)))}
              style={({ pressed }) => [st.calWeekNav, pressed && { opacity: 0.5 }]}
            >
              <ChevronRight size={15} color='#C7C7CC' strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={st.calPrettyRow}>
            <Text style={st.calPrettyText}>{prettyDay}</Text>
          </View>
        </View>

        {/* ── Worker Filter ─────────────────────────────── */}
        <SelectSheet label="עובד" value={workerId} options={workerOptions} onChange={setWorkerId} />

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

        {/* ── Section Header ────────────────────────────── */}
        <View style={st.secHeader}>
          <View style={st.secTitleGroup}>
            <Text style={st.secTitle}>משימות</Text>
            <View style={st.secBadge}>
              <Text style={st.secBadgeText}>{filteredItems.length}</Text>
            </View>
          </View>
          <View style={st.secFilterBtn}>
            <ListFilter size={14} color={colors.muted} strokeWidth={2} />
          </View>
        </View>

        {/* ── Filter Chips ──────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.filterBar}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.value}
              style={({ pressed }) => [
                st.filterChip,
                filter === f.value && st.filterChipActive,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[st.filterChipText, filter === f.value && st.filterChipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    ),
    [calMonthLabel, day, filter, filteredItems.length, items.length, parsedDay, prettyDay, stats, todayStr, weekDates, workerId, workerOptions],
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
          const stripeColor = item.status === 'completed' ? '#34C759' : '#FF9500';
          const kindConf    = KIND_CONFIG[item.kind];
          const workerName  = userMap.get(item.worker_id) ?? item.worker_id.slice(0, 6);

          return (
            <View style={[st.taskWrap, item.status === 'completed' && { opacity: 0.68 }]}>
              {/* ── White card (overflow:hidden for rounded corners) ── */}
              <View style={st.taskInner}>

                {/* Body */}
                <View style={st.taskBody}>
                  {/* Row 1: avatar + worker name (right) | kind chip + time (left) */}
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
                      <View style={[
                        st.kindChip,
                        { backgroundColor: `${kindConf.color}15`, borderColor: `${kindConf.color}30` },
                      ]}>
                        <Text style={[st.kindChipText, { color: kindConf.color }]}>
                          {kindConf.label}
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
                  {/* Complete button */}
                  <Pressable
                    style={[st.tcBtn, st.tcBtnGo, item.status === 'completed' && st.tcBtnDone]}
                    onPress={() => {
                      setEdit(item);
                      setNewTime(new Date(item.date).toISOString().slice(11, 16));
                    }}
                    accessibilityLabel="ביצוע"
                  >
                    {item.status === 'completed'
                      ? <Check size={15} color='#34C759' strokeWidth={2.2} />
                      : <ArrowUpRight size={15} color={colors.primary} strokeWidth={2.2} />
                    }
                  </Pressable>

                  {/* Delete button (UI only) */}
                  <Pressable style={[st.tcBtn, st.tcBtnDel]} accessibilityLabel="מחיקה">
                    <Trash2 size={14} color='#FF3B30' strokeWidth={2} />
                  </Pressable>

                  {/* Edit / pencil button */}
                  <Pressable
                    style={st.tcBtn}
                    onPress={() => {
                      setEdit(item);
                      setNewTime(new Date(item.date).toISOString().slice(11, 16));
                    }}
                    accessibilityLabel="עריכה"
                  >
                    <Pencil size={14} color='#8E8E93' strokeWidth={2} />
                  </Pressable>

                  <View style={{ flex: 1 }} />
                </View>
              </View>

              {/* ── Status stripe (absolute, outside overflow:hidden) ── */}
              <View style={[st.taskStripe, { backgroundColor: stripeColor }]} />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIconWrap}>
              <CalendarDays size={26} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text style={st.emptyTitle}>אין משימות ליום הזה</Text>
            <Text style={st.emptySubtitle}>שייך תבנית לתאריך ליצירת משימות</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Edit Time Sheet ─────────────────────────────── */}
      <ModalSheet visible={!!edit} onClose={() => setEdit(null)}>
        {!!edit && (
          <View style={{ gap: 16 }}>
            <View style={st.editHeader}>
              <View style={st.editIconBubble}>
                <Clock size={16} color="#fff" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.editTitle}>עריכת שעה</Text>
                <Text style={st.editSubtitle}>
                  {KIND_CONFIG[edit.kind].label} · #{edit.order_number ?? '—'}
                </Text>
              </View>
            </View>

            <View style={st.editDetailsCard}>
              <View style={st.editDetailRow}>
                <Text style={st.editDetailLabel}>לקוח</Text>
                <Text style={st.editDetailValue}>{customerLabel(edit)}</Text>
              </View>
              <View style={st.editDetailDivider} />
              <View style={st.editDetailRow}>
                <Text style={st.editDetailLabel}>עובד</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Avatar size={20} uri={userAvatarMap.get(edit.worker_id) ?? null} name={userMap.get(edit.worker_id) ?? ''} />
                  <Text style={st.editDetailValue}>{userMap.get(edit.worker_id) ?? edit.worker_id.slice(0, 6)}</Text>
                </View>
              </View>
              <View style={st.editDetailDivider} />
              <View style={st.editDetailRow}>
                <Text style={st.editDetailLabel}>שעה נוכחית</Text>
                <View style={st.currentTimeBadge}>
                  <Clock size={12} color={colors.primary} strokeWidth={2} />
                  <Text style={st.currentTimeText}>{formatHm(edit.date)}</Text>
                </View>
              </View>
            </View>

            <SelectSheet
              label="שעה חדשה"
              value={newTime}
              placeholder="בחר שעה…"
              options={[
                { value: '07:00' }, { value: '07:30' },
                { value: '08:00' }, { value: '08:30' },
                { value: '09:00' }, { value: '09:30' },
                { value: '10:00' }, { value: '10:30' },
                { value: '11:00' }, { value: '11:30' },
                { value: '12:00' }, { value: '12:30' },
                { value: '13:00' }, { value: '13:30' },
                { value: '14:00' }, { value: '14:30' },
                { value: '15:00' }, { value: '15:30' },
                { value: '16:00' }, { value: '16:30' },
                { value: '17:00' }, { value: '17:30' },
                { value: '18:00' }, { value: '18:30' },
                { value: '19:00' }, { value: '19:30' },
                { value: '20:00' },
              ]}
              onChange={setNewTime}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="ביטול" variant="secondary" fullWidth={false} style={{ flex: 1, borderRadius: 14 }} onPress={() => setEdit(null)} />
              <Button title="שמור"  fullWidth={false}  style={{ flex: 1, borderRadius: 14 }} onPress={saveTime} />
            </View>
          </View>
        )}
      </ModalSheet>

      {/* ── Service Points Window ───────────────────────── */}
      <OriginWindow visible={pointsOpen} originRect={pointsOriginRect} onClose={closePoints}>
        <View style={{ flex: 1, padding: 16, gap: 14 }}>
          <View style={st.pointsHeader}>
            <View style={st.pointsIconBubble}>
              <Layers size={16} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.pointsTitle}>נקודות שירות</Text>
              {!!pointsJob && (
                <Text style={st.pointsSubtitle} numberOfLines={1}>
                  {customerLabel(pointsJob)} · {userMap.get(pointsJob.worker_id) ?? pointsJob.worker_id.slice(0, 6)}
                </Text>
              )}
            </View>
            <Pressable onPress={closePoints} hitSlop={8} style={({ pressed }) => [st.pointsCloseBtn, pressed && { opacity: 0.6 }]}>
              <X size={16} color={colors.muted} strokeWidth={2.5} />
            </Pressable>
          </View>

          {pointsLoading ? (
            <View style={st.pointsLoadingWrap}>
              <Text style={st.pointsLoadingText}>טוען נקודות שירות…</Text>
            </View>
          ) : pointsJob?.kind !== 'regular' ? (
            <View style={st.pointsEmptyWrap}>
              <View style={st.pointsEmptyIcon}><Layers size={22} color={colors.muted} strokeWidth={1.5} /></View>
              <Text style={st.pointsEmptyText}>אין נקודות למשימה זו</Text>
            </View>
          ) : (
            <FlatList
              data={jobPoints}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <View style={st.pointCard}>
                  <View style={st.pointCardHeader}>
                    <View style={st.pointDeviceIcon}>
                      <Droplets size={14} color={colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={st.pointDeviceText}>{item.sp?.device_type ?? item.service_point_id}</Text>
                  </View>
                  <View style={st.pointCardDivider} />
                  <View style={st.pointMetaRow}>
                    <View style={st.pointMetaItem}>
                      <Text style={st.pointMetaLabel}>ניחוח</Text>
                      <Text style={st.pointMetaValue}>{item.sp?.scent_type ?? '-'}</Text>
                    </View>
                    <View style={st.pointMetaSep} />
                    <View style={st.pointMetaItem}>
                      <Text style={st.pointMetaLabel}>מילוי</Text>
                      <Text style={st.pointMetaValue}>{item.custom_refill_amount ?? item.sp?.refill_amount ?? '-'}</Text>
                    </View>
                  </View>
                  {!!item.sp?.notes && (
                    <>
                      <View style={st.pointCardDivider} />
                      <Text style={st.pointNotes} numberOfLines={2}>{item.sp.notes}</Text>
                    </>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={st.pointsEmptyWrap}>
                  <View style={st.pointsEmptyIcon}><Layers size={22} color={colors.muted} strokeWidth={1.5} /></View>
                  <Text style={st.pointsEmptyText}>אין נקודות למשימה זו</Text>
                </View>
              }
            />
          )}

          <Button title="סגור" variant="secondary" onPress={closePoints} style={{ borderRadius: 14 }} />
        </View>
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
    flexDirection: 'row',
    paddingHorizontal: 30,
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
  calWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  calWeekNav: {
    width: 26,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  calPrettyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
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

  // ── Section Header ─────────────────────────────────
  secHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  secTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  secTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  secBadge: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 3,
  },
  secBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  secFilterBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Filter Chips ───────────────────────────────────
  filterBar: {
    flexDirection: 'row-reverse',
    gap: 7,
    paddingBottom: 2,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.primary,
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
  taskStripe: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
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
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  taskTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3A3A3C',
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
  },
  kindChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tcBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#F9F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tcBtnGo: {
    borderColor: '#DDDCF5',
    backgroundColor: '#F0F0FF',
  },
  tcBtnDone: {
    borderColor: '#C8F0D0',
    backgroundColor: '#F0FFF4',
  },
  tcBtnDel: {
    borderColor: '#FFE5E5',
    backgroundColor: '#FFF5F5',
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

  // ── Edit Time Sheet ────────────────────────────────
  editHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  editIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  editSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    marginTop: 1,
  },
  editDetailsCard: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  editDetailRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editDetailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'right',
  },
  editDetailValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'left',
  },
  editDetailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  currentTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentTimeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },

  // ── Service Points Window ──────────────────────────
  pointsHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  pointsIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pointsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  pointsSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    marginTop: 1,
  },
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
  pointsLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsLoadingText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  pointsEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  pointsEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(37,99,235,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pointsEmptyText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Service Point Card ─────────────────────────────
  pointCard: {
    backgroundColor: colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  pointCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
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
  pointDeviceText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
  },
  pointCardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  pointMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  pointMetaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pointMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  pointMetaValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  pointMetaSep: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  pointNotes: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 18,
  },
});
