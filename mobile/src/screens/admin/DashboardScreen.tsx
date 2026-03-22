import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { ClipboardList, Coins, UserRound, Users } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
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

function formatShortDate(iso: string) {
  try {
    return format(new Date(iso), 'd.M.yyyy');
  } catch {
    return '';
  }
}

function jobTitle(j: SimpleJob) {
  if (j.notes?.trim()) return j.notes.trim();
  if (j.order_number != null) return `הזמנה #${j.order_number}`;
  return `משימה #${j.id.slice(0, 6)}`;
}

function jobStatusLabel(status: SimpleJob['status']) {
  return status === 'pending' ? 'במהלך' : 'הושלם';
}

export function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [monthJobs, setMonthJobs] = useState<SimpleJob[]>([]);
  const [recentJobs, setRecentJobs] = useState<SimpleJob[]>([]);
  const [workers, setWorkers] = useState<SimpleUser[]>([]);
  const [customers, setCustomers] = useState<SimpleUser[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [workerDetailsOpen, setWorkerDetailsOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();

      const [jobsRes, recentRes, usersRes, spRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, date, status, worker_id, customer_id, order_number, notes')
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false }),
        supabase
          .from('jobs')
          .select('id, date, status, worker_id, customer_id, order_number, notes')
          .order('date', { ascending: false })
          .limit(3),
        supabase.from('users').select('id, name, role, price, avatar_url'),
        supabase.from('service_points').select('id, device_type'),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (recentRes.error) throw recentRes.error;
      if (usersRes.error) throw usersRes.error;
      if (spRes.error) throw spRes.error;

      const allUsers = (usersRes.data ?? []) as SimpleUser[];
      setMonthJobs((jobsRes.data ?? []) as SimpleJob[]);
      setRecentJobs((recentRes.data ?? []) as SimpleJob[]);
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

    return {
      customersCount,
      totalPointsPrice,
      jobsThisMonth,
      pendingThisMonth,
      monthByWorker,
      dailyDistribution,
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 26 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Card
            style={{
              flexBasis: '48%',
              flexGrow: 1,
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: '#EEF2FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={18} color="#4338CA" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>עובדים פעילים</Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
                  {stats.activeWorkers}
                </Text>
              </View>
            </View>
          </Card>

          <Card
            style={{
              flexBasis: '48%',
              flexGrow: 1,
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: '#ECFDF5',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserRound size={18} color="#047857" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>לקוחות</Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
                  {stats.customersCount}
                </Text>
              </View>
            </View>
          </Card>

          <Card
            style={{
              flexBasis: '48%',
              flexGrow: 1,
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: '#F5F3FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ClipboardList size={18} color="#6D28D9" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>סה״כ משימות</Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
                  {stats.jobsThisMonth}
                </Text>
              </View>
            </View>
          </Card>

          <Card
            style={{
              flexBasis: '48%',
              flexGrow: 1,
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: '#FFFBEB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Coins size={18} color="#B45309" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>מחיר כל הנקודות</Text>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
                  {formatIls(stats.totalPointsPrice)}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={{ marginTop: 14, gap: 10 }}>
          <Card
            style={{
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted, fontWeight: '800' }}>Top</Text>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>התפלגות מכשירים</Text>
            </View>

            <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stats.deviceRows.length ? (
                stats.deviceRows.map((r) => (
                  <View
                    key={r.device}
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      backgroundColor: colors.bg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{r.device}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: colors.muted, fontWeight: '800' }}>יחידות</Text>
                      <Text style={{ color: colors.text, fontWeight: '900' }}>{r.count}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>אין נתונים.</Text>
              )}
            </View>
          </Card>

          <Card
            style={{
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: '#EEF2FF',
                  borderWidth: 1,
                  borderColor: '#C7D2FE',
                }}
              >
                <Text style={{ color: '#3730A3', fontWeight: '900' }}>{`היום · ${format(new Date(), 'd.M')}`}</Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>התפלגות משימות יומיות לפי עובדים</Text>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right', marginTop: 4 }}>
                  {`סה״כ ${stats.dailyDistribution.totalJobs} משימות`}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              {stats.dailyDistribution.rows.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingVertical: 2, paddingHorizontal: 2 }}
                >
                  {stats.dailyDistribution.rows.map((w) => {
                    const pct = w.total ? Math.round((w.completed / w.total) * 100) : 0;
                    return (
                      <View
                        key={w.id}
                        style={{
                          width: 190,
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.bg,
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Avatar size={44} uri={w.avatar_url ?? null} name={w.name} />
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }} numberOfLines={1}>
                              {w.name}
                            </Text>
                            <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right', marginTop: 3 }}>
                              {`פתוחות ${w.pending} · הושלמו ${w.completed}`}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            marginTop: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: '#E2E8F0',
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                          }}
                        >
                          <View
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: pct === 100 ? colors.success : '#3B82F6',
                            }}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                          <Text style={{ color: colors.muted, fontWeight: '800' }}>סה״כ</Text>
                          <Text style={{ color: colors.text, fontWeight: '900' }}>{w.total}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>אין משימות להיום.</Text>
              )}
            </View>
          </Card>

          <Card
            style={{
              padding: 14,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>עובדים פעילים</Text>

            <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stats.activeWorkerRows.length ? (
                stats.activeWorkerRows.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      setSelectedWorkerId(w.id);
                      setWorkerDetailsOpen(true);
                    }}
                    android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.bg,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                        <Avatar size={36} uri={w.avatar_url ?? null} name={w.name} />
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', flexShrink: 1 }} numberOfLines={1}>
                          {w.name}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>אין עובדים פעילים כרגע</Text>
              )}
            </View>
          </Card>
        </View>
      </ScrollView>

      <Modal
        visible={workerDetailsOpen}
        transparent
        animationType="fade"
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
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.45)',
            padding: 16,
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.elevated,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Pressable
                onPress={() => {
                  setWorkerDetailsOpen(false);
                  setSelectedWorkerId(null);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '900' }}>סגור</Text>
              </Pressable>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>סיכום חודשי</Text>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginTop: 2 }} numberOfLines={1}>
                  {selectedWorker?.name ?? 'עובד'}
                </Text>
              </View>

              <Avatar size={44} uri={selectedWorker?.avatar_url ?? null} name={selectedWorker?.name ?? ''} />
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              <View
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.muted, fontWeight: '800' }}>הושלמו החודש</Text>
                  <Text style={{ color: colors.success, fontWeight: '900', fontSize: 18 }}>{selectedWorkerMonth.completed}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: colors.muted, fontWeight: '800' }}>פתוחות</Text>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{selectedWorkerMonth.pending}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: colors.muted, fontWeight: '800' }}>סה״כ</Text>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{selectedWorkerMonth.total}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

