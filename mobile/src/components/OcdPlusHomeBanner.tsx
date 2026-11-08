import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { OCD_PLUS_DISCOUNT, OCD_PLUS_FREE_SHIPPING_AT } from './OcdPlusProductPriceBlock';
import { OcdPlusMark } from './OcdPlusMark';
import { useMembershipCardFloat, type BannerViewport } from '../hooks/useMembershipCardFloat';

const CARD_ART = require('../../assets/ocdplus-membership-card-cutout.png');

export function OcdPlusHomeBanner({ width, edgeBleed = 0, isSubscriber, onPress, viewport }: {
  width: number;
  edgeBleed?: number;
  isSubscriber: boolean;
  onPress: () => void;
  viewport: BannerViewport;
}) {
  const action = isSubscriber ? 'למועדון שלי' : 'להכיר את OCD+';
  const artworkWidth = width;
  // Explicit dimensions prevent local asset dimensions from stretching the row.
  const imageWidth = Math.min(220, artworkWidth * 0.72);
  const imageHeight = imageWidth * (480 / 720);
  const imageLift = Math.round(imageHeight * 0.48);
  const topClearance = imageLift + 4;
  const discountPercent = Math.round(OCD_PLUS_DISCOUNT * 100);
  const float = useMembershipCardFloat(viewport, 8 + topClearance - imageLift, imageHeight);

  return (
    <Animated.View onLayout={float.onLayout} entering={float.reducedMotion ? undefined : FadeInDown.duration(240)} style={[styles.spacing, { width, marginHorizontal: -edgeBleed }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`מועדון OCD+, ${discountPercent}% הנחה על כל המוצרים ומשלוח חינם מעל ${OCD_PLUS_FREE_SHIPPING_AT} שקלים. ${isSubscriber ? 'החברות שלכם פעילה. למועדון שלי' : 'להכרת המועדון'}`}
        style={{ paddingTop: topClearance }}
      >
        <View style={styles.banner}>
          <View style={styles.body} pointerEvents="none">
            <View style={styles.background} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.watermarkLeft}>
                <OcdPlusMark variant="glyph" size={210} color="#1D1D1D" />
              </View>
              <View style={styles.watermarkRight}>
                <OcdPlusMark variant="glyph" size={230} color="#191919" />
              </View>
            </View>
            <Animated.View style={[styles.artwork, { width: artworkWidth, height: imageHeight - imageLift - 12 }, float.style]}>
              {/* Static native gradient moves with the card; no animated blur. */}
              <Svg
                width={imageWidth + 56}
                height={imageHeight + 36}
                viewBox="0 0 300 200"
                style={{ position: 'absolute', left: (artworkWidth - imageWidth - 56) / 2, top: -imageLift - 8 }}
                pointerEvents="none"
                accessible={false}
              >
                <Defs>
                  <RadialGradient id="membership-card-halo" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.3} />
                    <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.16} />
                    <Stop offset="78%" stopColor="#FFFFFF" stopOpacity={0.05} />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx="150" cy="100" rx="150" ry="100" fill="url(#membership-card-halo)" />
              </Svg>
              <Image source={CARD_ART} onLoad={float.onLoad} resizeMode="contain" style={{ width: imageWidth, height: imageHeight, transform: [{ translateY: -imageLift }] }} accessible={false} />
            </Animated.View>
            <View style={styles.copy}>
              <View style={styles.membership}>
                {isSubscriber ? <Ionicons name="checkmark" size={11} color="#BDBDBD" /> : null}
                <Text style={styles.eyebrow}>{isSubscriber ? 'חבר מועדון פעיל' : 'מועדון הלקוחות'}</Text>
              </View>
              <Text style={styles.title}>הטבות בכל קנייה.</Text>
              <Text style={styles.subtitle}>{'גישה ראשונה להשקות ומבצעים,\nושירות מועדף לחברי OCD+.'}</Text>
              <View style={styles.action}>
                <Text style={styles.actionText}>{action}</Text>
                <Ionicons name="arrow-back" size={16} color="#FAFAFA" />
              </View>
            </View>
          </View>
          <View style={styles.benefits} pointerEvents="none">
            <Text style={styles.benefit}><Text style={styles.benefitValue}>{discountPercent}%</Text> הנחה קבועה</Text>
            <View style={styles.separator} />
            <Text style={styles.benefit}>משלוח חינם מעל <Text style={styles.benefitValue}>{OCD_PLUS_FREE_SHIPPING_AT} ₪</Text></Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spacing: { paddingTop: 8 },
  banner: { overflow: 'visible', backgroundColor: '#101010' },
  body: { flexDirection: 'column', alignItems: 'center' },
  // Clip only the decoration; the raised membership card must remain visible.
  background: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#101010', overflow: 'hidden' },
  watermarkLeft: { position: 'absolute', left: -138, bottom: -54, transform: [{ rotate: '-14deg' }] },
  watermarkRight: { position: 'absolute', right: -160, top: 6, transform: [{ rotate: '12deg' }] },
  artwork: { flexShrink: 0, alignItems: 'center', justifyContent: 'flex-start', overflow: 'visible', zIndex: 1 },
  copy: { width: '100%', paddingHorizontal: 18, paddingTop: 0, paddingBottom: 2, alignItems: 'center' },
  membership: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 },
  eyebrow: { fontSize: 10, lineHeight: 16, color: '#AFAFAF', flexShrink: 1, textAlign: 'center', writingDirection: 'rtl' },
  title: { color: '#FAFAFA', fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' },
  subtitle: { color: '#BDBDBD', fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center', writingDirection: 'rtl' },
  action: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, marginTop: 0 },
  actionText: { color: '#FAFAFA', fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1, textAlign: 'center', writingDirection: 'rtl' },
  benefits: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 12, rowGap: 5, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#292929', backgroundColor: '#181818' },
  benefit: { color: '#BDBDBD', fontSize: 10, lineHeight: 16, textAlign: 'center', writingDirection: 'rtl' },
  benefitValue: { color: '#FAFAFA', fontWeight: '600' },
  separator: { width: 1, height: 12, backgroundColor: '#3A3A3A' },
});
