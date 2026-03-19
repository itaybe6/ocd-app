import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { endOfMonth, format, startOfMonth } from 'date-fns';
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
      const pending = monthJobs.filter((j) => j.status === 'pending');
      const counts = pending.reduce<Record<string, number>>((acc, j) => {
        acc[j.worker_id] = (acc[j.worker_id] ?? 0) + 1;
        return acc;
      }, {});
      const nameById = new Map(workers.map((w) => [w.id, w.name]));
      const avatarById = new Map(workers.map((w) => [w.id, w.avatar_url ?? null]));
      return Object.entries(counts)
        .map(([id, count]) => ({ id, count, name: nameById.get(id) ?? 'עובד', avatar_url: avatarById.get(id) ?? null }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    })();

    return { customersCount, totalPointsPrice, jobsThisMonth, pendingThisMonth, activeWorkers, deviceRows, activeWorkerRows };
  }, [customers, monthJobs, servicePoints, workers]);

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
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>משימות אחרונות</Text>

            <View style={{ marginTop: 10, gap: 10 }}>
              {recentJobs.length ? (
                recentJobs.map((j) => (
                  <View
                    key={j.id}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.bg,
                      borderRadius: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: j.status === 'pending' ? '#FEF3C7' : '#DCFCE7',
                        borderWidth: 1,
                        borderColor: j.status === 'pending' ? '#F59E0B' : '#22C55E',
                      }}
                    >
                      <Text style={{ color: j.status === 'pending' ? '#92400E' : '#166534', fontWeight: '900' }}>
                        {jobStatusLabel(j.status)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }} numberOfLines={1}>
                        {jobTitle(j)}
                      </Text>
                      <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right', marginTop: 4 }}>
                        {formatShortDate(j.date)}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>אין משימות להצגה.</Text>
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

            <View style={{ marginTop: 10, gap: 10 }}>
              {stats.activeWorkerRows.length ? (
                stats.activeWorkerRows.map((w) => (
                  <View
                    key={w.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.bg,
                    }}
                  >
                    <Avatar size={34} uri={w.avatar_url ?? null} name={w.name} />
                    <View
                      style={{
                        minWidth: 40,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: '#93C5FD',
                        backgroundColor: '#EFF6FF',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#1D4ED8', fontWeight: '900' }}>{w.count}</Text>
                    </View>

                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1 }}>
                      {w.name}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>אין עובדים פעילים כרגע</Text>
              )}
            </View>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

