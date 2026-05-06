import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { OcdPlusMark } from './OcdPlusMark';

const OCD_PLUS_DISCOUNT = 0.13;

/** Floating price pill + banner CTA — pure black (not slate #111827). */
const OCD_PLUS_PILL_BG = '#000000';

export function computeOcdPlusPrice(regularPrice: number): number {
  return Math.round(regularPrice * (1 - OCD_PLUS_DISCOUNT) * 100) / 100;
}

export function formatOcdPrice(price: number) {
  return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── internal alias ─── */
const fmt = formatOcdPrice;

/* ─────────────────────────────────────────
 * Floating badge — sits at the bottom edge
 * of a product card, half inside / half out.
 * ───────────────────────────────────────── */
export function OcdPlusFloatingBadge({
  regularPrice,
  isSubscriber,
  onPress,
}: {
  regularPrice: number;
  isSubscriber: boolean;
  onPress?: () => void;
}) {
  const memberPrice = computeOcdPlusPrice(regularPrice);

  const pill = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: OCD_PLUS_PILL_BG,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 13,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: '800',
          letterSpacing: 0.2,
        }}
      >
        {fmt(memberPrice)}
      </Text>
      <OcdPlusMark size={20} />
    </View>
  );

  if (!isSubscriber && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="הצטרפות למועדון הלקוחות"
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        {pill}
      </Pressable>
    );
  }
  return pill;
}

/** Compact pill CTA under home promo banner — same styling as {@link OcdPlusFloatingBadge}, width fits label + mark. */
export function OcdPlusJoinBannerButton({
  isSubscriber,
  onPress,
}: {
  isSubscriber: boolean;
  onPress?: () => void;
}) {
  if (isSubscriber || !onPress) return null;

  const shell = {
    flexDirection: 'row-reverse' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    gap: 8,
    backgroundColor: OCD_PLUS_PILL_BG,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
    minHeight: 40,
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="לחצו כאן כדי להצטרף למועדון OCD Plus"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1, alignSelf: 'center' })}
    >
      <View style={shell}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '800',
            textAlign: 'right',
            lineHeight: 18,
          }}
          numberOfLines={2}
        >
          לחצו כאן כדי להצטרף ל־
        </Text>
        <OcdPlusMark size={20} />
      </View>
    </Pressable>
  );
}

/* ─────────────────────────────────────────
 * Inline price block — used in horizontal
 * cards, product screen, featured banners.
 * ───────────────────────────────────────── */
function MemberPriceTag({
  priceText,
  markSize,
  priceFontSize,
  onDark,
}: {
  priceText: string;
  markSize: number;
  priceFontSize: number;
  onDark: boolean;
}) {
  const pillBg = onDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.07)';
  const priceColor = onDark ? '#E0E7FF' : '#3730A3';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        alignSelf: 'flex-start',
        backgroundColor: pillBg,
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 11,
      }}
    >
      <Text
        style={{
          color: priceColor,
          fontSize: priceFontSize,
          fontWeight: '800',
          letterSpacing: 0.2,
          textAlign: 'right',
        }}
      >
        {priceText}
      </Text>
      <View style={{ width: markSize, height: markSize, alignItems: 'center', justifyContent: 'center' }}>
        <OcdPlusMark size={markSize} />
      </View>
    </View>
  );
}

type Props = {
  regularPrice: number;
  isOcdPlusSubscriber: boolean;
  onSubscribePress?: () => void;
  /** Large price line size */
  titleSize?: number;
  /** `onDark` — light text for banners on a dark background */
  variant?: 'default' | 'onDark';
};

export function OcdPlusProductPriceBlock({
  regularPrice,
  isOcdPlusSubscriber,
  onSubscribePress,
  titleSize = 16,
  variant = 'default',
}: Props) {
  const memberPrice = computeOcdPlusPrice(regularPrice);
  const onDark = variant === 'onDark';
  const largeSize = titleSize;
  const smallSize = Math.max(11, Math.round(titleSize * 0.72));

  const cPrimary = onDark ? '#FFFFFF' : '#111827';
  const cMuted = onDark ? '#94A3B8' : '#94A3B8';
  const markSize = Math.max(22, Math.min(30, Math.round(largeSize * 1.1)));
  const tagPriceSize = Math.max(13, Math.round(smallSize + 2));

  if (isOcdPlusSubscriber) {
    return (
      <View style={{ alignItems: 'flex-end', gap: 8, width: '100%' }}>
        <MemberPriceTag
          priceText={fmt(memberPrice)}
          markSize={markSize}
          priceFontSize={tagPriceSize}
          onDark={onDark}
        />
        <Text style={{ color: cMuted, fontSize: smallSize, fontWeight: '600', textAlign: 'right' }}>
          {fmt(regularPrice)} מחיר מלא
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'flex-end', gap: 8, width: '100%' }}>
      <Text style={{ color: cPrimary, fontSize: largeSize, fontWeight: '900', textAlign: 'right' }}>
        {fmt(regularPrice)}
      </Text>

      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          width: '100%',
        }}
      >
        <MemberPriceTag
          priceText={fmt(memberPrice)}
          markSize={markSize}
          priceFontSize={tagPriceSize}
          onDark={onDark}
        />
        {onSubscribePress ? (
          <Pressable
            onPress={onSubscribePress}
            accessibilityRole="button"
            accessibilityLabel="הצטרפות למועדון הלקוחות"
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.88 : 1,
              borderRadius: 999,
              backgroundColor: onDark ? '#FFFFFF' : '#000000',
              paddingHorizontal: 14,
              paddingVertical: 8,
              minHeight: 36,
              justifyContent: 'center',
              alignItems: 'center',
            })}
          >
            <Text style={{ color: onDark ? '#000000' : '#FFFFFF', fontSize: 12, fontWeight: '900' }}>הצטרף למועדון</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
