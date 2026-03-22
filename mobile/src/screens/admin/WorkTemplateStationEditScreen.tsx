import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Clock, Trash2, User, Users } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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

export function WorkTemplateStationEditScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateStationEdit'>) {
  const { templateId, day, stationId } = route.params;
  const [station, setStation] = useState<StationRow | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(route.params.customerId ?? null);
  const [workerId, setWorkerId] = useState<string | null>(route.params.workerId ?? null);
  const [scheduledTime, setScheduledTime] = useState(route.params.scheduledTime ?? '09:00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timeRegex = useMemo(() => /^([01]\d|2[0-3]):([0-5]\d)$/, []);

  useEffect(() => {
    if (route.params.customerId !== undefined) setCustomerId(route.params.customerId ?? null);
  }, [route.params.customerId]);

  useEffect(() => {
    if (route.params.workerId !== undefined) setWorkerId(route.params.workerId ?? null);
  }, [route.params.workerId]);

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
      setCustomerId((prev) => (route.params.customerId !== undefined ? prev : row.customer_id ?? null));
      setWorkerId((prev) => (route.params.workerId !== undefined ? prev : row.worker_id ?? null));
      setScheduledTime((prev) => (route.params.scheduledTime !== undefined ? prev : (row.scheduled_time ?? '09:00').trim() || '09:00'));
    }
  }, [route.params.customerId, route.params.scheduledTime, route.params.workerId, stationId]);

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
    Alert.alert(
      'מחיקת תחנה',
      `האם למחוק את תחנה #${station?.order ?? ''}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: del },
      ]
    );
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

  const stationTitle = station ? `עריכת תחנה #${station.order}` : 'עריכת תחנה';

  return (
    <Screen padded={false}>
      {/* ─── Header ─── */}
      <View style={s.headerWrap}>
        <Text style={s.title}>{stationTitle}</Text>
        <View style={s.headerMetaRow}>
          <View style={s.metaPill}>
            <Text style={s.metaPillText}>יום {day}</Text>
          </View>
          {station?.order ? (
            <View style={[s.metaPill, s.metaPillNeutral]}>
              <Text style={[s.metaPillText, s.metaPillTextNeutral]}>תחנה #{station.order}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {!station ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator />
            <Text style={s.loadingText}>טוען תחנה…</Text>
          </Card>
        ) : null}

        {/* ─── Pickers Card ─── */}
        <Card style={s.cardNoPad}>
          {/* Customer picker */}
          <Pressable
            onPress={() =>
              navigation.navigate('WorkTemplateUserPicker', {
                kind: 'customer',
                templateId,
                day,
                target: 'edit',
                stationId,
                currentId: customerId,
              })
            }
            style={({ pressed }) => [s.pickerRow, pressed && s.pickerRowPressed]}
          >
            {customer ? (
              <Avatar size={38} uri={customer.avatar_url ?? null} name={customer.name} />
            ) : (
              <View style={s.pickerIconCircle}>
                <User size={18} color={colors.muted} />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={s.pickerLabel}>לקוח</Text>
              <Text style={[s.pickerValue, !customer && s.pickerValuePlaceholder]} numberOfLines={1}>
                {customer?.name ?? 'בחר לקוח…'}
              </Text>
            </View>

            <ChevronLeft size={18} color={colors.muted} />
          </Pressable>

          {/* Divider */}
          <View style={s.inlineDivider} />

          {/* Worker picker */}
          <Pressable
            onPress={() =>
              navigation.navigate('WorkTemplateUserPicker', {
                kind: 'worker',
                templateId,
                day,
                target: 'edit',
                stationId,
                currentId: workerId,
              })
            }
            style={({ pressed }) => [s.pickerRow, pressed && s.pickerRowPressed]}
          >
            {worker ? (
              <Avatar size={38} uri={worker.avatar_url ?? null} name={worker.name} />
            ) : (
              <View style={s.pickerIconCircle}>
                <Users size={18} color={colors.muted} />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={s.pickerLabel}>עובד</Text>
              <Text style={[s.pickerValue, !worker && s.pickerValuePlaceholder]} numberOfLines={1}>
                {worker?.name ?? 'בחר עובד…'}
              </Text>
            </View>

            <ChevronLeft size={18} color={colors.muted} />
          </Pressable>
        </Card>

        {/* ─── Time Card ─── */}
        <Card>
          <View style={s.timeRow}>
            <View style={s.timeIconCircle}>
              <Clock size={18} color={colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
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
              <Text style={s.helperText}>פורמט: HH:mm (למשל 09:00)</Text>
            </View>
          </View>
        </Card>

        {/* ─── Error ─── */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ─── Actions ─── */}
        <View style={s.actionsWrap}>
          <Button
            title={saving ? 'שומר…' : 'שמור שינויים'}
            onPress={save}
            disabled={saving || deleting}
          />

          <Pressable
            onPress={confirmDelete}
            disabled={saving || deleting}
            style={({ pressed }) => ({ opacity: saving || deleting ? 0.55 : pressed ? 0.88 : 1 })}
          >
            <View style={s.deleteOutlineBtn}>
              <Trash2 size={17} color={colors.danger} />
              <Text style={s.deleteOutlineText}>{deleting ? 'מוחק…' : 'מחק תחנה'}</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: colors.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  headerMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metaPill: {
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  metaPillNeutral: {
    backgroundColor: '#0F172A08',
    borderWidth: 1,
    borderColor: '#0F172A12',
  },
  metaPillText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 12,
  },
  metaPillTextNeutral: {
    color: colors.text,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  loadingCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '800',
  },
  cardNoPad: {
    padding: 0,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerRowPressed: {
    backgroundColor: '#0F172A06',
  },
  pickerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F172A08',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0F172A10',
  },
  pickerLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  pickerValue: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 2,
    fontSize: 15,
  },
  pickerValuePlaceholder: {
    color: colors.muted,
    fontWeight: '700',
  },
  inlineDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  timeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  timeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F172A08',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0F172A10',
    marginTop: 18,
  },
  timeInput: {
    backgroundColor: colors.bg,
    fontWeight: '900',
    fontSize: 16,
  },
  helperText: {
    marginTop: 8,
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'right',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  actionsWrap: {
    gap: 10,
    paddingTop: 4,
  },
  deleteOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
  },
  deleteOutlineText: {
    color: colors.danger,
    fontWeight: '900',
    fontSize: 15,
  },
});
