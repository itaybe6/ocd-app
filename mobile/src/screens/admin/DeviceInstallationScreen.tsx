import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';

type UserLite = { id: string; name: string; role: 'worker' | 'customer' };

function combine(dateYmd: string, timeHm: string): string {
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time');
  return d.toISOString();
}

export function DeviceInstallationScreen() {
  const { setIsLoading } = useLoading();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [workerId, setWorkerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const workerOptions = useMemo(() => users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name })), [users]);
  const customerOptions = useMemo(() => users.filter((u) => u.role === 'customer').map((u) => ({ value: u.id, label: u.name })), [users]);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('id, name, role').in('role', ['worker', 'customer']).order('name');
    if (!error) setUsers((data ?? []) as any);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  const create = async () => {
    try {
      if (!workerId) throw new Error('בחר עובד');
      if (!customerId) throw new Error('בחר לקוח');
      if (!date.trim()) throw new Error('הכנס תאריך yyyy-MM-dd');
      const iso = combine(date.trim(), time.trim());
      setIsLoading(true);
      const { error } = await supabase.from('installation_jobs').insert({
        worker_id: workerId,
        customer_id: customerId,
        date: iso,
        status: 'pending',
        notes: notes.trim() || null,
      });
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'נוצרה משימת התקנה' });
      setNotes('');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'יצירה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title="צור" fullWidth={false} onPress={create} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>התקנת מכשירים</Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>יצירת משימת התקנה</Text>
          <View style={{ gap: 10 }}>
            <SelectSheet label="עובד" value={workerId} placeholder="בחר עובד…" options={workerOptions} onChange={setWorkerId} />
            <SelectSheet label="לקוח" value={customerId} placeholder="בחר לקוח…" options={customerOptions} onChange={setCustomerId} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label="תאריך (yyyy-MM-dd)" value={date} onChangeText={setDate} placeholder="2026-03-15" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="שעה (HH:mm)" value={time} onChangeText={setTime} placeholder="09:00" />
              </View>
            </View>
            <Input label="הערות" value={notes} onChangeText={setNotes} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

