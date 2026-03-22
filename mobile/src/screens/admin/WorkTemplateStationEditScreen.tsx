import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Clock, Trash2, User, Users } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/ui/Avatar';
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
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'right', letterSpacing: -0.5 }}>
              {stationTitle}
            </Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <View style={{
                backgroundColor: 'rgba(37,99,235,0.10)',
                borderRadius: 20,
                paddingHorizontal: 11,
                paddingVertical: 4,
              }}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>יום {day}</Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: pressed ? colors.border : colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            })}
          >
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Pickers Card ─── */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: '#D1D5DB',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.10,
          shadowRadius: 8,
          elevation: 4,
        }}>
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
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
            })}
          >
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(37,99,235,0.10)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {customer ? (
                <Avatar size={38} uri={customer.avatar_url ?? null} name={customer.name} />
              ) : (
                <User size={18} color={colors.primary} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>לקוח</Text>
              <Text style={{
                color: customer ? colors.text : colors.muted,
                fontWeight: customer ? '700' : '500',
                textAlign: 'right',
                marginTop: 2,
                fontSize: 15,
              }}>
                {customer?.name ?? 'בחר לקוח...'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {customer && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
              )}
              <ChevronLeft size={18} color={colors.muted} />
            </View>
          </Pressable>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 16 }} />

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
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
            })}
          >
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(139,92,246,0.10)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {worker ? (
                <Avatar size={38} uri={worker.avatar_url ?? null} name={worker.name} />
              ) : (
                <Users size={18} color="#8B5CF6" />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>עובד</Text>
              <Text style={{
                color: worker ? colors.text : colors.muted,
                fontWeight: worker ? '700' : '500',
                textAlign: 'right',
                marginTop: 2,
                fontSize: 15,
              }}>
                {worker?.name ?? 'בחר עובד...'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {worker && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />
              )}
              <ChevronLeft size={18} color={colors.muted} />
            </View>
          </Pressable>
        </View>

        {/* ─── Time Card ─── */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: '#D1D5DB',
          paddingHorizontal: 16,
          paddingVertical: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.10,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(245,158,11,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Clock size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right', marginBottom: 6 }}>
                שעה מתוזמנת
              </Text>
              <TextInput
                value={scheduledTime}
                onChangeText={(v) => { setScheduledTime(v); setError(''); }}
                placeholder="09:00"
                placeholderTextColor={colors.muted}
                inputMode="numeric"
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: colors.text,
                  textAlign: 'right',
                  fontSize: 16,
                  fontWeight: '700',
                }}
              />
            </View>
          </View>
        </View>

        {/* ─── Error ─── */}
        {!!error && (
          <View style={{
            backgroundColor: 'rgba(220,38,38,0.08)',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(220,38,38,0.20)',
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}>
            <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>{error}</Text>
          </View>
        )}

        {/* ─── Save Button ─── */}
        <Pressable
          onPress={save}
          disabled={saving || deleting}
          style={({ pressed }) => ({
            backgroundColor: saving ? '#94A3B8' : colors.primary,
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
            {saving ? 'שומר...' : 'שמור שינויים'}
          </Text>
        </Pressable>

        {/* ─── Delete Button ─── */}
        <Pressable
          onPress={confirmDelete}
          disabled={saving || deleting}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(220,38,38,0.25)',
            backgroundColor: pressed ? 'rgba(220,38,38,0.06)' : 'rgba(220,38,38,0.04)',
            opacity: (saving || deleting) ? 0.5 : 1,
          })}
        >
          <Trash2 size={17} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 15 }}>
            {deleting ? 'מוחק...' : 'מחק תחנה'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
