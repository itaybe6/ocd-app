import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { WorkTemplatesStackParamList } from '../../navigation/workTemplatesTypes';

type UserLite = { id: string; name: string; role: 'customer' | 'worker'; avatar_url?: string | null };

export function WorkTemplateUserPickerScreen({
  navigation,
  route,
}: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplateUserPicker'>) {
  const { kind, templateId, day, target, stationId, currentId } = route.params;
  const [users, setUsers] = useState<UserLite[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('users').select('id, name, role, avatar_url').eq('role', kind).order('name');
      if (error) throw error;
      setUsers((data ?? []) as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.name ?? '').toLowerCase().includes(q));
  }, [query, users]);

  const goBackWithValue = (value: string | null) => {
    const params =
      target === 'create'
        ? ({
            templateId,
            day,
            ...(kind === 'customer' ? { customerId: value } : { workerId: value }),
          } as const)
        : ({
            templateId,
            day,
            stationId: stationId!,
            ...(kind === 'customer' ? { customerId: value } : { workerId: value }),
          } as const);

    navigation.navigate({
      name: target === 'create' ? 'WorkTemplateStationCreate' : 'WorkTemplateStationEdit',
      params: params as any,
      merge: true,
    } as any);
    navigation.goBack();
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{kind === 'worker' ? 'בחירת עובד' : 'בחירת לקוח'}</Text>
        <Button title="חזור" variant="secondary" fullWidth={false} onPress={() => navigation.goBack()} />
      </View>

      <View style={{ marginTop: 12, gap: 10, flex: 1 }}>
        <Input value={query} onChangeText={setQuery} placeholder={kind === 'worker' ? 'חפש עובד…' : 'חפש לקוח…'} />

        <Button
          title={kind === 'worker' ? 'נקה עובד' : 'נקה לקוח'}
          variant="secondary"
          onPress={() => goBackWithValue(null)}
        />

        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          refreshing={loading}
          onRefresh={refresh}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
          renderItem={({ item: u }) => {
            const selected = (currentId ?? null) === u.id;
            return (
              <Pressable
                onPress={() => goBackWithValue(u.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? 'rgba(37, 99, 235, 0.12)' : colors.elevated,
                  borderColor: selected ? 'rgba(37, 99, 235, 0.35)' : colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <Avatar size={28} uri={u.avatar_url ?? null} name={u.name} style={{ backgroundColor: '#fff' }} />
                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1 }}>{u.name}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין תוצאות.</Text>}
        />
      </View>
    </Screen>
  );
}

