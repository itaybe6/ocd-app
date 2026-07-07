import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';

/* ─── palette (minimal, monochrome — matches profile) ─────────────────────── */
const P = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  separator: '#ECECEC',
  label: '#111111',
  secondaryLabel: '#555555',
  tertiaryLabel: '#999999',
  iconBg: '#F0F0F0',
  iconColor: '#444444',
};

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
      {/* header — black slab with rounded bottom corners */}
      <View style={[styles.headerBg, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>כתובות שמורות</Text>
            <Text style={styles.headerSubtitle}>הכתובת תשמש למשלוחים ולשירותים</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: 16,
            paddingHorizontal: 20,
            paddingBottom: contentPaddingBottom + 16,
            gap: 12,
          }}
        >
          {editing ? (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>כתובת</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="רחוב, מספר בית, עיר"
                placeholderTextColor="#B9BEC6"
                textContentType="fullStreetAddress"
                autoComplete="street-address"
                autoFocus
                editable={!saving}
                multiline
                style={styles.input}
              />

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={saveAddress}
                  disabled={saving || draft.trim().length < 3}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    (saving || draft.trim().length < 3) && styles.primaryActionDisabled,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text
                    style={[
                      styles.primaryActionText,
                      (saving || draft.trim().length < 3) && { color: '#A6ABB3' },
                    ]}
                  >
                    {saving ? 'שומר…' : 'שמירת כתובת'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={cancelEdit}
                  disabled={saving}
                  style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.secondaryActionText}>ביטול</Text>
                </Pressable>
              </View>
            </View>
          ) : savedAddress ? (
            <View style={styles.card}>
              <View style={styles.addressRow}>
                <View style={styles.iconSlot}>
                  <Ionicons name="location-outline" size={22} color={P.iconColor} />
                </View>
                <View style={styles.addressMeta}>
                  <Text style={styles.addressTitle}>כתובת ראשית</Text>
                  <Text style={styles.addressText}>{savedAddress}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={startEdit}
                  disabled={saving}
                  style={({ pressed }) => [styles.primaryAction, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.primaryActionText}>עריכת כתובת</Text>
                </Pressable>
                <Pressable
                  onPress={removeAddress}
                  disabled={saving}
                  style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.secondaryActionText, { color: '#D94040' }]}>{saving ? 'מסיר…' : 'הסרה'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.card, styles.emptyCard]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="location-outline" size={30} color={P.tertiaryLabel} />
              </View>
              <Text style={styles.emptyTitle}>אין כתובת שמורה</Text>
              <Text style={styles.emptyText}>הוסף כתובת כדי שנוכל להשתמש בה במשלוחים.</Text>
              <Pressable
                onPress={startEdit}
                style={({ pressed }) => [styles.primaryAction, { marginTop: 6 }, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.primaryActionText}>הוספת כתובת</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  headerBg: {
    backgroundColor: '#000000',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitles: { flex: 1, alignItems: 'center', gap: 3 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  card: {
    backgroundColor: P.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.separator,
    padding: 16,
    gap: 12,
  },

  addressRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  iconSlot: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.iconBg,
  },
  addressMeta: { flex: 1, alignItems: 'flex-end', gap: 4 },
  addressTitle: { fontSize: 12, fontWeight: '700', color: P.tertiaryLabel, textAlign: 'right' },
  addressText: { fontSize: 16, fontWeight: '600', color: P.label, textAlign: 'right', lineHeight: 23 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: P.separator },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: P.tertiaryLabel, textAlign: 'right' },
  input: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: P.separator,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: P.label,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    textAlignVertical: 'top',
  },

  actionsRow: { flexDirection: 'row-reverse', gap: 10 },
  primaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionDisabled: { backgroundColor: '#E9EAEC' },
  primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.separator,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { color: P.label, fontSize: 14, fontWeight: '700' },

  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.iconBg,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: P.label },
  emptyText: { fontSize: 13, color: P.tertiaryLabel, textAlign: 'center' },
});
