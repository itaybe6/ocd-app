import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import {
  CalendarDays,
  CalendarCheck2,
  ChevronLeft,
  ClipboardList,
  Layers,
  Plus,
  X,
} from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalDialog } from '../../components/ModalDialog';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';
import { yyyyMmDd } from '../../lib/time';
import { fetchWorkTemplatesSorted, templateDay, type WorkTemplateLite } from '../../lib/workTemplates';

type Template = { id: string; day: number };
type WorkSchedule = { id: string; date: string; template_id: string; created_at?: string };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type ServicePoint = { id: string; customer_id: string; refill_amount: number };

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

function formatDateHebrew(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  const dayName = HEBREW_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `יום ${dayName}, ${dd}/${mm}/${yyyy}`;
}

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
    () => templates.map((t) => ({ value: t.id, label: `יום ${t.day}` })),
    [templates],
  );

  const templateMap = useMemo(() => {
    const m = new Map<string, Template>();
    for (const t of templates) m.set(t.id, t);
    return m;
  }, [templates]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([
        fetchWorkTemplatesSorted(),
        supabase.from('work_schedules').select('id, date, template_id, created_at').order('date', { ascending: false }),
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

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

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

  const listHeader = useMemo(
    () => (
      <View style={{ gap: 20, marginTop: 4 }}>
        {/* ── Assignment Form ─────────────────────────────────── */}
        <View style={st.formCard}>
          <View style={st.formHeaderRow}>
            <View style={st.formIconBubble}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.formTitle}>שיוך תבנית לתאריך</Text>
              <Text style={st.formSubtitle}>בחר תאריך ותבנית ליצירת משימות</Text>
            </View>
          </View>

          <View style={st.formDivider} />

          <View style={{ gap: 12 }}>
            <Input label="תאריך (yyyy-MM-dd)" value={date} onChangeText={setDate} />
            <SelectSheet
              label="תבנית"
              value={templateId}
              placeholder="בחר תבנית…"
              options={templateOptions}
              onChange={setTemplateId}
            />
            <Button
              title="שייך תבנית + צור משימות"
              onPress={assignTemplate}
              disabled={!date.trim() || !templateId}
              style={{ borderRadius: 14 }}
            />
          </View>
        </View>

        {/* ── Section Header ──────────────────────────────────── */}
        <View style={st.sectionHeader}>
          <View style={st.sectionIconWrap}>
            <ClipboardList size={14} color={colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={st.sectionLabel}>שיוכים קיימים</Text>
          <View style={st.countBadge}>
            <Text style={st.countText}>{schedules.length}</Text>
          </View>
        </View>
      </View>
    ),
    [schedules.length, date, templateId, templateOptions],
  );

  const renderScheduleCard = ({ item }: { item: WorkSchedule }) => {
    const tpl = templateMap.get(item.template_id);
    const dayLabel = tpl ? `יום ${tpl.day}` : null;

    return (
      <Pressable
        onPress={() => setSelectedSchedule(item)}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
      >
        <View style={st.card}>
          <View style={st.cardInner}>
            <View style={st.cardIconWrap}>
              <CalendarCheck2 size={18} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={st.cardContent}>
              <Text style={st.cardTitle}>{formatDateHebrew(item.date)}</Text>
              <View style={st.cardMetaRow}>
                <Layers size={12} color={colors.muted} strokeWidth={2} />
                <Text style={st.cardMeta}>
                  {dayLabel ? `תבנית ${dayLabel}` : 'תבנית משויכת'}
                </Text>
              </View>
            </View>
            <ChevronLeft size={18} color={colors.muted} strokeWidth={2} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={schedules}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={st.listContent}
        refreshing={loading}
        onRefresh={fetchAll}
        ListHeaderComponent={listHeader}
        renderItem={renderScheduleCard}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}>
              <CalendarDays size={28} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text style={st.emptyTitle}>אין שיוכים</Text>
            <Text style={st.emptySubtitle}>שייך תבנית לתאריך כדי ליצור קו עבודה</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Detail Dialog ─────────────────────────────────────── */}
      <ModalDialog
        visible={!!selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
        containerStyle={st.dialogContainer}
      >
        {!!selectedSchedule && (
          <>
            {/* Header */}
            <View style={st.dialogHeader}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={st.dialogIconBubble}>
                  <CalendarCheck2 size={18} color="#fff" strokeWidth={2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.dialogTitle}>פרטי שיוך</Text>
                  <Text style={st.dialogSubtitle}>{formatDateHebrew(selectedSchedule.date)}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setSelectedSchedule(null)}
                hitSlop={8}
                style={({ pressed }) => [st.dialogCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <X size={16} color={colors.muted} strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Body */}
            <View style={st.dialogBody}>
              {/* Details Card */}
              <View style={st.dialogDetailsCard}>
                <View style={st.detailRow}>
                  <Text style={st.detailLabel}>תאריך</Text>
                  <Text style={st.detailValue}>{selectedSchedule.date}</Text>
                </View>
                <View style={st.detailDivider} />
                <View style={st.detailRow}>
                  <Text style={st.detailLabel}>תבנית</Text>
                  <View style={st.templateBadge}>
                    <Layers size={12} color={colors.primary} strokeWidth={2} />
                    <Text style={st.templateBadgeText}>
                      {templateMap.get(selectedSchedule.template_id)
                        ? `יום ${templateMap.get(selectedSchedule.template_id)!.day}`
                        : selectedSchedule.template_id.slice(0, 8)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="סגור"
                    variant="secondary"
                    onPress={() => setSelectedSchedule(null)}
                    style={{ borderRadius: 14 }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="הסר שיוך"
                    variant="danger"
                    onPress={() => removeTemplate(selectedSchedule)}
                    style={{ borderRadius: 14 }}
                  />
                </View>
              </View>
            </View>
          </>
        )}
      </ModalDialog>
    </View>
  );
}

const st = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },

  formCard: {
    backgroundColor: colors.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 0,
  },
  formHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  formIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  formSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    marginTop: 1,
  },
  formDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },

  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.4,
    textAlign: 'right',
  },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },

  card: {
    backgroundColor: colors.elevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  cardInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  cardMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(37,99,235,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  dialogContainer: {
    padding: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  dialogHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dialogIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  dialogSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
  },
  dialogCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialogBody: {
    padding: 18,
    gap: 16,
  },
  dialogDetailsCard: {
    backgroundColor: colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },

  detailRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'right',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'left',
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  templateBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
});
