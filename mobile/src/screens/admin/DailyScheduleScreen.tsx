import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { addDays, format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  Droplets,
  Eye,
  Layers,
  User,
  X,
} from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModalSheet } from '../../components/ModalSheet';
import { OriginWindow, type OriginRect } from '../../components/OriginWindow';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobCardAction, JobChip } from '../../components/jobs/JobCard';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { toDate, yyyyMmDd } from '../../lib/time';
import { useLoading } from '../../state/LoadingContext';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

LocaleConfig.locales.he = {
  monthNames: [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ],
  monthNamesShort: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
  dayNames: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  dayNamesShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
  today: 'היום',
};
LocaleConfig.defaultLocale = 'he';

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
  regular: { label: 'רגילה', accent: 'blue' as const, color: '#0058BC' },
  installation: { label: 'התקנה', accent: 'purple' as const, color: '#7C3AED' },
  special: { label: 'מיוחדת', accent: 'orange' as const, color: '#EA580C' },
} as const;

export function DailyScheduleScreen() {
  const { setIsLoading } = useLoading();
  const [day, setDay] = useState(yyyyMmDd(new Date()));
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [tempDay, setTempDay] = useState(day);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [oneTimeCustomers, setOneTimeCustomers] = useState<OneTimeCustomerLite[]>([]);
  const [workerId, setWorkerId] = useState('');
  const [items, setItems] = useState<Unified[]>([]);
  const [loading, setLoading] = useState(false);

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

  const openDatePicker = useCallback(() => {
    setTempDay(day);
    setDateSheetOpen(true);
  }, [day]);

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
    if (!ids.length) {
      setOneTimeCustomers([]);
      return;
    }
    const uniqueIds = Array.from(new Set(ids));
    const { data, error } = await supabase.from('one_time_customers').select('id, name').in('id', uniqueIds);
    if (!error) setOneTimeCustomers((data ?? []) as any);
  }, []);

  const fetchDay = useCallback(async () => {
    try {
      setLoading(true);
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const baseFilter = (q: any) => {
        q = q.gte('date', start).lte('date', end);
        if (workerId) q = q.eq('worker_id', workerId);
        return q;
      };

      const [regRes, instRes, specRes] = await Promise.all([
        baseFilter(supabase.from('jobs').select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes')),
        baseFilter(
          supabase.from('installation_jobs').select('id, date, status, worker_id, customer_id, one_time_customer_id, order_number, notes'),
        ),
        baseFilter(supabase.from('special_jobs').select('id, date, status, worker_id, order_number, notes')),
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
      if (x.customer_id) return userMap.get(x.customer_id) ?? x.customer_id.slice(0, 6);
      if (x.one_time_customer_id) return oneTimeMap.get(x.one_time_customer_id) ?? x.one_time_customer_id.slice(0, 6);
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

    if (job.kind !== 'regular') {
      setPointsLoading(false);
      return;
    }

    try {
      const { data: jsp, error: jspErr } = await supabase
        .from('job_service_points')
        .select('id, job_id, service_point_id, custom_refill_amount')
        .eq('job_id', job.id);
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
      <View style={{ gap: 14 }}>
        {/* ── Date Navigation ───────────────────────────── */}
        <View style={st.dateCard}>
          <View style={st.dateCardHeader}>
            <View style={st.dateIconBubble}>
              <CalendarDays size={16} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.dateCardTitle}>תאריך</Text>
              <Text style={st.dateCardSubtitle}>בחר יום לצפייה במשימות</Text>
            </View>
          </View>

          <View style={st.dateDivider} />

          <View style={st.dateNavRow}>
            <Pressable
              onPress={() => setDay(yyyyMmDd(addDays(parsedDay, -1)))}
              style={({ pressed }) => [st.dateNavBtn, pressed && { opacity: 0.6 }]}
            >
              <ChevronLeft size={18} color={colors.text} strokeWidth={2.5} />
            </Pressable>

            <Pressable onPress={openDatePicker} style={({ pressed }) => [st.dateDisplay, pressed && { opacity: 0.85 }]}>
              <CalendarDays size={18} color={colors.primary} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={st.dateMainText}>{prettyDay}</Text>
                <Text style={st.dateSub}>{day}</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setDay(yyyyMmDd(addDays(parsedDay, 1)))}
              style={({ pressed }) => [st.dateNavBtn, pressed && { opacity: 0.6 }]}
            >
              <ChevronRight size={18} color={colors.text} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* ── Worker Filter ─────────────────────────────── */}
        <SelectSheet label="עובד" value={workerId} options={workerOptions} onChange={setWorkerId} />

        {/* ── Stats Bar ─────────────────────────────────── */}
        {items.length > 0 && (
          <View style={st.statsRow}>
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: colors.primary }]} />
              <Text style={st.statValue}>{stats.total}</Text>
              <Text style={st.statLabel}>סה״כ</Text>
            </View>
            <View style={st.statSeparator} />
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={st.statValue}>{stats.pending}</Text>
              <Text style={st.statLabel}>ממתינות</Text>
            </View>
            <View style={st.statSeparator} />
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: colors.success }]} />
              <Text style={st.statValue}>{stats.completed}</Text>
              <Text style={st.statLabel}>הושלמו</Text>
            </View>
          </View>
        )}

        {/* ── Section Header ───────────────────────────── */}
        <View style={st.sectionHeader}>
          <View style={st.sectionIconWrap}>
            <ClipboardList size={14} color={colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={st.sectionLabel}>משימות</Text>
          <View style={st.countBadge}>
            <Text style={st.countText}>{items.length}</Text>
          </View>
        </View>
      </View>
    ),
    [day, items.length, openDatePicker, parsedDay, prettyDay, stats, workerId, workerOptions],
  );

  return (
    <View style={st.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={st.listContent}
        refreshing={loading}
        onRefresh={() => {
          fetchUsers();
          fetchDay();
        }}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <JobCard
            style={{ borderRadius: 18 }}
            kind={item.kind}
            title={customerLabel(item)}
            status={item.status}
            primaryNode={
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Avatar
                  size={24}
                  uri={userAvatarMap.get(item.worker_id) ?? null}
                  name={userMap.get(item.worker_id) ?? ''}
                  style={{ backgroundColor: '#fff' }}
                />
                <Text
                  style={{
                    color: KIND_CONFIG[item.kind].color,
                    fontWeight: '700',
                    fontSize: 13,
                    textAlign: 'right',
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  #{item.order_number ?? '—'} עובד: {userMap.get(item.worker_id) ?? item.worker_id.slice(0, 6)}
                </Text>
              </View>
            }
            description={item.notes ?? null}
            onPress={() => {
              setEdit(item);
              setNewTime(new Date(item.date).toISOString().slice(11, 16));
            }}
            faded={item.status === 'completed'}
            actions={
              <JobCardAction
                label="נקודות משימה"
                onPress={() => openJobPoints(item)}
                onOriginRect={(r) => {
                  pointsOriginRectRef.current = r;
                }}
              >
                <Eye size={20} color="#414755" />
              </JobCardAction>
            }
            chips={
              <>
                <JobChip text={KIND_CONFIG[item.kind].label} accent={KIND_CONFIG[item.kind].accent} />
                <JobChip text={formatHm(item.date)} muted />
              </>
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}>
              <CalendarDays size={28} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text style={st.emptyTitle}>אין משימות ליום הזה</Text>
            <Text style={st.emptySubtitle}>שייך תבנית לתאריך ליצירת משימות</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Calendar Sheet ──────────────────────────────── */}
      <ModalSheet visible={dateSheetOpen} onClose={() => setDateSheetOpen(false)} containerStyle={{ paddingBottom: 18 }}>
        <View style={{ gap: 12 }}>
          <View style={st.calendarHeader}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={st.calendarIconBubble}>
                <CalendarDays size={16} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={st.calendarTitle}>בחירת תאריך</Text>
            </View>
            <Pressable
              onPress={() => setTempDay(yyyyMmDd(new Date()))}
              style={({ pressed }) => [st.todayBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={st.todayBtnText}>היום</Text>
            </Pressable>
          </View>

          <Calendar
            current={tempDay}
            onDayPress={(d) => setTempDay(d.dateString)}
            markedDates={{
              [tempDay]: { selected: true, selectedColor: colors.primary, selectedTextColor: '#fff' },
            }}
            enableSwipeMonths
            firstDay={0}
            style={st.calendar}
            theme={{
              calendarBackground: colors.card,
              textSectionTitleColor: colors.muted,
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              textMonthFontWeight: '900',
              textDayFontWeight: '700',
              textDayHeaderFontWeight: '800',
              arrowColor: colors.text,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#fff',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title="ביטול"
              variant="secondary"
              fullWidth={false}
              style={{ flex: 1, borderRadius: 14 }}
              onPress={() => setDateSheetOpen(false)}
            />
            <Button
              title="אישור"
              fullWidth={false}
              style={{ flex: 1, borderRadius: 14 }}
              onPress={() => {
                setDay(tempDay);
                setDateSheetOpen(false);
              }}
            />
          </View>
        </View>
      </ModalSheet>

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
                  {KIND_CONFIG[edit.kind].label} • #{edit.order_number ?? '—'}
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
                  <Avatar
                    size={20}
                    uri={userAvatarMap.get(edit.worker_id) ?? null}
                    name={userMap.get(edit.worker_id) ?? ''}
                  />
                  <Text style={st.editDetailValue}>
                    {userMap.get(edit.worker_id) ?? edit.worker_id.slice(0, 6)}
                  </Text>
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
              <Button
                title="ביטול"
                variant="secondary"
                fullWidth={false}
                style={{ flex: 1, borderRadius: 14 }}
                onPress={() => setEdit(null)}
              />
              <Button
                title="שמור"
                fullWidth={false}
                style={{ flex: 1, borderRadius: 14 }}
                onPress={saveTime}
              />
            </View>
          </View>
        )}
      </ModalSheet>

      {/* ── Service Points Window ───────────────────────── */}
      <OriginWindow
        visible={pointsOpen}
        originRect={pointsOriginRect}
        onClose={closePoints}
      >
        <View style={{ flex: 1, padding: 16, gap: 14 }}>
          <View style={st.pointsHeader}>
            <View style={st.pointsIconBubble}>
              <Layers size={16} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.pointsTitle}>נקודות שירות</Text>
              {!!pointsJob && (
                <Text style={st.pointsSubtitle} numberOfLines={1}>
                  {customerLabel(pointsJob)} • {userMap.get(pointsJob.worker_id) ?? pointsJob.worker_id.slice(0, 6)}
                </Text>
              )}
            </View>
            <Pressable
              onPress={closePoints}
              hitSlop={8}
              style={({ pressed }) => [st.pointsCloseBtn, pressed && { opacity: 0.6 }]}
            >
              <X size={16} color={colors.muted} strokeWidth={2.5} />
            </Pressable>
          </View>

          {pointsLoading ? (
            <View style={st.pointsLoadingWrap}>
              <Text style={st.pointsLoadingText}>טוען נקודות שירות…</Text>
            </View>
          ) : pointsJob?.kind !== 'regular' ? (
            <View style={st.pointsEmptyWrap}>
              <View style={st.pointsEmptyIcon}>
                <Layers size={22} color={colors.muted} strokeWidth={1.5} />
              </View>
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
                    <Text style={st.pointDeviceText}>
                      {item.sp?.device_type ?? item.service_point_id}
                    </Text>
                  </View>
                  <View style={st.pointCardDivider} />
                  <View style={st.pointMetaRow}>
                    <View style={st.pointMetaItem}>
                      <Text style={st.pointMetaLabel}>ניחוח</Text>
                      <Text style={st.pointMetaValue}>{item.sp?.scent_type ?? '-'}</Text>
                    </View>
                    <View style={st.pointMetaSeparator} />
                    <View style={st.pointMetaItem}>
                      <Text style={st.pointMetaLabel}>מילוי</Text>
                      <Text style={st.pointMetaValue}>
                        {item.custom_refill_amount ?? item.sp?.refill_amount ?? '-'}
                      </Text>
                    </View>
                  </View>
                  {!!item.sp?.notes && (
                    <>
                      <View style={st.pointCardDivider} />
                      <Text style={st.pointNotes} numberOfLines={2}>
                        {item.sp.notes}
                      </Text>
                    </>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={st.pointsEmptyWrap}>
                  <View style={st.pointsEmptyIcon}>
                    <Layers size={22} color={colors.muted} strokeWidth={1.5} />
                  </View>
                  <Text style={st.pointsEmptyText}>אין נקודות למשימה זו</Text>
                </View>
              }
            />
          )}

          <Button
            title="סגור"
            variant="secondary"
            onPress={closePoints}
            style={{ borderRadius: 14 }}
          />
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },

  // ── Date Card ──────────────────────────────────────
  dateCard: {
    backgroundColor: colors.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  dateCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  dateIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  dateCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  dateCardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    marginTop: 1,
  },
  dateDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateNavBtn: {
    width: 42,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplay: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  dateMainText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'right',
  },
  dateSub: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 1,
  },

  // ── Stats Bar ──────────────────────────────────────
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  statSeparator: {
    width: 1,
    height: '70%' as any,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },

  // ── Section Header ─────────────────────────────────
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.4,
    textAlign: 'right',
  },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },

  // ── Empty State ────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyIcon: {
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

  // ── Calendar Sheet ─────────────────────────────────
  calendarHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  calendarTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  todayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
  },
  todayBtnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  calendar: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
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
  pointMetaSeparator: {
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
