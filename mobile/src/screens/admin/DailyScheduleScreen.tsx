import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { yyyyMmDd } from '../../lib/time';
import { useLoading } from '../../state/LoadingContext';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  worker_id: string;
  order_number?: number | null;
  notes?: string | null;
};

type Worker = { id: string; name: string; role: 'worker' };

function parseTimeToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function updateIsoTime(iso: string, timeHm: string): string {
  const d = new Date(iso);
  const [hh, mm] = timeHm.split(':').map((x) => Number(x));
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.toISOString();
}

export function DailyScheduleScreen() {
  const { setIsLoading } = useLoading();
  const [day, setDay] = useState(yyyyMmDd(new Date()));
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerId, setWorkerId] = useState('');
  const [items, setItems] = useState<Unified[]>([]);
  const [loading, setLoading] = useState(false);

  const [edit, setEdit] = useState<Unified | null>(null);
  const [newTime, setNewTime] = useState('09:00');

  const workerOptions = useMemo(
    () => [{ value: '', label: 'הכל' }, ...workers.map((w) => ({ value: w.id, label: w.name }))],
    [workers]
  );

  const fetchWorkers = async () => {
    const { data, error } = await supabase.from('users').select('id, name, role').eq('role', 'worker').order('name');
    if (!error) setWorkers((data ?? []) as any);
  };

  const fetchDay = async () => {
    try {
      setLoading(true);
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const baseFilter = (q: any) => {
        q = q.gte('date', start).lte('date', end);
        if (workerId) q = q.eq('worker_id', workerId);
        return q;
      };

      const [regRes, instRes, specRes] = await Promise.all([
        baseFilter(supabase.from('jobs').select('id, date, status, worker_id, order_number, notes')),
        baseFilter(supabase.from('installation_jobs').select('id, date, status, worker_id, order_number, notes')),
        baseFilter(supabase.from('special_jobs').select('id, date, status, worker_id, order_number, notes')),
      ]);

      if (regRes.error) throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      const regs = (regRes.data ?? []).map((r: any) => ({ kind: 'regular', ...r }) as Unified);
      const insts = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const specs = (specRes.data ?? []).map((r: any) => ({ kind: 'special', ...r }) as Unified);

      const combined = [...regs, ...insts, ...specs].sort((a, b) => {
        const ao = a.order_number == null ? 1e9 : a.order_number;
        const bo = b.order_number == null ? 1e9 : b.order_number;
        if (ao !== bo) return ao - bo;
        return parseTimeToMinutes(a.date) - parseTimeToMinutes(b.date);
      });

      setItems(combined);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    fetchDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, workerId]);

  const saveTime = async () => {
    if (!edit) return;
    if (edit.kind !== 'regular') {
      Toast.show({ type: 'error', text1: 'עריכת שעה זמינה כרגע רק למשימות regular' });
      return;
    }
    try {
      setIsLoading(true);
      const updatedIso = updateIsoTime(edit.date, newTime.trim());
      const { error } = await supabase.from('jobs').update({ date: updatedIso }).eq('id', edit.id);
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.kind === 'regular' && x.id === edit.id ? { ...x, date: updatedIso } : x)));
      setEdit(null);
      Toast.show({ type: 'success', text1: 'עודכן' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchDay} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>לוז יומי</Text>
        </View>
        <Input label="תאריך (yyyy-MM-dd)" value={day} onChangeText={setDay} />
        <SelectSheet label="עובד" value={workerId} options={workerOptions} onChange={setWorkerId} />
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setEdit(item);
              setNewTime(new Date(item.date).toISOString().slice(11, 16));
            }}
          >
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                {item.kind} • #{item.order_number ?? '—'} • {item.status}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>{item.date}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>worker_id: {item.worker_id}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות ליום הזה.</Text>}
      />

      <ModalSheet visible={!!edit} onClose={() => setEdit(null)}>
        {!!edit && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              עריכת שעה
            </Text>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>
              סוג: {edit.kind} • #{edit.order_number ?? '—'}
            </Text>
            <Input label="שעה חדשה (HH:mm)" value={newTime} onChangeText={setNewTime} placeholder="09:00" />
            <Button title="שמור" onPress={saveTime} />
            <Button title="סגור" variant="secondary" onPress={() => setEdit(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

