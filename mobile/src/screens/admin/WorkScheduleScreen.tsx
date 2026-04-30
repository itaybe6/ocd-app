import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { ModalDialog } from '../../components/ModalDialog';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';
import { yyyyMmDd } from '../../lib/time';
import { fetchWorkTemplatesSorted, templateDay, type WorkTemplateLite } from '../../lib/workTemplates';

type Template = { id: string; day: number };
type WorkSchedule = { id: string; date: string; template_id: string };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type ServicePoint = { id: string; customer_id: string; refill_amount: number };

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
// Chronological Sun→Sat; the row uses flexDirection: 'row-reverse' so
// Sunday lands on the right and Saturday on the left.
const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 4;
const CELL_W = Math.floor((SCREEN_W - H_PAD * 2) / 7);
const CELL_H = 80;

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateHebrew(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  const dayName = HEBREW_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `יום ${dayName}, ${dd}/${mm}/${d.getFullYear()}`;
}

function combine(dateYmd: string, timeHm: string): string {
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time');
  return d.toISOString();
}

// ─── MonthView ────────────────────────────────────────────────────────────────

type MonthViewProps = {
  year: number;
  month: number;
  today: string;
  scheduleByDate: Map<string, WorkSchedule>;
  templateMap: Map<string, Template>;
  onDayPress: (dateStr: string) => void;
};

function MonthView({ year, month, today, scheduleByDate, templateMap, onDayPress }: MonthViewProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  // Grid uses flexDirection: 'row-reverse', so Sunday is on the right.
  // Leading empty cells before day 1 = firstDow (0 if Sunday, 6 if Saturday).
  const leading = firstDow;

  const cells = useMemo(() => {
    const arr: Array<{ type: 'empty'; key: string } | { type: 'day'; day: number; dateStr: string }> = [];
    for (let i = 0; i < leading; i++) arr.push({ type: 'empty', key: `e${i}` });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ type: 'day', day: d, dateStr: toDateStr(year, month, d) });
    while (arr.length % 7 !== 0) arr.push({ type: 'empty', key: `t${arr.length}` });
    return arr;
  }, [year, month, daysInMonth, leading]);

  return (
    <View style={mv.block}>
      <Text style={mv.title}>{`${MONTH_NAMES[month]} ${year}`}</Text>

      {/* Day-of-week header */}
      <View style={mv.headerRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={mv.headerCell}>
            <Text style={[mv.headerText, i === 6 && mv.satText]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={mv.divider} />

      {/* Day grid */}
      <View style={mv.grid}>
        {cells.map((cell, idx) => {
          if (cell.type === 'empty') {
            return <View key={(cell as any).key ?? idx} style={mv.cell} />;
          }
          const { day, dateStr } = cell;
          const schedule = scheduleByDate.get(dateStr);
          const template = schedule ? templateMap.get(schedule.template_id) : undefined;
          const isToday = dateStr === today;
          const dow = new Date(dateStr + 'T00:00:00').getDay();
          const isSat = dow === 6;

          return (
            <Pressable
              key={dateStr}
              style={({ pressed }) => [mv.cell, pressed && mv.cellPressed]}
              onPress={() => onDayPress(dateStr)}
            >
              <View style={[mv.numWrap, isToday && mv.numWrapToday]}>
                <Text style={[mv.dayNum, isToday && mv.dayNumToday, isSat && !isToday && mv.satNum]}>
                  {day}
                </Text>
              </View>
              {template ? (
                <View style={mv.badge}>
                  <Text style={mv.badgeText} numberOfLines={1}>{`יום ${template.day}`}</Text>
                </View>
              ) : (
                <View style={mv.badgePlaceholder} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const mv = StyleSheet.create({
  block: {
    marginHorizontal: H_PAD,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 8,
    paddingRight: 8,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    marginBottom: 4,
  },
  headerCell: {
    width: CELL_W,
    alignItems: 'center',
    paddingVertical: 6,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
  },
  satText: {
    color: '#FF3B30',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D5DB',
    marginBottom: 0,
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  cellPressed: {
    backgroundColor: '#EFF6FF',
  },
  numWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numWrapToday: {
    backgroundColor: '#007AFF',
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '400',
    color: '#0F172A',
  },
  dayNumToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  satNum: {
    color: '#FF3B30',
  },
  badge: {
    marginTop: 3,
    backgroundColor: '#2563EB',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: CELL_W - 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  badgePlaceholder: {
    height: 18,
    marginTop: 3,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export function WorkScheduleScreen() {
  const { setIsLoading } = useLoading();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editTemplateId, setEditTemplateId] = useState('');

  const today = yyyyMmDd(new Date());
  const nowDate = new Date();

  const scheduleByDate = useMemo(() => {
    const m = new Map<string, WorkSchedule>();
    for (const s of schedules) m.set(s.date, s);
    return m;
  }, [schedules]);

  const templateMap = useMemo(() => {
    const m = new Map<string, Template>();
    for (const t of templates) m.set(t.id, t);
    return m;
  }, [templates]);

  const templateOptions = useMemo(
    () => templates.map((t) => ({ value: t.id, label: `יום ${t.day}` })),
    [templates],
  );

  const months = useMemo(() => {
    const result: { year: number; month: number }[] = [];
    let y = nowDate.getFullYear();
    let mo = nowDate.getMonth() - 1;
    if (mo < 0) { mo += 12; y--; }
    for (let i = 0; i < 9; i++) {
      result.push({ year: y, month: mo });
      mo++;
      if (mo > 11) { mo = 0; y++; }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([
        fetchWorkTemplatesSorted(),
        supabase.from('work_schedules').select('id, date, template_id').order('date', { ascending: false }),
      ]);
      if (sRes.error) throw sRes.error;
      const normalized = (tRes.templates ?? [])
        .map((t: WorkTemplateLite) => ({ id: t.id, day: templateDay(t) }))
        .filter((t): t is Template => typeof t.day === 'number' && t.day >= 1 && t.day <= 28)
        .sort((a, b) => a.day - b.day);
      const seen = new Set<number>();
      const deduped: Template[] = [];
      for (const t of normalized) {
        if (seen.has(t.day)) continue;
        seen.add(t.day);
        deduped.push(t);
      }
      setTemplates(deduped);
      setSchedules((sRes.data ?? []) as WorkSchedule[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleDayPress = (dateStr: string) => {
    setSelectedDate(dateStr);
    setEditTemplateId(scheduleByDate.get(dateStr)?.template_id ?? '');
  };

  const assignTemplate = async () => {
    if (!selectedDate) return;
    if (!editTemplateId) return Toast.show({ type: 'error', text1: 'בחר תבנית' });
    try {
      setIsLoading(true);
      const upsertRes = await supabase
        .from('work_schedules')
        .upsert({ date: selectedDate, template_id: editTemplateId })
        .select('id, date, template_id')
        .single();
      if (upsertRes.error) throw upsertRes.error;

      const { data: stations, error: stErr } = await supabase
        .from('template_stations')
        .select('id, template_id, "order", customer_id, worker_id, scheduled_time')
        .eq('template_id', editTemplateId)
        .order('order', { ascending: true });
      if (stErr) throw stErr;

      const stationList = (stations ?? []) as Station[];
      const validStations = stationList.filter((s) => s.customer_id && s.worker_id);
      if (!validStations.length) {
        Toast.show({ type: 'info', text1: 'אין תחנות משובצות', text2: 'שייך לקוח+עובד לתחנות בתבניות עבודה' });
        await fetchAll();
        setSelectedDate(null);
        return;
      }

      const start = new Date(`${selectedDate}T00:00:00`).toISOString();
      const end = new Date(`${selectedDate}T23:59:59`).toISOString();
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

      for (const st of validStations) {
        const jobDate = combine(selectedDate, st.scheduled_time || '09:00');
        const { data: existing, error: existingErr } = await supabase
          .from('jobs')
          .select('id')
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
            .insert({ customer_id: st.customer_id, worker_id: st.worker_id, date: jobDate, status: 'pending' })
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
            const { error: jspErr } = await supabase
              .from('job_service_points')
              .insert(missing.map((sp) => ({ job_id: jobId, service_point_id: sp.id, custom_refill_amount: null })));
            if (jspErr) throw jspErr;
          }
        }
      }

      Toast.show({ type: 'success', text1: 'שויך תבנית ונוצרו משימות' });
      setSelectedDate(null);
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שיוך נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const removeTemplate = async () => {
    if (!selectedDate) return;
    const schedule = scheduleByDate.get(selectedDate);
    if (!schedule) return;
    try {
      setIsLoading(true);
      const start = new Date(`${selectedDate}T00:00:00`).toISOString();
      const end = new Date(`${selectedDate}T23:59:59`).toISOString();

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
      setSelectedDate(null);
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הסרה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSchedule = selectedDate ? scheduleByDate.get(selectedDate) : undefined;

  return (
    <View style={st.root}>
      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} tintColor="#007AFF" />}
      >
        {months.map(({ year, month }) => (
          <MonthView
            key={`${year}-${month}`}
            year={year}
            month={month}
            today={today}
            scheduleByDate={scheduleByDate}
            templateMap={templateMap}
            onDayPress={handleDayPress}
          />
        ))}
      </ScrollView>

      <ModalDialog
        visible={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        containerStyle={st.dialogContainer}
      >
        {!!selectedDate && (
          <>
            <View style={st.dialogHeader}>
              <Pressable
                onPress={() => setSelectedDate(null)}
                hitSlop={8}
                style={({ pressed }) => [st.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <X size={16} color="#64748B" strokeWidth={2.5} />
              </Pressable>
              <View style={st.dialogTitleWrap}>
                <Text style={st.dialogTitle}>{formatDateHebrew(selectedDate)}</Text>
                {selectedSchedule && (
                  <Text style={st.dialogSub}>
                    {`תבנית נוכחית: יום ${templateMap.get(selectedSchedule.template_id)?.day ?? '—'}`}
                  </Text>
                )}
              </View>
            </View>

            <View style={st.dialogBody}>
              <SelectSheet
                label="תבנית עבודה"
                value={editTemplateId}
                placeholder="בחר תבנית…"
                options={templateOptions}
                onChange={setEditTemplateId}
              />
              <Button
                title={selectedSchedule ? 'עדכן תבנית + משימות' : 'שייך תבנית + צור משימות'}
                onPress={assignTemplate}
                disabled={!editTemplateId}
                style={{ borderRadius: 14 }}
              />
              {selectedSchedule && (
                <Button
                  title="הסר שיוך"
                  variant="danger"
                  onPress={removeTemplate}
                  style={{ borderRadius: 14 }}
                />
              )}
            </View>
          </>
        )}
      </ModalDialog>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingTop: 8,
    paddingBottom: 48,
  },

  dialogContainer: {
    padding: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  dialogHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  dialogTitleWrap: {
    flex: 1,
    gap: 2,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  dialogSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'right',
  },
  dialogBody: {
    padding: 18,
    gap: 12,
  },
});
