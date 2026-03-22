import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pencil } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
    const { data, error } = await supabase.from('users').select('id, name, role, avatar_url').in('role', ['customer', 'worker']).order('name');
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
    <Screen>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{`תחנות בתבנית ${day}`}</Text>
          <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>הקצה לקוח+עובד לכל תחנה</Text>
        </View>
        <Button title="חזור" variant="secondary" fullWidth={false} onPress={() => navigation.goBack()} />
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Input label="חיפוש לפי לקוח או עובד" value={searchQuery} onChangeText={setSearchQuery} placeholder="חפש..." />
        <Button title="הוסף תחנה" variant="primary" onPress={() => navigation.navigate('WorkTemplateStationCreate', { templateId, day })} />
      </View>

      <View style={{ marginTop: 12, flex: 1 }}>
        <FlatList
          data={filteredStations}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
          refreshing={loading}
          onRefresh={refresh}
          renderItem={({ item }) => {
            const customer = item.customer_id ? userById.get(item.customer_id) ?? null : null;
            const worker = item.worker_id ? userById.get(item.worker_id) ?? null : null;
            const customerName = customer?.name ?? null;
            const workerName = worker?.name ?? null;
            return (
              <Card>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תחנה #{item.order}</Text>
                    <View style={{ marginTop: 10, flexDirection: 'row-reverse', gap: 10 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>לקוח</Text>
                        <View
                          style={{
                            backgroundColor: colors.elevated,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: 14,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <Avatar size={22} uri={customer?.avatar_url ?? null} name={customerName} style={{ backgroundColor: '#fff' }} />
                          <Text style={{ color: customerName ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', flex: 1 }} numberOfLines={1}>
                            {customerName ?? 'לא נבחר'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>עובד</Text>
                        <View
                          style={{
                            backgroundColor: colors.elevated,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: 14,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <Avatar size={22} uri={worker?.avatar_url ?? null} name={workerName} style={{ backgroundColor: '#fff' }} />
                          <Text style={{ color: workerName ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', flex: 1 }} numberOfLines={1}>
                            {workerName ?? 'לא נבחר'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(100,116,139,0.10)',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 12 }}>{item.scheduled_time}</Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`עריכת תחנה ${item.order}`}
                      onPress={() => navigation.navigate('WorkTemplateStationEdit', { templateId, day, stationId: item.id })}
                      style={({ pressed }) => ({
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? 'rgba(37, 99, 235, 0.16)' : 'rgba(37, 99, 235, 0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(37, 99, 235, 0.25)',
                      })}
                    >
                      <Pencil size={18} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין תחנות.</Text>}
        />
      </View>
    </Screen>
  );
}

