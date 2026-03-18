import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ModalSheet } from '../../components/ModalSheet';
import { Input } from '../../components/ui/Input';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { yyyyMmDd } from '../../lib/time';

type Job = {
  id: string;
  date: string;
  status: 'pending' | 'completed';
  worker_id: string;
};

type JobServicePoint = { id: string; job_id: string; image_url?: string | null };

export function CustomerServicesScreen() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [images, setImages] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'completed'>('');
  const [dateFilter, setDateFilter] = useState('');
  const [q, setQ] = useState('');

  const filteredJobs = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter && j.status !== statusFilter) return false;
      if (dateFilter && yyyyMmDd(j.date) !== dateFilter) return false;
      if (!qq) return true;
      const w = workers[j.worker_id] ?? '';
      return j.id.toLowerCase().includes(qq) || w.toLowerCase().includes(qq);
    });
  }, [jobs, statusFilter, dateFilter, q, workers]);

  const fetchJobs = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('id, date, status, worker_id')
        .eq('customer_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as Job[];
      setJobs(list);

      const workerIds = Array.from(new Set(list.map((j) => j.worker_id).filter(Boolean)));
      if (workerIds.length) {
        const { data: wData, error: wErr } = await supabase.from('users').select('id, name').in('id', workerIds);
        if (!wErr) {
          const map: Record<string, string> = {};
          for (const r of wData ?? []) map[(r as any).id] = (r as any).name;
          setWorkers(map);
        }
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const openJob = async (job: Job) => {
    setSelectedJob(job);
    setImages([]);
    try {
      const { data, error } = await supabase.from('job_service_points').select('id, job_id, image_url').eq('job_id', job.id);
      if (error) throw error;
      const urls = ((data ?? []) as JobServicePoint[])
        .map((r) => r.image_url)
        .filter(Boolean)
        .map((p) => getPublicUrl(p!));
      setImages(urls);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת תמונות נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchJobs} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>שירותים</Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Input label="חיפוש (id / עובד)" value={q} onChangeText={setQ} placeholder="חפש…" />
        <Input label="תאריך (yyyy-MM-dd) אופציונלי" value={dateFilter} onChangeText={setDateFilter} placeholder="2026-03-15" />
        <SelectSheet
          label="סטטוס"
          value={statusFilter}
          placeholder="הכל"
          options={[
            { value: '', label: 'הכל' },
            { value: 'pending', label: 'pending' },
            { value: 'completed', label: 'completed' },
          ]}
          onChange={(v) => setStatusFilter((v || '') as any)}
        />
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={filteredJobs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => openJob(item)}>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>משימה #{item.id.slice(0, 6)}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                {item.date}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                עובד: {workers[item.worker_id] ?? item.worker_id}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>סטטוס: {item.status}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selectedJob} onClose={() => setSelectedJob(null)}>
        {!!selectedJob && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>תמונות</Text>
            {images.length ? (
              <FlatList
                data={images}
                keyExtractor={(u) => u}
                numColumns={2}
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
                renderItem={({ item }) => (
                  <View style={{ flex: 1 }}>
                    <Card style={{ padding: 10 }}>
                      <Image source={{ uri: item }} style={{ width: '100%', height: 140, borderRadius: 12 }} resizeMode="cover" />
                    </Card>
                  </View>
                )}
              />
            ) : (
              <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונות למשימה.</Text>
            )}
            <Button title="סגור" variant="secondary" onPress={() => setSelectedJob(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

