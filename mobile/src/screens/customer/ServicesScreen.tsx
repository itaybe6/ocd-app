import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ModalSheet } from '../../components/ModalSheet';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';

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
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [images, setImages] = useState<string[]>([]);

  const completedJobs = useMemo(() => jobs.filter((j) => j.status === 'completed'), [jobs]);

  const fetchJobs = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('id, date, status, worker_id')
        .eq('customer_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      setJobs((data ?? []) as Job[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchJobs} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>שירותים</Text>
      </View>

      <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>
        תצוגה בסיסית: משימות “completed” + גלריית תמונות (מ-`job_service_points.image_url`).
      </Text>

      <FlatList
        style={{ marginTop: 12 }}
        data={completedJobs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => openJob(item)}>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>משימה #{item.id.slice(0, 6)}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>{item.date}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין משימות שהושלמו.</Text>}
      />

      <ModalSheet visible={!!selectedJob} onClose={() => setSelectedJob(null)}>
        {!!selectedJob && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>תמונות</Text>
            {images.length ? (
              <View style={{ gap: 8 }}>
                {images.map((u) => (
                  <Card key={u}>
                    <Text style={{ color: colors.text, textAlign: 'right' }} numberOfLines={1}>
                      {u}
                    </Text>
                  </Card>
                ))}
              </View>
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

