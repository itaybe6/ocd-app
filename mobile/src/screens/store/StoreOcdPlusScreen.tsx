import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from './StoreHomeScreen';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import {
  OCD_PLUS_HEADLINE,
  OCD_PLUS_SUBSCRIBE_BUTTON_LABEL,
  OCD_PLUS_SUBTITLE,
  OcdPlusChecklist,
  OcdPlusChecklistSummary,
} from '../../components/ocdPlusBenefits';

/** he-IL date for the next billing line (e.g. "3 באוגוסט 2026"). */
function formatBillingDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

type Props = NativeStackScreenProps<RootStackParamList, 'StoreOcdPlus'> & {
  onBottomTabPress: (tabId: StoreBottomTabId) => void;
};

export function StoreOcdPlusScreen({ navigation, onBottomTabPress }: Props) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { status, subscription, busy, startPurchase, cancel } = useOcdPlusMembership();
  const isSubscriber = status === 'active';
  const nextBillingLabel = useMemo(
    () => formatBillingDate(subscription?.next_billing_at ?? subscription?.current_period_end),
    [subscription?.next_billing_at, subscription?.current_period_end],
  );
  const statusNote =
    status === 'pending'
      ? 'ההצטרפות ממתינה להשלמת התשלום.'
      : status === 'past_due'
        ? 'התשלום האחרון נכשל. אפשר לנסות שוב כדי לחדש את ההטבות.'
        : status === 'cancelled'
          ? 'המנוי בוטל. אפשר להצטרף מחדש בכל עת.'
          : null;

  const handlePurchase = startPurchase;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <Screen padded={false}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: contentPaddingBottom + 24,
            }}
          >
            <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#EEF2FF',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <OcdPlusMark size={22} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>מועדון</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'right', marginTop: 16, lineHeight: 36 }}>
                {OCD_PLUS_HEADLINE}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 16,
                  lineHeight: 24,
                  textAlign: 'right',
                  marginTop: 10,
                }}
              >
                {OCD_PLUS_SUBTITLE}
              </Text>
            </View>

            {isSubscriber ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'flex-end',
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-end' }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>אתם כבר חברי</Text>
                  <OcdPlusMark size={28} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 24, textAlign: 'right' }}>
                  תודה שאתם איתנו. תהנו מההנחות וההטבות — ואם משהו חסר, אנחנו כאן.
                </Text>
                {nextBillingLabel ? (
                  <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'right', alignSelf: 'stretch' }}>
                    {subscription?.cancel_at_period_end
                      ? `המנוי יסתיים ב־${nextBillingLabel}`
                      : `החיוב הבא: ${nextBillingLabel}`}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => navigation.navigate('Main', { initialTab: 'home', initialTabRequestId: Date.now() })}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    backgroundColor: '#000000',
                    borderRadius: 999,
                    paddingVertical: 14,
                    paddingHorizontal: 28,
                    opacity: pressed ? 0.88 : 1,
                  })}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>חזרה לחנות</Text>
                </Pressable>
                {!subscription?.cancel_at_period_end ? (
                  <Pressable
                    onPress={cancel}
                    disabled={busy}
                    hitSlop={8}
                    style={{ alignSelf: 'flex-end', paddingVertical: 6, opacity: busy ? 0.6 : 1 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
                      ביטול המנוי
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <OcdPlusChecklist />
                </View>

                <OcdPlusChecklistSummary />

                {statusNote ? (
                  <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'right', marginTop: 4 }}>
                    {statusNote}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handlePurchase}
                  disabled={busy}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed || busy ? 0.88 : 1,
                    overflow: 'hidden',
                  })}
                >
                  <View
                    style={{
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
                        fontSize: 17,
                        fontWeight: '900',
                        lineHeight: 22,
                        textAlign: 'center',
                        ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                      }}
                    >
                      {OCD_PLUS_SUBSCRIBE_BUTTON_LABEL}
                    </Text>
                  </View>
                </Pressable>

              </>
            )}
          </ScrollView>
        </Screen>
        <StoreFloatingTabBar activeTab="ocdPlus" onTabPress={onBottomTabPress} />
      </View>
    </SafeAreaView>
  );
}
