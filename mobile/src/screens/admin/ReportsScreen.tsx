import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';

type Customer = { id: string; name: string; role: 'customer'; price?: number | null };
type Job = { id: string; date: string; status: 'pending' | 'completed' };
type ServicePoint = { id: string; refill_amount: number };
type JobServicePoint = { id: string; job_id: string; service_point_id: string; custom_refill_amount?: number | null };

type JobReport = { jobId: string; date: string; totalRefill: number };

export function ReportsScreen() {
  const { setIsLoading } = useLoading();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [jobs, setJobs] = useState<JobReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerPrice, setCustomerPrice] = useState<number | null>(null);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.name })),
    [customers]
  );

  const fetchCustomers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('id, name, role, price').eq('role', 'customer').order('name');
    if (!error) setCustomers((data ?? []) as any);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
    }, [fetchCustomers])
  );

  const runReport = async () => {
    if (!customerId) {
      Toast.show({ type: 'error', text1: 'בחר לקוח' });
      return;
    }
    try {
      setLoading(true);
      setIsLoading(true);

      const customer = customers.find((c) => c.id === customerId);
      setCustomerPrice(customer?.price ?? null);

      const { data: completedJobs, error: jobErr } = await supabase
        .from('jobs')
        .select('id, date, status')
        .eq('customer_id', customerId)
        .eq('status', 'completed')
        .order('date', { ascending: false });
      if (jobErr) throw jobErr;

      const jobList = (completedJobs ?? []) as Job[];
      const jobIds = jobList.map((j) => j.id);
      if (!jobIds.length) {
        setJobs([]);
        return;
      }

      const { data: jsps, error: jspErr } = await supabase
        .from('job_service_points')
        .select('id, job_id, service_point_id, custom_refill_amount')
        .in('job_id', jobIds);
      if (jspErr) throw jspErr;

      const jspRows = (jsps ?? []) as JobServicePoint[];
      const spIds = Array.from(new Set(jspRows.map((r) => r.service_point_id)));

      const { data: sps, error: spErr } = await supabase.from('service_points').select('id, refill_amount').in('id', spIds);
      if (spErr) throw spErr;
      const spMap = new Map(((sps ?? []) as ServicePoint[]).map((sp) => [sp.id, sp.refill_amount]));

      const sums = new Map<string, number>();
      for (const r of jspRows) {
        const base = spMap.get(r.service_point_id) ?? 0;
        const amt = r.custom_refill_amount ?? base;
        sums.set(r.job_id, (sums.get(r.job_id) ?? 0) + Number(amt));
      }

      const reports: JobReport[] = jobList.map((j) => ({
        jobId: j.id,
        date: j.date,
        totalRefill: sums.get(j.id) ?? 0,
      }));

      setJobs(reports);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'דוח נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const total = useMemo(() => jobs.reduce((sum, j) => sum + j.totalRefill, 0), [jobs]);

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'הרץ דוח'} fullWidth={false} onPress={runReport} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>דוחות</Text>
        </View>
        <SelectSheet label="לקוח" value={customerId} placeholder="בחר לקוח…" options={customerOptions} onChange={setCustomerId} />
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>סיכום</Text>
          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
            סה״כ מילוי: {total}
            {customerPrice != null ? `\nמחיר לקוח: ${customerPrice}` : ''}
          </Text>
        </Card>

        <FlatList
          data={jobs}
          keyExtractor={(i) => i.jobId}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>Job #{item.jobId.slice(0, 6)}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>{item.date}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>סה״כ מילוי: {item.totalRefill}</Text>
            </Card>
          )}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נתונים.</Text>}
        />
      </View>
    </Screen>
  );
}

