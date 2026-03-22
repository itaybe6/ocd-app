import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { ClipboardList, Coins, UserRound, Users } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
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


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 28, paddingHorizontal: 16, paddingTop: 12 },
  header: { marginBottom: 12, gap: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitleWrap: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { color: colors.text, fontWeight: '900', fontSize: 30, letterSpacing: -0.2, textAlign: 'right' },
  headerSubtitle: { color: colors.muted, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)',
  },
  pillText: { color: colors.text, fontWeight: '900' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    borderRadius: 22,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 2 },
    }),
  },
  tile: { flexBasis: '48%', flexGrow: 1 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { color: colors.muted, fontWeight: '900', textAlign: 'right' },
  tileValue: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 2 },
  section: { marginTop: 12, gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: colors.text, fontWeight: '900', textAlign: 'right' },
  sectionMeta: { color: colors.muted, fontWeight: '800', textAlign: 'right', marginTop: 3 },
  listRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: colors.bg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  listRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.06)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  horizontalCards: { gap: 12, paddingVertical: 2, paddingHorizontal: 2 },
  workerCard: {
    width: 196,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: colors.bg,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  workerName: { color: colors.text, fontWeight: '900', textAlign: 'right' },
  workerMeta: { color: colors.muted, fontWeight: '800', textAlign: 'right', marginTop: 3 },
  activeWorkerRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: colors.bg,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
  },
  badgeText: { color: colors.primary, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)',
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: -6 } },
      android: { elevation: 8 },
    }),
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.12)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    }, [fetchAll])
  );

  const stats = useMemo(() => {
    const customersCount = customers.length;
    const totalPointsPrice = customers.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
    const jobsThisMonth = monthJobs.length;
    const pendingThisMonth = monthJobs.filter((j) => j.status === 'pending').length;

    const monthByWorker = monthJobs.reduce<Record<string, { total: number; pending: number; completed: number }>>((acc, j) => {
      const row = acc[j.worker_id] ?? { total: 0, pending: 0, completed: 0 };
      row.total += 1;
      if (j.status === 'pending') row.pending += 1;
      else row.completed += 1;
      acc[j.worker_id] = row;
      return acc;
    }, {});

    const dailyDistribution = (() => {
      const start = startOfDay(new Date()).getTime();
      const end = endOfDay(new Date()).getTime();
      const jobsToday = monthJobs.filter((j) => {
        const t = new Date(j.date).getTime();
        return Number.isFinite(t) && t >= start && t <= end;
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

    const activeWorkerRows = (() => {
      return workers
        .map((w) => ({
          id: w.id,
          name: w.name,
          avatar_url: w.avatar_url ?? null,
          count: monthByWorker[w.id]?.pending ?? 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'));
    })();

    const dailyByWorker = new Map(dailyDistribution.rows.map((r) => [r.id, r]));

    return {
      customersCount,
      totalPointsPrice,
      jobsThisMonth,
      pendingThisMonth,
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

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} tintColor={colors.primary} />}
      >
        <View style={styles.kpiGrid}>
          <Card style={[styles.card, styles.tile]}>
            <View style={styles.tileRow}>
              <View style={styles.iconChip}>
                <Users size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.tileLabel}>עובדים פעילים</Text>
                <Text style={styles.tileValue}>{stats.activeWorkers}</Text>
              </View>
            </View>
          </Card>

          <Card style={[styles.card, styles.tile]}>
            <View style={styles.tileRow}>
              <View style={styles.iconChip}>
                <UserRound size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.tileLabel}>לקוחות</Text>
                <Text style={styles.tileValue}>{stats.customersCount}</Text>
              </View>
            </View>
          </Card>

          <Card style={[styles.card, styles.tile]}>
            <View style={styles.tileRow}>
              <View style={styles.iconChip}>
                <ClipboardList size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.tileLabel}>סה״כ משימות</Text>
                <Text style={styles.tileValue}>{stats.jobsThisMonth}</Text>
              </View>
            </View>
          </Card>

          <Card style={[styles.card, styles.tile]}>
            <View style={styles.tileRow}>
              <View style={styles.iconChip}>
                <Coins size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.tileLabel}>מחיר כל הנקודות</Text>
                <Text style={[styles.tileValue, { fontSize: 20 }]}>{formatIls(stats.totalPointsPrice)}</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Card style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              {stats.deviceRows.length ? (
                <View style={[styles.badge, { backgroundColor: 'rgba(15,23,42,0.04)', borderColor: 'rgba(15,23,42,0.06)' }]}>
                  <Text style={[styles.badgeText, { color: colors.muted }]}>מובילים</Text>
                </View>
              ) : (
                <View />
              )}
              <Text style={styles.sectionTitle}>התפלגות מכשירים</Text>
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {stats.deviceRows.length ? (
                stats.deviceRows.map((r) => {
                  const pct = Math.round((r.count / deviceMax) * 100);
                  return (
                    <View key={r.device} style={styles.listRow}>
                      <View style={styles.listRowTop}>
                        <Text style={{ color: colors.text, fontWeight: '900' }}>{r.count}</Text>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }} numberOfLines={1}>
                          {r.device}
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>אין נתונים.</Text>
              )}
            </View>
          </Card>

          <Card style={[styles.card, { paddingHorizontal: 0, paddingBottom: 0 }]}>
            <View style={[styles.sectionHeaderRow, { paddingHorizontal: 16 }]}>
              {stats.pendingThisMonth ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{`${stats.pendingThisMonth} פתוחות`}</Text>
                </View>
              ) : <View />}
              <Text style={styles.sectionTitle}>עובדים פעילים</Text>
            </View>

            {stats.activeWorkerRows.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0, gap: 10 }}
              >
                {stats.activeWorkerRows.map((w, i) => {
                  const monthData = stats.monthByWorker[w.id] ?? { total: 0, pending: 0, completed: 0 };
                  const todayData = stats.dailyByWorker.get(w.id);
                  const hasToday = !!todayData && todayData.total > 0;
                  const todayPct = hasToday ? Math.round((todayData.completed / todayData.total) * 100) : 0;
                  const monthPct = monthData.total ? Math.round((monthData.completed / monthData.total) * 100) : 0;
                  const heroPct = hasToday ? todayPct : monthPct;
                  const accentColor = heroPct === 100 ? colors.success : colors.primary;
                  const isTop = i === 0;
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => {
                        setSelectedWorkerId(w.id);
                        setWorkerDetailsOpen(true);
                      }}
                      style={({ pressed }) => ({
                        width: 162,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isTop ? `${accentColor}33` : 'rgba(15,23,42,0.08)',
                        backgroundColor: isTop ? `${accentColor}07` : colors.elevated,
                        overflow: 'hidden',
                        opacity: pressed ? 0.78 : 1,
                        transform: pressed ? [{ scale: 0.96 }] : [],
                      })}
                    >
                      <View style={{ padding: 14, alignItems: 'center', gap: 10 }}>
                        <View
                          style={{
                            width: 68,
                            height: 68,
                            borderRadius: 34,
                            borderWidth: 3,
                            borderColor: `${accentColor}55`,
                            padding: 2,
                            backgroundColor: colors.elevated,
                          }}
                        >
                          <Avatar size={60} uri={w.avatar_url ?? null} name={w.name} />
                        </View>

                        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 14, textAlign: 'center' }} numberOfLines={1}>
                          {w.name}
                        </Text>

                        {hasToday ? (
                          <View style={{ alignItems: 'center', gap: 3 }}>
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 5,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 8,
                              backgroundColor: 'rgba(15,23,42,0.04)',
                            }}>
                              <Text style={{ color: colors.muted, fontWeight: '900', fontSize: 10 }}>היום</Text>
                            </View>
                            <Text style={{ color: accentColor, fontWeight: '900', fontSize: 30, letterSpacing: -1 }}>
                              {`${todayPct}%`}
                            </Text>
                            <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 11, textAlign: 'center' }}>
                              {`${todayData.completed} מתוך ${todayData.total}`}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ alignItems: 'center', gap: 2 }}>
                            <Text style={{ color: accentColor, fontWeight: '900', fontSize: 30, letterSpacing: -1 }}>
                              {monthData.total ? `${monthPct}%` : '—'}
                            </Text>
                            <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 11, textAlign: 'center' }}>
                              {monthData.total ? `החודש · ${monthData.completed} מתוך ${monthData.total}` : 'אין משימות'}
                            </Text>
                          </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {hasToday && (
                            <>
                              <View style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(22,163,74,0.10)' }}>
                                <Text style={{ color: colors.success, fontWeight: '900', fontSize: 11 }}>{`✓ ${todayData.completed}`}</Text>
                              </View>
                              <View style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(37,99,235,0.08)' }}>
                                <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 11 }}>{`◎ ${todayData.pending}`}</Text>
                              </View>
                            </>
                          )}
                          {!hasToday && monthData.total > 0 && (
                            <>
                              <View style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(22,163,74,0.10)' }}>
                                <Text style={{ color: colors.success, fontWeight: '900', fontSize: 11 }}>{`✓ ${monthData.completed}`}</Text>
                              </View>
                              <View style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(37,99,235,0.08)' }}>
                                <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 11 }}>{`◎ ${monthData.pending}`}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>

                      <View style={{ height: 6, backgroundColor: 'rgba(15,23,42,0.05)' }}>
                        <View style={{ height: '100%', width: `${heroPct}%`, backgroundColor: accentColor }} />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right', paddingHorizontal: 16, paddingVertical: 12 }}>
                אין עובדים פעילים כרגע
              </Text>
            )}
            <View style={{ height: 16 }} />
          </Card>
        </View>
      </ScrollView>

      <Modal
        visible={workerDetailsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setWorkerDetailsOpen(false);
          setSelectedWorkerId(null);
        }}
      >
        <Pressable
          onPress={() => {
            setWorkerDetailsOpen(false);
            setSelectedWorkerId(null);
          }}
          style={styles.modalOverlay}
        >
          <Pressable onPress={() => {}} style={[styles.sheet, { width: '100%', maxHeight: '88%' }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Pressable
                  onPress={() => {
                    setWorkerDetailsOpen(false);
                    setSelectedWorkerId(null);
                  }}
                  style={styles.closeButton}
                >
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>×</Text>
                </Pressable>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{format(new Date(), 'M.yyyy')}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontWeight: '900' }}>סיכום חודשי</Text>
                  </View>

                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginTop: 6, fontSize: 18 }} numberOfLines={1}>
                    {selectedWorker?.name ?? 'עובד'}
                  </Text>
                </View>

                <Avatar size={52} uri={selectedWorker?.avatar_url ?? null} name={selectedWorker?.name ?? ''} />
              </View>

              <View style={{ marginTop: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: 'rgba(15,23,42,0.08)',
                  backgroundColor: colors.bg,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.muted, fontWeight: '900' }}>הושלמו החודש</Text>
                  <Text style={{ color: colors.success, fontWeight: '900', fontSize: 28 }}>{selectedWorkerMonth.completed}</Text>
                </View>

                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right', marginTop: 6 }}>
                  {selectedWorkerMonth.total ? `${selectedWorkerCompletionPct}% מתוך ${selectedWorkerMonth.total}` : 'אין משימות החודש'}
                </Text>

                <View
                  style={{
                    marginTop: 10,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: 'rgba(15,23,42,0.06)',
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(15,23,42,0.06)',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${selectedWorkerCompletionPct}%`,
                      backgroundColor: selectedWorkerCompletionPct === 100 ? colors.success : colors.primary,
                    }}
                  />
                </View>

                <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <View
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: 'rgba(15,23,42,0.08)',
                      backgroundColor: colors.elevated,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontWeight: '900', textAlign: 'right' }}>פתוחות</Text>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, textAlign: 'right', marginTop: 6 }}>
                      {selectedWorkerMonth.pending}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: 'rgba(15,23,42,0.08)',
                      backgroundColor: colors.elevated,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontWeight: '900', textAlign: 'right' }}>סה״כ</Text>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, textAlign: 'right', marginTop: 6 }}>
                      {selectedWorkerMonth.total}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexBasis: '100%',
                      flexGrow: 1,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: 'rgba(15,23,42,0.08)',
                      backgroundColor: colors.elevated,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ minWidth: 44, alignItems: 'flex-start' }}>
                        {loadingAllTimeCompleted ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20 }}>
                            {allTimeCompleted == null ? '—' : allTimeCompleted}
                          </Text>
                        )}
                      </View>
                      <Text style={{ color: colors.muted, fontWeight: '900', textAlign: 'right' }}>הושלמו בכל הזמנים</Text>
                    </View>
                    {allTimeCompleted == null && !loadingAllTimeCompleted ? (
                      <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right', marginTop: 6 }}>
                        לא הצלחנו לטעון כרגע
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

