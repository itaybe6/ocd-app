import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { ModalSheet } from './ModalSheet';
import { OcdPlusMark } from './OcdPlusMark';
import { LavaLampDark } from './LavaLampDark';
import { OCD_PLUS_BENEFITS, OcdPlusBenefitRow } from './ocdPlusBenefits';

const OCD_PLUS_SUBSCRIBE_URL = process.env.EXPO_PUBLIC_OCD_PLUS_SUBSCRIBE_URL?.trim() ?? '';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onClose: () => void;
  isSubscriber: boolean;
};

export function OcdPlusSubscribeSheet({ visible, onClose, isSubscriber }: Props) {
  const insets = useSafeAreaInsets();
  const [opening, setOpening] = useState(false);
  const sheetMaxH = Math.round(SCREEN_H * 0.92);
  const scrollMaxH = Math.round(SCREEN_H * 0.80);

  const handlePurchase = useCallback(async () => {
    if (OCD_PLUS_SUBSCRIBE_URL) {
      try {
        setOpening(true);
        const supported = await Linking.canOpenURL(OCD_PLUS_SUBSCRIBE_URL);
        if (supported) {
          await Linking.openURL(OCD_PLUS_SUBSCRIBE_URL);
          onClose();
        } else {
          Toast.show({ type: 'error', text1: 'לא ניתן לפתוח את עמוד הרכישה' });
        }
      } catch {
        Toast.show({ type: 'error', text1: 'שגיאה בפתיחת הקישור' });
      } finally {
        setOpening(false);
      }
      return;
    }

    Toast.show({
      type: 'info',
      text1: 'בקרוב',
      text2: 'עמוד התשלום יתחבר כאן. בינתיים אפשר ליצור קשר עם השירות להשלמת הרכישה.',
    });
  }, [onClose]);

  return (
    <ModalSheet
      visible={visible && !isSubscriber}
      onClose={onClose}
      dark
      background={
        <LavaLampDark
          width={SCREEN_W}
          height={sheetMaxH}
          count={5}
          duration={22000}
        />
      }
      containerStyle={{
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
        maxHeight: sheetMaxH,
        backgroundColor: '#08090F',
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: scrollMaxH }}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingTop: 6,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── OCD+ icon — hero centred at top ── */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 22 }}>
          <OcdPlusMark size={72} />
        </View>

        {/* Title */}
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 24,
            fontWeight: '900',
            textAlign: 'center',
            lineHeight: 32,
            marginBottom: 10,
          }}
        >
          המנוי המדהים ששווה מאוד לרכוש
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.52)',
            fontSize: 14.5,
            lineHeight: 23,
            textAlign: 'center',
            marginBottom: 26,
            paddingHorizontal: 6,
          }}
        >
          הנחה קבועה, הטבות בלעדיות וחוויה נקייה ומסודרת — בדיוק בשביל מי שאוהב סדר בבית ובחיים.
        </Text>

        {/* Benefits list */}
        <View
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            marginBottom: 16,
          }}
        >
          {OCD_PLUS_BENEFITS.map((b, index) => (
            <OcdPlusBenefitRow
              key={b.title}
              {...b}
              isLast={index === OCD_PLUS_BENEFITS.length - 1}
              dark
            />
          ))}
        </View>

        {/* Purchase button */}
        <View
          style={{
            borderRadius: 999,
            overflow: 'hidden',
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 18,
            elevation: 8,
            marginBottom: 14,
          }}
        >
          <Pressable
            onPress={handlePurchase}
            disabled={opening}
            style={({ pressed }) => ({ opacity: pressed || opening ? 0.82 : 1 })}
          >
            <LinearGradient
              colors={['#4F46E5', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 17,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Ionicons name="star" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={{ color: '#FFFFFF', fontSize: 16.5, fontWeight: '900', letterSpacing: 0.3 }}>
                הצטרף למועדון
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Drag hint */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.22)',
            fontSize: 12,
            textAlign: 'center',
            letterSpacing: 0.2,
          }}
        >
          גרור למטה לסגירה
        </Text>
      </ScrollView>
    </ModalSheet>
  );
}
