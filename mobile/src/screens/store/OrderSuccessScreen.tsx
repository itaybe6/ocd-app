import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../state/CartContext';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

/**
 * Shown after Shopify checkout reports a completed order URL in the WebView.
 * Clears the persisted app cart, then sends the shopper back to the store root.
 */
export function OrderSuccessScreen({ navigation }: Props) {
  const { clearCart } = useCart();
  const [clearing, setClearing] = useState(false);

  const onBackToStore = useCallback(async () => {
    setClearing(true);
    try {
      await clearCart();
    } finally {
      setClearing(false);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [clearCart, navigation]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text, ...RTL_TEXT }}>תודה על הרכישה!</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: colors.muted, ...RTL_TEXT }}>
          ההזמנה נקלטה ב־Shopify. עדכונים על המשלוח יישלחו לפי ההגדרות בחנות.
        </Text>

        <Pressable
          onPress={() => void onBackToStore()}
          disabled={clearing}
          style={({ pressed }) => ({
            marginTop: 8,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            opacity: pressed && !clearing ? 0.9 : clearing ? 0.7 : 1,
          })}
        >
          {clearing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>חזרה לחנות</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
