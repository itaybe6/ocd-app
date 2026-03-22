import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, Clock, MapPin, Plus, Search, User, Users } from 'lucide-react-native';
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
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 27, fontWeight: '900', textAlign: 'right', letterSpacing: -0.5 }}>
              תחנות בתבנית
            </Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <View style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>יום {day}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>
                {filteredStations.length} תחנות
              </Text>
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

        {/* Search */}
        <View style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: colors.elevated,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginTop: 14,
          gap: 10,
        }}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="חיפוש לפי לקוח או עובד..."
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              color: colors.text,
              textAlign: 'right',
              fontSize: 15,
              padding: 0,
            }}
          />
        </View>
      </View>

      {/* ─── List ─── */}
      <FlatList
        data={filteredStations}
        keyExtractor={(i) => i.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 120 }}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => {
          const customer = item.customer_id ? userById.get(item.customer_id) ?? null : null;
          const worker = item.worker_id ? userById.get(item.worker_id) ?? null : null;

          return (
            <Pressable
              accessibilityLabel={`עריכת תחנה ${item.order}`}
              onPress={() => navigation.navigate('WorkTemplateStationEdit', { templateId, day, stationId: item.id })}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#D1D5DB',
                overflow: 'hidden',
                opacity: pressed ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.10,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              {/* Card top row: station number + time */}
              <View style={{
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingTop: 13,
                paddingBottom: 11,
                borderBottomWidth: 1,
                borderBottomColor: '#E5E7EB',
              }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }}>
                  <View style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: 'rgba(37,99,235,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13 }}>{item.order}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                    תחנה #{item.order}
                  </Text>
                </View>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: 'rgba(15,23,42,0.06)',
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}>
                  <Clock size={13} color={colors.muted} />
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                    {item.scheduled_time}
                  </Text>
                </View>
              </View>

              {/* Customer row */}
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: '#E5E7EB',
              }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: customer ? '#22C55E' : '#D1D5DB',
                }} />
                <Avatar size={34} uri={customer?.avatar_url ?? null} name={customer?.name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'right' }}>
                    לקוח
                  </Text>
                  <Text
                    style={{ color: customer ? colors.text : colors.muted, fontWeight: '700', textAlign: 'right', marginTop: 1, fontSize: 14 }}
                    numberOfLines={1}
                  >
                    {customer?.name ?? 'לא נבחר'}
                  </Text>
                </View>
                <User size={16} color={colors.muted} style={{ opacity: 0.5 }} />
              </View>

              {/* Worker row */}
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 11,
              }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: worker ? '#8B5CF6' : '#D1D5DB',
                }} />
                <Avatar size={34} uri={worker?.avatar_url ?? null} name={worker?.name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'right' }}>
                    עובד
                  </Text>
                  <Text
                    style={{ color: worker ? colors.text : colors.muted, fontWeight: '700', textAlign: 'right', marginTop: 1, fontSize: 14 }}
                    numberOfLines={1}
                  >
                    {worker?.name ?? 'לא נבחר'}
                  </Text>
                </View>
                <Users size={16} color={colors.muted} style={{ opacity: 0.5 }} />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 14 }}>
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: 'rgba(37,99,235,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MapPin size={32} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, textAlign: 'center', fontSize: 17, fontWeight: '800' }}>
              אין תחנות עדיין
            </Text>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
              לחץ על הוסף תחנה כדי להתחיל
            </Text>
          </View>
        }
      />

      {/* ─── FAB ─── */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          bottom: 28,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 999,
        }}
      >
        <Pressable
          onPress={() => navigation.navigate('WorkTemplateStationCreate', { templateId, day })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingHorizontal: 24,
            paddingVertical: 16,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.45,
            shadowRadius: 20,
            elevation: 12,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Plus size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 }}>הוסף תחנה</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
