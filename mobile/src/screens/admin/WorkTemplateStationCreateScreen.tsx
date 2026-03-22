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

type UserLite = { id: string; name: string; role: 'customer' | 'worker'; avatar_url?: string | null };

export function WorkTemplateStationCreateScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateStationCreate'>) {
  const { templateId, day } = route.params;
  const [users, setUsers] = useState<UserLite[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(route.params.customerId ?? null);
  const [workerId, setWorkerId] = useState<string | null>(route.params.workerId ?? null);
  const [scheduledTime, setScheduledTime] = useState(route.params.scheduledTime ?? '09:00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const save = async () => {
    const time = scheduledTime.trim();
    if (!customerId) return setError('בחר לקוח לפני שמוסיפים תחנה');
    if (!workerId) return setError('בחר עובד לפני שמוסיפים תחנה');
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
      const nextOrder = lastOrder + 1;

      const { error: insErr } = await supabase.from('template_stations').insert({
        template_id: templateId,
        order: nextOrder,
        scheduled_time: time,
        customer_id: customerId,
        worker_id: workerId,
      });
      if (insErr) throw insErr;

      Toast.show({ type: 'success', text1: 'נוספה תחנה' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הוספה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>הוספת תחנה</Text>
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
                  target: 'create',
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
                  target: 'create',
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

            <Button title={saving ? 'שומר…' : 'הוסף תחנה'} variant="primary" disabled={saving} onPress={save} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

