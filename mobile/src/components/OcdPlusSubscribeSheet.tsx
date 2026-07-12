import React, { useCallback, useMemo } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalSheet } from './ModalSheet';
import { OcdPlusMark } from './OcdPlusMark';
import { LavaLampDark } from './LavaLampDark';
import { useOcdPlusMembership } from '../state/useOcdPlusMembership';
import { safeNavigate } from '../navigation/navigationRef';
import {
  OCD_PLUS_HEADLINE,
  OCD_PLUS_SUBSCRIBE_BUTTON_LABEL,
  OCD_PLUS_SUBTITLE,
  OcdPlusChecklist,
  OcdPlusChecklistSummary,
} from './ocdPlusBenefits';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GOLD = '#D4AF37';
const GOLD_SOFT = 'rgba(212,175,55,0.22)';

type Props = {
  visible: boolean;
  onClose: () => void;
  isSubscriber: boolean;
};

function formatBillingDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function OcdPlusMemberSheetContent({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { subscription } = useOcdPlusMembership();

  const nextBillingLabel = useMemo(
    () => formatBillingDate(subscription?.next_billing_at ?? subscription?.current_period_end),
    [subscription?.next_billing_at, subscription?.current_period_end],
  );

  const billingNote = useMemo(() => {
    if (!nextBillingLabel) return null;
    if (subscription?.cancel_at_period_end) {
      return `המנוי יסתיים ב־${nextBillingLabel}`;
    }
    return `החיוב הבא: ${nextBillingLabel}`;
  }, [nextBillingLabel, subscription?.cancel_at_period_end]);

  const handleManagePress = useCallback(() => {
    onClose();
    setTimeout(() => {
      safeNavigate('Main', { initialCustomerOcdPlus: true, initialTabRequestId: Date.now() });
    }, 280);
  }, [onClose]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: Math.round(SCREEN_H * 0.80) }}
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingBottom: Math.max(insets.bottom, 16) + 24,
        paddingTop: 6,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 20 }}>
        <OcdPlusMark size={72} />
        <View
          style={{
            marginTop: 16,
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: GOLD_SOFT,
            borderWidth: 1,
            borderColor: 'rgba(212,175,55,0.45)',
          }}
        >
          <Text style={{ color: GOLD, fontSize: 12.5, fontWeight: '900', letterSpacing: 0.6 }}>
            חבר VIP פעיל
          </Text>
        </View>
      </View>

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
        אתם כבר חברי{' '}
        <Text style={{ color: GOLD }}>OCD+</Text>
      </Text>

      <Text
        style={{
          color: 'rgba(255,255,255,0.58)',
          fontSize: 14.5,
          lineHeight: 23,
          textAlign: 'center',
          marginBottom: 18,
          paddingHorizontal: 6,
        }}
      >
        תודה שאתם איתנו. ההנחות, ההשקות המוקדמות וכל ההטבות שלכם פעילות ומחכות לכם בחנות.
      </Text>

      {billingNote ? (
        <View
          style={{
            alignSelf: 'stretch',
            marginBottom: 20,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13.5, textAlign: 'center', fontWeight: '700' }}>
            {billingNote}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          alignSelf: 'stretch',
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: GOLD,
          shadowColor: GOLD,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 6,
          marginBottom: 14,
        }}
      >
        <Pressable
          onPress={handleManagePress}
          android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
          style={({ pressed }) => ({
            width: '100%',
            opacity: pressed ? 0.88 : 1,
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
                color: '#1A1200',
                fontSize: 16.5,
                fontWeight: '900',
                letterSpacing: 0.3,
                lineHeight: 22,
                textAlign: 'center',
                ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
              }}
            >
              לאזור האישי לניהול המנוי
            </Text>
          </View>
        </Pressable>
      </View>

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
  );
}

function OcdPlusSubscribeSheetContent({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { busy, startPurchase } = useOcdPlusMembership();
  const opening = busy;

  const handlePurchase = useCallback(async () => {
    await startPurchase();
    onClose();
  }, [onClose, startPurchase]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: Math.round(SCREEN_H * 0.80) }}
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingBottom: Math.max(insets.bottom, 16) + 24,
        paddingTop: 6,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 22 }}>
        <OcdPlusMark size={72} />
      </View>

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
  );
}

export function OcdPlusSubscribeSheet({ visible, onClose, isSubscriber }: Props) {
  const sheetMaxH = Math.round(SCREEN_H * 0.92);

  return (
    <ModalSheet
      visible={visible}
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
      {isSubscriber ? (
        <OcdPlusMemberSheetContent onClose={onClose} />
      ) : (
        <OcdPlusSubscribeSheetContent onClose={onClose} />
      )}
    </ModalSheet>
  );
}
