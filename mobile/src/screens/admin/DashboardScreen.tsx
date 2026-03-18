import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

type SimpleUser = { id: string; name: string; role: 'admin' | 'worker' | 'customer'; price?: number | null };
type SimpleJob = { id: string; date: string; status: 'pending' | 'completed'; worker_id: string; customer_id?: string | null };
type ServicePoint = { id: string; device_type: string };

export function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [monthJobs, setMonthJobs] = useState<SimpleJob[]>([]);
  const [workers, setWorkers] = useState<SimpleUser[]>([]);
  const [customers, setCustomers] = useState<SimpleUser[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();

      const [jobsRes, usersRes, spRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, date, status, worker_id, customer_id')
          .gte('date', start)
          .lte('date', end),
        supabase.from('users').select('id, name, role, price'),
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

    const deviceDistribution = servicePoints.reduce<Record<string, number>>((acc, sp) => {
      const key = sp.device_type || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const activeWorkers = new Set(monthJobs.filter((j) => j.status === 'pending').map((j) => j.worker_id)).size;

    const deviceRows = Object.entries(deviceDistribution)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { customersCount, totalPointsPrice, jobsThisMonth, pendingThisMonth, activeWorkers, deviceRows };
  }, [customers, monthJobs, servicePoints]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchAll} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>לוח בקרה</Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>סטטיסטיקות חודשיות</Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>
            משימות החודש: {stats.jobsThisMonth}{'\n'}
            Pending החודש: {stats.pendingThisMonth}{'\n'}
            עובדים פעילים (בערך): {stats.activeWorkers}{'\n'}
            לקוחות: {stats.customersCount}{'\n'}
            סה״כ מחיר נקודות: {stats.totalPointsPrice}
          </Text>
        </Card>

        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>התפלגות מכשירים (Top)</Text>
        <FlatList
          data={stats.deviceRows}
          keyExtractor={(i) => i.device}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.device}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>כמות: {item.count}</Text>
            </Card>
          )}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נתונים.</Text>}
        />
      </View>
    </Screen>
  );
}

