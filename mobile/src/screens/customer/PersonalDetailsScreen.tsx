import { radii } from '../../theme/radii';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '../../components/toast/Toast';
import { useAuth } from '../../state/AuthContext';
import { displayAccountPhone, isValidProfileName, normalizeProfileName } from '../../lib/customerProfile';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import { AccountButton, AccountHeader, AccountIntro, accountColors as C } from './AccountUI';

export function CustomerPersonalDetailsScreen({ onBack, onTabPress }: {
  onBack: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const { user, updateName } = useAuth();
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setError(null);
  }, [user?.id, user?.name]);

  const changed = normalizeProfileName(name) !== normalizeProfileName(user?.name ?? '');
  const valid = isValidProfileName(name);
  const save = useCallback(async () => {
    if (saveInFlight.current || !changed || !valid || !user) return;
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateName(name);
      Keyboard.dismiss();
      Toast.show({ type: 'success', text1: 'השם עודכן בהצלחה' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת השם נכשלה. נסו שוב.');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [changed, name, updateName, user, valid]);

  return (
    <View style={styles.root}>
      <AccountHeader onBack={() => { if (!saveInFlight.current) onBack(); }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: contentPaddingBottom + 24 }}>
          <AccountIntro title="פרטים אישיים" subtitle="השם שלכם ומספר ההתחברות לחשבון." />
          <Text style={styles.label}>שם מלא</Text>
          <TextInput
            value={name}
            onChangeText={(value) => { setName(value); setError(null); }}
            accessibilityLabel="שם מלא"
            placeholder="איך קוראים לכם?"
            placeholderTextColor="#929292"
            textContentType="name"
            autoComplete="name"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            editable={!saving}
            returnKeyType="done"
            onSubmitEditing={save}
            style={styles.input}
          />
          <Text style={styles.hint}>השם הזה יופיע באזור האישי שלכם.</Text>
          {changed && !valid ? <Text style={styles.error} accessibilityLiveRegion="polite">יש להזין שם באורך 2 עד 80 תווים.</Text> : null}
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={styles.saveArea}>
            <AccountButton label={saving ? 'שומרים את השם…' : 'שמירת שינויים'} onPress={save} busy={saving} disabled={!changed || !valid || !user} />
            {changed ? (
              <Pressable onPress={() => { setName(user?.name ?? ''); setError(null); }} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving }} style={styles.reset}>
                <Text style={styles.resetText}>ביטול השינוי</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.phoneSection}>
            <View style={styles.phoneHeading}>
              <View style={styles.phoneIcon}><Ionicons name="call-outline" size={20} color={C.ink} /></View>
              <View style={styles.phoneCopy}>
                <Text style={styles.label}>מספר ההתחברות</Text>
                <Text selectable style={styles.phone}>{displayAccountPhone(user?.phone)}</Text>
              </View>
              <Ionicons name="lock-closed-outline" size={16} color={C.muted} accessibilityLabel="לתצוגה בלבד" />
            </View>
            <Text style={styles.phoneHint}>זה המספר שאליו נשלח קוד האימות בהתחברות. המספר מוצג כאן לקריאה בלבד.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StoreFloatingTabBar activeTab="profile" onTabPress={(tab) => { if (!saveInFlight.current) onTabPress(tab); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fill: { flex: 1 },
  label: { color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: '600', textAlign: 'right' },
  input: { minHeight: 56, borderWidth: 1, borderColor: '#D5D6D8', borderRadius: radii.surface, backgroundColor: '#FAFAFA', paddingHorizontal: 16, paddingVertical: 14, marginTop: 10, color: C.ink, fontSize: 17, lineHeight: 25, textAlign: 'right' },
  hint: { color: C.muted, fontSize: 12, lineHeight: 20, textAlign: 'right', marginTop: 10 },
  error: { color: C.red, fontSize: 13, lineHeight: 22, textAlign: 'right', marginTop: 10 },
  saveArea: { marginTop: 24 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  resetText: { color: C.muted, fontSize: 12, lineHeight: 20 },
  phoneSection: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 24, marginTop: 32, gap: 15 },
  phoneHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 13 },
  phoneIcon: { width: 40, height: 40, borderRadius: radii.compact, backgroundColor: '#F5F6F7', alignItems: 'center', justifyContent: 'center' },
  phoneCopy: { flex: 1, gap: 7 },
  phone: { color: C.ink, fontSize: 20, lineHeight: 28, textAlign: 'right', writingDirection: 'ltr', fontVariant: ['tabular-nums'] },
  phoneHint: { color: C.muted, fontSize: 12, lineHeight: 21, textAlign: 'right' },
});
