import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ModalSheet } from '../../components/ModalSheet';
import { JobCard, JobChip } from '../../components/jobs/JobCard';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { toDate, yyyyMmDd } from '../../lib/time';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';
import { Calendar, Search, X } from 'lucide-react-native';

type Kind = 'installation' | 'special';
type Status = 'pending' | 'completed';

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  worker_id: string;
  order_number?: number | null;
  notes?: string | null;
  image_url?: string | null; // for special
};

type InstallationDevice = { id: string; installation_job_id: string; device_name?: string | null; image_url?: string | null };

const kindLabel = (k: Kind) => (k === 'installation' ? 'התקנה' : 'מיוחדת');

export function InstallationJobsScreen() {
  const { setIsLoading } = useLoading();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Unified[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [kindFilter, setKindFilter] = useState<'' | Kind>('');
  const [dateFilter, setDateFilter] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [selected, setSelected] = useState<Unified | null>(null);
  const [devices, setDevices] = useState<InstallationDevice[]>([]);

  const dateValue = useMemo(() => {
    if (!dateFilter) return new Date();
    const d = toDate(dateFilter);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [dateFilter]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [instRes, specRes] = await Promise.all([
        supabase.from('installation_jobs').select('id, date, status, worker_id, order_number, notes').order('date', { ascending: false }),
        supabase.from('special_jobs').select('id, date, status, worker_id, order_number, notes, image_url').order('date', { ascending: false }),
      ]);
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;
      const inst = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const spec = (specRes.data ?? []).map((r: any) => ({ kind: 'special', ...r }) as Unified);
      setItems([...inst, ...spec].sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (kindFilter && it.kind !== kindFilter) return false;
      if (statusFilter && it.status !== statusFilter) return false;
      if (dateFilter && yyyyMmDd(it.date) !== dateFilter) return false;
      if (!qq) return true;
      return it.id.toLowerCase().includes(qq) || String(it.order_number ?? '').includes(qq);
    });
  }, [items, q, kindFilter, statusFilter, dateFilter]);

  const open = async (it: Unified) => {
    setSelected(it);
    setDevices([]);
    if (it.kind !== 'installation') return;
    try {
      const { data, error } = await supabase
        .from('installation_devices')
        .select('id, installation_job_id, device_name, image_url')
        .eq('installation_job_id', it.id);
      if (error) throw error;
      setDevices((data ?? []) as InstallationDevice[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת מכשירים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const del = async (it: Unified) => {
    try {
      setIsLoading(true);
      if (it.kind === 'installation') {
        await supabase.from('installation_devices').delete().eq('installation_job_id', it.id);
        const { error } = await supabase.from('installation_jobs').delete().eq('id', it.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('special_jobs').delete().eq('id', it.id);
        if (error) throw error;
      }
      setItems((prev) => prev.filter((x) => !(x.kind === it.kind && x.id === it.id)));
      setSelected(null);
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen backgroundColor="#FAF9FE">
      <FlatList
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} />}
        style={{ marginTop: 8 }}
        data={filtered}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 12,
                borderWidth: 1,
                borderColor: 'rgba(60,60,67,0.12)',
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: 'rgba(118,118,128,0.12)',
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(60,60,67,0.08)',
                }}
              >
                <Search size={18} color="rgba(60,60,67,0.6)" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="חיפוש לפי מזהה / מספר הזמנה"
                  placeholderTextColor="rgba(60,60,67,0.6)"
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 16,
                    textAlign: 'right',
                    paddingVertical: 0,
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {!!q.trim() && (
                  <Pressable
                    onPress={() => setQ('')}
                    hitSlop={10}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(60,60,67,0.18)',
                    }}
                  >
                    <X size={16} color="rgba(60,60,67,0.8)" />
                  </Pressable>
                )}
              </View>

              <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right', marginBottom: 6 }}>סוג</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: 'rgba(118,118,128,0.12)',
                      borderRadius: 12,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: 'rgba(60,60,67,0.08)',
                    }}
                  >
                    {[
                      { value: '' as const, label: 'הכל' },
                      { value: 'installation' as const, label: 'התקנה' },
                      { value: 'special' as const, label: 'מיוחדת' },
                    ].map((opt) => {
                      const active = kindFilter === opt.value;
                      return (
                        <Pressable
                          key={opt.value || 'all'}
                          onPress={() => setKindFilter(opt.value)}
                          style={{
                            flex: 1,
                            borderRadius: 10,
                            paddingVertical: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: active ? '#FFFFFF' : 'transparent',
                            shadowColor: '#000',
                            shadowOpacity: active ? 0.08 : 0,
                            shadowRadius: active ? 6 : 0,
                            shadowOffset: { width: 0, height: 3 },
                            elevation: active ? 1 : 0,
                          }}
                        >
                          <Text style={{ color: active ? colors.text : 'rgba(60,60,67,0.8)', fontWeight: '800' }}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right', marginBottom: 6 }}>סטטוס</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: 'rgba(118,118,128,0.12)',
                      borderRadius: 12,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: 'rgba(60,60,67,0.08)',
                    }}
                  >
                    {[
                      { value: '' as const, label: 'הכל' },
                      { value: 'pending' as const, label: 'ממתין' },
                      { value: 'completed' as const, label: 'הושלם' },
                    ].map((opt) => {
                      const active = statusFilter === opt.value;
                      return (
                        <Pressable
                          key={opt.value || 'all'}
                          onPress={() => setStatusFilter(opt.value)}
                          style={{
                            flex: 1,
                            borderRadius: 10,
                            paddingVertical: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: active ? '#FFFFFF' : 'transparent',
                            shadowColor: '#000',
                            shadowOpacity: active ? 0.08 : 0,
                            shadowRadius: active ? 6 : 0,
                            shadowOffset: { width: 0, height: 3 },
                            elevation: active ? 1 : 0,
                          }}
                        >
                          <Text style={{ color: active ? colors.text : 'rgba(60,60,67,0.8)', fontWeight: '800' }}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={{ color: colors.muted, fontWeight: '700', textAlign: 'right', marginBottom: 6 }}>תאריך (אופציונלי)</Text>
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      DateTimePickerAndroid.open({
                        value: dateValue,
                        mode: 'date',
                        is24Hour: true,
                        onChange: (_event, selectedDate) => {
                          if (!selectedDate) return;
                          setDateFilter(yyyyMmDd(selectedDate));
                        },
                      });
                      return;
                    }
                    setDatePickerOpen(true);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: 'rgba(118,118,128,0.12)',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(60,60,67,0.08)',
                  }}
                >
                  <Calendar size={18} color="rgba(60,60,67,0.6)" />
                  <Text
                    style={{
                      flex: 1,
                      color: dateFilter ? colors.text : 'rgba(60,60,67,0.6)',
                      fontSize: 16,
                      fontWeight: '700',
                      textAlign: 'right',
                    }}
                  >
                    {dateFilter ? dateFilter : 'בחירת תאריך'}
                  </Text>
                  {!!dateFilter.trim() && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setDateFilter('');
                      }}
                      hitSlop={10}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(60,60,67,0.18)',
                      }}
                    >
                      <X size={16} color="rgba(60,60,67,0.8)" />
                    </Pressable>
                  )}
                </Pressable>
              </View>

              <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button title="נקה סינון" variant="secondary" fullWidth onPress={() => {
                    setQ('');
                    setDateFilter('');
                    setKindFilter('');
                    setStatusFilter('');
                  }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={loading ? 'טוען…' : 'רענון'} fullWidth onPress={fetchAll} />
                </View>
              </View>
            </View>

            <Text style={{ color: colors.muted, textAlign: 'right' }}>
              מציג {filtered.length} {filtered.length === 1 ? 'משימה' : 'משימות'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <JobCard
            title={`#${item.order_number ?? '—'} - ${kindLabel(item.kind)}`}
            status={item.status}
            description={item.notes ?? null}
            onPress={() => open(item)}
            faded={item.status === 'completed'}
            chips={
              <>
                <JobChip text={kindLabel(item.kind)} />
                <JobChip text={yyyyMmDd(item.date)} muted />
              </>
            }
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selected} onClose={() => setSelected(null)}>
        {!!selected && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button title="מחק" variant="danger" fullWidth={false} onPress={() => del(selected)} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
                {selected.kind} • #{selected.order_number ?? '—'}
              </Text>
            </View>

            {selected.kind === 'installation' ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>מכשירים</Text>
                {devices.length ? (
                  <View style={{ gap: 10 }}>
                    {devices.map((d) => (
                      <Card key={d.id}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{d.device_name ?? 'Device'}</Text>
                        {d.image_url ? (
                          <Image
                            source={{ uri: getPublicUrl(d.image_url) }}
                            style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 10 }}
                          />
                        ) : null}
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין מכשירים.</Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונה</Text>
                {selected.image_url ? (
                  <Card>
                    <Image source={{ uri: getPublicUrl(selected.image_url) }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                  </Card>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונה.</Text>
                )}
              </>
            )}

            <Button title="סגור" variant="secondary" onPress={() => setSelected(null)} />
          </View>
        )}
      </ModalSheet>

      <ModalSheet visible={datePickerOpen} onClose={() => setDatePickerOpen(false)}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button title="סגור" variant="secondary" fullWidth={false} onPress={() => setDatePickerOpen(false)} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>בחירת תאריך</Text>
          </View>

          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10 }}>
            <DateTimePicker
              value={dateValue}
              mode="date"
              display="inline"
              themeVariant="light"
              onChange={(_event, selectedDate) => {
                if (!selectedDate) return;
                setDateFilter(yyyyMmDd(selectedDate));
              }}
            />
          </View>

          {!!dateFilter && (
            <Button
              title="נקה תאריך"
              variant="secondary"
              onPress={() => {
                setDateFilter('');
                setDatePickerOpen(false);
              }}
            />
          )}
        </View>
      </ModalSheet>
    </Screen>
  );
}

