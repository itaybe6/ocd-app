import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react-native';
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

const BG = '#F2F2F7';
const CARD_BG = '#FFFFFF';
const LABEL_COLOR = '#8E8E93';
const SEPARATOR = '#E5E5EA';

export function WorkTemplateStationsScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateStations'>) {
  const { templateId, day } = route.params;
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteStation = useCallback(
    (stationId: string, order: number) => {
      Alert.alert(`מחיקת תחנה #${order}`, 'האם אתה בטוח שברצונך למחוק תחנה זו? לא ניתן לבטל פעולה זו.', [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('template_stations').delete().eq('id', stationId);
              if (error) throw error;
              Toast.show({ type: 'success', text1: 'התחנה נמחקה בהצלחה' });
              await fetchStations();
            } catch (e: any) {
              Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
            }
          },
        },
      ]);
    },
    [fetchStations]
  );

  const bulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      `מחיקת ${selectedIds.size} תחנות`,
      'האם אתה בטוח שברצונך למחוק את התחנות הנבחרות? לא ניתן לבטל פעולה זו.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = Array.from(selectedIds);
              const { error } = await supabase.from('template_stations').delete().in('id', ids);
              if (error) throw error;
              Toast.show({ type: 'success', text1: `${ids.length} תחנות נמחקו בהצלחה` });
              setSelectedIds(new Set());
              setIsEditMode(false);
              await fetchStations();
            } catch (e: any) {
              Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
            }
          },
        },
      ]
    );
  }, [selectedIds, fetchStations]);

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
    <Screen padded={false} backgroundColor={BG} safeAreaEdges={['bottom', 'left', 'right']}>

      {/* ─── Header ─── */}
      <View style={s.header}>
        {/* Top row: title + meta */}
        <View style={s.headerTop}>
          <View style={s.headerMeta}>
            <View style={s.countPill}>
              <Text style={s.countNum}>{filteredStations.length}</Text>
              <Text style={s.countLabel}> תחנות</Text>
            </View>
          </View>

          <View style={s.headerTitleGroup}>
            <View style={s.dayPill}>
              <Text style={s.dayPillText}>יום {day}</Text>
            </View>
            <Text style={s.headerTitle}>תחנות בתבנית</Text>
          </View>
        </View>

        {/* Search + edit row */}
        <View style={s.searchRow}>
          <Pressable
            onPress={toggleEditMode}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, transform: pressed ? [{ scale: 0.96 }] : [] })}
          >
            <View style={[s.editBtn, isEditMode && s.editBtnActive]}>
              {isEditMode ? (
                <>
                  <X size={12} color={LABEL_COLOR} strokeWidth={2.5} />
                  <Text style={s.editBtnTextActive}>ביטול</Text>
                </>
              ) : (
                <>
                  <Pencil size={12} color={colors.primary} strokeWidth={2.5} />
                  <Text style={s.editBtnText}>עריכה</Text>
                </>
              )}
            </View>
          </Pressable>

          <View style={s.searchWrap}>
            <Search size={15} color={LABEL_COLOR} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="חיפוש לפי לקוח או עובד..."
              placeholderTextColor={LABEL_COLOR}
              style={s.searchInput}
            />
            {!!searchQuery && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <View style={s.searchClear}>
                  <X size={9} color="#fff" strokeWidth={3} />
                </View>
              </Pressable>
            )}
          </View>
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
        renderItem={({ item, index }) => {
          const customer = item.customer_id ? userById.get(item.customer_id) ?? null : null;
          const worker = item.worker_id ? userById.get(item.worker_id) ?? null : null;
          const isSelected = selectedIds.has(item.id);

          return (
            <Pressable
              onPress={() => isEditMode && toggleSelect(item.id)}
              onLongPress={() => {
                if (!isEditMode) {
                  setIsEditMode(true);
                  toggleSelect(item.id);
                }
              }}
              style={({ pressed }) => [{ opacity: pressed && isEditMode ? 0.75 : pressed ? 0.97 : 1 }]}
            >
              <View style={[s.card, isSelected && s.cardSelected, index === 0 && s.cardFirst]}>
                {/* Selection indicator */}
                {isEditMode && (
                  <View style={s.selectionCol}>
                    {isSelected ? (
                      <CheckCircle2 size={24} color={colors.primary} strokeWidth={2} />
                    ) : (
                      <Circle size={24} color={SEPARATOR} strokeWidth={2} />
                    )}
                  </View>
                )}

                <View style={s.cardContent}>
                  <View style={[s.cardBody, isEditMode && s.cardBodyEditing]}>
                    {/* ── Card top row: order + title + time ── */}
                    <View style={s.cardTopRow}>
                      <View style={s.timePill}>
                        <Clock size={12} color={colors.primary} strokeWidth={2.5} />
                        <Text style={s.timePillText}>{item.scheduled_time}</Text>
                      </View>
                      <View style={s.cardTitleGroup}>
                        <Text style={s.cardTitle}>תחנה #{item.order}</Text>
                        <View style={s.orderCircle}>
                          <Text style={s.orderCircleText}>{item.order}</Text>
                        </View>
                      </View>
                    </View>

                    {/* ── Divider ── */}
                    <View style={s.sep} />

                    {/* ── Person rows ── */}
                    <View style={s.personsWrap}>
                      {/* Customer */}
                      <View style={s.personRow}>
                        <View style={s.personRight}>
                          {customer ? (
                            <>
                              <Avatar size={34} uri={customer.avatar_url ?? null} name={customer.name} />
                              <Text style={s.personName} numberOfLines={1}>{customer.name}</Text>
                            </>
                          ) : (
                            <>
                              <View style={s.emptyCircle}>
                                <User size={14} color={LABEL_COLOR} />
                              </View>
                              <Text style={s.personEmpty}>לא נבחר</Text>
                            </>
                          )}
                        </View>
                        <View style={s.roleTag}>
                          <User size={11} color={colors.primary} strokeWidth={2.5} />
                          <Text style={s.roleTagText}>לקוח</Text>
                        </View>
                      </View>

                      <View style={s.innerSep} />

                      {/* Worker */}
                      <View style={s.personRow}>
                        <View style={s.personRight}>
                          {worker ? (
                            <>
                              <Avatar size={34} uri={worker.avatar_url ?? null} name={worker.name} />
                              <Text style={s.personName} numberOfLines={1}>{worker.name}</Text>
                            </>
                          ) : (
                            <>
                              <View style={[s.emptyCircle, s.emptyCircleWorker]}>
                                <Users size={14} color="#8B5CF6" />
                              </View>
                              <Text style={s.personEmpty}>לא נבחר</Text>
                            </>
                          )}
                        </View>
                        <View style={[s.roleTag, s.roleTagWorker]}>
                          <Users size={11} color="#8B5CF6" strokeWidth={2.5} />
                          <Text style={[s.roleTagText, s.roleTagTextWorker]}>עובד</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* ── Footer actions (hidden in edit mode) ── */}
                  {!isEditMode && (
                    <View style={s.cardFooter}>
                      <View style={s.footerHalf}>
                        <Pressable
                          onPress={() => navigation.navigate('WorkTemplateStationEdit', { templateId, day, stationId: item.id })}
                          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                        >
                          <View style={s.footerAction}>
                            <Pencil size={13} color={colors.primary} strokeWidth={2.5} />
                            <Text style={s.footerActionEditText}>עריכה</Text>
                          </View>
                        </Pressable>
                      </View>

                      <View style={s.footerDivider} />

                      <View style={s.footerHalf}>
                        <Pressable
                          onPress={() => deleteStation(item.id, item.order)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                        >
                          <View style={s.footerAction}>
                            <Trash2 size={13} color={colors.danger} strokeWidth={2.5} />
                            <Text style={s.footerActionDeleteText}>מחק</Text>
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <MapPin size={30} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={s.emptyTitle}>אין תחנות עדיין</Text>
            <Text style={s.emptySubtitle}>לחץ על הוסף תחנה כדי להתחיל</Text>
          </View>
        }
      />

      {/* ─── FAB / Bulk-delete bar ─── */}
      <View pointerEvents="box-none" style={s.fabWrap}>
        {isEditMode ? (
          <Pressable
            onPress={bulkDelete}
            disabled={selectedIds.size === 0}
            style={({ pressed }) => [pressed && s.fabPressed]}
          >
            <View style={[s.fab, s.fabDanger, selectedIds.size === 0 && s.fabDisabled]}>
              <Trash2 size={18} color="#fff" strokeWidth={2.5} />
              <Text style={s.fabText}>
                {selectedIds.size > 0 ? `מחק ${selectedIds.size} תחנות` : 'בחר תחנות למחיקה'}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('WorkTemplateStationCreate', { templateId, day })}
            style={({ pressed }) => [pressed && s.fabPressed]}
          >
            <View style={s.fab}>
              <Plus size={20} color="#fff" strokeWidth={2.5} />
              <Text style={s.fabText}>הוסף תחנה</Text>
            </View>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  /* ══ Header ══ */
  header: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEPARATOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  dayPill: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dayPillText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: -0.1,
  },
  headerMeta: {
    alignItems: 'flex-start',
  },
  countPill: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    backgroundColor: BG,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: SEPARATOR,
  },
  countNum: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: -0.5,
  },
  countLabel: {
    color: LABEL_COLOR,
    fontWeight: '600',
    fontSize: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
  },
  editBtnActive: {
    backgroundColor: 'rgba(142,142,147,0.1)',
    borderColor: SEPARATOR,
  },
  editBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  editBtnTextActive: {
    color: LABEL_COLOR,
    fontWeight: '700',
    fontSize: 13,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SEPARATOR,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    fontSize: 14,
    padding: 0,
  },
  searchClear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LABEL_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ══ List ══ */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 10,
  },

  /* ══ Card ══ */
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardFirst: {},
  cardSelected: {
    shadowColor: colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  selectionCol: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(37,99,235,0.03)',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SEPARATOR,
  },
  cardContent: {
    flex: 1,
  },
  cardBody: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  cardBodyEditing: {
    paddingHorizontal: 14,
  },

  /* Card top row */
  cardTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  orderCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(37,99,235,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCircleText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(37,99,235,0.07)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  timePillText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },

  /* Separators */
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SEPARATOR,
    marginBottom: 10,
  },
  innerSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SEPARATOR,
    marginHorizontal: 4,
    marginVertical: 2,
  },

  /* Person rows */
  personsWrap: {
    gap: 0,
    marginBottom: 4,
  },
  personRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  personRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  personName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'right',
    flexShrink: 1,
  },
  personEmpty: {
    color: LABEL_COLOR,
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'right',
  },
  emptyCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircleWorker: {
    backgroundColor: 'rgba(139,92,246,0.06)',
    borderColor: 'rgba(139,92,246,0.14)',
  },
  roleTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37,99,235,0.07)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: 10,
    minWidth: 52,
    justifyContent: 'center',
  },
  roleTagWorker: {
    backgroundColor: 'rgba(139,92,246,0.07)',
  },
  roleTagText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  roleTagTextWorker: {
    color: '#8B5CF6',
  },

  /* Card footer */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEPARATOR,
  },
  footerHalf: {
    flex: 1,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  footerActionEditText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  footerDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: SEPARATOR,
    marginVertical: 8,
  },
  footerActionDeleteText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },

  /* ══ Empty state ══ */
  emptyState: {
    alignItems: 'center',
    paddingTop: 72,
    gap: 12,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    color: LABEL_COLOR,
    fontSize: 14,
    fontWeight: '500',
  },

  /* ══ FAB ══ */
  fabWrap: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 17,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 14,
  },
  fabDanger: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  fabDisabled: { opacity: 0.45 },
  fabPressed: {
    opacity: 0.93,
    transform: [{ scale: 0.975 }],
  },
  fabText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.1,
  },
});
