import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { ModalDialog } from '../../components/ModalDialog';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { ensureWorkTemplates28, templateDay, type WorkTemplateLite } from '../../lib/workTemplates';
import { useLoading } from '../../state/LoadingContext';

type Template = { id: string; day: number };
type TemplateForGrid = { id: string; day: number };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type UserLite = { id: string; name: string; role: 'customer' | 'worker' };

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

  const [editStation, setEditStation] = useState<Station | null>(null);
  const [stationCustomerId, setStationCustomerId] = useState('');
  const [stationWorkerId, setStationWorkerId] = useState('');
  const [stationTime, setStationTime] = useState('09:00');

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
    const { data, error } = await supabase.from('users').select('id, name, role').in('role', ['customer', 'worker']).order('name');
    if (!error) setUsers((data ?? []) as any);
  };

  const fetchStations = async (templateId: string) => {
    const { data, error } = await supabase
      .from('template_stations')
      .select('id, template_id, "order", customer_id, worker_id, scheduled_time')
      .eq('template_id', templateId)
      .order('order', { ascending: true });
    if (error) throw error;
    setStations((data ?? []) as any);
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

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => {
      const customer = (s.customer_id ? userNameById.get(s.customer_id) : '') ?? '';
      const worker = (s.worker_id ? userNameById.get(s.worker_id) : '') ?? '';
      return customer.toLowerCase().includes(q) || worker.toLowerCase().includes(q);
    });
  }, [searchQuery, stations, userNameById]);

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

  const openEdit = (s: Station) => {
    setEditStation(s);
    setStationCustomerId(s.customer_id ?? '');
    setStationWorkerId(s.worker_id ?? '');
    setStationTime(s.scheduled_time ?? '09:00');
  };

  const saveStation = async () => {
    if (!editStation) return;
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('template_stations')
        .update({
          customer_id: stationCustomerId || null,
          worker_id: stationWorkerId || null,
          scheduled_time: stationTime.trim() || '09:00',
        })
        .eq('id', editStation.id);
      if (error) throw error;
      setEditStation(null);
      await fetchStations(editStation.template_id);
      Toast.show({ type: 'success', text1: 'עודכן' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
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

  return (
    <Screen>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'right' }}>בחירת תבנית</Text>
          <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>לחץ על יום בחודש כדי לערוך תחנות</Text>
        </View>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} variant="secondary" onPress={refresh} />
      </View>

      <View style={{ marginTop: 12 }}>
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
          setEditStation(null);
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
              const customerName = item.customer_id ? userNameById.get(item.customer_id) : null;
              const workerName = item.worker_id ? userNameById.get(item.worker_id) : null;
              return (
                <Pressable onPress={() => openEdit(item)}>
                  {({ pressed }) => (
                    <Card style={{ transform: [{ scale: pressed ? 0.99 : 1 }] }}>
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תחנה #{item.order}</Text>
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
                      </View>
                      <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
                        לקוח: {customerName ?? '—'} • עובד: {workerName ?? '—'}
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right', fontSize: 12 }}>
                        לחץ לעריכה
                      </Text>
                    </Card>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין תחנות.</Text>}
          />
        </View>
      </ModalDialog>

      <ModalSheet visible={!!editStation} onClose={() => setEditStation(null)}>
        {!!editStation && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              עריכת תחנה #{editStation.order}
            </Text>
            <SelectSheet label="לקוח" value={stationCustomerId} placeholder="בחר לקוח…" options={customerOptions} onChange={setStationCustomerId} />
            <SelectSheet label="עובד" value={stationWorkerId} placeholder="בחר עובד…" options={workerOptions} onChange={setStationWorkerId} />
            <Input label="שעה (HH:mm)" value={stationTime} onChangeText={setStationTime} placeholder="09:00" />
            <Button title="שמור" onPress={saveStation} />
            <Button title="מחק תחנה" variant="danger" onPress={() => deleteStation(editStation)} />
            <Button title="סגור" variant="secondary" onPress={() => setEditStation(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

