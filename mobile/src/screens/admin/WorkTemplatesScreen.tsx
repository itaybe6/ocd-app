import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';

type Template = { id: string; day_of_month: number };
type Station = { id: string; template_id: string; order: number; customer_id?: string | null; worker_id?: string | null; scheduled_time: string };
type UserLite = { id: string; name: string; role: 'customer' | 'worker' };

export function WorkTemplatesScreen() {
  const { setIsLoading } = useLoading();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);

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
    const { data, error } = await supabase.from('work_templates').select('id, day_of_month').order('day_of_month');
    if (error) throw error;
    const existing = (data ?? []) as Template[];
    const existingDays = new Set(existing.map((t) => t.day_of_month));
    const missing = Array.from({ length: 28 }, (_, i) => i + 1).filter((d) => !existingDays.has(d));
    if (missing.length) {
      const { error: insErr } = await supabase.from('work_templates').insert(missing.map((d) => ({ day_of_month: d })));
      if (insErr) throw insErr;
      const { data: again, error: againErr } = await supabase.from('work_templates').select('id, day_of_month').order('day_of_month');
      if (againErr) throw againErr;
      setTemplates((again ?? []) as Template[]);
      setSelectedTemplateId((again ?? [])[0]?.id ?? '');
      return;
    }
    setTemplates(existing);
    setSelectedTemplateId(existing[0]?.id ?? '');
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

  const refresh = async () => {
    try {
      setLoading(true);
      await Promise.all([ensureTemplates(), fetchUsers()]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) return;
    fetchStations(selectedTemplateId).catch((e: any) => Toast.show({ type: 'error', text1: 'טעינת תחנות נכשלה', text2: e?.message ?? 'Unknown error' }));
  }, [selectedTemplateId]);

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
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={refresh} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>תבניות עבודה</Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>בחר תבנית</Text>
          <SelectSheet
            label="יום בחודש (1..28)"
            value={selectedTemplateId}
            options={templates.map((t) => ({ value: t.id, label: String(t.day_of_month) }))}
            onChange={setSelectedTemplateId}
          />
          <View style={{ marginTop: 10 }}>
            <Button title="הוסף תחנה" variant="secondary" onPress={addStation} />
          </View>
        </Card>

        <FlatList
          data={stations}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => openEdit(item)}>
              <Card>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תחנה #{item.order}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                  שעה: {item.scheduled_time} • לקוח: {item.customer_id ?? '—'} • עובד: {item.worker_id ?? '—'}
                </Text>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין תחנות.</Text>}
        />
      </View>

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

