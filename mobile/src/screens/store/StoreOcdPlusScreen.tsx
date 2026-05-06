import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../state/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from './StoreHomeScreen';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { OCD_PLUS_BENEFITS, OcdPlusBenefitRow } from '../../components/ocdPlusBenefits';

const OCD_PLUS_SUBSCRIBE_URL = process.env.EXPO_PUBLIC_OCD_PLUS_SUBSCRIBE_URL?.trim() ?? '';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreOcdPlus'> & {
  onBottomTabPress: (tabId: StoreBottomTabId) => void;
};

export function StoreOcdPlusScreen({ navigation, onBottomTabPress }: Props) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { user } = useAuth();
  const isSubscriber = user?.role === 'customer' && !!user.ocd_plus_subscriber;
  const [opening, setOpening] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (OCD_PLUS_SUBSCRIBE_URL) {
      try {
        setOpening(true);
        const supported = await Linking.canOpenURL(OCD_PLUS_SUBSCRIBE_URL);
        if (supported) {
          await Linking.openURL(OCD_PLUS_SUBSCRIBE_URL);
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
  }, []);

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
                המנוי המדהים ששווה מאוד לרכוש
              </Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <OcdPlusMark size={26} />
                <Text style={{ flex: 1, minWidth: '60%', color: colors.muted, fontSize: 16, lineHeight: 26, textAlign: 'right' }}>
                  הוא המועדון שלנו ללקוחות שרוצים יותר: הנחה קבועה על המחיר, הטבות בלעדיות וחוויה נקייה ומסודרת — בדיוק בשביל מי שאוהב סדר בבית ובחיים.
                </Text>
              </View>
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
              </View>
            ) : (
              <>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    paddingHorizontal: 4,
                    paddingTop: 8,
                    paddingBottom: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {OCD_PLUS_BENEFITS.map((b, index) => (
                    <OcdPlusBenefitRow key={b.title} {...b} isLast={index === OCD_PLUS_BENEFITS.length - 1} />
                  ))}
                </View>

                <View
                  style={{
                    marginTop: 24,
                    backgroundColor: '#0F172A',
                    borderRadius: 20,
                    padding: 22,
                    alignItems: 'flex-end',
                    gap: 10,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
                    מוכנים להצטרף?
                  </Text>
                  <Text style={{ color: '#94A3B8', fontSize: 14, lineHeight: 22, textAlign: 'right' }}>
                    לחיצה על הכפתור למטה מעבירה לעמוד רכישה מאובטח — מהיר, פשוט ובלי כאב ראש.
                  </Text>
                </View>

                <Pressable
                  onPress={handlePurchase}
                  disabled={opening}
                  style={({ pressed }) => ({
                    marginTop: 20,
                    backgroundColor: colors.primary,
                    borderRadius: 999,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed || opening ? 0.88 : 1,
                  })}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900' }}>לחץ לרכישה</Text>
                </Pressable>

              </>
            )}
          </ScrollView>
        </Screen>
        <StoreFloatingTabBar activeTab={null} onTabPress={onBottomTabPress} />
      </View>
    </SafeAreaView>
  );
}
