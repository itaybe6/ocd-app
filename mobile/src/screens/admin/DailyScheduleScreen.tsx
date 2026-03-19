import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobChip } from '../../components/jobs/JobCard';
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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatHm(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

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
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers]);

  const kindLabel = useCallback((k: Kind) => (k === 'regular' ? 'רגילה' : k === 'installation' ? 'התקנה' : 'מיוחדת'), []);

  const parsedDay = useMemo(() => {
    const d = new Date(`${day}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [day]);

  const onDatePicked = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS !== 'ios') setShowDatePicker(false);
      if (event.type !== 'set') return;
      if (!selected) return;
      setDay(yyyyMmDd(selected));
    },
    []
  );

  const fetchWorkers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('id, name, role').eq('role', 'worker').order('name');
    if (!error) setWorkers((data ?? []) as any);
  }, []);

  const fetchDay = useCallback(async () => {
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
  }, [day, workerId]);

  useFocusEffect(
    useCallback(() => {
      fetchWorkers();
      fetchDay();
    }, [fetchWorkers, fetchDay])
  );

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
    <Screen backgroundColor="#FAF9FE">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchDay} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>לוז יומי</Text>
        </View>
        {Platform.OS === 'web' ? (
          <Input label="תאריך (yyyy-MM-dd)" value={day} onChangeText={setDay} />
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)}>
              <Input
                label="תאריך"
                value={day}
                editable={false}
                onPressIn={() => setShowDatePicker(true)}
                pointerEvents="none"
              />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={parsedDay}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDatePicked}
              />
            )}
          </>
        )}
        <SelectSheet label="עובד" value={workerId} options={workerOptions} onChange={setWorkerId} />
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <JobCard
            style={{ borderRadius: 18 }}
            title={`#${item.order_number ?? '—'} - ${workerMap.get(item.worker_id) ?? item.worker_id.slice(0, 6)}`}
            status={item.status}
            primaryText={`סוג: ${kindLabel(item.kind)}`}
            description={item.notes ?? null}
            onPress={() => {
              setEdit(item);
              setNewTime(new Date(item.date).toISOString().slice(11, 16));
            }}
            faded={item.status === 'completed'}
            chips={
              <>
                <JobChip text={kindLabel(item.kind)} />
                <JobChip text={formatHm(item.date)} muted />
              </>
            }
          />
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

