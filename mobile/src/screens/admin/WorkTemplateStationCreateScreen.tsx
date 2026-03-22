import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Check, Clock, Plus, Search, User, Users, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { WorkTemplatesStackParamList } from '../../navigation/workTemplatesTypes';

type UserLite = { id: string; name: string; role: 'customer' | 'worker'; avatar_url?: string | null };

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

  const handleClose = () => { setQuery(''); onClose(); };
  const handleSelect = (id: string | null) => { setQuery(''); onSelect(id); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={pm.container}>
        <View style={pm.header}>
          <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <View style={pm.closeBtn}><X size={18} color={colors.text} strokeWidth={2.5} /></View>
          </Pressable>
          <Text style={pm.title}>{title}</Text>
          <View style={pm.closeBtn} />
        </View>

        <View style={pm.searchWrap}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isCustomer ? 'חפש לקוח...' : 'חפש עובד...'}
            placeholderTextColor={colors.muted}
            autoFocus
            style={pm.searchInput}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <View style={pm.clearQueryBtn}><X size={11} color="#fff" strokeWidth={3} /></View>
            </Pressable>
          )}
        </View>

        {!!selectedId && (
          <Pressable onPress={() => handleSelect(null)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <View style={pm.clearRow}>
              <X size={15} color={colors.danger} />
              <Text style={pm.clearText}>{isCustomer ? 'נקה בחירת לקוח' : 'נקה בחירת עובד'}</Text>
            </View>
          </Pressable>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={pm.listContent}
          renderItem={({ item: u }) => {
            const selected = selectedId === u.id;
            return (
              <Pressable onPress={() => handleSelect(u.id)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <View style={[pm.userRow, selected ? pm.userRowSelected : null]}>
                  <Avatar size={40} uri={u.avatar_url ?? null} name={u.name} />
                  <View style={pm.userInfo}>
                    <Text style={[pm.userName, selected ? pm.userNameSelected : null]}>{u.name}</Text>
                    {selected && <Text style={pm.userSelectedBadge}>נבחר</Text>}
                  </View>
                  <View style={[pm.checkCircle, selected ? pm.checkCircleActive : null]}>
                    {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={pm.emptyWrap}>
              <View style={pm.emptyIcon}>
                {isCustomer ? <User size={28} color={colors.muted} /> : <Users size={28} color={colors.muted} />}
              </View>
              <Text style={pm.emptyText}>
                {query ? 'לא נמצאו תוצאות' : isCustomer ? 'אין לקוחות' : 'אין עובדים'}
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    backgroundColor: colors.elevated, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  searchWrap: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.elevated,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginTop: 12, gap: 10,
  },
  searchInput: { flex: 1, color: colors.text, textAlign: 'right', fontSize: 15, padding: 0 },
  clearQueryBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  clearRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10,
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FECACA',
  },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 8 },
  userRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: colors.elevated,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14,
  },
  userRowSelected: { backgroundColor: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.25)' },
  userInfo: { flex: 1, alignItems: 'flex-end' },
  userName: { color: colors.text, fontWeight: '700', fontSize: 15, textAlign: 'right' },
  userNameSelected: { fontWeight: '900' },
  userSelectedBadge: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  emptyWrap: { alignItems: 'center', paddingTop: 50, gap: 12 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
});

/* ═══════════════════════════════════════════════════════ */

export function WorkTemplateStationCreateScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateStationCreate'>) {
  const { templateId, day } = route.params;
  const [users, setUsers] = useState<UserLite[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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

  useFocusEffect(useCallback(() => { fetchUsers(); }, [fetchUsers]));

  const userById = useMemo(() => {
    const map = new Map<string, UserLite>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const customer = customerId ? userById.get(customerId) ?? null : null;
  const worker = workerId ? userById.get(workerId) ?? null : null;
  const allFilled = !!customerId && !!workerId && timeRegex.test(scheduledTime.trim());

  const save = async () => {
    const time = scheduledTime.trim();
    if (!customerId) return setError('יש לבחור לקוח לפני הוספת תחנה');
    if (!workerId) return setError('יש לבחור עובד לפני הוספת תחנה');
    if (!timeRegex.test(time)) return setError('יש להזין שעה בפורמט HH:mm (למשל 09:00)');

    try {
      setSaving(true);
      setError('');
      const maxRes = await supabase
        .from('template_stations')
        .select('"order"')
        .eq('template_id', templateId)
        .order('order', { ascending: false })
        .limit(1);
      if (maxRes.error) throw maxRes.error;
      const lastOrder = ((maxRes.data?.[0] as any)?.order as number | undefined) ?? 0;

      const { error: insErr } = await supabase.from('template_stations').insert({
        template_id: templateId,
        order: lastOrder + 1,
        scheduled_time: time,
        customer_id: customerId,
        worker_id: workerId,
      });
      if (insErr) throw insErr;

      Toast.show({ type: 'success', text1: 'תחנה נוספה בהצלחה' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הוספה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false} backgroundColor={colors.elevated}>
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
        {/* ─── Section: אנשים ─── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>שיוך אנשים</Text>
          <View style={s.card}>
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
                  onChangeText={(v) => { setScheduledTime(v); setError(''); }}
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

        {/* ─── Save ─── */}
        <Pressable onPress={save} disabled={saving} style={({ pressed }) => ({ opacity: saving ? 0.55 : pressed ? 0.88 : 1 })}>
          <View style={[s.saveBtnInner, !allFilled && !saving ? s.saveBtnDimmed : null]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={18} color="#fff" strokeWidth={2.5} />}
            <Text style={s.saveBtnText}>{saving ? 'מוסיף תחנה...' : 'הוסף תחנה'}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
  section: { marginBottom: 20 },
  sectionLabel: {
    color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'right',
    letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.elevated, borderRadius: 20, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden', elevation: 2,
  },
  personRow: {
    flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  personAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(37,99,235,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  personAvatarWorker: { backgroundColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.15)' },
  personInfo: { flex: 1, alignItems: 'flex-end' },
  personRole: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginBottom: 2 },
  personName: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  personNameEmpty: { color: '#94A3B8', fontWeight: '600' },
  selectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  selectedDotWorker: { backgroundColor: '#8B5CF6' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  timeRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 14, padding: 16 },
  timeIconWrap: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.16)', alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  timeInputWrap: { flex: 1 },
  timeInput: { backgroundColor: colors.bg, fontWeight: '900', fontSize: 18 },
  timeHelper: { color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 6 },
  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  saveBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16, elevation: 4,
  },
  saveBtnDimmed: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
});
