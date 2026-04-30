import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  I18nManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Clock, User, Users, X } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { ModalDialog } from '../../components/ModalDialog';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';
import { yyyyMmDd } from '../../lib/time';
import { fetchWorkTemplatesSorted, templateDay, type WorkTemplateLite } from '../../lib/workTemplates';

type Template = { id: string; day: number };
type WorkSchedule = { id: string; date: string; template_id: string };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type ServicePoint = { id: string; customer_id: string; refill_amount: number };

type PreviewUser = { id: string; name: string; avatar_url?: string | null };
type TemplatePreviewRow = {
  id: string;
  order: number;
  timeLabel: string;
  customer: PreviewUser | null;
  worker: PreviewUser | null;
};

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
// Visual left→right order: Sat is leftmost, Sunday is rightmost (Hebrew RTL calendar).
// We always want index 0 on the left, regardless of the device's RTL setting,
// so we pick `row-reverse` on RTL devices (the OS then flips it back to LTR).
const DAY_LABELS_VISUAL = ['ש', 'ו', 'ה', 'ד', 'ג', 'ב', 'א'];
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const H_PAD = 4;
const CELL_H = 80;
const ROW_FLEX_DIR: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row-reverse' : 'row';
// Use the window width directly so each column gets an exact pixel size,
// regardless of any flex/percentage layout quirks in parent containers.
const WINDOW_W = Dimensions.get('window').width;
const WINDOW_H = Dimensions.get('window').height;
const ROW_WIDTH = WINDOW_W - H_PAD * 2;
const COL_WIDTH = ROW_WIDTH / 7;

function formatStationTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  const s = String(raw).trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
}

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

type DayCell = { day: number; dateStr: string } | null;

// Visual columns left→right: 0=Sat … 6=Sun (Hebrew RTL calendar).
// For a date with JS getDay() value (0=Sun … 6=Sat), visualCol = 6 - getDay().
function MonthView({ year, month, today, scheduleByDate, templateMap, onDayPress }: MonthViewProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks = useMemo(() => {
    const result: DayCell[][] = [];
    let current: DayCell[] = Array(7).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const visualCol = 6 - dow;
      current[visualCol] = { day: d, dateStr: toDateStr(year, month, d) };
      if (dow === 6) {
        result.push(current);
        current = Array(7).fill(null);
      }
    }
    if (current.some((c) => c !== null)) result.push(current);
    return result;
  }, [year, month, daysInMonth]);

  return (
    <View style={mv.block}>
      <Text style={mv.title}>{`${MONTH_NAMES[month]} ${year}`}</Text>

      {/* Day-of-week header (visual L→R: Sat … Sun) */}
      <View style={mv.headerRow}>
        {DAY_LABELS_VISUAL.map((label, i) => (
          <View key={i} style={mv.headerCell}>
            <Text style={[mv.headerText, i === 0 && mv.satText]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={mv.divider} />

      {/* Day grid: each row has exactly 7 cells (Sat=0 … Sun=6 visually L→R). */}
      {weeks.map((week, wIdx) => (
        <View key={wIdx} style={mv.weekRow}>
          {week.map((cell, colIdx) => {
            if (!cell) {
              return <View key={`e-${wIdx}-${colIdx}`} style={mv.cellSlot} />;
            }
            const { day, dateStr } = cell;
            const schedule = scheduleByDate.get(dateStr);
            const template = schedule ? templateMap.get(schedule.template_id) : undefined;
            const isToday = dateStr === today;
            const isSat = colIdx === 0; // Saturday is the leftmost visual column

            return (
              <View key={dateStr} style={mv.cellSlot}>
                <Pressable
                  style={({ pressed }) => [mv.cellInner, pressed && mv.cellPressed]}
                  onPress={() => onDayPress(dateStr)}
                >
                  <View style={[mv.numWrap, isToday && mv.numWrapToday]}>
                    <Text style={[mv.dayNum, isToday && mv.dayNumToday, isSat && !isToday && mv.satNum]}>
                      {day}
                    </Text>
                  </View>
                  {template ? (
                    <View style={mv.badge}>
                      <Text style={mv.badgeText} numberOfLines={1}>{`תבנית ${template.day}`}</Text>
                    </View>
                  ) : (
                    <View style={mv.badgePlaceholder} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const mv = StyleSheet.create({
  block: {
    width: ROW_WIDTH,
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
    flexDirection: ROW_FLEX_DIR,
    width: ROW_WIDTH,
    height: 30,
  },
  weekRow: {
    flexDirection: ROW_FLEX_DIR,
    width: ROW_WIDTH,
    height: CELL_H,
  },
  headerCell: {
    width: COL_WIDTH,
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  cellSlot: {
    width: COL_WIDTH,
    height: CELL_H,
    flexShrink: 0,
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  cellInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 6,
    paddingLeft: 20,
    marginRight: 20,
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
    maxWidth: '92%',
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
  const [templatePreviewRows, setTemplatePreviewRows] = useState<TemplatePreviewRow[]>([]);
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);

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
    () => templates.map((t) => ({ value: t.id, label: `תבנית ${t.day}` })),
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

  useEffect(() => {
    if (!selectedDate || !editTemplateId) {
      setTemplatePreviewRows([]);
      setTemplatePreviewLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setTemplatePreviewLoading(true);
      try {
        const { data: stData, error: stErr } = await supabase
          .from('template_stations')
          .select('id, "order", customer_id, worker_id, scheduled_time')
          .eq('template_id', editTemplateId)
          .order('order', { ascending: true });
        if (stErr) throw stErr;
        const rows = (stData ?? []) as Pick<Station, 'id' | 'order' | 'customer_id' | 'worker_id' | 'scheduled_time'>[];
        const idSet = new Set<string>();
        for (const r of rows) {
          if (r.customer_id) idSet.add(r.customer_id);
          if (r.worker_id) idSet.add(r.worker_id);
        }
        const ids = [...idSet];
        const userMap = new Map<string, PreviewUser>();
        if (ids.length) {
          const { data: uData, error: uErr } = await supabase
            .from('users')
            .select('id, name, avatar_url')
            .in('id', ids);
          if (uErr) throw uErr;
          for (const u of (uData ?? []) as PreviewUser[]) userMap.set(u.id, u);
        }
        if (cancelled) return;
        setTemplatePreviewRows(
          rows.map((r) => ({
            id: r.id,
            order: r.order,
            timeLabel: formatStationTime(r.scheduled_time),
            customer: r.customer_id ? userMap.get(r.customer_id) ?? null : null,
            worker: r.worker_id ? userMap.get(r.worker_id) ?? null : null,
          })),
        );
      } catch (e: any) {
        if (!cancelled) {
          setTemplatePreviewRows([]);
          Toast.show({ type: 'error', text1: 'טעינת משימות', text2: e?.message ?? 'Unknown error' });
        }
      } finally {
        if (!cancelled) setTemplatePreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, editTemplateId]);

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
  const previewTemplateDay = editTemplateId ? templateMap.get(editTemplateId)?.day : undefined;

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
                    {`משובץ כעת · תבנית ${templateMap.get(selectedSchedule.template_id)?.day ?? '—'}`}
                  </Text>
                )}
              </View>
            </View>

            <ScrollView
              style={st.dialogScroll}
              contentContainerStyle={st.dialogScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!!editTemplateId && (
                <View style={st.previewSection}>
                  <View style={st.previewSectionHead}>
                    <Text style={st.previewSectionTitle}>משימות בתבנית</Text>
                    {previewTemplateDay != null && (
                      <View style={st.previewPill}>
                        <Text style={st.previewPillText}>{`תבנית ${previewTemplateDay}`}</Text>
                      </View>
                    )}
                  </View>
                  {templatePreviewLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={st.previewSpinner} />
                  ) : templatePreviewRows.length === 0 ? (
                    <Text style={st.previewEmpty}>אין תחנות מוגדרות בתבנית זו</Text>
                  ) : (
                    templatePreviewRows.map((row, idx) => (
                      <View key={row.id} style={[st.previewCard, idx > 0 && st.previewCardSpacing]}>
                        <View style={st.previewCardInner}>
                          <View style={st.previewTop}>
                            <View style={st.previewOrder}>
                              <Text style={st.previewOrderText}>{row.order}</Text>
                            </View>
                            <View style={st.previewTimeChip}>
                              <Clock size={13} color={colors.primary} strokeWidth={2.5} />
                              <Text style={st.previewTimeText}>{row.timeLabel}</Text>
                            </View>
                          </View>
                          <View style={st.previewSep} />
                          <View style={st.previewPersonRow}>
                            <View style={st.previewRoleTag}>
                              <User size={11} color={colors.primary} strokeWidth={2.5} />
                              <Text style={st.previewRoleText}>לקוח</Text>
                            </View>
                            <View style={st.previewPersonMain}>
                              {row.customer ? (
                                <>
                                  <Avatar size={32} uri={row.customer.avatar_url ?? null} name={row.customer.name} />
                                  <Text style={st.previewName} numberOfLines={1}>
                                    {row.customer.name}
                                  </Text>
                                </>
                              ) : (
                                <Text style={st.previewMissing}>לא משובץ</Text>
                              )}
                            </View>
                          </View>
                          <View style={st.previewInnerSep} />
                          <View style={st.previewPersonRow}>
                            <View style={[st.previewRoleTag, st.previewRoleTagWorker]}>
                              <Users size={11} color="#7C3AED" strokeWidth={2.5} />
                              <Text style={[st.previewRoleText, st.previewRoleTextWorker]}>עובד</Text>
                            </View>
                            <View style={st.previewPersonMain}>
                              {row.worker ? (
                                <>
                                  <Avatar size={32} uri={row.worker.avatar_url ?? null} name={row.worker.name} />
                                  <Text style={st.previewName} numberOfLines={1}>
                                    {row.worker.name}
                                  </Text>
                                </>
                              ) : (
                                <Text style={st.previewMissing}>לא משובץ</Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              <View style={st.dialogForm}>
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
            </ScrollView>
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
  dialogScroll: {
    maxHeight: WINDOW_H * 0.52,
  },
  dialogScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  dialogForm: {
    gap: 12,
    marginTop: 4,
  },
  previewSection: {
    marginBottom: 18,
  },
  previewSectionHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    flex: 1,
  },
  previewPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  previewSpinner: {
    marginVertical: 20,
  },
  previewEmpty: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'right',
    marginVertical: 8,
  },
  previewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  previewCardSpacing: {
    marginTop: 10,
  },
  previewCardInner: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderStartWidth: 3,
    borderStartColor: colors.primary,
  },
  previewTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewOrder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOrderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3730A3',
  },
  previewTimeChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#CBD5E1',
    marginVertical: 12,
  },
  previewPersonRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  previewRoleTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  previewRoleTagWorker: {
    backgroundColor: '#F5F3FF',
  },
  previewRoleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  previewRoleTextWorker: {
    color: '#7C3AED',
  },
  previewPersonMain: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  previewName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
  },
  previewMissing: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'right',
  },
  previewInnerSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
});
