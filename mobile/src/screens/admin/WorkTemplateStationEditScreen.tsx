import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Check, Clock, Save, Search, Trash2, User, Users, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { WorkTemplatesStackParamList } from '../../navigation/workTemplatesTypes';

type StationRow = {
  id: string;
  template_id: string;
  order: number;
  customer_id?: string | null;
  worker_id?: string | null;
  scheduled_time: string;
};

type UserLite = { id: string; name: string; role: 'customer' | 'worker'; avatar_url?: string | null };

function normalizeTime(raw: string): string {
  const t = (raw ?? '').trim();
  const match = t.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : '09:00';
}

/* ─── Inline user picker modal ─── */
function UserPickerModal({
  visible,
  kind,
  users,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  kind: 'customer' | 'worker';
  users: UserLite[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const isCustomer = kind === 'customer';
  const title = isCustomer ? 'בחירת לקוח' : 'בחירת עובד';

  const filtered = useMemo(() => {
    const list = users.filter((u) => u.role === kind);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => (u.name ?? '').toLowerCase().includes(q));
  }, [users, kind, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = (id: string | null) => {
    setQuery('');
    onSelect(id);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={ms.container}>
        {/* Header */}
        <View style={ms.header}>
          <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <View style={ms.closeBtn}>
              <X size={18} color={colors.text} strokeWidth={2.5} />
            </View>
          </Pressable>
          <Text style={ms.title}>{title}</Text>
          <View style={ms.closeBtn} />
        </View>

        {/* Search */}
        <View style={ms.searchWrap}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isCustomer ? 'חפש לקוח...' : 'חפש עובד...'}
            placeholderTextColor={colors.muted}
            autoFocus
            style={ms.searchInput}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <View style={ms.clearQueryBtn}>
                <X size={11} color="#fff" strokeWidth={3} />
              </View>
            </Pressable>
          )}
        </View>

        {/* Clear selection */}
        {!!selectedId && (
          <Pressable onPress={() => handleSelect(null)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <View style={ms.clearRow}>
              <X size={15} color={colors.danger} />
              <Text style={ms.clearText}>{isCustomer ? 'נקה בחירת לקוח' : 'נקה בחירת עובד'}</Text>
            </View>
          </Pressable>
        )}

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ms.listContent}
          renderItem={({ item: u }) => {
            const selected = selectedId === u.id;
            return (
              <Pressable onPress={() => handleSelect(u.id)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <View style={[ms.userRow, selected ? ms.userRowSelected : null]}>
                  <Avatar size={40} uri={u.avatar_url ?? null} name={u.name} />
                  <View style={ms.userInfo}>
                    <Text style={[ms.userName, selected ? ms.userNameSelected : null]}>{u.name}</Text>
                    {selected && <Text style={ms.userSelectedBadge}>נבחר</Text>}
                  </View>
                  <View style={[ms.checkCircle, selected ? ms.checkCircleActive : null]}>
                    {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={ms.emptyWrap}>
              <View style={ms.emptyIcon}>
                {isCustomer ? <User size={28} color={colors.muted} /> : <Users size={28} color={colors.muted} />}
              </View>
              <Text style={ms.emptyText}>
                {query ? 'לא נמצאו תוצאות' : isCustomer ? 'אין לקוחות' : 'אין עובדים'}
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

/* Modal styles */
const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  searchWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    fontSize: 15,
    padding: 0,
  },
  clearQueryBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 8,
  },
  userRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  userRowSelected: {
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderColor: 'rgba(37,99,235,0.25)',
  },
  userInfo: { flex: 1, alignItems: 'flex-end' },
  userName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'right',
  },
  userNameSelected: { fontWeight: '900' },
  userSelectedBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyWrap: { alignItems: 'center', paddingTop: 50, gap: 12 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
});

/* ═══════════════════════════════════════════════════════ */

export function WorkTemplateStationEditScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateStationEdit'>) {
  const { stationId } = route.params;
  const [station, setStation] = useState<StationRow | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerKind, setPickerKind] = useState<'customer' | 'worker' | null>(null);

  const timeRegex = useMemo(() => /^([01]\d|2[0-3]):([0-5]\d)$/, []);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, avatar_url')
      .in('role', ['customer', 'worker'])
      .order('name');
    if (!error) setUsers((data ?? []) as any);
  }, []);

  const fetchStation = useCallback(async () => {
    const { data, error } = await supabase
      .from('template_stations')
      .select('id, template_id, "order", customer_id, worker_id, scheduled_time')
      .eq('id', stationId)
      .maybeSingle();
    if (error) throw error;
    const row = (data as any) as StationRow | null;
    setStation(row);
    if (row) {
      setCustomerId(row.customer_id ?? null);
      setWorkerId(row.worker_id ?? null);
      setScheduledTime(normalizeTime(row.scheduled_time ?? '09:00'));
    }
  }, [stationId]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
      fetchStation().catch((e: any) =>
        Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' })
      );
    }, [fetchStation, fetchUsers])
  );

  const userById = useMemo(() => {
    const map = new Map<string, UserLite>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const customer = customerId ? userById.get(customerId) ?? null : null;
  const worker = workerId ? userById.get(workerId) ?? null : null;

  const save = async () => {
    const time = scheduledTime.trim();
    if (!timeRegex.test(time)) return setError('יש להזין שעה בפורמט HH:mm (למשל 09:00)');
    try {
      setSaving(true);
      setError('');
      const { error } = await supabase
        .from('template_stations')
        .update({ customer_id: customerId, worker_id: workerId, scheduled_time: time })
        .eq('id', stationId);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'התחנה עודכנה בהצלחה' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('מחיקת תחנה', `האם למחוק את תחנה #${station?.order ?? ''}?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: del },
    ]);
  };

  const del = async () => {
    try {
      setDeleting(true);
      const { error } = await supabase.from('template_stations').delete().eq('id', stationId);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'התחנה נמחקה' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <Screen padded={false} backgroundColor={colors.elevated}>
      {/* Inline picker modal */}
      <UserPickerModal
        visible={pickerKind !== null}
        kind={pickerKind ?? 'customer'}
        users={users}
        selectedId={pickerKind === 'customer' ? customerId : workerId}
        onSelect={(id) => {
          if (pickerKind === 'customer') setCustomerId(id);
          else setWorkerId(id);
          setPickerKind(null);
        }}
        onClose={() => setPickerKind(null)}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!station && (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.loadingText}>טוען תחנה…</Text>
          </View>
        )}

        {/* ─── Section: אנשים ─── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>שיוך אנשים</Text>
          <View style={s.card}>
            {/* Customer */}
            <Pressable onPress={() => setPickerKind('customer')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={s.personRow}>
                {customer ? (
                  <Avatar size={42} uri={customer.avatar_url ?? null} name={customer.name} />
                ) : (
                  <View style={s.personAvatar}>
                    <User size={19} color={colors.primary} strokeWidth={1.8} />
                  </View>
                )}
                <View style={s.personInfo}>
                  <Text style={s.personRole}>לקוח</Text>
                  <Text style={[s.personName, customer ? null : s.personNameEmpty]} numberOfLines={1}>
                    {customer?.name ?? 'בחר לקוח...'}
                  </Text>
                </View>
                {customer && <View style={s.selectedDot} />}
              </View>
            </Pressable>

            <View style={s.divider} />

            {/* Worker */}
            <Pressable onPress={() => setPickerKind('worker')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={s.personRow}>
                {worker ? (
                  <Avatar size={42} uri={worker.avatar_url ?? null} name={worker.name} />
                ) : (
                  <View style={[s.personAvatar, s.personAvatarWorker]}>
                    <Users size={19} color="#8B5CF6" strokeWidth={1.8} />
                  </View>
                )}
                <View style={s.personInfo}>
                  <Text style={s.personRole}>עובד</Text>
                  <Text style={[s.personName, worker ? null : s.personNameEmpty]} numberOfLines={1}>
                    {worker?.name ?? 'בחר עובד...'}
                  </Text>
                </View>
                {worker && <View style={[s.selectedDot, s.selectedDotWorker]} />}
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── Section: שעה ─── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>תזמון</Text>
          <View style={s.card}>
            <View style={s.timeRow}>
              <View style={s.timeIconWrap}>
                <Clock size={20} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={s.timeInputWrap}>
                <Input
                  label="שעה מתוזמנת"
                  value={scheduledTime}
                  onChangeText={(v) => {
                    setScheduledTime(v);
                    setError('');
                  }}
                  placeholder="09:00"
                  inputMode="numeric"
                  style={s.timeInput}
                />
                <Text style={s.timeHelper}>פורמט HH:mm — למשל 09:00</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Error ─── */}
        {!!error && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ─── Actions ─── */}
        <View style={s.actions}>
          <Pressable onPress={save} disabled={busy} style={({ pressed }) => ({ opacity: busy ? 0.55 : pressed ? 0.88 : 1 })}>
            <View style={s.saveBtnInner}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={18} color="#fff" strokeWidth={2.5} />}
              <Text style={s.saveBtnText}>{saving ? 'שומר…' : 'שמור שינויים'}</Text>
            </View>
          </Pressable>

          <Pressable onPress={confirmDelete} disabled={busy} style={({ pressed }) => ({ opacity: busy ? 0.45 : pressed ? 0.88 : 1 })}>
            <View style={s.deleteBtnInner}>
              {deleting ? <ActivityIndicator size="small" color={colors.danger} /> : <Trash2 size={16} color={colors.danger} strokeWidth={2} />}
              <Text style={s.deleteBtnText}>{deleting ? 'מוחק…' : 'מחק תחנה'}</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
  },
  loadingWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  section: { marginBottom: 20 },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  personRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(37,99,235,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarWorker: {
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderColor: 'rgba(139,92,246,0.15)',
  },
  personInfo: { flex: 1, alignItems: 'flex-end' },
  personRole: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  personName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  personNameEmpty: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  selectedDotWorker: {
    backgroundColor: '#8B5CF6',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  timeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  timeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  timeInputWrap: { flex: 1 },
  timeInput: {
    backgroundColor: colors.bg,
    fontWeight: '900',
    fontSize: 18,
  },
  timeHelper: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: { gap: 10 },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    elevation: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  deleteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.elevated,
    borderRadius: 18,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
});
