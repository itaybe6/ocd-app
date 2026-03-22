import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import {
  Droplets,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalDialog } from '../../components/ModalDialog';
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

  const closeEditDevice = () => {
    setIsEditOpen(false);
    if (editCloseTimer.current) clearTimeout(editCloseTimer.current);
    editCloseTimer.current = setTimeout(() => {
      setEditDevice(null);
      editCloseTimer.current = null;
    }, 300);
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
        {/* Search + Add row */}
        <View style={st.searchRow}>
          <View style={st.searchWrap}>
            <Search size={16} color={colors.muted} />
            <Input
              label={undefined}
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש…"
              style={st.searchInput}
            />
            {isSearching && (
              <Pressable hitSlop={10} onPress={() => setQuery('')} style={({ pressed }) => [st.clearBtn, pressed && { opacity: 0.6 }]}>
                <X size={12} color="#fff" strokeWidth={3} />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setCreateType('device'); setCreateOpen(true); }}
            hitSlop={8}
          >
            {({ pressed }) => (
              <View style={[st.addBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}>
                <Plus size={20} color="#fff" strokeWidth={2.5} />
              </View>
            )}
          </Pressable>
        </View>

        {/* Devices section header */}
        <View style={st.sectionHeader}>
          <View style={st.sectionIconWrap}>
            <Smartphone size={14} color={colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={st.sectionLabel}>מכשירים</Text>
          <View style={st.countBadge}>
            <Text style={st.countText}>{filteredDevices.length}</Text>
          </View>
        </View>
      </View>
    );
  }, [filteredDevices.length, query]);

  const renderDeviceCard = ({ item }: { item: Device }) => (
    <View style={st.card}>
      <View style={st.cardInner}>
        <View style={st.cardIconWrap}>
          <Smartphone size={18} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={st.cardContent}>
          <Text style={st.cardTitle}>{item.name}</Text>
          <View style={st.cardMetaRow}>
            <Droplets size={12} color={colors.muted} strokeWidth={2} />
            <Text style={st.cardMeta}>מילוי: {item.refill_amount}</Text>
          </View>
        </View>
        <View style={st.cardActions}>
          <Pressable
            hitSlop={8}
            onPress={() => openEditDevice(item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <View style={st.iconBtnEdit}>
              <Pencil size={14} color={colors.text} strokeWidth={2.2} />
            </View>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => requestDeleteDevice(item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <View style={st.iconBtnDanger}>
              <Trash2 size={14} color={colors.danger} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={filteredDevices}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={st.listContent}
        refreshing={loading}
        onRefresh={fetchAll}
        ListHeaderComponent={listHeader}
        renderItem={renderDeviceCard}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}>
              <Smartphone size={28} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text style={st.emptyTitle}>
              {query.trim() ? 'לא נמצאו מכשירים' : 'אין מכשירים'}
            </Text>
            <Text style={st.emptySubtitle}>
              {query.trim() ? 'נסה חיפוש אחר' : 'לחץ + כדי להוסיף מכשיר חדש'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 28 }}>
            {/* Scents section header */}
            <View style={[st.sectionHeader, { marginBottom: 4 }]}>
              <View style={[st.sectionIconWrap, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                <Droplets size={14} color="#8B5CF6" strokeWidth={2.2} />
              </View>
              <Text style={st.sectionLabel}>ניחוחות</Text>
              <View style={st.countBadge}>
                <Text style={st.countText}>{filteredScents.length}</Text>
              </View>
            </View>

            {filteredScents.length === 0 ? (
              <View style={st.emptyWrap}>
                <View style={[st.emptyIcon, { backgroundColor: 'rgba(139,92,246,0.06)' }]}>
                  <Droplets size={28} color={colors.muted} strokeWidth={1.5} />
                </View>
                <Text style={st.emptyTitle}>
                  {query.trim() ? 'לא נמצאו ניחוחות' : 'אין ניחוחות'}
                </Text>
                <Text style={st.emptySubtitle}>
                  {query.trim() ? 'נסה חיפוש אחר' : 'לחץ + כדי להוסיף ניחוח חדש'}
                </Text>
              </View>
            ) : (
              filteredScents.map((item) => (
                <View key={item.id} style={st.card}>
                  <View style={st.cardInner}>
                    <View style={[st.cardIconWrap, { backgroundColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.15)' }]}>
                      <Droplets size={18} color="#8B5CF6" strokeWidth={2} />
                    </View>
                    <Text style={[st.cardTitle, { flex: 1, textAlign: 'right' }]}>{item.name}</Text>
                    <View style={st.cardActions}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => openEditScent(item)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                      >
                        <View style={st.iconBtnEdit}>
                          <Pencil size={14} color={colors.text} strokeWidth={2.2} />
                        </View>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => deleteScent(item.id)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                      >
                        <View style={st.iconBtnDanger}>
                          <Trash2 size={14} color={colors.danger} strokeWidth={2.2} />
                        </View>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 40 }} />
          </View>
        }
      />

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <ModalDialog visible={createOpen} onClose={() => setCreateOpen(false)} containerStyle={st.createDialog}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.createScrollContent}
          >
            <View style={{ gap: 18 }}>
              {/* Header */}
              <View style={st.modalHeaderRow}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                  <View style={st.modalIconBubble}>
                    <Plus size={16} color="#fff" strokeWidth={2.5} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={st.modalTitle}>הוספה</Text>
                    <Text style={st.modalSubtitle}>בחר סוג ומלא פרטים</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setCreateOpen(false)}
                  hitSlop={8}
                  style={({ pressed }) => [st.modalCloseBtn, pressed && { opacity: 0.6 }]}
                >
                  <X size={16} color={colors.muted} strokeWidth={2.5} />
                </Pressable>
              </View>

              {/* Segmented control */}
              <View style={st.segmented}>
                {(['device', 'scent'] as const).map((type) => {
                  const active = createType === type;
                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      onPress={() => setCreateType(type)}
                      style={{ flex: 1 }}
                    >
                      {({ pressed }) => (
                        <View style={[st.segItem, active && st.segItemActive, pressed && { opacity: 0.8 }]}>
                          {type === 'device' ? (
                            <Smartphone size={14} color={active ? colors.primary : colors.muted} strokeWidth={2.2} />
                          ) : (
                            <Droplets size={14} color={active ? '#8B5CF6' : colors.muted} strokeWidth={2.2} />
                          )}
                          <Text style={[st.segText, active && st.segTextActive]}>
                            {type === 'device' ? 'מכשיר' : 'ניחוח'}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Form */}
              <View style={st.formWrap}>
                {createType === 'device' ? (
                  <View style={{ gap: 14 }}>
                    <View style={st.formHeaderRow}>
                      <Smartphone size={15} color={colors.primary} strokeWidth={2} />
                      <Text style={st.formSectionTitle}>פרטי מכשיר</Text>
                    </View>
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
                  <View style={{ gap: 14 }}>
                    <View style={st.formHeaderRow}>
                      <Droplets size={15} color="#8B5CF6" strokeWidth={2} />
                      <Text style={st.formSectionTitle}>פרטי ניחוח</Text>
                    </View>
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
          <View style={{ gap: 14 }}>
            <View style={st.sheetHeaderRow}>
              <View style={st.sheetDangerIcon}>
                <Trash2 size={18} color={colors.danger} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.sheetTitle}>מחיקת מכשיר</Text>
                <Text style={st.sheetBody}>
                  {deleteDevice.name}
                  {deviceUsageCount != null ? ` · בשימוש ב-${deviceUsageCount} נקודות שירות` : ''}
                </Text>
              </View>
            </View>
            <Button title="מחק רק מכשיר" variant="danger" onPress={() => confirmDeleteDevice('deviceOnly')} />
            <Button title="מחק כולל נקודות שירות" variant="danger" onPress={() => confirmDeleteDevice('cascade')} />
            <Button title="ביטול" variant="secondary" onPress={() => setDeleteDevice(null)} />
          </View>
        )}
      </ModalSheet>

      {/* ── Edit Scent Modal ───────────────────────────────────────────────── */}
      <ModalDialog visible={!!editScent} onClose={closeEditScent}>
        {!!editScent && (
          <View style={{ gap: 18 }}>
            <View style={st.modalHeaderRow}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View style={[st.modalIconBubble, { backgroundColor: '#8B5CF6' }]}>
                  <Pencil size={15} color="#fff" strokeWidth={2.2} />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={st.modalTitle}>עריכת ניחוח</Text>
                  <Text style={st.modalSubtitle}>{editScent.name}</Text>
                </View>
              </View>
              <Pressable
                onPress={closeEditScent}
                hitSlop={8}
                style={({ pressed }) => [st.modalCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <X size={16} color={colors.muted} strokeWidth={2.5} />
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
      <ModalDialog visible={isEditOpen} onClose={closeEditDevice}>
        {!!editDevice && (
          <View style={{ gap: 18 }}>
            <View style={st.modalHeaderRow}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View style={st.modalIconBubble}>
                  <Pencil size={15} color="#fff" strokeWidth={2.2} />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={st.modalTitle}>עריכת סוג מכשיר</Text>
                  <Text style={st.modalSubtitle}>{editDevice.name}</Text>
                </View>
              </View>
              <Pressable
                onPress={closeEditDevice}
                hitSlop={8}
                style={({ pressed }) => [st.modalCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <X size={16} color={colors.muted} strokeWidth={2.5} />
              </Pressable>
            </View>
            <Input label="שם סוג מכשיר" value={editDeviceName} onChangeText={setEditDeviceName} placeholder="לדוגמה: A100" />
            <Input label="כמות מילוי" value={editDeviceRefill} onChangeText={setEditDeviceRefill} keyboardType="numeric" placeholder="100" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="ביטול" variant="secondary" onPress={closeEditDevice} />
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

const st = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },

  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    color: colors.text,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },

  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.2,
    textAlign: 'right',
  },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },

  card: {
    backgroundColor: colors.elevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  cardInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  cardMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtnEdit: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(37,99,235,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  createDialog: {
    padding: 0,
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '86%',
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.bg,
  },
  createScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },

  modalHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  segmented: {
    flexDirection: 'row-reverse',
    gap: 4,
    padding: 4,
    backgroundColor: colors.border,
    borderRadius: 16,
  },
  segItem: {
    flexDirection: 'row-reverse',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segItemActive: {
    backgroundColor: colors.elevated,
    elevation: 2,
  },
  segText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  segTextActive: {
    color: colors.text,
    fontWeight: '800',
  },

  formWrap: {
    backgroundColor: colors.elevated,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  formSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    textAlign: 'right',
    letterSpacing: 0.3,
  },

  sheetHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  sheetDangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  sheetBody: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
    lineHeight: 20,
  },
});
