import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { ClipboardList, Coins, UserRound, Users } from 'lucide-react-native';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

type SimpleUser = {
  id: string;
  name: string;
  role: 'admin' | 'worker' | 'customer';
  price?: number | null;
  avatar_url?: string | null;
};
type SimpleJob = {
  id: string;
  date: string;
  status: 'pending' | 'completed';
  worker_id: string;
  customer_id?: string | null;
  order_number?: number | null;
  notes?: string | null;
};
type ServicePoint = { id: string; device_type: string };

function formatIls(amount: number) {
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₪${Math.round(amount).toLocaleString('he-IL')}`;
  }
}

const ACC = {
  violet: { soft: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.14)', solid: '#7C3AED', glow: 'rgba(124,58,237,0.025)' },
  cyan: { soft: 'rgba(6,182,212,0.07)', border: 'rgba(6,182,212,0.14)', solid: '#06B6D4', glow: 'rgba(6,182,212,0.025)' },
  amber: { soft: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.14)', solid: '#F59E0B', glow: 'rgba(245,158,11,0.025)' },
  emerald: { soft: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.14)', solid: '#10B981', glow: 'rgba(16,185,129,0.025)' },
} as const;

const DEVICE_COLORS = [colors.primary, '#7C3AED', '#06B6D4', '#F59E0B', '#10B981', '#EC4899'];

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44 },

  hero: {
    marginTop: 0,
    borderRadius: 24,
    padding: 22,
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
    }),
  },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  heroPct: { color: '#FFFFFF', fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  heroMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 6 },
  heroBar: { marginTop: 18, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  heroBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#FFFFFF' },
  heroPills: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  kpiCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 2 },
    }),
  },
  kpiIconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  kpiValue: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'right', letterSpacing: -1 },
  kpiLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  kpiAccentBar: { position: 'absolute', bottom: 0, left: 24, right: 24, height: 3, borderRadius: 999 },

  section: { marginTop: 26 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.14)',
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '900' },

  devCard: {
    borderRadius: 22,
    padding: 6,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 2 },
    }),
  },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  devName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  devCount: {
    minWidth: 36,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    backgroundColor: 'rgba(15,23,42,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  devBar: { width: 72, height: 5, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.05)', overflow: 'hidden' },
  devBarFill: { height: '100%', borderRadius: 999 },
  devDivider: { height: 1, backgroundColor: 'rgba(15,23,42,0.04)', marginHorizontal: 14 },

  wrkWrap: {
    borderRadius: 22,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 2 },
    }),
  },
  wrkCard: { width: 164, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  wrkInner: { padding: 16, alignItems: 'center', gap: 10 },
  wrkRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, padding: 2, alignItems: 'center', justifyContent: 'center' },
  wrkName: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  wrkPct: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
  wrkMeta: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  wrkChips: { flexDirection: 'row', gap: 6 },
  wrkChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  wrkChipText: { fontSize: 11, fontWeight: '900' },
  wrkBar: { height: 4, backgroundColor: 'rgba(15,23,42,0.03)' },
  wrkBarFill: { height: '100%' },
  wrkTodayPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(15,23,42,0.04)' },
  wrkTodayText: { color: colors.muted, fontWeight: '900', fontSize: 10 },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '86%',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 32, shadowOffset: { width: 0, height: -8 } },
      android: { elevation: 14 },
    }),
  },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.1)', alignSelf: 'center', marginTop: 12, marginBottom: 6 },
  sheetBody: { padding: 22, paddingBottom: 36 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(15,23,42,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetName: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sheetSub: { color: colors.muted, fontSize: 13, fontWeight: '800', textAlign: 'right', marginTop: 3 },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  sheetStat: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    backgroundColor: colors.bg,
    padding: 16,
  },
  sheetStatVal: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'right' },
  sheetStatLbl: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  sheetFull: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    backgroundColor: colors.bg,
    padding: 16,
    marginTop: 10,
  },
  sheetBar: { marginTop: 16, height: 10, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.06)', overflow: 'hidden' },
  sheetBarFill: { height: '100%', borderRadius: 999 },
  noData: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'right', padding: 20 },
});

export function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [monthJobs, setMonthJobs] = useState<SimpleJob[]>([]);
  const [workers, setWorkers] = useState<SimpleUser[]>([]);
  const [customers, setCustomers] = useState<SimpleUser[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [workerDetailsOpen, setWorkerDetailsOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [allTimeCompleted, setAllTimeCompleted] = useState<number | null>(null);
  const [loadingAllTimeCompleted, setLoadingAllTimeCompleted] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();

      const [jobsRes, usersRes, spRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, date, status, worker_id, customer_id, order_number, notes')
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false }),
        supabase.from('users').select('id, name, role, price, avatar_url'),
        supabase.from('service_points').select('id, device_type'),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (spRes.error) throw spRes.error;

      const allUsers = (usersRes.data ?? []) as SimpleUser[];
      setMonthJobs((jobsRes.data ?? []) as SimpleJob[]);
      setWorkers(allUsers.filter((u) => u.role === 'worker'));
      setCustomers(allUsers.filter((u) => u.role === 'customer'));
      setServicePoints((spRes.data ?? []) as ServicePoint[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת דשבורד נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const stats = useMemo(() => {
    const customersCount = customers.length;
    const totalPointsPrice = customers.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
    const jobsThisMonth = monthJobs.length;
    const pendingThisMonth = monthJobs.filter((j) => j.status === 'pending').length;
    const completedThisMonth = jobsThisMonth - pendingThisMonth;
    const completionRate = jobsThisMonth ? Math.round((completedThisMonth / jobsThisMonth) * 100) : 0;

    const monthByWorker = monthJobs.reduce<Record<string, { total: number; pending: number; completed: number }>>((acc, j) => {
      const row = acc[j.worker_id] ?? { total: 0, pending: 0, completed: 0 };
      row.total += 1;
      if (j.status === 'pending') row.pending += 1;
      else row.completed += 1;
      acc[j.worker_id] = row;
      return acc;
    }, {});

    const dailyDistribution = (() => {
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();
      const jobsToday = monthJobs.filter((j) => {
        const t = new Date(j.date).getTime();
        return Number.isFinite(t) && t >= dayStart && t <= dayEnd;
      });

      const nameById = new Map(workers.map((w) => [w.id, w.name]));
      const avatarById = new Map(workers.map((w) => [w.id, w.avatar_url ?? null]));

      const counts = jobsToday.reduce<Record<string, { total: number; pending: number; completed: number }>>((acc, j) => {
        const row = acc[j.worker_id] ?? { total: 0, pending: 0, completed: 0 };
        row.total += 1;
        if (j.status === 'pending') row.pending += 1;
        else row.completed += 1;
        acc[j.worker_id] = row;
        return acc;
      }, {});

      const rows = Object.entries(counts)
        .map(([id, c]) => ({
          id,
          name: nameById.get(id) ?? 'עובד',
          avatar_url: avatarById.get(id) ?? null,
          total: c.total,
          pending: c.pending,
          completed: c.completed,
        }))
        .sort((a, b) => b.total - a.total || b.pending - a.pending);

      return { totalJobs: jobsToday.length, rows };
    })();

    const deviceDistribution = servicePoints.reduce<Record<string, number>>((acc, sp) => {
      const key = sp.device_type || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const activeWorkers = new Set(monthJobs.filter((j) => j.status === 'pending').map((j) => j.worker_id)).size;

    const deviceRows = Object.entries(deviceDistribution)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const activeWorkerRows = workers
      .map((w) => ({
        id: w.id,
        name: w.name,
        avatar_url: w.avatar_url ?? null,
        count: monthByWorker[w.id]?.pending ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'));

    const dailyByWorker = new Map(dailyDistribution.rows.map((r) => [r.id, r]));

    return {
      customersCount,
      totalPointsPrice,
      jobsThisMonth,
      pendingThisMonth,
      completedThisMonth,
      completionRate,
      monthByWorker,
      dailyDistribution,
      dailyByWorker,
      activeWorkers,
      deviceRows,
      activeWorkerRows,
    };
  }, [customers, monthJobs, servicePoints, workers]);

  const selectedWorker = useMemo(() => {
    if (!selectedWorkerId) return null;
    return workers.find((w) => w.id === selectedWorkerId) ?? null;
  }, [selectedWorkerId, workers]);

  const selectedWorkerMonth = useMemo(() => {
    if (!selectedWorkerId) return { total: 0, pending: 0, completed: 0 };
    return stats.monthByWorker[selectedWorkerId] ?? { total: 0, pending: 0, completed: 0 };
  }, [selectedWorkerId, stats.monthByWorker]);

  const selectedWorkerCompletionPct = useMemo(() => {
    if (!selectedWorkerMonth.total) return 0;
    return Math.round((selectedWorkerMonth.completed / selectedWorkerMonth.total) * 100);
  }, [selectedWorkerMonth.completed, selectedWorkerMonth.total]);

  const deviceMax = useMemo(() => Math.max(1, ...stats.deviceRows.map((r) => r.count)), [stats.deviceRows]);

  useEffect(() => {
    if (!workerDetailsOpen || !selectedWorkerId) return;
    let alive = true;
    setAllTimeCompleted(null);
    setLoadingAllTimeCompleted(true);
    (async () => {
      try {
        const { count, error } = await supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', selectedWorkerId)
          .eq('status', 'completed');
        if (error) throw error;
        if (!alive) return;
        setAllTimeCompleted(count ?? 0);
      } catch {
        if (!alive) return;
        setAllTimeCompleted(null);
      } finally {
        if (!alive) return;
        setLoadingAllTimeCompleted(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workerDetailsOpen, selectedWorkerId]);

  const closeSheet = useCallback(() => {
    setWorkerDetailsOpen(false);
    setSelectedWorkerId(null);
  }, []);

  return (
    <View style={S.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} tintColor={colors.primary} />}
      >
        {/* ── Monthly Hero ── */}
        <View style={S.hero}>
          <Text style={S.heroLabel}>השלמת משימות החודש</Text>
          <View style={S.heroRow}>
            <Text style={S.heroMeta}>{`${stats.completedThisMonth} מתוך ${stats.jobsThisMonth}`}</Text>
            <Text style={S.heroPct}>{`${stats.completionRate}%`}</Text>
          </View>
          <View style={S.heroBar}>
            <View style={[S.heroBarFill, { width: `${stats.completionRate}%` }]} />
          </View>
          <View style={S.heroPills}>
            <View style={S.heroPill}>
              <Text style={S.heroPillText}>{`${stats.completedThisMonth} הושלמו`}</Text>
            </View>
            <View style={S.heroPill}>
              <Text style={S.heroPillText}>{`${stats.pendingThisMonth} פתוחות`}</Text>
            </View>
          </View>
        </View>

        {/* ── KPI Grid ── */}
        <View style={S.kpiGrid}>
          <View style={[S.kpiCard, { backgroundColor: ACC.violet.glow, borderColor: ACC.violet.border }]}>
            <View style={[S.kpiIconWrap, { backgroundColor: ACC.violet.soft }]}>
              <Users size={20} color={ACC.violet.solid} />
            </View>
            <Text style={S.kpiValue}>{stats.activeWorkers}</Text>
            <Text style={S.kpiLabel}>עובדים פעילים</Text>
            <View style={[S.kpiAccentBar, { backgroundColor: `${ACC.violet.solid}20` }]} />
          </View>

          <View style={[S.kpiCard, { backgroundColor: ACC.cyan.glow, borderColor: ACC.cyan.border }]}>
            <View style={[S.kpiIconWrap, { backgroundColor: ACC.cyan.soft }]}>
              <UserRound size={20} color={ACC.cyan.solid} />
            </View>
            <Text style={S.kpiValue}>{stats.customersCount}</Text>
            <Text style={S.kpiLabel}>לקוחות</Text>
            <View style={[S.kpiAccentBar, { backgroundColor: `${ACC.cyan.solid}20` }]} />
          </View>

          <View style={[S.kpiCard, { backgroundColor: ACC.amber.glow, borderColor: ACC.amber.border }]}>
            <View style={[S.kpiIconWrap, { backgroundColor: ACC.amber.soft }]}>
              <ClipboardList size={20} color={ACC.amber.solid} />
            </View>
            <Text style={S.kpiValue}>{stats.jobsThisMonth}</Text>
            <Text style={S.kpiLabel}>סה״כ משימות</Text>
            <View style={[S.kpiAccentBar, { backgroundColor: `${ACC.amber.solid}20` }]} />
          </View>

          <View style={[S.kpiCard, { backgroundColor: ACC.emerald.glow, borderColor: ACC.emerald.border }]}>
            <View style={[S.kpiIconWrap, { backgroundColor: ACC.emerald.soft }]}>
              <Coins size={20} color={ACC.emerald.solid} />
            </View>
            <Text style={[S.kpiValue, { fontSize: 22 }]}>{formatIls(stats.totalPointsPrice)}</Text>
            <Text style={S.kpiLabel}>מחיר כל הנקודות</Text>
            <View style={[S.kpiAccentBar, { backgroundColor: `${ACC.emerald.solid}20` }]} />
          </View>
        </View>

        {/* ── Device Distribution ── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            {stats.deviceRows.length > 0 ? (
              <View style={[S.badge, { backgroundColor: 'rgba(15,23,42,0.04)', borderColor: 'rgba(15,23,42,0.07)' }]}>
                <Text style={[S.badgeText, { color: colors.muted }]}>מובילים</Text>
              </View>
            ) : (
              <View />
            )}
            <Text style={S.sectionTitle}>התפלגות מכשירים</Text>
          </View>

          <View style={S.devCard}>
            {stats.deviceRows.length > 0 ? (
              stats.deviceRows.map((r, i) => {
                const pct = Math.round((r.count / deviceMax) * 100);
                const barColor = DEVICE_COLORS[i % DEVICE_COLORS.length];
                return (
                  <React.Fragment key={r.device}>
                    {i > 0 && <View style={S.devDivider} />}
                    <View style={S.devRow}>
                      <Text style={S.devCount}>{r.count}</Text>
                      <View style={S.devBar}>
                        <View style={[S.devBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={S.devName} numberOfLines={1}>
                        {r.device}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })
            ) : (
              <Text style={S.noData}>אין נתונים.</Text>
            )}
          </View>
        </View>

        {/* ── Active Workers ── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            {stats.pendingThisMonth > 0 ? (
              <View style={S.badge}>
                <Text style={S.badgeText}>{`${stats.pendingThisMonth} פתוחות`}</Text>
              </View>
            ) : (
              <View />
            )}
            <Text style={S.sectionTitle}>עובדים פעילים</Text>
          </View>

          <View style={S.wrkWrap}>
            {stats.activeWorkerRows.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ padding: 14, gap: 10 }}
              >
                {stats.activeWorkerRows.map((w, i) => {
                  const monthData = stats.monthByWorker[w.id] ?? { total: 0, pending: 0, completed: 0 };
                  const todayData = stats.dailyByWorker.get(w.id);
                  const hasToday = !!todayData && todayData.total > 0;
                  const todayPct = hasToday ? Math.round((todayData.completed / todayData.total) * 100) : 0;
                  const monthPct = monthData.total ? Math.round((monthData.completed / monthData.total) * 100) : 0;
                  const heroPct = hasToday ? todayPct : monthPct;
                  const accent = heroPct === 100 ? colors.success : colors.primary;
                  const isTop = i === 0;

                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => {
                        setSelectedWorkerId(w.id);
                        setWorkerDetailsOpen(true);
                      }}
                      style={({ pressed }) => [
                        S.wrkCard,
                        {
                          borderColor: isTop ? `${accent}40` : 'rgba(15,23,42,0.06)',
                          backgroundColor: isTop ? `${accent}06` : colors.bg,
                          opacity: pressed ? 0.82 : 1,
                          transform: pressed ? [{ scale: 0.96 }] : [],
                        },
                      ]}
                    >
                      <View style={S.wrkInner}>
                        <View style={[S.wrkRing, { borderColor: `${accent}50`, backgroundColor: colors.elevated }]}>
                          <Avatar size={56} uri={w.avatar_url ?? null} name={w.name} />
                        </View>

                        <Text style={S.wrkName} numberOfLines={1}>
                          {w.name}
                        </Text>

                        {hasToday ? (
                          <View style={{ alignItems: 'center', gap: 3 }}>
                            <View style={S.wrkTodayPill}>
                              <Text style={S.wrkTodayText}>היום</Text>
                            </View>
                            <Text style={[S.wrkPct, { color: accent }]}>{`${todayPct}%`}</Text>
                            <Text style={S.wrkMeta}>{`${todayData.completed} מתוך ${todayData.total}`}</Text>
                          </View>
                        ) : (
                          <View style={{ alignItems: 'center', gap: 2 }}>
                            <Text style={[S.wrkPct, { color: accent }]}>
                              {monthData.total ? `${monthPct}%` : '—'}
                            </Text>
                            <Text style={S.wrkMeta}>
                              {monthData.total ? `החודש · ${monthData.completed}/${monthData.total}` : 'אין משימות'}
                            </Text>
                          </View>
                        )}

                        <View style={S.wrkChips}>
                          {hasToday && todayData && (
                            <>
                              <View style={[S.wrkChip, { backgroundColor: 'rgba(22,163,74,0.08)' }]}>
                                <Text style={[S.wrkChipText, { color: colors.success }]}>{`✓ ${todayData.completed}`}</Text>
                              </View>
                              <View style={[S.wrkChip, { backgroundColor: 'rgba(37,99,235,0.08)' }]}>
                                <Text style={[S.wrkChipText, { color: colors.primary }]}>{`◎ ${todayData.pending}`}</Text>
                              </View>
                            </>
                          )}
                          {!hasToday && monthData.total > 0 && (
                            <>
                              <View style={[S.wrkChip, { backgroundColor: 'rgba(22,163,74,0.08)' }]}>
                                <Text style={[S.wrkChipText, { color: colors.success }]}>{`✓ ${monthData.completed}`}</Text>
                              </View>
                              <View style={[S.wrkChip, { backgroundColor: 'rgba(37,99,235,0.08)' }]}>
                                <Text style={[S.wrkChipText, { color: colors.primary }]}>{`◎ ${monthData.pending}`}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>

                      <View style={S.wrkBar}>
                        <View style={[S.wrkBarFill, { width: `${heroPct}%`, backgroundColor: accent }]} />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={S.noData}>אין עובדים פעילים כרגע</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Worker Details Sheet ── */}
      <Modal visible={workerDetailsOpen} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={S.overlay} onPress={closeSheet}>
          <Pressable onPress={() => {}} style={S.sheet}>
            <View style={S.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sheetBody}>
              {/* Header */}
              <View style={S.sheetTop}>
                <Pressable onPress={closeSheet} style={S.closeBtn}>
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>×</Text>
                </Pressable>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={S.sheetName}>{selectedWorker?.name ?? 'עובד'}</Text>
                  <Text style={S.sheetSub}>{`סיכום חודשי · ${format(new Date(), 'M.yyyy')}`}</Text>
                </View>

                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    borderWidth: 2,
                    borderColor: `${colors.primary}30`,
                    padding: 2,
                  }}
                >
                  <Avatar size={50} uri={selectedWorker?.avatar_url ?? null} name={selectedWorker?.name ?? ''} />
                </View>
              </View>

              {/* Completion hero */}
              <View style={{ marginTop: 22 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>
                    {selectedWorkerMonth.total ? `${selectedWorkerCompletionPct}% הושלמו` : 'אין משימות'}
                  </Text>
                  <Text
                    style={{
                      color: selectedWorkerCompletionPct === 100 ? colors.success : colors.primary,
                      fontSize: 36,
                      fontWeight: '900',
                      letterSpacing: -1,
                    }}
                  >
                    {selectedWorkerMonth.completed}
                  </Text>
                </View>
                <View style={S.sheetBar}>
                  <View
                    style={[
                      S.sheetBarFill,
                      {
                        width: `${selectedWorkerCompletionPct}%`,
                        backgroundColor: selectedWorkerCompletionPct === 100 ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Stats grid */}
              <View style={S.sheetGrid}>
                <View style={S.sheetStat}>
                  <Text style={S.sheetStatVal}>{selectedWorkerMonth.pending}</Text>
                  <Text style={S.sheetStatLbl}>פתוחות</Text>
                </View>
                <View style={S.sheetStat}>
                  <Text style={S.sheetStatVal}>{selectedWorkerMonth.total}</Text>
                  <Text style={S.sheetStatLbl}>סה״כ</Text>
                </View>
              </View>

              {/* All-time */}
              <View style={S.sheetFull}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ minWidth: 44, alignItems: 'flex-start' }}>
                    {loadingAllTimeCompleted ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 26 }}>
                        {allTimeCompleted == null ? '—' : allTimeCompleted}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 13, textAlign: 'right' }}>
                    הושלמו בכל הזמנים
                  </Text>
                </View>
                {allTimeCompleted == null && !loadingAllTimeCompleted && (
                  <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12, textAlign: 'right', marginTop: 6 }}>
                    לא הצלחנו לטעון כרגע
                  </Text>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
