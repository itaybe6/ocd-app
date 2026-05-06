import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { addMonths, endOfWeek, startOfWeek } from 'date-fns';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { fetchProducts } from '../../lib/shopify';
import { useLoading } from '../../state/LoadingContext';
import { OcdPlusMark } from '../../components/OcdPlusMark';

LocaleConfig.locales['he'] = {
  monthNames: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
  monthNamesShort: ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'],
  dayNames: ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'],
  dayNamesShort: ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'],
  today: 'היום',
};
LocaleConfig.defaultLocale = 'he';

// Hebrew calendar week: visual order Sat … Sun (ש … א), Sunday rightmost.
// OS RTL already mirrors `row`; on LTR devices reverse the week row so א׳ stays on the right.
const CAL_WEEK_ROW_DIR: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row' : 'row-reverse';

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayKey(): string {
  return toDateKey(new Date());
}

/* ─── Spin-box for hour / minute ─── */
function SpinBox({
  value,
  label,
  onInc,
  onDec,
}: {
  value: string;
  label: string;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <View style={sp.wrap}>
      <Text style={sp.label}>{label}</Text>
      <TouchableOpacity onPress={onInc} style={sp.arrowBtn} activeOpacity={0.7}>
        <Text style={sp.arrow}>▲</Text>
      </TouchableOpacity>
      <View style={sp.valuePill}>
        <Text style={sp.value}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onDec} style={sp.arrowBtn} activeOpacity={0.7}>
        <Text style={sp.arrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  label: { color: '#94A3B8', fontWeight: '800', fontSize: 11, marginBottom: 2 },
  arrowBtn: {
    width: 38,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  arrow: { color: '#475569', fontSize: 13, fontWeight: '900' },
  valuePill: {
    width: 58,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { color: '#1D4ED8', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
});

/* ─── Time picker ─── */
function TimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const hour = value.getHours();
  const minute = value.getMinutes();

  const setHour = (h: number) => {
    const n = new Date(value);
    n.setHours(((h % 24) + 24) % 24);
    onChange(n);
  };
  const setMinute = (min: number) => {
    const n = new Date(value);
    n.setMinutes(((min % 60) + 60) % 60, 0, 0);
    onChange(n);
  };

  return (
    <View style={tp.wrap}>
      <SpinBox
        label="שעה"
        value={String(hour).padStart(2, '0')}
        onInc={() => setHour(hour + 1)}
        onDec={() => setHour(hour - 1)}
      />
      <Text style={tp.colon}>:</Text>
      <SpinBox
        label="דקות"
        value={String(minute).padStart(2, '0')}
        onInc={() => setMinute(minute + 5)}
        onDec={() => setMinute(minute - 5)}
      />
    </View>
  );
}

const tp = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  colon: { color: '#1D4ED8', fontSize: 26, fontWeight: '900', marginTop: -16 },
});

/* ─── Main screen ─── */
export function StoreManagementScreen() {
  const { setIsLoading } = useLoading();
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [customersCount, setCustomersCount] = useState<number | null>(null);
  const [ordersThisWeek, setOrdersThisWeek] = useState<number | null>(null);
  const [ocdPlusModalOpen, setOcdPlusModalOpen] = useState(false);
  const [ocdPlusSubscribers, setOcdPlusSubscribers] = useState<
    { id: string; name: string; phone: string; created_at?: string | null }[]
  >([]);
  const [ocdPlusListLoading, setOcdPlusListLoading] = useState(false);

  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 10);
    return d;
  });

  const loadProductCount = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const list = await fetchProducts();
      setProductCount(list.length);
    } catch (e: any) {
      setProductCount(null);
      Toast.show({ type: 'error', text1: 'טעינת מוצרים נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProductCount();
  }, [loadProductCount]);

  const refreshStoreStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
      const end = endOfWeek(now, { weekStartsOn: 0 }).toISOString();

      const [custRes, jobsRes, instRes, specRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('date', start).lte('date', end),
        supabase.from('installation_jobs').select('id', { count: 'exact', head: true }).gte('date', start).lte('date', end),
        supabase.from('special_jobs').select('id', { count: 'exact', head: true }).gte('date', start).lte('date', end),
      ]);

      if (custRes.error) throw custRes.error;
      if (jobsRes.error) throw jobsRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      setCustomersCount(custRes.count ?? 0);
      setOrdersThisWeek((jobsRes.count ?? 0) + (instRes.count ?? 0) + (specRes.count ?? 0));
    } catch (e: any) {
      setCustomersCount(null);
      setOrdersThisWeek(null);
      Toast.show({ type: 'error', text1: 'טעינת נתוני חנות נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStoreStats();
  }, [refreshStoreStats]);

  const openOcdPlusModal = useCallback(async () => {
    setOcdPlusModalOpen(true);
    setOcdPlusListLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, created_at')
        .eq('ocd_plus_subscriber', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setOcdPlusSubscribers(
        (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name ?? '',
          phone: row.phone ?? '',
          created_at: row.created_at ?? null,
        })),
      );
    } catch (e: any) {
      setOcdPlusSubscribers([]);
      Toast.show({ type: 'error', text1: 'טעינת רשימת המנויים נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setOcdPlusListLoading(false);
    }
  }, []);

  const openPushModal = () => {
    setPushTitle('');
    setPushBody('');
    setScheduleMode('now');
    const d = new Date();
    d.setMinutes(d.getMinutes() + 10);
    setScheduledAt(d);
    setPushModalOpen(true);
  };

  const submitPush = async () => {
    const t = pushTitle.trim();
    const b = pushBody.trim();
    if (!t || !b) {
      Toast.show({ type: 'error', text1: 'חסרים שדות', text2: 'יש להזין כותרת ותוכן' });
      return;
    }
    if (scheduleMode === 'scheduled') {
      const now = Date.now();
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < now + 30_000) {
        Toast.show({ type: 'error', text1: 'תזמון לא תקין', text2: 'בחר תאריך/שעה לפחות 30 שניות קדימה' });
        return;
      }
    }

    const payload = {
      title: t,
      body: b,
      scheduleAt: scheduleMode === 'scheduled' ? scheduledAt.toISOString() : null,
      imageUrl: null,
    };

    try {
      setIsLoading(true);
      const secret = process.env.EXPO_PUBLIC_ADMIN_BROADCAST_SECRET?.trim();
      const { data, error } = await supabase.functions.invoke('send-broadcast-push', {
        body: payload,
        headers: secret ? { 'x-admin-secret': secret } : undefined,
      });
      if (error) throw error;
      const mode = (data as any)?.mode ?? null;
      if (mode === 'scheduled') {
        Toast.show({ type: 'success', text1: 'הפוש תוזמן', text2: 'הוא יישלח בזמן שבחרת (בהרצת המתזמן בשרת)' });
      } else {
        const total = (data as any)?.totalTokens ?? null;
        const ok = (data as any)?.successCount ?? null;
        const bad = (data as any)?.errorCount ?? null;
        Toast.show({
          type: 'success',
          text1: 'הפוש שוגר',
          text2: total != null ? `נשלח: ${ok ?? '—'} תקין, ${bad ?? '—'} שגוי (סה״כ ${total})` : undefined,
        });
      }
      setPushModalOpen(false);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שליחה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDateKey = toDateKey(scheduledAt);
  const calendarMonthKey = `${scheduledAt.getFullYear()}-${scheduledAt.getMonth()}`;
  const markedDates: Record<string, any> = {
    [selectedDateKey]: {
      selected: true,
      selectedColor: '#2563EB',
      selectedTextColor: '#FFFFFF',
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.statsGrid}>
          <View style={s.statTile}>
            <Text style={s.statLabel}>פריטים בחנות</Text>
            <Text style={s.statValue}>{loadingProducts ? '—' : String(productCount ?? 0)}</Text>
            <Text style={s.statHint}>מוצרים שנטענו (דגימה)</Text>
          </View>

          <View style={s.statTile}>
            <Text style={s.statLabel}>הזמנות השבוע</Text>
            <Text style={s.statValue}>{statsLoading ? '—' : String(ordersThisWeek ?? 0)}</Text>
            <Text style={s.statHint}>משימות (כל הסוגים)</Text>
          </View>

          <View style={s.statTile}>
            <Text style={s.statLabel}>לקוחות</Text>
            <Text style={s.statValue}>{statsLoading ? '—' : String(customersCount ?? 0)}</Text>
            <Text style={s.statHint}>במערכת</Text>
          </View>
        </View>

        <Pressable
          onPress={openPushModal}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(37,99,235,0.10)' }}
          style={({ pressed }) => [s.pushLauncher, pressed && s.pushLauncherPressed]}
        >
          <View style={s.pushLauncherInner}>
            <View style={s.pushLauncherFrame} />
            <View style={s.pushLauncherGlowA} />
            <View style={s.pushLauncherGlowB} />

            <View style={s.pushLauncherRow}>
              <View style={s.pushLauncherIconWrap}>
                <Text style={s.pushLauncherIcon}>📣</Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={s.pushLauncherTitle}>שיגור פושים</Text>
                <Text style={s.pushLauncherSub}>כותרת, תוכן • שליחה מיידית או מתוזמנת</Text>
              </View>

              <View style={s.pushLauncherChevronWrap}>
                <Text style={s.pushLauncherChevron}>‹</Text>
              </View>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={openOcdPlusModal}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(37,99,235,0.10)' }}
          style={({ pressed }) => [s.pushLauncher, pressed && s.pushLauncherPressed]}
        >
          <View style={s.pushLauncherInner}>
            <View style={s.pushLauncherFrame} />
            <View style={s.pushLauncherGlowA} />
            <View style={s.pushLauncherGlowB} />

            <View style={s.pushLauncherRow}>
              <View style={s.pushLauncherIconWrap}>
                <Text style={s.pushLauncherIcon}>✦</Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Text style={s.pushLauncherTitle}>מנויי</Text>
                  <OcdPlusMark size={22} />
                </View>
                <Text style={s.pushLauncherSub}>לחץ לצפייה ברשימת המנויים הפעילים</Text>
              </View>

              <View style={s.pushLauncherChevronWrap}>
                <Text style={s.pushLauncherChevron}>‹</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      <Modal
        visible={ocdPlusModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOcdPlusModalOpen(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={m.root}>
          <StatusBar barStyle="dark-content" />
          <View style={m.header}>
            <Pressable
              onPress={() => setOcdPlusModalOpen(false)}
              hitSlop={10}
              style={({ pressed }) => [m.navBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={m.navBtnText}>✕</Text>
            </Pressable>
            <View
              style={{
                flex: 1,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Text style={[m.headerTitle, { flex: 0 }]}>מנויי</Text>
              <OcdPlusMark size={24} />
            </View>
            <View style={{ minWidth: 44 }} />
          </View>

          {ocdPlusListLoading ? (
            <View style={plusM.loadingWrap}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={plusM.loadingHint}>טוען רשימה…</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={plusM.listContent}
            >
              {ocdPlusSubscribers.length === 0 ? (
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={plusM.emptyText}>אין משתמשים עם מנוי </Text>
                  <OcdPlusMark size={18} />
                  <Text style={plusM.emptyText}> פעיל</Text>
                </View>
              ) : (
                ocdPlusSubscribers.map((u) => (
                  <View key={u.id} style={plusM.row}>
                    <Text style={plusM.rowName} numberOfLines={1}>
                      {u.name?.trim() || 'ללא שם'}
                    </Text>
                    <Text style={plusM.rowPhone} numberOfLines={1}>
                      {u.phone || '—'}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={pushModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPushModalOpen(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={m.root}>
          <StatusBar barStyle="dark-content" />

          {/* Header */}
          <View style={m.header}>
            <Pressable
              onPress={() => setPushModalOpen(false)}
              hitSlop={10}
              style={({ pressed }) => [m.navBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={m.navBtnText}>✕</Text>
            </Pressable>
            <Text style={m.headerTitle}>שיגור פוש</Text>
            <View style={{ minWidth: 44 }} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={m.content}
          >
            {/* Fields */}
            <Input
              label="כותרת"
              value={pushTitle}
              onChangeText={setPushTitle}
              placeholder="לדוגמה: מבצע חדש בחנות 🎉"
            />

            <Input
              label="תוכן ההתראה"
              value={pushBody}
              onChangeText={setPushBody}
              placeholder="לדוגמה: 20% הנחה עד חצות 🛒"
              multiline
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />

            {/* Live preview */}
            {(!!pushTitle.trim() || !!pushBody.trim()) && (
              <View style={m.previewChip}>
                <View style={m.previewChipBar} />
                <View style={{ flex: 1 }}>
                  <Text style={m.previewChipLabel}>תצוגה מקדימה</Text>
                  {!!pushTitle.trim() && (
                    <Text style={m.previewChipTitle} numberOfLines={1}>{pushTitle.trim()}</Text>
                  )}
                  {!!pushBody.trim() && (
                    <Text style={m.previewChipBody} numberOfLines={3}>{pushBody.trim()}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 24 }}>🔔</Text>
              </View>
            )}

            {/* Timing section label */}
            <Text style={m.sectionLabel}>מתי לשלוח?</Text>

            {/* Option cards */}
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => setScheduleMode('now')}
                style={[m.optionCard, scheduleMode === 'now' && m.optionCardActive]}
              >
                <View style={m.optionIconWrap}>
                  <Text style={{ fontSize: 22 }}>⚡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[m.optionTitle, scheduleMode === 'now' && m.optionTitleActive]}>שלח עכשיו</Text>
                  <Text style={m.optionSub}>שיגור ללקוחות עם האפליקציה (לא לעובדים/מנהלים)</Text>
                </View>
                {scheduleMode === 'now' && (
                  <View style={m.check}><Text style={m.checkText}>✓</Text></View>
                )}
              </Pressable>

              <Pressable
                onPress={() => setScheduleMode('scheduled')}
                style={[m.optionCard, scheduleMode === 'scheduled' && m.optionCardActive]}
              >
                <View style={m.optionIconWrap}>
                  <Text style={{ fontSize: 22 }}>🗓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[m.optionTitle, scheduleMode === 'scheduled' && m.optionTitleActive]}>תזמן לתאריך ושעה</Text>
                  <Text style={m.optionSub}>בחר מועד שיגור בעתיד</Text>
                </View>
                {scheduleMode === 'scheduled' && (
                  <View style={m.check}><Text style={m.checkText}>✓</Text></View>
                )}
              </Pressable>
            </View>

            {/* Scheduler – calendar + time picker */}
            {scheduleMode === 'scheduled' ? (
              <View style={m.schedulerWrap}>
                {/* Selected datetime summary */}
                <View style={m.selectedSummary}>
                  <Text style={m.selectedSummaryLabel}>מועד נבחר</Text>
                  <Text style={m.selectedSummaryValue}>
                    {scheduledAt.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {'  ·  '}
                    {String(scheduledAt.getHours()).padStart(2, '0')}:{String(scheduledAt.getMinutes()).padStart(2, '0')}
                  </Text>
                </View>

                {/* Calendar */}
                <Calendar
                  key={calendarMonthKey}
                  current={selectedDateKey}
                  minDate={todayKey()}
                  markedDates={markedDates}
                  firstDay={0}
                  onDayPress={(day: any) => {
                    const n = new Date(scheduledAt);
                    const parts = (day.dateString as string).split('-');
                    n.setFullYear(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    setScheduledAt(n);
                  }}
                  renderArrow={(direction: string) => (
                    <Text style={m.calArrow}>{direction === 'left' ? '‹' : '›'}</Text>
                  )}
                  onPressArrowLeft={() => {
                    setScheduledAt((prev) => {
                      const next = addMonths(prev, -1);
                      const t = new Date(`${todayKey()}T12:00:00`);
                      const minMonth = t.getFullYear() * 12 + t.getMonth();
                      const targetMonth = next.getFullYear() * 12 + next.getMonth();
                      if (targetMonth < minMonth) return prev;
                      return next;
                    });
                  }}
                  onPressArrowRight={() => {
                    setScheduledAt((prev) => addMonths(prev, 1));
                  }}
                  theme={{
                    ...calTheme,
                    'stylesheet.calendar.main': {
                      week: {
                        flexDirection: CAL_WEEK_ROW_DIR,
                        justifyContent: 'flex-start',
                        paddingHorizontal: 0,
                      },
                    },
                    'stylesheet.calendar.header': {
                      week: {
                        flexDirection: CAL_WEEK_ROW_DIR,
                        justifyContent: 'flex-start',
                        paddingHorizontal: 0,
                      },
                      dayHeader: {
                        marginTop: 2,
                        marginBottom: 7,
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#64748B',
                      },
                    },
                  }}
                  style={m.calendarStyle}
                />

                {/* Time picker */}
                <View style={m.timePickerSection}>
                  <Text style={m.timePickerLabel}>שעת שליחה</Text>
                  <TimePicker value={scheduledAt} onChange={setScheduledAt} />
                </View>
              </View>
            ) : null}

            {/* Submit button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={submitPush}
              style={{
                backgroundColor: '#1D4ED8',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 4,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
                {scheduleMode === 'scheduled' ? '🗓  תזמן פוש' : '📣  שגר עכשיו'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/* ─── Calendar theme ─── */
const calTheme = {
  backgroundColor: '#FFFFFF',
  calendarBackground: '#FFFFFF',
  textSectionTitleColor: '#64748B',
  selectedDayBackgroundColor: '#2563EB',
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: '#2563EB',
  dayTextColor: '#0F172A',
  textDisabledColor: '#CBD5E1',
  dotColor: '#2563EB',
  selectedDotColor: '#FFFFFF',
  arrowColor: '#2563EB',
  monthTextColor: '#0F172A',
  textDayFontWeight: '700' as any,
  textMonthFontWeight: '900' as any,
  textDayHeaderFontWeight: '800' as any,
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 12,
};

/* ─── Styles ─── */
const s = StyleSheet.create({
  statsGrid: { flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap' },
  statTile: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 110,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  statLabel: { color: '#64748B', fontWeight: '800', fontSize: 12, textAlign: 'right' },
  statValue: { color: '#0F172A', fontWeight: '900', fontSize: 24, textAlign: 'right', marginTop: 6, letterSpacing: -0.4 },
  statHint: { color: '#94A3B8', fontWeight: '700', fontSize: 11, textAlign: 'right', marginTop: 6 },

  pushLauncher: {
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  pushLauncherPressed: { opacity: 0.92, transform: [{ scale: 0.992 }] },
  pushLauncherInner: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(37,99,235,0.20)',
    overflow: 'hidden',
  },
  pushLauncherFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  pushLauncherGlowA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.12)',
    top: -90,
    right: -80,
  },
  pushLauncherGlowB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.10)',
    bottom: -70,
    left: -70,
  },
  pushLauncherRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  pushLauncherIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushLauncherIcon: { fontSize: 22 },
  pushLauncherTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  pushLauncherSub: { color: '#475569', fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  pushLauncherChevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushLauncherChevron: { color: '#64748B', fontSize: 22, fontWeight: '600' },
});

const plusM = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingHint: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'flex-end',
  },
  rowName: { color: '#0F172A', fontWeight: '900', fontSize: 15, textAlign: 'right', alignSelf: 'stretch' },
  rowPhone: { color: '#64748B', fontWeight: '700', fontSize: 13, textAlign: 'right', marginTop: 4, alignSelf: 'stretch' },
});

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
  },
  navBtn: {
    minWidth: 44,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  navBtnText: { color: '#475569', fontWeight: '800', fontSize: 18 },

  content: { padding: 16, gap: 14, paddingBottom: 40 },

  sectionLabel: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'right',
    marginTop: 2,
  },

  previewChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    overflow: 'hidden',
    position: 'relative',
  },
  previewChipBar: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#0EA5E9',
  },
  previewChipLabel: { color: '#0369A1', fontWeight: '800', fontSize: 10, textAlign: 'right', marginBottom: 2 },
  previewChipTitle: { color: '#0F172A', fontWeight: '900', fontSize: 13, textAlign: 'right' },
  previewChipBody: { color: '#475569', fontWeight: '600', fontSize: 12, textAlign: 'right', marginTop: 2 },

  optionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  optionCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { color: '#0F172A', fontWeight: '900', fontSize: 15, textAlign: 'right' },
  optionTitleActive: { color: '#1D4ED8' },
  optionSub: { color: '#94A3B8', fontWeight: '600', fontSize: 12, textAlign: 'right', marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },

  /* Scheduler */
  schedulerWrap: {
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    paddingBottom: 4,
  },

  selectedSummary: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  selectedSummaryLabel: { color: '#3B82F6', fontWeight: '800', fontSize: 11, marginBottom: 3 },
  selectedSummaryValue: { color: '#1D4ED8', fontWeight: '900', fontSize: 14, textAlign: 'right' },

  calendarStyle: {
    paddingHorizontal: 8,
  },
  calArrow: { color: '#2563EB', fontSize: 22, fontWeight: '900', paddingHorizontal: 4 },

  timePickerSection: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  timePickerLabel: {
    color: '#475569',
    fontWeight: '900',
    fontSize: 13,
    textAlign: 'right',
  },

});
