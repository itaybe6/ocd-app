import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { supabaseUrl } from '../../lib/supabase';
import { allowPaymentNavigation, isHypPaymentUrl, isHypReturnUrl } from '../../lib/ocdPlusCheckout';
import { storeAccent } from '../../theme/storeAccent';
import { AccountButton } from './AccountUI';

export function OcdPlusCheckoutScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'OcdPlusCheckout'>) {
  const insets = useSafeAreaInsets();
  const { isActiveMember, loading: checking, refresh } = useOcdPlusMembership();
  const [pageUrl, setPageUrl] = useState(route.params.paymentUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [returned, setReturned] = useState(false);
  const [retry, setRetry] = useState(0);
  const valid = isHypPaymentUrl(route.params.paymentUrl);

  useEffect(() => {
    if (!loading) return;
    // Slow third-party assets must not cover an already usable payment form.
    const timer = setTimeout(() => setLoading(false), 15000);
    return () => clearTimeout(timer);
  }, [loading, retry]);

  // Wait for the actual callback request to finish loading before checking.
  // A return URL or a WebView message is never proof that payment succeeded.
  useEffect(() => {
    if (!returned || isActiveMember) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let remaining = 5;
    const check = async () => {
      await refresh();
      if (!cancelled && --remaining > 0) timer = setTimeout(check, 2000);
    };
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [returned, isActiveMember, refresh]);

  const finishLoad = (url?: string) => {
    setLoading(false);
    if (url && isHypReturnUrl(url, supabaseUrl)) setReturned(true);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="חזרה לעמוד הקודם" onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-forward" size={22} color="#111111" />
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.title}>הצטרפות ל־OCD+</Text>
          <Text style={styles.subtitle}>תשלום מאובטח · 49 ₪ לחודש</Text>
        </View>
        <Ionicons name="lock-closed-outline" size={19} color={storeAccent.ink} />
      </View>
      {returned ? (
        <View style={styles.result}>
          <Text style={styles.title}>{isActiveMember ? 'ברוכים הבאים ל־OCD+' : 'בודקים את מצב המנוי'}</Text>
          <Text style={styles.description}>{isActiveMember ? 'התשלום אושר והמנוי שלכם פעיל.' : 'עדיין לא התקבל אישור להפעלת המנוי. אפשר לבדוק שוב או לחזור לאזור האישי.'}</Text>
          {!isActiveMember && <AccountButton label="בדיקת מצב המנוי" onPress={() => void refresh()} busy={checking} />}
          <AccountButton label="חזרה לאפליקציה" onPress={() => navigation.goBack()} />
        </View>
      ) : !valid || error ? (
        <View style={styles.result}>
          <Text style={styles.title}>לא הצלחנו לטעון את התשלום</Text>
          <Text style={styles.description}>אם כבר אישרתם תשלום, בדקו את מצב המנוי לפני ניסיון נוסף.</Text>
          <AccountButton label="בדיקת מצב המנוי" onPress={() => setReturned(true)} />
          {valid && <AccountButton label="טעינה מחדש" onPress={() => { setPageUrl(route.params.paymentUrl); setError(false); setLoading(true); setRetry(value => value + 1); }} />}
        </View>
      ) : (
        <View style={styles.content}>
          {Platform.OS === 'web' ? React.createElement('iframe', {
            key: retry, src: pageUrl, title: 'תשלום מאובטח ל־OCD+',
            style: { width: '100%', height: '100%', border: 0 },
            onLoad: () => { finishLoad(); void refresh(); }, onError: () => { setLoading(false); setError(true); },
          }) : <WebView
            key={retry}
            source={{ uri: pageUrl }}
            style={styles.content}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={request => allowPaymentNavigation(request.url)}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            mixedContentMode="never"
            onOpenWindow={({ nativeEvent }) => {
              if (allowPaymentNavigation(nativeEvent.targetUrl) && nativeEvent.targetUrl !== 'about:blank') setPageUrl(nativeEvent.targetUrl);
            }}
            onLoadEnd={({ nativeEvent }) => finishLoad(nativeEvent.url)}
            onError={() => { setLoading(false); setError(true); }}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.statusCode >= 400 && nativeEvent.url === pageUrl) { setLoading(false); setError(true); }
            }}
          />}
          {loading && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={storeAccent.ink} /><Text style={styles.subtitle}>טוענים את התשלום המאובטח…</Text></View>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8E8' },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  heading: { flex: 1, alignItems: 'flex-end' },
  title: { fontSize: 18, fontWeight: '700', color: '#111111', textAlign: 'right' },
  subtitle: { fontSize: 12, color: '#737373', marginTop: 4, textAlign: 'right' },
  content: { flex: 1, backgroundColor: '#FFFFFF' },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', gap: 12 },
  result: { padding: 24, gap: 20 },
  description: { fontSize: 15, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl', color: '#737373' },
});
