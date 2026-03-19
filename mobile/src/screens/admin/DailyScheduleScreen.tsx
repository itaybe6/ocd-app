import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { addDays, format } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobChip } from '../../components/jobs/JobCard';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { toDate, yyyyMmDd } from '../../lib/time';
import { useLoading } from '../../state/LoadingContext';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

LocaleConfig.locales.he = {
  monthNames: [
    'ינואר',
    'פברואר',
    'מרץ',
    'אפריל',
    'מאי',
    'יוני',
    'יולי',
    'אוגוסט',
    'ספטמבר',
    'אוקטובר',
    'נובמבר',
    'דצמבר',
  ],
  monthNamesShort: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
  dayNames: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  dayNamesShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
  today: 'היום',
};
LocaleConfig.defaultLocale = 'he';

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
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [tempDay, setTempDay] = useState(day);
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

  const openDatePicker = useCallback(() => {
    setTempDay(day);
    setDateSheetOpen(true);
  }, [day]);

  const prettyDay = useMemo(() => {
    const d = toDate(day);
    return format(d, 'EEEE, dd/MM/yyyy', { locale: he });
  }, [day]);

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
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right' }}>תאריך</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  onPress={() => setDay(yyyyMmDd(addDays(parsedDay, -1)))}
                  style={{
                    width: 44,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: colors.elevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronRight size={20} color={colors.text} />
                </Pressable>

                <Pressable
                  onPress={openDatePicker}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    borderRadius: 16,
                    backgroundColor: colors.elevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <CalendarDays size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{prettyDay}</Text>
                      <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>{day}</Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setDay(yyyyMmDd(addDays(parsedDay, 1)))}
                  style={{
                    width: 44,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: colors.elevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronLeft size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <ModalSheet visible={dateSheetOpen} onClose={() => setDateSheetOpen(false)} containerStyle={{ paddingBottom: 18 }}>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>בחירת תאריך</Text>
                  <Pressable
                    onPress={() => setTempDay(yyyyMmDd(new Date()))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: colors.elevated,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '900' }}>היום</Text>
                  </Pressable>
                </View>

                <Calendar
                  current={tempDay}
                  onDayPress={(d) => setTempDay(d.dateString)}
                  markedDates={{
                    [tempDay]: { selected: true, selectedColor: colors.primary, selectedTextColor: '#fff' },
                  }}
                  enableSwipeMonths
                  firstDay={0}
                  style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
                  theme={{
                    calendarBackground: colors.card,
                    textSectionTitleColor: colors.muted,
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text,
                    monthTextColor: colors.text,
                    textMonthFontWeight: '900',
                    textDayFontWeight: '700',
                    textDayHeaderFontWeight: '800',
                    arrowColor: colors.text,
                    selectedDayBackgroundColor: colors.primary,
                    selectedDayTextColor: '#fff',
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    title="ביטול"
                    variant="secondary"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    onPress={() => setDateSheetOpen(false)}
                  />
                  <Button
                    title="אישור"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    onPress={() => {
                      setDay(tempDay);
                      setDateSheetOpen(false);
                    }}
                  />
                </View>
              </View>
            </ModalSheet>
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

