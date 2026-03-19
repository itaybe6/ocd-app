import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalDialog } from '../../components/ModalDialog';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { ensureWorkTemplates28, templateDay, type WorkTemplateLite } from '../../lib/workTemplates';
import { useLoading } from '../../state/LoadingContext';

type Template = { id: string; day: number };
type TemplateForGrid = { id: string; day: number };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type UserLite = { id: string; name: string; role: 'customer' | 'worker'; avatar_url?: string | null };
type DropdownKind = 'customer' | 'worker';

export function WorkTemplatesScreen() {
  const { setIsLoading } = useLoading();
  const [templateCandidates, setTemplateCandidates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ customerId: string | null; workerId: string | null; scheduledTime: string }>({
    customerId: null,
    workerId: null,
    scheduledTime: '09:00',
  });
  const [editError, setEditError] = useState('');
  const [pickerKind, setPickerKind] = useState<DropdownKind | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const customerOptions = useMemo(
    () => users.filter((u) => u.role === 'customer').map((u) => ({ value: u.id, label: u.name })),
    [users]
  );
  const workerOptions = useMemo(
    () => users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name })),
    [users]
  );

  const ensureTemplates = async () => {
    const { templates: raw } = await ensureWorkTemplates28();
    const normalized = (raw ?? [])
      .map((t: WorkTemplateLite) => ({ id: t.id, day: templateDay(t) }))
      .filter((t): t is Template => typeof t.day === 'number' && t.day >= 1 && t.day <= 28)
      .sort((a, b) => a.day - b.day);

    setTemplateCandidates(normalized);
    // don't auto-open any template; keep selection if user already picked
    setSelectedTemplateId((prev) => prev || '');
  };

  const fetchTemplateCounts = async (templateIds: string[]) => {
    if (!templateIds.length) return;
    const { data, error } = await supabase.from('template_stations').select('template_id').in('template_id', templateIds);
    if (error) return;
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
      const tid = row.template_id as string | undefined;
      if (!tid) continue;
      counts[tid] = (counts[tid] ?? 0) + 1;
    }
    setTemplateCounts(counts);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('id, name, role, avatar_url').in('role', ['customer', 'worker']).order('name');
    if (!error) setUsers((data ?? []) as any);
  };

  const fetchStations = async (templateId: string) => {
    const { data, error } = await supabase
      .from('template_stations')
      .select('id, template_id, "order", customer_id, worker_id, scheduled_time')
      .eq('template_id', templateId)
      .order('order', { ascending: true });
    if (error) throw error;
    const list = (data ?? []) as any as Station[];
    setStations(list);
    setEditingStationId(null);
    setPickerKind(null);
    setPickerQuery('');
    setEditError('');
  };

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([ensureTemplates(), fetchUsers()]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!selectedTemplateId) return;
    fetchStations(selectedTemplateId).catch((e: any) => Toast.show({ type: 'error', text1: 'טעינת תחנות נכשלה', text2: e?.message ?? 'Unknown error' }));
  }, [selectedTemplateId]);

  useEffect(() => {
    fetchTemplateCounts(templateCandidates.map((t) => t.id)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateCandidates.length]);

  const templatesForGrid: TemplateForGrid[] = useMemo(() => {
    // Deduplicate by day (1..28). If multiple templates exist for same day, pick the one with most stations.
    // Tie-breaker: lowest id to keep stable.
    const best = new Map<number, TemplateForGrid>();
    for (const t of templateCandidates) {
      const current = best.get(t.day);
      if (!current) {
        best.set(t.day, { id: t.id, day: t.day });
        continue;
      }
      const cCount = templateCounts[current.id] ?? 0;
      const tCount = templateCounts[t.id] ?? 0;
      if (tCount > cCount) {
        best.set(t.day, { id: t.id, day: t.day });
      } else if (tCount === cCount && String(t.id) < String(current.id)) {
        best.set(t.day, { id: t.id, day: t.day });
      }
    }
    return Array.from(best.values()).sort((a, b) => a.day - b.day);
  }, [templateCandidates, templateCounts]);

  const selectedDay = useMemo(
    () => templateCandidates.find((t) => t.id === selectedTemplateId)?.day ?? null,
    [selectedTemplateId, templateCandidates]
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

  const updateStation = async (stationId: string, updates: Partial<Station>) => {
    const before = stations;
    setStations((prev) => prev.map((s) => (s.id === stationId ? { ...s, ...updates } : s)));
    const { error } = await supabase.from('template_stations').update(updates).eq('id', stationId);
    if (error) {
      setStations(before);
      throw error;
    }
  };

  const addStation = async () => {
    if (!selectedTemplateId) return;
    try {
      setIsLoading(true);
      const nextOrder = (stations[stations.length - 1]?.order ?? 0) + 1;
      const { error } = await supabase.from('template_stations').insert({
        template_id: selectedTemplateId,
        order: nextOrder,
        scheduled_time: '09:00',
        customer_id: null,
        worker_id: null,
      });
      if (error) throw error;
      await fetchStations(selectedTemplateId);
      setTemplateCounts((prev) => ({ ...prev, [selectedTemplateId]: (prev[selectedTemplateId] ?? 0) + 1 }));
      Toast.show({ type: 'success', text1: 'נוספה תחנה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הוספה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteStation = async (s: Station) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.from('template_stations').delete().eq('id', s.id);
      if (error) throw error;
      await fetchStations(s.template_id);
      setTemplateCounts((prev) => ({ ...prev, [s.template_id]: Math.max(0, (prev[s.template_id] ?? 0) - 1) }));
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const openTemplate = (t: Template) => {
    setSelectedTemplateId(t.id);
    setSearchQuery('');
    setDetailOpen(true);
  };

  const editingStation = useMemo(
    () => (editingStationId ? stations.find((s) => s.id === editingStationId) ?? null : null),
    [editingStationId, stations]
  );

  const pickerUsers = useMemo(() => {
    const base = pickerKind === 'worker' ? users.filter((u) => u.role === 'worker') : users.filter((u) => u.role === 'customer');
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => (u.name ?? '').toLowerCase().includes(q));
  }, [pickerKind, pickerQuery, users]);

  const openStationEditor = (s: Station) => {
    setEditingStationId(s.id);
    setEditForm({
      customerId: s.customer_id ?? null,
      workerId: s.worker_id ?? null,
      scheduledTime: (s.scheduled_time ?? '09:00').trim() || '09:00',
    });
    setEditError('');
    setPickerKind(null);
    setPickerQuery('');
  };

  const saveEditingStation = async () => {
    if (!editingStation) return;
    const value = editForm.scheduledTime.trim();
    const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
    if (!isValid) {
      setEditError('יש להזין שעה בפורמט HH:mm (למשל 09:00)');
      return;
    }

    try {
      setIsLoading(true);
      await updateStation(editingStation.id, {
        customer_id: editForm.customerId,
        worker_id: editForm.workerId,
        scheduled_time: value,
      });
      Toast.show({ type: 'success', text1: 'עודכן' });
      setEditingStationId(null);
      setPickerKind(null);
      setPickerQuery('');
      setEditError('');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View>
        <FlatList
          data={templatesForGrid}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const count = templateCounts[item.id] ?? 0;
            return (
              <Pressable style={{ flex: 1 }} onPress={() => openTemplate(item)}>
                {({ pressed }) => (
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 14,
                      minHeight: 92,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.06,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>{item.day}</Text>
                      <View
                        style={{
                          backgroundColor: 'rgba(37, 99, 235, 0.10)',
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 12 }}>{count} תחנות</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'right' }}>תבנית {item.day}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>

      <ModalDialog
        visible={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setEditingStationId(null);
          setPickerKind(null);
          setPickerQuery('');
          setEditError('');
        }}
        containerStyle={{ height: '88%' }}
      >
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>
              {selectedDay != null ? `תחנות בתבנית ${selectedDay}` : 'תחנות בתבנית'}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>הקצה לקוח+עובד לכל תחנה</Text>
          </View>
          <Button title="סגור" variant="secondary" fullWidth={false} onPress={() => setDetailOpen(false)} />
        </View>

        <View style={{ marginTop: 12, gap: 10 }}>
          <Input label="חיפוש לפי לקוח או עובד" value={searchQuery} onChangeText={setSearchQuery} placeholder="חפש..." />
          <Button title="הוסף תחנה" variant="primary" onPress={addStation} />
        </View>

        <View style={{ marginTop: 12, flex: 1 }}>
          <FlatList
            data={filteredStations}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
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
                        onPress={() => openStationEditor(item)}
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
      </ModalDialog>

      <ModalDialog
        visible={!!editingStationId}
        onClose={() => {
          setEditingStationId(null);
          setPickerKind(null);
          setPickerQuery('');
          setEditError('');
        }}
        containerStyle={{ height: '78%' }}
      >
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
            {editingStation ? `עריכת תחנה #${editingStation.order}` : 'עריכת תחנה'}
          </Text>
          <Pressable
            accessibilityLabel="סגור"
            onPress={() => {
              setEditingStationId(null);
              setPickerKind(null);
              setPickerQuery('');
              setEditError('');
            }}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(100,116,139,0.18)' : 'rgba(100,116,139,0.10)',
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <X size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ marginTop: 12, gap: 10 }}>
          <Pressable
            onPress={() => {
              setPickerKind('customer');
              setPickerQuery('');
            }}
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
            <Text style={{ color: editForm.customerId ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
              {editForm.customerId ? userNameById.get(editForm.customerId) ?? '—' : 'בחר לקוח…'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPickerKind('worker');
              setPickerQuery('');
            }}
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
            <Text style={{ color: editForm.workerId ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
              {editForm.workerId ? userNameById.get(editForm.workerId) ?? '—' : 'בחר עובד…'}
            </Text>
          </Pressable>

          <Input
            label="שעה (HH:mm)"
            value={editForm.scheduledTime}
            onChangeText={(v) => {
              setEditForm((prev) => ({ ...prev, scheduledTime: v }));
              setEditError('');
            }}
            placeholder="09:00"
            inputMode="numeric"
          />
          {!!editError && <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700', textAlign: 'right' }}>{editError}</Text>}

          <Button title="שמור" variant="primary" onPress={saveEditingStation} />
          <Button
            title="מחק תחנה"
            variant="danger"
            onPress={async () => {
              if (!editingStation) return;
              const toDelete = editingStation;
              setEditingStationId(null);
              setPickerKind(null);
              setPickerQuery('');
              setEditError('');
              await deleteStation(toDelete);
            }}
          />
        </View>
      </ModalDialog>

      <ModalDialog
        visible={pickerKind !== null}
        onClose={() => {
          setPickerKind(null);
          setPickerQuery('');
        }}
        containerStyle={{ height: '78%' }}
      >
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
            {pickerKind === 'worker' ? 'בחר עובד' : 'בחר לקוח'}
          </Text>
          <Pressable
            accessibilityLabel="סגור"
            onPress={() => {
              setPickerKind(null);
              setPickerQuery('');
            }}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(100,116,139,0.18)' : 'rgba(100,116,139,0.10)',
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <X size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ marginTop: 12, gap: 10, flex: 1 }}>
          <Input
            value={pickerQuery}
            onChangeText={setPickerQuery}
            placeholder={pickerKind === 'worker' ? 'חפש עובד…' : 'חפש לקוח…'}
          />

          <Pressable
            onPress={() => {
              setEditForm((prev) => ({ ...prev, [pickerKind === 'worker' ? 'workerId' : 'customerId']: null } as any));
              setPickerKind(null);
              setPickerQuery('');
            }}
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '900' }}>{pickerKind === 'worker' ? 'נקה עובד' : 'נקה לקוח'}</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <FlatList
              data={pickerUsers}
              keyExtractor={(u) => u.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
              renderItem={({ item: u }) => {
                const selectedId = pickerKind === 'worker' ? editForm.workerId : editForm.customerId;
                const selected = selectedId === u.id;
                return (
                  <Pressable
                    onPress={() => {
                      setEditForm((prev) => ({ ...prev, [pickerKind === 'worker' ? 'workerId' : 'customerId']: u.id } as any));
                      setPickerKind(null);
                      setPickerQuery('');
                    }}
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
        </View>
      </ModalDialog>
    </Screen>
  );
}

