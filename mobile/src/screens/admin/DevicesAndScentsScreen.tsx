import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';

type Device = { id: string; name: string; refill_amount: number; created_at?: string };
type Scent = { id: string; name: string; created_at?: string };

export function DevicesAndScentsScreen() {
  const { setIsLoading } = useLoading();
  const [devices, setDevices] = useState<Device[]>([]);
  const [scents, setScents] = useState<Scent[]>([]);
  const [loading, setLoading] = useState(false);

  const [deviceName, setDeviceName] = useState('');
  const [deviceRefill, setDeviceRefill] = useState('');
  const [scentName, setScentName] = useState('');

  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const [deviceUsageCount, setDeviceUsageCount] = useState<number | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [dRes, sRes] = await Promise.all([
        supabase.from('devices').select('id, name, refill_amount, created_at').order('name', { ascending: true }),
        supabase.from('scents').select('id, name, created_at').order('name', { ascending: true }),
      ]);
      if (dRes.error) throw dRes.error;
      if (sRes.error) throw sRes.error;
      setDevices((dRes.data ?? []) as Device[]);
      setScents((sRes.data ?? []) as Scent[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const addDevice = async () => {
    const name = deviceName.trim();
    const refill_amount = Number(deviceRefill);
    if (!name || !refill_amount) {
      Toast.show({ type: 'error', text1: 'חסר שם/כמות מילוי' });
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabase.from('devices').insert({ name, refill_amount });
      if (error) throw error;
      setDeviceName('');
      setDeviceRefill('');
      Toast.show({ type: 'success', text1: 'נוסף מכשיר' });
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הוספה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const addScent = async () => {
    const name = scentName.trim();
    if (!name) {
      Toast.show({ type: 'error', text1: 'חסר שם ניחוח' });
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabase.from('scents').insert({ name });
      if (error) throw error;
      setScentName('');
      Toast.show({ type: 'success', text1: 'נוסף ניחוח' });
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הוספה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const requestDeleteDevice = async (d: Device) => {
    setDeleteDevice(d);
    setDeviceUsageCount(null);
    try {
      const { count, error } = await supabase
        .from('service_points')
        .select('id', { count: 'exact', head: true })
        .eq('device_type', d.name);
      if (error) throw error;
      setDeviceUsageCount(count ?? 0);
    } catch {
      setDeviceUsageCount(null);
    }
  };

  const confirmDeleteDevice = async (mode: 'deviceOnly' | 'cascade') => {
    if (!deleteDevice) return;
    try {
      setIsLoading(true);
      if (mode === 'cascade') {
        const { error: spErr } = await supabase.from('service_points').delete().eq('device_type', deleteDevice.name);
        if (spErr) throw spErr;
      }
      const { error } = await supabase.from('devices').delete().eq('id', deleteDevice.id);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'נמחק' });
      setDeleteDevice(null);
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteScent = async (id: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.from('scents').delete().eq('id', id);
      if (error) throw error;
      setScents((prev) => prev.filter((s) => s.id !== id));
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const devicesHeader = useMemo(
    () => (
      <Card>
        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>מכשירים</Text>
        <View style={{ gap: 10 }}>
          <Input label="שם מכשיר" value={deviceName} onChangeText={setDeviceName} placeholder="Device name" />
          <Input label="כמות מילוי" value={deviceRefill} onChangeText={setDeviceRefill} keyboardType="numeric" placeholder="100" />
          <Button title="הוסף מכשיר" onPress={addDevice} />
        </View>
      </Card>
    ),
    [deviceName, deviceRefill]
  );

  const scentsHeader = useMemo(
    () => (
      <Card>
        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>ניחוחות</Text>
        <View style={{ gap: 10 }}>
          <Input label="שם ניחוח" value={scentName} onChangeText={setScentName} placeholder="Scent name" />
          <Button title="הוסף ניחוח" onPress={addScent} />
        </View>
      </Card>
    ),
    [scentName]
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchAll} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>מכשירים וניחוחות</Text>
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={devices}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        ListHeaderComponent={devicesHeader}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={() => requestDeleteDevice(item)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: colors.danger, fontWeight: '900' }}>מחק</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>מילוי: {item.refill_amount}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין מכשירים.</Text>}
      />

      <FlatList
        data={scents}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListHeaderComponent={scentsHeader}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={() => deleteScent(item.id)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: colors.danger, fontWeight: '900' }}>מחק</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1 }}>{item.name}</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין ניחוחות.</Text>}
      />

      <ModalSheet visible={!!deleteDevice} onClose={() => setDeleteDevice(null)}>
        {!!deleteDevice && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>מחיקת מכשיר</Text>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>
              מכשיר: {deleteDevice.name}
              {deviceUsageCount != null ? `\nבשימוש ב-${deviceUsageCount} נקודות שירות.` : ''}
            </Text>
            <Button title="מחק רק מכשיר" variant="danger" onPress={() => confirmDeleteDevice('deviceOnly')} />
            <Button title="מחק כולל נקודות שירות" variant="danger" onPress={() => confirmDeleteDevice('cascade')} />
            <Button title="ביטול" variant="secondary" onPress={() => setDeleteDevice(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

