import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';
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
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalDialog } from '../../components/ModalDialog';
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
              color={colors.text}
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration)}
            />
          ) : (
            <AnimatedEntypo
              key="open"
              name="pencil"
              size={openIconSize}
              color={colors.text}
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
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    bottom: 18,
    right: 18,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  content: { flex: 1, paddingTop: 0 },
  header: { justifyContent: 'center' },
});

export function DevicesAndScentsScreen() {
  const { setIsLoading } = useLoading();
  const [devices, setDevices] = useState<Device[]>([]);
  const [scents, setScents] = useState<Scent[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'device' | 'scent'>('device');

  const [deviceName, setDeviceName] = useState('');
  const [deviceRefill, setDeviceRefill] = useState('');
  const [scentName, setScentName] = useState('');

  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const [deviceUsageCount, setDeviceUsageCount] = useState<number | null>(null);

  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editDeviceName, setEditDeviceName] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const editCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editScent, setEditScent] = useState<Scent | null>(null);
  const [editScentName, setEditScentName] = useState('');

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

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => d.name?.toLowerCase().includes(q));
  }, [devices, query]);

  const filteredScents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scents;
    return scents.filter((s) => s.name?.toLowerCase().includes(q));
  }, [scents, query]);

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
      setCreateOpen(false);
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
      setCreateOpen(false);
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

  const openEditScent = (s: Scent) => {
    setEditScent(s);
    setEditScentName(s.name);
  };

  const closeEditScent = () => {
    setEditScent(null);
    setEditScentName('');
  };

  const saveEditScent = async () => {
    const s = editScent;
    if (!s) return;
    const nextName = editScentName.trim();
    if (!nextName) {
      Toast.show({ type: 'error', text1: 'חסר שם ניחוח' });
      return;
    }
    if (nextName === s.name) {
      closeEditScent();
      return;
    }

    const exists = scents.some((x) => x.id !== s.id && x.name.toLocaleLowerCase() === nextName.toLocaleLowerCase());
    if (exists) {
      Toast.show({ type: 'error', text1: 'קיים כבר ניחוח בשם הזה' });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.from('scents').update({ name: nextName }).eq('id', s.id);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'עודכן ניחוח' });
      closeEditScent();
      await fetchAll();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'עדכון נכשל', text2: e?.message ?? 'Unknown error' });
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

  const listHeader = useMemo(() => {
    const isSearching = !!query.trim();
    return (
      <View style={{ gap: 10, marginTop: 4 }}>
        <View style={styles.actionRow}>
          <View style={styles.searchWrap}>
            <Entypo name="magnifying-glass" size={16} color="rgba(100,116,139,0.8)" />
            <Input
              label={undefined}
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש…"
              style={styles.searchInput}
            />
            {isSearching ? (
              <Pressable
                hitSlop={10}
                onPress={() => setQuery('')}
                style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
              >
                <Entypo name="cross" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setCreateType('device');
              setCreateOpen(true);
            }}
            hitSlop={8}
          >
            {({ pressed }) => (
              <View style={[styles.plusBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.96 }] }]}>
                <Entypo name="plus" size={18} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>מכשירים</Text>
          {isSearching ? <Text style={styles.sectionMeta}>{filteredDevices.length} תוצאות</Text> : null}
        </View>
      </View>
    );
  }, [filteredDevices.length, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={filteredDevices}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 12 }}
        refreshing={loading}
        onRefresh={fetchAll}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  hitSlop={8}
                  onPress={() => requestDeleteDevice(item)}
                  style={({ pressed }) => [styles.iconBtn, styles.iconBtnDanger, pressed && { opacity: 0.7 }]}
                >
                  <Entypo name="trash" size={16} color={colors.danger} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => openEditDevice(item)}
                  style={({ pressed }) => [styles.iconBtn, styles.iconBtnEdit, pressed && { opacity: 0.7 }]}
                >
                  <Entypo name="pencil" size={16} color={colors.primary} />
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>מילוי: {item.refill_amount}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'right' }}>
            {query.trim() ? 'לא נמצאו מכשירים.' : 'אין מכשירים.'}
          </Text>
        }
        ListFooterComponent={
          <View style={{ gap: 10, marginTop: 10 }}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>ניחוחות</Text>
              {query.trim() ? <Text style={styles.sectionMeta}>{filteredScents.length} תוצאות</Text> : null}
            </View>

            {filteredScents.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'right' }}>
                {query.trim() ? 'לא נמצאו ניחוחות.' : 'אין ניחוחות.'}
              </Text>
            ) : (
              filteredScents.map((item) => (
                <Card key={item.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => deleteScent(item.id)}
                        style={({ pressed }) => [styles.iconBtn, styles.iconBtnDanger, pressed && { opacity: 0.7 }]}
                      >
                        <Entypo name="trash" size={16} color={colors.danger} />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => openEditScent(item)}
                        style={({ pressed }) => [styles.iconBtn, styles.iconBtnEdit, pressed && { opacity: 0.7 }]}
                      >
                        <Entypo name="pencil" size={16} color={colors.primary} />
                      </Pressable>
                    </View>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1 }}>{item.name}</Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        }
      />

      <ModalDialog visible={createOpen} onClose={() => setCreateOpen(false)} containerStyle={styles.createDialog}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.createScrollContent}
          >
            <View style={{ gap: 12 }}>
          <View style={styles.createHeaderRow}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              <View style={styles.createIconBubble}>
                <Entypo name="plus" size={16} color="#fff" />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={styles.createTitle}>הוספה</Text>
                <Text style={styles.createSubtitle}>בחר סוג ומלא פרטים</Text>
              </View>
            </View>

            <Pressable
              onPress={() => setCreateOpen(false)}
              hitSlop={8}
              style={({ pressed }) => [styles.closeIconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
            >
              <Entypo name="cross" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreateType('device')}
              style={styles.segmentedItemWrap}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.segmentedItem,
                    createType === 'device' ? styles.segmentedItemActive : styles.segmentedItemInactive,
                    pressed && styles.segmentedItemPressed,
                  ]}
                >
                  <Text style={[styles.segmentedText, createType === 'device' && styles.segmentedTextActive]}>
                    מכשיר
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreateType('scent')}
              style={styles.segmentedItemWrap}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.segmentedItem,
                    createType === 'scent' ? styles.segmentedItemActive : styles.segmentedItemInactive,
                    pressed && styles.segmentedItemPressed,
                  ]}
                >
                  <Text style={[styles.segmentedText, createType === 'scent' && styles.segmentedTextActive]}>ניחוח</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.createFormWrap}>
            {createType === 'device' ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.createFormTitle}>פרטי מכשיר</Text>
                <Input label="שם מכשיר" value={deviceName} onChangeText={setDeviceName} placeholder="לדוגמה: A100" />
                <Input
                  label="כמות מילוי"
                  value={deviceRefill}
                  onChangeText={setDeviceRefill}
                  keyboardType="numeric"
                  placeholder="100"
                />
                <Button
                  title="הוסף מכשיר"
                  onPress={addDevice}
                  disabled={!deviceName.trim() || !Number(deviceRefill)}
                />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={styles.createFormTitle}>פרטי ניחוח</Text>
                <Input label="שם ניחוח" value={scentName} onChangeText={setScentName} placeholder="לדוגמה: Ocean" />
                <Button title="הוסף ניחוח" onPress={addScent} disabled={!scentName.trim()} />
              </View>
            )}
          </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ModalDialog>

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

      <ModalSheet visible={!!editScent} onClose={closeEditScent}>
        {!!editScent && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>עריכת ניחוח</Text>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>ניחוח: {editScent.name}</Text>
            <Input label="שם ניחוח חדש" value={editScentName} onChangeText={setEditScentName} placeholder="לדוגמה: Ocean" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="ביטול" variant="secondary" onPress={closeEditScent} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="שמור" onPress={saveEditScent} />
              </View>
            </View>
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
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{editDevice.name}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontSize: 14,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,116,139,0.10)',
  },
  plusBtn: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'right',
  },
  sectionMeta: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'right',
  },
  closeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.10)',
  },
  closeChipText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderColor: 'rgba(37,99,235,0.30)',
  },
  typeChipText: { color: colors.muted, fontWeight: '900' },
  typeChipTextActive: { color: colors.primary },

  createSheet: {
    maxHeight: '82%',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  createDialog: {
    padding: 0,
    borderRadius: 22,
    overflow: 'hidden',
    maxHeight: '86%',
    width: '100%',
    maxWidth: 520,
  },
  createScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  createHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  createTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  createSubtitle: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  closeIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,116,139,0.10)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmented: {
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 4,
    backgroundColor: 'rgba(15,23,42,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentedItemWrap: {
    flex: 1,
  },
  segmentedItem: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  segmentedItemActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  segmentedItemInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(15,23,42,0.12)',
  },
  segmentedItemPressed: {
    opacity: 0.85,
  },
  segmentedText: { color: colors.text, fontWeight: '900' },
  segmentedTextActive: { color: '#FFFFFF' },
  createFormWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 18,
    padding: 12,
  },
  createFormTitle: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'right',
    fontSize: 14,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  iconBtnEdit: {
    backgroundColor: '#DBEAFE',
  },
});

