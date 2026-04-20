import React from 'react';
import { Pressable, Text, View } from 'react-native';

const OCD_PLUS_DISCOUNT = 0.13;

export function computeOcdPlusPrice(regularPrice: number): number {
  return Math.round(regularPrice * (1 - OCD_PLUS_DISCOUNT) * 100) / 100;
}

function formatIls(price: number) {
  return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const cSecondary = onDark ? '#E2E8F0' : '#64748B';
  const cMuted = onDark ? '#94A3B8' : '#94A3B8';
  const cAccent = onDark ? '#93C5FD' : '#2563EB';

  if (isOcdPlusSubscriber) {
    return (
      <View style={{ alignItems: 'flex-end', gap: 6, width: '100%' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ color: cPrimary, fontSize: largeSize, fontWeight: '900', textAlign: 'right' }}>
            {formatIls(memberPrice)}
          </Text>
          <Text style={{ color: cAccent, fontSize: Math.max(10, smallSize - 1), fontWeight: '800' }}>מחיר OCD+</Text>
        </View>
        <Text style={{ color: cMuted, fontSize: smallSize, fontWeight: '600', textAlign: 'right' }}>
          {formatIls(regularPrice)} מחיר מלא
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'flex-end', gap: 8, width: '100%' }}>
      <Text style={{ color: cPrimary, fontSize: largeSize, fontWeight: '900', textAlign: 'right' }}>
        {formatIls(regularPrice)}
      </Text>

      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          width: '100%',
        }}
      >
        <Text style={{ color: cSecondary, fontSize: smallSize, fontWeight: '700', textAlign: 'right' }}>
          {formatIls(memberPrice)}
        </Text>
        <Text style={{ color: cAccent, fontSize: Math.max(10, smallSize - 1), fontWeight: '800' }}>עם OCD+</Text>
        {onSubscribePress ? (
          <Pressable
            onPress={onSubscribePress}
            accessibilityRole="button"
            accessibilityLabel="הצטרפות ל-OCD+"
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.88 : 1,
              borderRadius: 999,
              backgroundColor: onDark ? '#FFFFFF' : '#000000',
              paddingHorizontal: 12,
              paddingVertical: 7,
              minHeight: 34,
              justifyContent: 'center',
            })}
          >
            <Text style={{ color: onDark ? '#000000' : '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
              הצטרף ל-OCD+
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
