import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';
import { yyyyMmDd } from '../../lib/time';

type Template = { id: string; day_of_month: number };
type WorkSchedule = { id: string; date: string; template_id: string; created_at?: string };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type ServicePoint = { id: string; customer_id: string; refill_amount: number };
type Job = { id: string; customer_id?: string | null; worker_id: string; date: string; status: 'pending' | 'completed' };

function combine(dateYmd: string, timeHm: string): string {
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time');
  return d.toISOString();
}

export function WorkScheduleScreen() {
  const { setIsLoading } = useLoading();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

  const [date, setDate] = useState(yyyyMmDd(new Date()));
  const [templateId, setTemplateId] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<WorkSchedule | null>(null);

  const templateOptions = useMemo(
    () => templates.map((t) => ({ value: t.id, label: `יום ${t.day_of_month}` })),
    [templates]
  );

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([
        supabase.from('work_templates').select('id, day_of_month').order('day_of_month'),
        supabase.from('work_schedules').select('id, date, template_id, created_at').order('date', { ascending: false }),
      ]);
      if (tRes.error) throw tRes.error;
      if (sRes.error) throw sRes.error;
      setTemplates((tRes.data ?? []) as Template[]);
      setSchedules((sRes.data ?? []) as WorkSchedule[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const assignTemplate = async () => {
    if (!date.trim()) return Toast.show({ type: 'error', text1: 'חסר תאריך' });
    if (!templateId) return Toast.show({ type: 'error', text1: 'בחר תבנית' });

    try {
      setIsLoading(true);

      const upsertRes = await supabase.from('work_schedules').upsert({ date: date.trim(), template_id: templateId }).select('id, date, template_id').single();
      if (upsertRes.error) throw upsertRes.error;
      const schedule = upsertRes.data as any as WorkSchedule;

      const { data: stations, error: stErr } = await supabase
        .from('template_stations')
        .select('id, template_id, "order", customer_id, worker_id, scheduled_time')
        .eq('template_id', templateId)
        .order('order', { ascending: true });
      if (stErr) throw stErr;

      const stationList = (stations ?? []) as Station[];
      const validStations = stationList.filter((s) => s.customer_id && s.worker_id);
      if (!validStations.length) {
        Toast.show({ type: 'info', text1: 'אין תחנות משובצות', text2: 'שייך לקוח+עובד לתחנות בתבניות עבודה' });
        await fetchAll();
        return;
      }

      const start = new Date(`${date.trim()}T00:00:00`).toISOString();
      const end = new Date(`${date.trim()}T23:59:59`).toISOString();

      const customerIds = Array.from(new Set(validStations.map((s) => s.customer_id!)));
      const { data: spData, error: spErr } = await supabase
        .from('service_points')
        .select('id, customer_id, refill_amount')
        .in('customer_id', customerIds);
      if (spErr) throw spErr;
      const spByCustomer = new Map<string, ServicePoint[]>();
      for (const sp of (spData ?? []) as ServicePoint[]) {
        if (!spByCustomer.has(sp.customer_id)) spByCustomer.set(sp.customer_id, []);
        spByCustomer.get(sp.customer_id)!.push(sp);
      }

      // create/update jobs + ensure job_service_points (idempotent)
      for (const st of validStations) {
        const jobDate = combine(date.trim(), st.scheduled_time || '09:00');
        const { data: existing, error: existingErr } = await supabase
          .from('jobs')
          .select('id, customer_id, worker_id, date, status')
          .eq('status', 'pending')
          .eq('customer_id', st.customer_id!)
          .eq('worker_id', st.worker_id!)
          .gte('date', start)
          .lte('date', end)
          .maybeSingle();
        if (existingErr) throw existingErr;

        let jobId: string;
        if (existing) {
          jobId = (existing as any).id as string;
          const { error: updErr } = await supabase.from('jobs').update({ date: jobDate }).eq('id', jobId);
          if (updErr) throw updErr;
        } else {
          const { data: job, error: jobErr } = await supabase
            .from('jobs')
            .insert({
              customer_id: st.customer_id,
              worker_id: st.worker_id,
              date: jobDate,
              status: 'pending',
            })
            .select('id')
            .single();
          if (jobErr) throw jobErr;
          jobId = (job as any).id as string;
        }

        const sps = spByCustomer.get(st.customer_id!) ?? [];
        if (sps.length) {
          const { data: existingJsp, error: exJspErr } = await supabase
            .from('job_service_points')
            .select('service_point_id')
            .eq('job_id', jobId);
          if (exJspErr) throw exJspErr;
          const existingSpIds = new Set((existingJsp ?? []).map((r: any) => r.service_point_id as string));
          const missing = sps.filter((sp) => !existingSpIds.has(sp.id));
          if (missing.length) {
            const rows = missing.map((sp) => ({ job_id: jobId, service_point_id: sp.id, custom_refill_amount: null }));
            const { error: jspErr } = await supabase.from('job_service_points').insert(rows);
            if (jspErr) throw jspErr;
          }
        }
      }

      Toast.show({ type: 'success', text1: 'שויך תבנית ונוצרו משימות' });
      setSelectedSchedule(schedule);
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שיוך נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const removeTemplate = async (schedule: WorkSchedule) => {
    try {
      setIsLoading(true);
      const day = schedule.date;
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const { data: stations, error: stErr } = await supabase
        .from('template_stations')
        .select('customer_id, worker_id')
        .eq('template_id', schedule.template_id);
      if (stErr) throw stErr;

      const pairs = (stations ?? [])
        .map((s: any) => ({ customer_id: s.customer_id as string | null, worker_id: s.worker_id as string | null }))
        .filter((p) => p.customer_id && p.worker_id) as { customer_id: string; worker_id: string }[];

      const jobIdsToDelete: string[] = [];
      for (const p of pairs) {
        const { data: job, error: jobErr } = await supabase
          .from('jobs')
          .select('id')
          .eq('status', 'pending')
          .eq('customer_id', p.customer_id)
          .eq('worker_id', p.worker_id)
          .gte('date', start)
          .lte('date', end)
          .maybeSingle();
        if (jobErr) throw jobErr;
        if (job) jobIdsToDelete.push((job as any).id as string);
      }

      if (jobIdsToDelete.length) {
        const { error: jspErr } = await supabase.from('job_service_points').delete().in('job_id', jobIdsToDelete);
        if (jspErr) throw jspErr;
        const { error: delJobsErr } = await supabase.from('jobs').delete().in('id', jobIdsToDelete);
        if (delJobsErr) throw delJobsErr;
      }

      const { error } = await supabase.from('work_schedules').delete().eq('id', schedule.id);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'הוסר שיוך תבנית' });
      setSelectedSchedule(null);
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הסרה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchAll} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>קווי עבודה</Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>שיוך תבנית לתאריך</Text>
          <View style={{ gap: 10 }}>
            <Input label="תאריך (yyyy-MM-dd)" value={date} onChangeText={setDate} />
            <SelectSheet label="תבנית" value={templateId} placeholder="בחר תבנית…" options={templateOptions} onChange={setTemplateId} />
            <Button title="שייך תבנית + צור משימות" onPress={assignTemplate} />
          </View>
        </Card>

        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>שיוכים קיימים</Text>
        <FlatList
          data={schedules}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelectedSchedule(item)}>
              <Card>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.date}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>template_id: {item.template_id}</Text>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין שיוכים.</Text>}
        />
      </View>

      <ModalSheet visible={!!selectedSchedule} onClose={() => setSelectedSchedule(null)}>
        {!!selectedSchedule && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>שיוך</Text>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{selectedSchedule.date}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>template_id: {selectedSchedule.template_id}</Text>
            </Card>
            <Button title="הסר תבנית (ימחק pending jobs ליום)" variant="danger" onPress={() => removeTemplate(selectedSchedule)} />
            <Button title="סגור" variant="secondary" onPress={() => setSelectedSchedule(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

