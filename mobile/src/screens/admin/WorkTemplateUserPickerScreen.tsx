import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronRight, Search, User, Users, X } from 'lucide-react-native';
import { Avatar } from '../../components/ui/Avatar';
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

  const isCustomer = kind === 'customer';
  const accentColor = isCustomer ? colors.primary : '#8B5CF6';
  const accentBg = isCustomer ? 'rgba(37,99,235,0.10)' : 'rgba(139,92,246,0.10)';

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, avatar_url')
        .eq('role', kind)
        .order('name');
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

  const title = isCustomer ? 'בחירת לקוח' : 'בחירת עובד';
  const placeholder = isCustomer ? 'חפש לקוח...' : 'חפש עובד...';
  const hasSelection = !!currentId;

  return (
    <Screen padded={false}>
      {/* ─── Header ─── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: accentBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isCustomer ? (
                  <User size={20} color={accentColor} />
                ) : (
                  <Users size={20} color={accentColor} />
                )}
              </View>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                {title}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '500', textAlign: 'right', marginTop: 5 }}>
              {filtered.length} תוצאות
            </Text>
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
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            autoFocus
            style={{
              flex: 1,
              color: colors.text,
              textAlign: 'right',
              fontSize: 15,
              padding: 0,
            }}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <X size={12} color="#fff" />
              </View>
            </Pressable>
          )}
        </View>

        {/* Clear selection row */}
        {hasSelection && (
          <Pressable
            onPress={() => goBackWithValue(null)}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: pressed ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.05)',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(220,38,38,0.15)',
            })}
          >
            <X size={15} color={colors.danger} />
            <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14 }}>
              {isCustomer ? 'נקה בחירת לקוח' : 'נקה בחירת עובד'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ─── List ─── */}
      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        refreshing={loading}
        onRefresh={refresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 30 }}
        renderItem={({ item: u }) => {
          const selected = (currentId ?? null) === u.id;
          return (
            <Pressable
              onPress={() => goBackWithValue(u.id)}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 14,
                backgroundColor: selected
                  ? (isCustomer ? 'rgba(37,99,235,0.08)' : 'rgba(139,92,246,0.08)')
                  : pressed
                  ? 'rgba(0,0,0,0.03)'
                  : colors.card,
                borderWidth: 1,
                borderColor: selected
                  ? (isCustomer ? 'rgba(37,99,235,0.30)' : 'rgba(139,92,246,0.30)')
                  : colors.border,
                borderRadius: 18,
                paddingVertical: 13,
                paddingHorizontal: 14,
                transform: [{ scale: pressed ? 0.99 : 1 }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: selected ? 0.06 : 0.03,
                shadowRadius: 4,
                elevation: selected ? 2 : 1,
              })}
            >
              {/* Checkmark or placeholder */}
              <View style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: selected ? accentColor : colors.bg,
                borderWidth: 1.5,
                borderColor: selected ? accentColor : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selected && <Check size={14} color="#fff" strokeWidth={3} />}
              </View>

              {/* Avatar */}
              <Avatar size={44} uri={u.avatar_url ?? null} name={u.name} />

              {/* Name */}
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: colors.text,
                  fontWeight: selected ? '900' : '700',
                  textAlign: 'right',
                  fontSize: 16,
                }}>
                  {u.name}
                </Text>
                {selected && (
                  <Text style={{
                    color: accentColor,
                    fontSize: 12,
                    fontWeight: '600',
                    textAlign: 'right',
                    marginTop: 2,
                  }}>
                    נבחר
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 50, gap: 12 }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: accentBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isCustomer ? <User size={28} color={accentColor} /> : <Users size={28} color={accentColor} />}
            </View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
              {query ? 'לא נמצאו תוצאות' : isCustomer ? 'אין לקוחות' : 'אין עובדים'}
            </Text>
            {!!query && (
              <Text style={{ color: colors.muted, fontSize: 13 }}>נסה לחפש בשם אחר</Text>
            )}
          </View>
        }
      />
    </Screen>
  );
}
