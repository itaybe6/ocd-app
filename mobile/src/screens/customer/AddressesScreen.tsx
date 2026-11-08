import { radii } from '../../theme/radii';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '../../components/toast/Toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import { AccountHeader, AccountIntro, AccountButton, AccountEmpty, accountColors as C } from './AccountUI';

export function CustomerAddressesScreen({
  onBack,
  onTabPress,
}: {
  onBack: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const { user, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);

  const savedAddress = user?.address?.trim() ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(savedAddress);
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback(() => {
    setDraft(savedAddress);
    setEditing(true);
  }, [savedAddress]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(savedAddress);
  }, [savedAddress]);

  const saveAddress = useCallback(async () => {
    if (!user?.id) return;
    const next = draft.trim();
    if (next.length < 3) {
      Toast.show({ type: 'error', text1: 'נא להזין כתובת תקינה' });
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.from('users').update({ address: next }).eq('id', user.id);
      if (error) throw error;
      await setUser({ ...user, address: next });
      setEditing(false);
      Toast.show({ type: 'success', text1: 'הכתובת נשמרה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שמירת הכתובת נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  }, [draft, setUser, user]);

  const removeAddress = useCallback(async () => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('users').update({ address: null }).eq('id', user.id);
      if (error) throw error;
      await setUser({ ...user, address: null });
      setEditing(false);
      setDraft('');
      Toast.show({ type: 'success', text1: 'הכתובת הוסרה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'הסרת הכתובת נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  }, [setUser, user]);

  return (
    <View style={styles.root}>
      <AccountHeader onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: contentPaddingBottom + 24 }}>
          <AccountIntro title="הכתובת שלי" subtitle="כאן אפשר לעדכן את הכתובת השמורה בחשבון." />
          {editing ? (
            <View>
              <Text style={styles.fieldLabel}>כתובת מלאה</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="רחוב, מספר בית, דירה ועיר"
                placeholderTextColor="#929292"
                accessibilityLabel="כתובת מלאה"
                textContentType="fullStreetAddress"
                autoComplete="street-address"
                autoFocus
                editable={!saving}
                multiline
                style={styles.input}
              />
              <Text style={styles.fieldHint}>כדאי לכלול מספר דירה וקומה, אם יש.</Text>
              <AccountButton label={saving ? 'שומרים את הכתובת…' : 'שמירת כתובת'} onPress={saveAddress} busy={saving} disabled={draft.trim().length < 3} />
              <Pressable onPress={cancelEdit} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving }} style={styles.textAction}>
                <Text style={styles.textActionLabel}>ביטול</Text>
              </Pressable>
            </View>
          ) : savedAddress ? (
            <View>
              <View style={styles.address}>
                <View style={styles.addressHeading}><Ionicons name="location-outline" size={21} color={C.ink} /><Text style={styles.addressLabel}>כתובת שמורה</Text></View>
                <Text style={styles.addressText}>{savedAddress}</Text>
              </View>
              <AccountButton label="עריכת כתובת" onPress={startEdit} disabled={saving} />
              <Pressable onPress={removeAddress} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} style={styles.textAction}>
                <Text style={[styles.textActionLabel, { color: C.red }]}>{saving ? 'מסירים את הכתובת…' : 'הסרת הכתובת'}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <AccountEmpty icon="location-outline" title="לאן לשלוח?" description="שמרו את הכתובת שלכם כדי שיהיה קל למצוא ולעדכן אותה בפעם הבאה." />
              <AccountButton label="הוספת כתובת" onPress={startEdit} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fill: { flex: 1 },
  fieldLabel: { color: C.ink, fontSize: 14, fontWeight: '600', lineHeight: 22, textAlign: 'right', marginBottom: 10 },
  input: { minHeight: 126, borderWidth: 1, borderColor: '#D5D6D8', borderRadius: radii.surface, backgroundColor: '#FAFAFA', padding: 16, fontSize: 16, lineHeight: 26, color: C.ink, textAlign: 'right', textAlignVertical: 'top' },
  fieldHint: { color: C.muted, fontSize: 12, lineHeight: 20, textAlign: 'right', marginTop: 10, marginBottom: 28 },
  address: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 24, marginBottom: 28, gap: 18 },
  addressHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  addressLabel: { color: C.muted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  addressText: { color: C.ink, fontSize: 21, lineHeight: 32, fontWeight: '500', textAlign: 'right' },
  textAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 8 },
  textActionLabel: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
