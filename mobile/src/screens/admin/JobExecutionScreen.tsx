import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { JobCard, JobChip } from '../../components/jobs/JobCard';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { yyyyMmDd } from '../../lib/time';
import { useLoading } from '../../state/LoadingContext';
import { pickImageFromLibrary } from '../../lib/media';
import { completeUnifiedJob, uploadJobServicePointImage } from '../../lib/execution';

type Job = {
  id: string;
  date: string;
  status: 'pending' | 'completed';
  worker_id: string;
  customer_id?: string | null;
  order_number?: number | null;
  notes?: string | null;
};

type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };

type JobServicePoint = {
  id: string;
  job_id: string;
  service_point_id: string;
  image_url?: string | null;
  custom_refill_amount?: number | null;
  sp?: ServicePoint | null;
  localImageUri?: string | null;
  uploading?: boolean;
};

export function JobExecutionScreen() {
  const { setIsLoading } = useLoading();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [points, setPoints] = useState<JobServicePoint[]>([]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('id, date, status, worker_id, customer_id, order_number, notes')
        .order('date', { ascending: false });
      if (error) throw error;
      setJobs((data ?? []) as Job[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת משימות נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchJobs();
    }, [])
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (dateFilter && yyyyMmDd(j.date) !== dateFilter) return false;
      if (!qq) return true;
      return j.id.toLowerCase().includes(qq) || String(j.order_number ?? '').includes(qq);
    });
  }, [jobs, q, dateFilter]);

  const openJob = async (job: Job) => {
    setSelectedJob(job);
    setPoints([]);
    try {
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
      setPoints(rows.map((r) => ({ ...r, sp: spMap.get(r.service_point_id) ?? null })));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת נקודות נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const pickImage = async (jspId: string) => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setPoints((prev) => prev.map((p) => (p.id === jspId ? { ...p, localImageUri: uri } : p)));
  };

  const uploadForPoint = async (p: JobServicePoint) => {
    if (!selectedJob) return;
    if (!p.localImageUri) {
      Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
      return;
    }

    try {
      setPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadJobServicePointImage({
        jobId: selectedJob.id,
        jobServicePointId: p.id,
        servicePointId: p.service_point_id,
        localUri: p.localImageUri,
      });
      setPoints((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath, uploading: false } : x))
      );
      Toast.show({ type: 'success', text1: 'התמונה הועלתה' });
    } catch (e: any) {
      setPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const completeJob = async () => {
    if (!selectedJob) return;
    try {
      setIsLoading(true);
      await completeUnifiedJob('regular', selectedJob.id);
      setJobs((prev) => prev.map((j) => (j.id === selectedJob.id ? { ...j, status: 'completed' } : j)));
      Toast.show({ type: 'success', text1: 'המשימה הושלמה' });
      setSelectedJob((p) => (p ? { ...p, status: 'completed' } : p));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen backgroundColor="#FAF9FE">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchJobs} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>ביצוע משימות</Text>
        </View>
        <Input label="חיפוש (id / מספר הזמנה)" value={q} onChangeText={setQ} />
        <Input label="תאריך (yyyy-MM-dd) אופציונלי" value={dateFilter} onChangeText={setDateFilter} placeholder="2026-03-15" />
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <JobCard
            title={`#${item.order_number ?? '—'} - משימת ריח`}
            status={item.status}
            primaryText={item.customer_id ? `לקוח: ${item.customer_id.slice(0, 6)}` : undefined}
            description={item.notes ?? null}
            onPress={() => openJob(item)}
            faded={item.status === 'completed'}
            chips={
              <>
                <JobChip text="רגילה" />
                <JobChip text={yyyyMmDd(item.date)} muted />
              </>
            }
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selectedJob} onClose={() => setSelectedJob(null)}>
        {!!selectedJob && (
          <View style={{ gap: 12 }}>
            <JobCard
              title={`#${selectedJob.order_number ?? '—'} - משימת ריח`}
              status={selectedJob.status}
              description={selectedJob.notes ?? null}
              chips={
                <>
                  <JobChip text="רגילה" />
                  <JobChip text={yyyyMmDd(selectedJob.date)} muted />
                </>
              }
            />

            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>נקודות שירות</Text>
            <View style={{ gap: 10 }}>
              {points.map((p) => {
                const currentImageUrl = p.image_url ? getPublicUrl(p.image_url) : null;
                return (
                  <Card key={p.id}>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                      {p.sp?.device_type ?? p.service_point_id}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                      ניחוח: {p.sp?.scent_type ?? '-'} • מילוי: {p.custom_refill_amount ?? p.sp?.refill_amount ?? '-'}
                    </Text>

                    <View style={{ marginTop: 10, gap: 10 }}>
                      {p.localImageUri ? (
                        <Image source={{ uri: p.localImageUri }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                      ) : currentImageUrl ? (
                        <Image source={{ uri: currentImageUrl }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                      ) : null}

                      {currentImageUrl ? (
                        <Text style={{ color: colors.muted, textAlign: 'right' }} numberOfLines={1}>
                          {currentImageUrl}
                        </Text>
                      ) : null}

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Button title="בחר תמונה" variant="secondary" onPress={() => pickImage(p.id)} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            title={p.uploading ? 'מעלה…' : 'העלה'}
                            disabled={p.uploading}
                            onPress={() => uploadForPoint(p)}
                          />
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })}
              {!points.length ? <Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות.</Text> : null}
            </View>

            <Button
              title={selectedJob.status === 'completed' ? 'כבר הושלם' : 'סיים משימה'}
              disabled={selectedJob.status === 'completed'}
              onPress={completeJob}
            />
            <Button title="סגור" variant="secondary" onPress={() => setSelectedJob(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

