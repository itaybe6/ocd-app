import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Bell, Briefcase, Clock3, Sparkles, Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { yyyyMmDd } from '../../lib/time';

type JobKind = 'regular' | 'installation' | 'special';

type Row = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  job_kind: JobKind;
  job_id: string;
  created_at: string;
  read_at: string | null;
};

const KIND_META: Record<
  JobKind,
  { label: string; color: string; soft: string; ring: string; Icon: typeof Briefcase }
> = {
  regular: {
    label: 'משימת ריח',
    color: '#2563EB',
    soft: 'rgba(37,99,235,0.10)',
    ring: 'rgba(37,99,235,0.22)',
    Icon: Briefcase,
  },
  installation: {
    label: 'התקנה',
    color: '#7C3AED',
    soft: 'rgba(124,58,237,0.10)',
    ring: 'rgba(124,58,237,0.22)',
    Icon: Wrench,
  },
  special: {
    label: 'מיוחדת',
    color: '#EA580C',
    soft: 'rgba(234,88,12,0.10)',
    ring: 'rgba(234,88,12,0.22)',
    Icon: Sparkles,
  },
};

const KIND_TABLE: Record<JobKind, 'jobs' | 'installation_jobs' | 'special_jobs'> = {
  regular: 'jobs',
  installation: 'installation_jobs',
  special: 'special_jobs',
};

function buildSections(rows: Row[]) {
  const today: Row[] = [];
  const yesterday: Row[] = [];
  const earlier: Row[] = [];
  for (const r of rows) {
    const d = new Date(r.created_at);
    if (isToday(d)) today.push(r);
    else if (isYesterday(d)) yesterday.push(r);
    else earlier.push(r);
  }
  const sections: { title: string; data: Row[] }[] = [];
  if (today.length) sections.push({ title: 'היום', data: today });
  if (yesterday.length) sections.push({ title: 'אתמול', data: yesterday });
  if (earlier.length) sections.push({ title: 'קודם לכן', data: earlier });
  return sections;
}

function relativeLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d) || isYesterday(d)) {
    try {
      return formatDistanceToNow(d, { addSuffix: true, locale: he });
    } catch {
      return format(d, 'HH:mm');
    }
  }
  try {
    return format(d, "d בMMM yyyy 'בשעה' HH:mm", { locale: he });
  } catch {
    return format(d, 'dd/MM/yyyy HH:mm');
  }
}

export function WorkerNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const totalCount = rows.length;

  const sections = useMemo(() => buildSections(rows), [rows]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('worker_job_notifications')
      .select('id, user_id, title, body, job_kind, job_id, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    setRows((data ?? []) as Row[]);
  }, [user?.id]);

  /** כניסה למסך — כל ההודעות נסמנות כנקרא (גם לבאדג׳ במגירה). */
  const markAllReadOnEnter = useCallback(async () => {
    if (!user?.id) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('worker_job_notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (error) throw error;
    setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          setLoading(true);
          await load();
          if (!cancelled && user?.id) {
            try {
              await markAllReadOnEnter();
            } catch {
              /* רשימה עדיין מוצגת; סימון כנקרא אופציונלי */
            }
          }
        } catch (e: any) {
          if (!cancelled) Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? '' });
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load, markAllReadOnEnter, user?.id]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'רענון נכשל', text2: e?.message ?? '' });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openMission = useCallback(
    async (item: Row) => {
      if (opening) return;
      setOpening(item.id);
      try {
        const tbl = KIND_TABLE[item.job_kind];
        const { data, error } = await supabase
          .from(tbl)
          .select('id, date, worker_id')
          .eq('id', item.job_id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          Toast.show({
            type: 'info',
            text1: 'המשימה לא נמצאה',
            text2: 'ייתכן שהמשימה הוסרה מהמערכת',
          });
          return;
        }
        if (user?.id && data.worker_id && data.worker_id !== user.id) {
          Toast.show({
            type: 'info',
            text1: 'המשימה אינה משויכת אליך',
            text2: 'ייתכן שהמנהל הקצה אותה לעובד אחר',
          });
          return;
        }

        const ymd = yyyyMmDd(new Date(data.date));
        navigation.navigate(
          'Schedule' as never,
          {
            openJobId: item.job_id,
            openJobKind: item.job_kind,
            openJobDayYmd: ymd,
          } as never,
        );
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'פתיחה נכשלה', text2: e?.message ?? '' });
      } finally {
        setOpening(null);
      }
    },
    [navigation, opening, user?.id],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.hero}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow1} />
          <View style={styles.heroGlow2} />
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Bell size={22} color="#2563EB" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>הודעות מהמערכת</Text>
              <Text style={styles.heroSub}>
                משימות שהוקצו או עודכנו על ידי המנהל. הקש על משימה כדי לפתוח אותה בלוז היומי.
              </Text>
            </View>
          </View>

          {totalCount > 0 ? (
            <View style={styles.heroCountPill}>
              <Text style={styles.heroCountText}>
                {totalCount === 1 ? 'הודעה אחת' : `${totalCount} הודעות`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    ),
    [totalCount],
  );

  if (loading && !rows.length) {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>טוען הודעות…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={listHeader}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <View style={styles.sectionHeaderLine} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.itemSep} />}
        renderItem={({ item }) => {
          const meta = KIND_META[item.job_kind] ?? KIND_META.regular;
          const Icon = meta.Icon;
          const rel = relativeLabel(item.created_at);
          const isOpening = opening === item.id;

          return (
            <Pressable
              onPress={() => void openMission(item)}
              accessibilityRole="button"
              accessibilityLabel={`פתיחת משימה: ${item.title}`}
              android_ripple={{ color: 'rgba(15, 23, 42, 0.06)' }}
              style={({ pressed }) => [
                styles.cardFrame,
                pressed && styles.cardFramePressed,
                isOpening && { opacity: 0.82 },
              ]}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.kindIconWrap,
                      { borderColor: meta.ring, backgroundColor: meta.soft },
                    ]}
                  >
                    <Icon size={18} color={meta.color} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.kindPill,
                        { backgroundColor: meta.soft, borderColor: meta.ring },
                      ]}
                    >
                      <View style={[styles.kindPillDot, { backgroundColor: meta.color }]} />
                      <Text style={[styles.kindPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.cardBody} numberOfLines={3}>
                  {item.body}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.timeRow}>
                    {isOpening ? (
                      <ActivityIndicator size="small" color="#94A3B8" />
                    ) : (
                      <Clock3 size={12} color="#94A3B8" strokeWidth={2.2} />
                    )}
                    <Text style={styles.timeText}>{rel}</Text>
                  </View>
                </View>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Bell size={28} color="#94A3B8" strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>אין הודעות עדיין</Text>
            <Text style={styles.emptySub}>
              כשהמנהל יקצה לך משימה, היא תופיע כאן ובהתראה בטלפון.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** מעט כהה מהכרטיס הלבן — אותו עיקרון כמו מעל/מתחת ל־hero */
  screen: {
    flex: 1,
    backgroundColor: '#EEF2F7',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#EEF2F7',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  // ── Hero ─────────────────────────────────────
  hero: {
    marginBottom: 16,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 3 },
    }),
  },
  heroGlow1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#2563EB',
    opacity: 0.06,
    top: -70,
    left: -50,
  },
  heroGlow2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#7C3AED',
    opacity: 0.05,
    bottom: -40,
    right: -30,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  heroSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
    lineHeight: 19,
  },
  heroCountPill: {
    marginTop: 14,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'right',
  },

  // ── Section headers ─────────────────────────
  sectionHeaderWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  itemSep: {
    height: 14,
  },

  /** מסגרת חיצונית עגולה (טבעת) + פנים לבן — שתי שכבות מסגרת */
  cardFrame: {
    padding: 5,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#C2CCD9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 3 },
    }),
  },
  cardFramePressed: {
    opacity: 0.97,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  cardInner: {
    backgroundColor: colors.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    overflow: 'hidden',
  },
  cardContent: {
    backgroundColor: colors.elevated,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  kindIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  kindPill: {
    marginTop: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  kindPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardBody: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'right',
    lineHeight: 21,
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  timeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'right',
  },

  // ── Empty ───────────────────────────────────
  empty: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#334155',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
  },
});
