import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
    const { data, error } = await supabase.from('users').select('id, name, role, avatar_url').in('role', ['customer', 'worker']).order('name');
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
      navigation.setOptions({ title: `עריכת תחנה #${row.order}` });
    }
  }, [navigation, route.params.customerId, route.params.scheduledTime, route.params.workerId, stationId]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
      fetchStation().catch((e: any) => Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' }));
    }, [fetchStation, fetchUsers])
  );

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

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
      Toast.show({ type: 'success', text1: 'עודכן' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    try {
      setDeleting(true);
      const { error } = await supabase.from('template_stations').delete().eq('id', stationId);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'נמחק' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>
          {station ? `עריכת תחנה #${station.order}` : 'עריכת תחנה'}
        </Text>
        <Button title="חזור" variant="secondary" fullWidth={false} onPress={() => navigation.goBack()} />
      </View>

      <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{`תבנית ${day}`}</Text>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <View style={{ gap: 10 }}>
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
              style={{
                backgroundColor: colors.elevated,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>לקוח</Text>
              <Text style={{ color: customerId ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
                {customerId ? userNameById.get(customerId) ?? '—' : 'בחר לקוח…'}
              </Text>
            </Pressable>

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
              style={{
                backgroundColor: colors.elevated,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>עובד</Text>
              <Text style={{ color: workerId ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
                {workerId ? userNameById.get(workerId) ?? '—' : 'בחר עובד…'}
              </Text>
            </Pressable>

            <Input
              label="שעה (HH:mm)"
              value={scheduledTime}
              onChangeText={(v) => {
                setScheduledTime(v);
                setError('');
              }}
              placeholder="09:00"
              inputMode="numeric"
            />

            {!!error && <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700', textAlign: 'right' }}>{error}</Text>}

            <Button title={saving ? 'שומר…' : 'שמור'} variant="primary" disabled={saving} onPress={save} />
            <Button title={deleting ? 'מוחק…' : 'מחק תחנה'} variant="danger" disabled={deleting} onPress={del} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

