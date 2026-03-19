import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View, type ViewStyle } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Entypo } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  KeyboardState,
  LinearTransition,
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated';
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

const AnimatedEntypo = Animated.createAnimatedComponent(Entypo);

const { width } = Dimensions.get('window');
const _defaultDuration = 500;

export type FabButtonProps = {
  onPress: () => void;
  isOpen: boolean;
  children: React.ReactNode;
  panelStyle?: ViewStyle;
  duration?: number;
  openedSize?: number;
  closedSize?: number;
};

export function FabButton({
  onPress,
  isOpen,
  panelStyle,
  children,
  duration = _defaultDuration,
  openedSize = width * 0.9,
  closedSize = 64,
}: FabButtonProps) {
  const spacing = closedSize * 0.2;
  const closeIconSize = closedSize * 0.3;
  const openIconSize = closedSize * 0.45;
  const { height: keyboardHeight, state } = useAnimatedKeyboard();

  const keyboardHeightStyle = useAnimatedStyle(() => {
    return {
      marginBottom:
        state.value === KeyboardState.OPEN
          ? keyboardHeight.value - 80 + spacing
          : 0,
    };
  });

  return (
    <Animated.View
      style={[
        fabStyles.panel,
        panelStyle,
        {
          width: isOpen ? openedSize : closedSize,
          height: isOpen ? 'auto' : closedSize,
          borderRadius: closedSize / 2,
          padding: spacing,
        },
        keyboardHeightStyle,
      ]}
      layout={LinearTransition.duration(duration)}
    >
      <TouchableWithoutFeedback onPress={onPress}>
        <Animated.View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            right: 0,
            top: 0,
            width: closedSize,
            height: closedSize,
            zIndex: 2,
          }}
          layout={LinearTransition.duration(duration)}
        >
          {isOpen ? (
            <AnimatedEntypo
              key="close"
              name="cross"
              size={closeIconSize}
              color="white"
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration)}
            />
          ) : (
            <AnimatedEntypo
              key="open"
              name="pencil"
              size={openIconSize}
              color="white"
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration)}
            />
          )}
        </Animated.View>
      </TouchableWithoutFeedback>
      {isOpen && (
        <Animated.View
          entering={FadeInDown.duration(duration)}
          exiting={FadeOutDown.duration(duration)}
          style={{ flex: 1, gap: spacing * 2, padding: spacing }}
        >
          <View style={fabStyles.header}>
            <Text style={fabStyles.heading}>עריכת סוג מכשיר</Text>
          </View>
          <View style={[fabStyles.content, { gap: spacing * 2 }]}>{children}</View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const fabStyles = StyleSheet.create({
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'right',
  },
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    bottom: 18,
    right: 18,
    backgroundColor: '#111',
    zIndex: 9999,
    elevation: 20,
  },
  content: { flex: 1, paddingTop: 0 },
  header: { justifyContent: 'center' },
});

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

  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editDeviceName, setEditDeviceName] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const editCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

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

  const openEditDevice = (d: Device) => {
    if (editCloseTimer.current) {
      clearTimeout(editCloseTimer.current);
      editCloseTimer.current = null;
    }
    setEditDevice(d);
    setEditDeviceName(d.name);
    setIsEditOpen(true);
  };

  const closeEditDevice = (durationMs = _defaultDuration) => {
    setIsEditOpen(false);
    if (editCloseTimer.current) clearTimeout(editCloseTimer.current);
    editCloseTimer.current = setTimeout(() => {
      setEditDevice(null);
      editCloseTimer.current = null;
    }, durationMs);
  };

  const saveEditDeviceType = async () => {
    const d = editDevice;
    if (!d) return;
    const nextName = editDeviceName.trim();
    if (!nextName) {
      Toast.show({ type: 'error', text1: 'חסר שם סוג מכשיר' });
      return;
    }
    if (nextName === d.name) {
      closeEditDevice();
      return;
    }

    const exists = devices.some((x) => x.id !== d.id && x.name.toLocaleLowerCase() === nextName.toLocaleLowerCase());
    if (exists) {
      Toast.show({ type: 'error', text1: 'קיים כבר סוג מכשיר בשם הזה' });
      return;
    }

    const oldName = d.name;
    try {
      setIsLoading(true);

      const { error: devErr } = await supabase.from('devices').update({ name: nextName }).eq('id', d.id);
      if (devErr) throw devErr;

      const { error: spErr } = await supabase.from('service_points').update({ device_type: nextName }).eq('device_type', oldName);
      if (spErr) {
        await supabase.from('devices').update({ name: oldName }).eq('id', d.id);
        throw spErr;
      }

      Toast.show({ type: 'success', text1: 'עודכן סוג מכשיר' });
      closeEditDevice();
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        ListHeaderComponent={devicesHeader}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable onPress={() => requestDeleteDevice(item)} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: colors.danger, fontWeight: '900' }}>מחק</Text>
                </Pressable>
                <Pressable
                  hitSlop={12}
                  onPress={() => openEditDevice(item)}
                  style={({ pressed }) => [
                    { paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
                    pressed ? { opacity: 0.7, backgroundColor: 'rgba(15, 23, 42, 0.06)' } : null,
                  ]}
                >
                  <Entypo name="pencil" size={16} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '900' }}>ערוך</Text>
                </Pressable>
              </View>
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
        keyboardShouldPersistTaps="handled"
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

      {!!editDevice && (
        <FabButton
          isOpen={isEditOpen}
          onPress={() => (isEditOpen ? closeEditDevice() : setIsEditOpen(true))}
          openedSize={width - 36}
          panelStyle={{ right: 18, bottom: 18 }}
        >
          <Text style={{ color: 'white', fontWeight: '900', textAlign: 'right' }}>{editDevice.name}</Text>
          <Input label="שם סוג חדש" value={editDeviceName} onChangeText={setEditDeviceName} placeholder="לדוגמה: A100" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="ביטול" variant="secondary" onPress={() => closeEditDevice()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="שמור" onPress={saveEditDeviceType} />
            </View>
          </View>
        </FabButton>
      )}
    </Screen>
  );
}

