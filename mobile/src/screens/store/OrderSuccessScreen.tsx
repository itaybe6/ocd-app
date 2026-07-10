import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { useCart } from '../../state/CartContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

/**
 * Shown after Shopify checkout reports a completed order URL in the WebView.
 * Clears the persisted app cart, then routes guests home and customers to profile.
 */
export function OrderSuccessScreen({ navigation, route }: Props) {
  const { clearCart } = useCart();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const orderNumber = route.params?.orderNumber?.trim() || undefined;
  const isCustomer = user?.role === 'customer';
  const primaryLabel = isCustomer ? 'לאזור האישי' : 'חזרה לעמוד הבית';

  // Clear as soon as checkout succeeds — don't wait for the CTA press.
  useEffect(() => {
    void clearCart();
  }, [clearCart]);

  const go = useCallback(
    (destination: 'profile' | 'home') => {
      if (busy) return;
      setBusy(true);

      void clearCart();

      if (destination === 'profile') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { initialCustomerProfile: true } }],
        });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    },
    [busy, clearCart, navigation]
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#F7F7F5' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, alignItems: 'flex-start' }}>
        <TouchableOpacity
          onPress={() => go('home')}
          accessibilityRole="button"
          accessibilityLabel="סגירה"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            shadowColor: '#000000',
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          }}
        >
          <Ionicons name="close" size={21} color="#111111" />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../../assets/logopng/OCDLOGO-04.png')}
          style={{ width: 168, height: 62 }}
          resizeMode="contain"
        />
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          justifyContent: 'center',
          paddingBottom: 20,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111111',
            marginBottom: 20,
          }}
        >
          <Ionicons name="checkmark" size={34} color="#FFFFFF" />
        </View>

        <Text
          style={{
            fontSize: 29,
            fontWeight: '900',
            color: '#111111',
            letterSpacing: -0.3,
            marginBottom: 10,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}
        >
          תודה שרכשת ב־OCD!
        </Text>

        <Text
          style={{
            fontSize: 16,
            lineHeight: 25,
            color: '#64748B',
            marginBottom: 22,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}
        >
          {`ההזמנה שלך נקלטה בהצלחה.\nאנחנו כבר מתחילים לטפל בה.`}
        </Text>

        {orderNumber ? (
          <View
            style={{
              borderRadius: 20,
              paddingVertical: 18,
              paddingHorizontal: 20,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#ECECE8',
              shadowColor: '#000000',
              shadowOpacity: 0.04,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#8A8A84', marginBottom: 6, ...RTL_TEXT }}>
              מספר הזמנה
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '900',
                color: '#111111',
                letterSpacing: 0.5,
                ...RTL_TEXT,
              }}
            >
              #{orderNumber}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 14, lineHeight: 22, color: '#64748B', textAlign: 'center', writingDirection: 'rtl' }}>
            אישור ההזמנה ועדכוני המשלוח יישלחו אליך לפי פרטי הקשר שמילאת בקופה.
          </Text>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => go(isCustomer ? 'profile' : 'home')}
          disabled={busy}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          style={{
            minHeight: 58,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111111',
            opacity: busy ? 0.75 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900' }}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>

        {isCustomer ? (
          <TouchableOpacity
            onPress={() => go('home')}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="חזרה לעמוד הבית"
            style={{
              minHeight: 48,
              marginTop: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
              <Text style={{ color: '#111111', fontSize: 15, fontWeight: '800' }}>חזרה לעמוד הבית</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
