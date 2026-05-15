import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { ModalSheet } from './ModalSheet';
import { OcdPlusMark } from './OcdPlusMark';
import { LavaLampDark } from './LavaLampDark';
import {
  OCD_PLUS_HEADLINE,
  OCD_PLUS_SUBSCRIBE_BUTTON_LABEL,
  OCD_PLUS_SUBTITLE,
  OcdPlusChecklist,
  OcdPlusChecklistSummary,
} from './ocdPlusBenefits';

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
          {OCD_PLUS_HEADLINE}
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.52)',
            fontSize: 14.5,
            lineHeight: 23,
            textAlign: 'center',
            marginBottom: 22,
            paddingHorizontal: 6,
          }}
        >
          {OCD_PLUS_SUBTITLE}
        </Text>

        <View style={{ marginBottom: 6, paddingHorizontal: 4 }}>
          <OcdPlusChecklist dark />
        </View>

        <OcdPlusChecklistSummary dark />

        {/* Purchase button — bg on outer View; Pressable alone can skip painting fill on some RN/modal stacks */}
        <View
          style={{
            alignSelf: 'stretch',
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 14,
            elevation: 6,
            marginBottom: 14,
          }}
        >
          <Pressable
            onPress={handlePurchase}
            disabled={opening}
            android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
            style={({ pressed }) => ({
              width: '100%',
              opacity: pressed || opening ? 0.82 : 1,
            })}
          >
            <View
              style={{
                width: '100%',
                minHeight: 52,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 24,
              }}
            >
              <Text
                style={{
                  color: '#000000',
                  fontSize: 16.5,
                  fontWeight: '900',
                  letterSpacing: 0.3,
                  lineHeight: 22,
                  textAlign: 'center',
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                }}
              >
                {OCD_PLUS_SUBSCRIBE_BUTTON_LABEL}
              </Text>
            </View>
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
