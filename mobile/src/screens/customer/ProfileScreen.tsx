import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';

type ServicePoint = {
  id: string;
  customer_id: string;
  device_type: string;
  scent_type: string;
  refill_amount: number;
  notes?: string | null;
};

type ScentRow = { id: string; name: string };

export function CustomerProfileScreen() {
  const { user } = useAuth();
  const [points, setPoints] = useState<ServicePoint[]>([]);
  const [scents, setScents] = useState<ScentRow[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<ServicePoint | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const scentOptions = useMemo(() => {
    const fromTable = scents.map((s) => ({ value: s.name, label: s.name }));
    if (fromTable.length) return fromTable;
    const unique = Array.from(new Set(points.map((p) => p.scent_type).filter(Boolean)));
    return unique.map((v) => ({ value: v, label: v }));
  }, [scents, points]);

  const fetchAll = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [{ data: sp, error: spErr }, { data: sc, error: scErr }] = await Promise.all([
        supabase
          .from('service_points')
          .select('id, customer_id, device_type, scent_type, refill_amount, notes')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('scents').select('id, name').order('name', { ascending: true }),
      ]);
      if (spErr) throw spErr;
      if (scErr) {
        // scents table may not exist yet; keep fallback options
        setScents([]);
      } else {
        setScents((sc ?? []) as ScentRow[]);
      }
      setPoints((sp ?? []) as ServicePoint[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const updateScent = async (newScent: string) => {
    if (!selectedPoint) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('service_points').update({ scent_type: newScent }).eq('id', selectedPoint.id);
      if (error) throw error;
      setPoints((prev) => prev.map((p) => (p.id === selectedPoint.id ? { ...p, scent_type: newScent } : p)));
      setSelectedPoint((prev) => (prev ? { ...prev, scent_type: newScent } : prev));
      Toast.show({ type: 'success', text1: 'עודכן' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchAll} />
        <View>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>פרופיל</Text>
          <Text style={{ color: colors.muted, textAlign: 'right' }}>{user?.name}</Text>
        </View>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>פרטי לקוח</Text>
          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
            טלפון: {user?.phone ?? '-'}{'\n'}
            כתובת: {user?.address ?? '-'}{'\n'}
            מחיר: {user?.price ?? '-'}
          </Text>
        </Card>

        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>נקודות שירות</Text>
        <FlatList
          data={points}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelectedPoint(item)}>
              <Card>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.device_type}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                  ניחוח: {item.scent_type} • מילוי: {item.refill_amount}
                </Text>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות שירות.</Text>}
        />
      </View>

      <ModalSheet visible={!!selectedPoint} onClose={() => setSelectedPoint(null)}>
        {!!selectedPoint && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              עריכת נקודת שירות
            </Text>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{selectedPoint.device_type}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                מילוי: {selectedPoint.refill_amount}
              </Text>
            </Card>
            <SelectSheet
              label="ניחוח"
              value={selectedPoint.scent_type}
              options={scentOptions.length ? scentOptions : [{ value: selectedPoint.scent_type, label: selectedPoint.scent_type }]}
              onChange={updateScent}
            />
            <Button title={saving ? 'שומר…' : 'סגור'} variant="secondary" onPress={() => setSelectedPoint(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

