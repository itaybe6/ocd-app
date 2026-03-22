import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Clock, MapPin, Pencil, Plus, Search, Trash2, User, Users } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/ui/Avatar';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { WorkTemplatesStackParamList } from '../../navigation/workTemplatesTypes';

type Station = {
  id: string;
  template_id: string;
  order: number;
  customer_id?: string | null;
  worker_id?: string | null;
  scheduled_time: string;
};

type UserLite = { id: string; name: string; role: 'customer' | 'worker'; avatar_url?: string | null };

export function WorkTemplateStationsScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateStations'>) {
  const { templateId, day } = route.params;
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, avatar_url')
      .in('role', ['customer', 'worker'])
      .order('name');
    if (!error) setUsers((data ?? []) as any);
  }, []);

  const fetchStations = useCallback(async () => {
    const { data, error } = await supabase
      .from('template_stations')
      .select('id, template_id, "order", customer_id, worker_id, scheduled_time')
      .eq('template_id', templateId)
      .order('order', { ascending: true });
    if (error) throw error;
    setStations(((data ?? []) as any) as Station[]);
  }, [templateId]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchStations()]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [fetchStations, fetchUsers]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const userById = useMemo(() => {
    const map = new Map<string, UserLite>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const deleteStation = useCallback((stationId: string, order: number) => {
    Alert.alert(
      `מחיקת תחנה #${order}`,
      'האם אתה בטוח שברצונך למחוק תחנה זו? לא ניתן לבטל פעולה זו.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('template_stations')
                .delete()
                .eq('id', stationId);
              if (error) throw error;
              Toast.show({ type: 'success', text1: 'התחנה נמחקה בהצלחה' });
              await fetchStations();
            } catch (e: any) {
              Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
            }
          },
        },
      ]
    );
  }, [fetchStations]);

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => {
      const customer = (s.customer_id ? userNameById.get(s.customer_id) : '') ?? '';
      const worker = (s.worker_id ? userNameById.get(s.worker_id) : '') ?? '';
      return customer.toLowerCase().includes(q) || worker.toLowerCase().includes(q);
    });
  }, [searchQuery, stations, userNameById]);

  return (
    <Screen padded={false}>
      {/* ─── Header ─── */}
      <View style={s.headerWrap}>
        <View style={s.headerRow}>
          <Text style={s.title}>תחנות בתבנית</Text>
          <View style={s.titleMeta}>
            <View style={s.dayBadge}>
              <Text style={s.dayBadgeText}>יום {day}</Text>
            </View>
            <Text style={s.stationCount}>{filteredStations.length} תחנות</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="חיפוש לפי לקוח או עובד..."
            placeholderTextColor={colors.muted}
            style={s.searchInput}
          />
        </View>
      </View>

      {/* ─── List ─── */}
      <FlatList
        data={filteredStations}
        keyExtractor={(i) => i.id}
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => {
          const customer = item.customer_id ? userById.get(item.customer_id) ?? null : null;
          const worker = item.worker_id ? userById.get(item.worker_id) ?? null : null;

          return (
            <View style={s.card}>
              {/* Colored left accent strip */}
              <View style={s.cardAccent} />

              <View style={s.cardInner}>
                {/* Card header: order badge + title + time */}
                <View style={s.cardHeader}>
                  <View style={s.cardHeaderRight}>
                    <View style={s.orderBadge}>
                      <Text style={s.orderBadgeText}>{item.order}</Text>
                    </View>
                    <Text style={s.cardTitle}>תחנה #{item.order}</Text>
                  </View>
                  <View style={s.timeBadge}>
                    <Clock size={13} color={colors.muted} />
                    <Text style={s.timeBadgeText}>{item.scheduled_time}</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={s.divider} />

                {/* Customer row */}
                <View style={[s.personRow, s.customerRow]}>
                  <View style={s.personRowLeft}>
                    <View style={[s.roleIcon, s.roleIconNeutral]}>
                      <User size={14} color={colors.muted} />
                    </View>
                    <Text style={s.roleLabel}>לקוח</Text>
                  </View>
                  <View style={s.personInfo}>
                    {customer ? (
                      <>
                        <Avatar size={32} uri={customer.avatar_url ?? null} name={customer.name} />
                        <Text style={s.personName} numberOfLines={1}>{customer.name}</Text>
                      </>
                    ) : (
                      <>
                        <View style={s.emptyAvatar}>
                          <User size={15} color="#94A3B8" />
                        </View>
                        <Text style={s.emptyName}>לא נבחר</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Worker row */}
                <View style={[s.personRow, s.workerRow]}>
                  <View style={s.personRowLeft}>
                    <View style={[s.roleIcon, s.roleIconNeutralDark]}>
                      <Users size={14} color={colors.muted} />
                    </View>
                    <Text style={s.roleLabel}>עובד</Text>
                  </View>
                  <View style={s.personInfo}>
                    {worker ? (
                      <>
                        <Avatar size={32} uri={worker.avatar_url ?? null} name={worker.name} />
                        <Text style={s.personName} numberOfLines={1}>{worker.name}</Text>
                      </>
                    ) : (
                      <>
                        <View style={s.emptyAvatar}>
                          <Users size={15} color="#94A3B8" />
                        </View>
                        <Text style={s.emptyName}>לא נבחר</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Divider */}
                <View style={[s.divider, { marginTop: 10, marginBottom: 0 }]} />

                {/* Action buttons footer */}
                <View style={s.cardFooter}>
                  <Pressable
                    onPress={() => deleteStation(item.id, item.order)}
                    style={({ pressed }) => [s.actionBtn, s.deleteBtn, pressed && s.deleteBtnPressed]}
                  >
                    <Trash2 size={15} color={colors.danger} />
                    <Text style={s.deleteBtnText}>מחק</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate('WorkTemplateStationEdit', { templateId, day, stationId: item.id })}
                    style={({ pressed }) => [s.actionBtn, s.editBtn, pressed && s.editBtnPressed]}
                  >
                    <Pencil size={15} color={colors.primary} />
                    <Text style={s.editBtnText}>עריכה</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <MapPin size={32} color={colors.primary} />
            </View>
            <Text style={s.emptyTitle}>אין תחנות עדיין</Text>
            <Text style={s.emptySubtitle}>לחץ על הוסף תחנה כדי להתחיל</Text>
          </View>
        }
      />

      {/* ─── FAB ─── */}
      <View pointerEvents="box-none" style={s.fabWrap}>
        <Pressable
          onPress={() => navigation.navigate('WorkTemplateStationCreate', { templateId, day })}
          style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
        >
          <Plus size={22} color="#fff" />
          <Text style={s.fabText}>הוסף תחנה</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  /* ── Header ── */
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: colors.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    alignItems: 'flex-end',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  titleMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  dayBadge: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dayBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  stationCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    fontSize: 15,
    padding: 0,
  },

  /* ── List ── */
  listContent: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },

  /* ── Card ── */
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardAccent: {
    width: 5,
    backgroundColor: colors.primary,
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  cardHeaderRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeBadgeText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },

  /* ── Person rows ── */
  personRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  customerRow: {
    backgroundColor: 'rgba(100,116,139,0.06)',
  },
  workerRow: {
    backgroundColor: 'rgba(100,116,139,0.10)',
    marginBottom: 0,
  },
  personRowLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  roleIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconNeutral: {
    backgroundColor: 'rgba(100,116,139,0.12)',
  },
  roleIconNeutralDark: {
    backgroundColor: 'rgba(71,85,105,0.16)',
  },
  roleLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  personInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  personName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'right',
  },
  emptyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyName: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'right',
  },

  /* ── Card footer actions ── */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderColor: 'rgba(37,99,235,0.18)',
  },
  editBtnPressed: {
    backgroundColor: 'rgba(37,99,235,0.14)',
  },
  editBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    backgroundColor: 'rgba(220,38,38,0.05)',
    borderColor: 'rgba(220,38,38,0.18)',
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  deleteBtnText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },

  /* ── Empty state ── */
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 14,
  },

  /* ── FAB ── */
  fabWrap: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 30,
    paddingHorizontal: 26,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 12,
  },
  fabPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  fabText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
