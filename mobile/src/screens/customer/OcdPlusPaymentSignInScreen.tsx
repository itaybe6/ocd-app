import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { storeAccent } from '../../theme/storeAccent';
import { AccountButton, AccountHeader } from './AccountUI';
import { useAuth } from '../../state/AuthContext';

export function OcdPlusPaymentSignInScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'OcdPlusPaymentSignIn'>) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      // AuthContext clears the local fixture and resets navigation to Login.
      await signOut();
    } catch {
      setError(true);
      setBusy(false);
    }
  };
  return (
    <View style={styles.screen}>
      <AccountHeader onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>מצטרפים ל־OCD+</Text>
        <Text style={styles.description}>כדי לשייך את המנוי אליכם, מתחברים עם מספר הטלפון האמיתי שלכם.</Text>
        <View style={styles.notice}>
          <Text style={styles.price}>49 ₪ לחודש</Text>
          <Text style={styles.description}>התשלום מתבצע בעמוד המאובטח של HYP. השלמת התשלום יוצרת חיוב אמיתי ומנוי מתחדש.</Text>
        </View>
        <Text style={styles.description}>כרגע אתם מחוברים לחשבון הדמו המקומי של אדיר.</Text>
        <AccountButton label="להתחברות עם מספר אמיתי" onPress={handleSignIn} busy={busy} />
        {error ? <Text style={styles.description}>לא הצלחנו לפתוח את ההתחברות. נסו שוב.</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 24, gap: 20 },
  notice: { padding: 20, backgroundColor: storeAccent.soft, borderRadius: 20, gap: 8 },
  title: { textAlign: 'right', color: '#111111', fontSize: 26, fontWeight: '700' },
  price: { textAlign: 'right', color: storeAccent.ink, fontSize: 24, fontWeight: '700' },
  description: { textAlign: 'right', writingDirection: 'rtl', color: '#737373', fontSize: 15, lineHeight: 23 },
});
