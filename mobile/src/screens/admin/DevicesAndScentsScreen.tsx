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
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalDialog } from '../../components/ModalDialog';
import { ModalSheet } from '../../components/ModalSheet';
import { supabase } from '../../lib/supabase';
import { useLoading } from '../../state/LoadingContext';

// ─── iOS-style design tokens ───────────────────────────────────────────────
const ios = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  secondary: '#8E8E93',
  separator: '#E5E5EA',
  danger: '#FF3B30',
  dangerBg: '#FFF1F0',
  editBg: '#F2F2F7',
  primaryAction: '#1C1C1E',
  labelBg: '#EBEBF0',
};

type Device = { id: string; name: string; refill_amount: number; created_at?: string };
type Scent = { id: string; name: string; created_at?: string };

const AnimatedEntypo = Animated.createAnimatedComponent(Entypo);
const { width } = Dimensions.get('window');
const _defaultDuration = 400;

// ─── FAB (Floating Edit Panel) ──────────────────────────────────────────────
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
  closedSize = 56,
}: FabButtonProps) {
  const spacing = 16;
  const { height: keyboardHeight, state } = useAnimatedKeyboard();

  const keyboardHeightStyle = useAnimatedStyle(() => ({
    marginBottom:
      state.value === KeyboardState.OPEN ? keyboardHeight.value - 80 + spacing : 0,
  }));

  return (
    <Animated.View
      style={[
        fabStyles.panel,
        panelStyle,
        {
          width: isOpen ? openedSize : closedSize,
          height: isOpen ? 'auto' : closedSize,
          borderRadius: isOpen ? 20 : closedSize / 2,
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
              size={18}
              color={ios.secondary}
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration)}
            />
          ) : (
            <AnimatedEntypo
              key="open"
              name="pencil"
              size={20}
              color="#FFFFFF"
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
          style={{ flex: 1, padding: spacing + 4 }}
        >
          <View style={fabStyles.header}>
            <Text style={fabStyles.heading}>עריכת סוג מכשיר</Text>
          </View>
          <View style={{ gap: spacing, marginTop: spacing }}>{children}</View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const fabStyles = StyleSheet.create({
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: ios.text,
    textAlign: 'right',
  },
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    bottom: 20,
    right: 20,
    backgroundColor: ios.card,
    borderColor: ios.separator,
    borderWidth: 0.5,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: { justifyContent: 'center' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
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
  const [editDeviceRefill, setEditDeviceRefill] = useState('');
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
    setEditDeviceRefill(String(d.refill_amount));
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
    const nextRefill = Number(editDeviceRefill);
    if (!nextName) {
      Toast.show({ type: 'error', text1: 'חסר שם סוג מכשיר' });
      return;
    }
    if (!nextRefill) {
      Toast.show({ type: 'error', text1: 'כמות מילוי חייבת להיות מספר' });
      return;
    }
    const nameUnchanged = nextName === d.name;
    const refillUnchanged = nextRefill === d.refill_amount;
    if (nameUnchanged && refillUnchanged) {
      closeEditDevice();
      return;
    }
    if (!nameUnchanged) {
      const exists = devices.some((x) => x.id !== d.id && x.name.toLocaleLowerCase() === nextName.toLocaleLowerCase());
      if (exists) {
        Toast.show({ type: 'error', text1: 'קיים כבר סוג מכשיר בשם הזה' });
        return;
      }
    }
    const oldName = d.name;
    try {
      setIsLoading(true);
      const { error: devErr } = await supabase.from('devices').update({ name: nextName, refill_amount: nextRefill }).eq('id', d.id);
      if (devErr) throw devErr;
      if (!nameUnchanged) {
        const { error: spErr } = await supabase.from('service_points').update({ device_type: nextName }).eq('device_type', oldName);
        if (spErr) {
          await supabase.from('devices').update({ name: oldName }).eq('id', d.id);
          throw spErr;
        }
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
      <View style={{ gap: 20, marginTop: 4 }}>
        {/* Page Title */}
        <View style={s.pageHeader}>
          <Text style={s.pageKicker}>ניהול</Text>
          <Text style={s.pageTitle}>מכשירים וניחוחות</Text>
        </View>

        {/* Search + Add row */}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <Entypo name="magnifying-glass" size={16} color={ios.secondary} style={{ marginRight: 4 }} />
            <Input
              label={undefined}
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש…"
              style={s.searchInput}
            />
            {isSearching && (
              <Pressable hitSlop={10} onPress={() => setQuery('')} style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.6 }]}>
                <Entypo name="cross" size={14} color={ios.secondary} />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setCreateType('device'); setCreateOpen(true); }}
            hitSlop={8}
          >
            {({ pressed }) => (
              <View style={[s.addBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] }]}>
                <Entypo name="plus" size={20} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Devices section header */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>מכשירים</Text>
          <View style={s.countBadge}>
            <Text style={s.countText}>{filteredDevices.length}</Text>
          </View>
        </View>
      </View>
    );
  }, [filteredDevices.length, query]);

  const renderDeviceCard = ({ item }: { item: Device }) => (
    <View style={s.card}>
      <View style={s.cardInner}>
        {/* Right: content */}
        <View style={s.cardContent}>
          <Text style={s.cardTitle}>{item.name}</Text>
          <Text style={s.cardMeta}>מילוי: {item.refill_amount}</Text>
        </View>

        {/* Left: action buttons */}
        <View style={s.cardActions}>
          <Pressable
            hitSlop={8}
            onPress={() => requestDeleteDevice(item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <View style={[s.iconBtn, s.iconBtnDanger]}>
              <Entypo name="trash" size={16} color={ios.danger} />
            </View>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => openEditDevice(item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <View style={[s.iconBtn, s.iconBtnEdit]}>
              <Entypo name="pencil" size={16} color={ios.text} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: ios.bg }}>
      <FlatList
        data={filteredDevices}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.listContent}
        refreshing={loading}
        onRefresh={fetchAll}
        ListHeaderComponent={listHeader}
        renderItem={renderDeviceCard}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={s.emptyText}>
            {query.trim() ? 'לא נמצאו מכשירים.' : 'אין מכשירים.'}
          </Text>
        }
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 24 }}>
            {/* Scents section header */}
            <View style={[s.sectionHeader, { marginBottom: 4 }]}>
              <Text style={s.sectionLabel}>ניחוחות</Text>
              <View style={s.countBadge}>
                <Text style={s.countText}>{filteredScents.length}</Text>
              </View>
            </View>

            {filteredScents.length === 0 ? (
              <Text style={s.emptyText}>
                {query.trim() ? 'לא נמצאו ניחוחות.' : 'אין ניחוחות.'}
              </Text>
            ) : (
              filteredScents.map((item) => (
                <View key={item.id} style={s.card}>
                  <View style={s.cardInner}>
                    <Text style={[s.cardTitle, { flex: 1, textAlign: 'right' }]}>{item.name}</Text>
                    <View style={s.cardActions}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => deleteScent(item.id)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                      >
                        <View style={[s.iconBtn, s.iconBtnDanger]}>
                          <Entypo name="trash" size={16} color={ios.danger} />
                        </View>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => openEditScent(item)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                      >
                        <View style={[s.iconBtn, s.iconBtnEdit]}>
                          <Entypo name="pencil" size={16} color={ios.text} />
                        </View>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 100 }} />
          </View>
        }
      />

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <ModalDialog visible={createOpen} onClose={() => setCreateOpen(false)} containerStyle={s.createDialog}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.createScrollContent}
          >
            <View style={{ gap: 16 }}>
              {/* Header */}
              <View style={s.createHeaderRow}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <View style={s.createIconBubble}>
                    <Entypo name="plus" size={16} color="#fff" />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={s.createTitle}>הוספה</Text>
                    <Text style={s.createSubtitle}>בחר סוג ומלא פרטים</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setCreateOpen(false)}
                  hitSlop={8}
                  style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}
                >
                  <Entypo name="cross" size={16} color={ios.secondary} />
                </Pressable>
              </View>

              {/* Segmented control */}
              <View style={s.segmented}>
                {(['device', 'scent'] as const).map((type) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    onPress={() => setCreateType(type)}
                    style={{ flex: 1 }}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          s.segItem,
                          createType === type && s.segItemActive,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text style={[s.segText, createType === type && s.segTextActive]}>
                          {type === 'device' ? 'מכשיר' : 'ניחוח'}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Form */}
              <View style={s.formWrap}>
                {createType === 'device' ? (
                  <View style={{ gap: 12 }}>
                    <Text style={s.formSectionTitle}>פרטי מכשיר</Text>
                    <Input label="שם מכשיר" value={deviceName} onChangeText={setDeviceName} placeholder="לדוגמה: A100" />
                    <Input
                      label="כמות מילוי"
                      value={deviceRefill}
                      onChangeText={setDeviceRefill}
                      keyboardType="numeric"
                      placeholder="100"
                    />
                    <Button title="הוסף מכשיר" onPress={addDevice} disabled={!deviceName.trim() || !Number(deviceRefill)} />
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={s.formSectionTitle}>פרטי ניחוח</Text>
                    <Input label="שם ניחוח" value={scentName} onChangeText={setScentName} placeholder="לדוגמה: Ocean" />
                    <Button title="הוסף ניחוח" onPress={addScent} disabled={!scentName.trim()} />
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ModalDialog>

      {/* ── Delete Device Sheet ────────────────────────────────────────────── */}
      <ModalSheet visible={!!deleteDevice} onClose={() => setDeleteDevice(null)}>
        {!!deleteDevice && (
          <View style={{ gap: 12 }}>
            <Text style={s.sheetTitle}>מחיקת מכשיר</Text>
            <Text style={s.sheetBody}>
              מכשיר: {deleteDevice.name}
              {deviceUsageCount != null ? `\nבשימוש ב-${deviceUsageCount} נקודות שירות.` : ''}
            </Text>
            <Button title="מחק רק מכשיר" variant="danger" onPress={() => confirmDeleteDevice('deviceOnly')} />
            <Button title="מחק כולל נקודות שירות" variant="danger" onPress={() => confirmDeleteDevice('cascade')} />
            <Button title="ביטול" variant="secondary" onPress={() => setDeleteDevice(null)} />
          </View>
        )}
      </ModalSheet>

      {/* ── Edit Scent Sheet ───────────────────────────────────────────────── */}
      <ModalDialog visible={!!editScent} onClose={closeEditScent}>
        {!!editScent && (
          <View style={{ gap: 16 }}>
            <View style={s.createHeaderRow}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <View style={s.createIconBubble}>
                  <Entypo name="pencil" size={15} color="#fff" />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={s.createTitle}>עריכת ניחוח</Text>
                  <Text style={s.createSubtitle}>{editScent.name}</Text>
                </View>
              </View>
              <Pressable
                onPress={closeEditScent}
                hitSlop={8}
                style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <Entypo name="cross" size={16} color={ios.secondary} />
              </Pressable>
            </View>
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
      </ModalDialog>

      {/* ── Edit Device Modal ────────────────────────────────────────────────── */}
      <ModalDialog visible={isEditOpen} onClose={() => closeEditDevice()}>
        {!!editDevice && (
          <View style={{ gap: 16 }}>
            <View style={s.createHeaderRow}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <View style={s.createIconBubble}>
                  <Entypo name="pencil" size={15} color="#fff" />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={s.createTitle}>עריכת סוג מכשיר</Text>
                  <Text style={s.createSubtitle}>{editDevice.name}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => closeEditDevice()}
                hitSlop={8}
                style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <Entypo name="cross" size={16} color={ios.secondary} />
              </Pressable>
            </View>
            <Input label="שם סוג מכשיר" value={editDeviceName} onChangeText={setEditDeviceName} placeholder="לדוגמה: A100" />
            <Input label="כמות מילוי" value={editDeviceRefill} onChangeText={setEditDeviceRefill} keyboardType="numeric" placeholder="100" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="ביטול" variant="secondary" onPress={() => closeEditDevice()} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="שמור" onPress={saveEditDeviceType} />
              </View>
            </View>
          </View>
        )}
      </ModalDialog>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // ── Page title ──
  pageHeader: {
    gap: 6,
  },
  pageKicker: {
    fontSize: 12,
    fontWeight: '600',
    color: ios.secondary,
    textAlign: 'right',
    letterSpacing: 0.6,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: ios.text,
    textAlign: 'right',
    letterSpacing: -0.2,
  },

  // ── Search row ──
  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: ios.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: ios.separator,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    color: ios.text,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ios.labelBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ios.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ios.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  countBadge: {
    backgroundColor: ios.labelBg,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: ios.secondary,
  },

  // ── Cards ──
  card: {
    backgroundColor: ios.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: ios.separator,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cardContent: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: ios.text,
    textAlign: 'right',
  },
  cardMeta: {
    fontSize: 13,
    color: ios.secondary,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: {
    backgroundColor: '#FFEBE9',
  },
  iconBtnEdit: {
    backgroundColor: '#E8E8ED',
  },

  emptyText: {
    color: ios.secondary,
    textAlign: 'right',
    fontSize: 14,
    paddingVertical: 8,
  },

  // ── Create dialog ──
  createDialog: {
    padding: 0,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '86%',
    width: '100%',
    maxWidth: 520,
    backgroundColor: ios.bg,
  },
  createScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  createHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ios.primaryAction,
  },
  createTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ios.text,
    textAlign: 'right',
  },
  createSubtitle: {
    fontSize: 12,
    color: ios.secondary,
    textAlign: 'right',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ios.labelBg,
  },

  // ── Segmented control ──
  segmented: {
    flexDirection: 'row-reverse',
    gap: 4,
    padding: 3,
    backgroundColor: ios.labelBg,
    borderRadius: 12,
  },
  segItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemActive: {
    backgroundColor: ios.card,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segText: {
    fontSize: 14,
    fontWeight: '600',
    color: ios.secondary,
  },
  segTextActive: {
    color: ios.text,
  },

  // ── Form ──
  formWrap: {
    backgroundColor: ios.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: ios.separator,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: ios.secondary,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },

  // ── Sheets ──
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ios.text,
    textAlign: 'right',
  },
  sheetBody: {
    fontSize: 14,
    color: ios.secondary,
    textAlign: 'right',
    lineHeight: 20,
  },
});
