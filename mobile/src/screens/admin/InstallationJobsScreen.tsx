import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobChip } from '../../components/jobs/JobCard';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { yyyyMmDd } from '../../lib/time';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';

type Kind = 'installation' | 'special';
type Status = 'pending' | 'completed';

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  worker_id: string;
  order_number?: number | null;
  notes?: string | null;
  image_url?: string | null; // for special
};

type InstallationDevice = { id: string; installation_job_id: string; device_name?: string | null; image_url?: string | null };

const kindLabel = (k: Kind) => (k === 'installation' ? 'התקנה' : 'מיוחדת');

export function InstallationJobsScreen() {
  const { setIsLoading } = useLoading();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Unified[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [kindFilter, setKindFilter] = useState<'' | Kind>('');
  const [dateFilter, setDateFilter] = useState('');

  const [selected, setSelected] = useState<Unified | null>(null);
  const [devices, setDevices] = useState<InstallationDevice[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [instRes, specRes] = await Promise.all([
        supabase.from('installation_jobs').select('id, date, status, worker_id, order_number, notes').order('date', { ascending: false }),
        supabase.from('special_jobs').select('id, date, status, worker_id, order_number, notes, image_url').order('date', { ascending: false }),
      ]);
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;
      const inst = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const spec = (specRes.data ?? []).map((r: any) => ({ kind: 'special', ...r }) as Unified);
      setItems([...inst, ...spec].sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (kindFilter && it.kind !== kindFilter) return false;
      if (statusFilter && it.status !== statusFilter) return false;
      if (dateFilter && yyyyMmDd(it.date) !== dateFilter) return false;
      if (!qq) return true;
      return it.id.toLowerCase().includes(qq) || String(it.order_number ?? '').includes(qq);
    });
  }, [items, q, kindFilter, statusFilter, dateFilter]);

  const open = async (it: Unified) => {
    setSelected(it);
    setDevices([]);
    if (it.kind !== 'installation') return;
    try {
      const { data, error } = await supabase
        .from('installation_devices')
        .select('id, installation_job_id, device_name, image_url')
        .eq('installation_job_id', it.id);
      if (error) throw error;
      setDevices((data ?? []) as InstallationDevice[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת מכשירים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const del = async (it: Unified) => {
    try {
      setIsLoading(true);
      if (it.kind === 'installation') {
        await supabase.from('installation_devices').delete().eq('installation_job_id', it.id);
        const { error } = await supabase.from('installation_jobs').delete().eq('id', it.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('special_jobs').delete().eq('id', it.id);
        if (error) throw error;
      }
      setItems((prev) => prev.filter((x) => !(x.kind === it.kind && x.id === it.id)));
      setSelected(null);
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen backgroundColor="#FAF9FE">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchAll} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>משימות מיוחדות</Text>
        </View>
        <Input label="חיפוש (id/מספר הזמנה)" value={q} onChangeText={setQ} />
        <Input label="תאריך (yyyy-MM-dd) אופציונלי" value={dateFilter} onChangeText={setDateFilter} placeholder="2026-03-15" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SelectSheet
              label="סוג"
              value={kindFilter}
              placeholder="הכל"
              options={[
                { value: '', label: 'הכל' },
                { value: 'installation', label: 'installation' },
                { value: 'special', label: 'special' },
              ]}
              onChange={(v) => setKindFilter((v || '') as any)}
            />
          </View>
          <View style={{ flex: 1 }}>
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
        </View>
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={filtered}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <JobCard
            title={`#${item.order_number ?? '—'} - ${kindLabel(item.kind)}`}
            status={item.status}
            description={item.notes ?? null}
            onPress={() => open(item)}
            faded={item.status === 'completed'}
            chips={
              <>
                <JobChip text={kindLabel(item.kind)} />
                <JobChip text={yyyyMmDd(item.date)} muted />
              </>
            }
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selected} onClose={() => setSelected(null)}>
        {!!selected && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button title="מחק" variant="danger" fullWidth={false} onPress={() => del(selected)} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
                {selected.kind} • #{selected.order_number ?? '—'}
              </Text>
            </View>

            {selected.kind === 'installation' ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>מכשירים</Text>
                {devices.length ? (
                  <View style={{ gap: 10 }}>
                    {devices.map((d) => (
                      <Card key={d.id}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{d.device_name ?? 'Device'}</Text>
                        {d.image_url ? (
                          <Image
                            source={{ uri: getPublicUrl(d.image_url) }}
                            style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 10 }}
                          />
                        ) : null}
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין מכשירים.</Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונה</Text>
                {selected.image_url ? (
                  <Card>
                    <Image source={{ uri: getPublicUrl(selected.image_url) }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                  </Card>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונה.</Text>
                )}
              </>
            )}

            <Button title="סגור" variant="secondary" onPress={() => setSelected(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

