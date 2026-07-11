import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { OcdPlusMark } from './OcdPlusMark';

const OCD_PLUS_DISCOUNT = 0.13;

/** Floating price pill + banner CTA — pure black (not slate #111827). */
const OCD_PLUS_PILL_BG = '#000000';

/** ידית כיווץ — בתוך הפאנל השחור, בראש */
const OCD_PLUS_COLLAPSE_HANDLE_SIZE = 32;
const OCD_PLUS_COLLAPSE_HANDLE_RADIUS = OCD_PLUS_COLLAPSE_HANDLE_SIZE / 2;
const OCD_PLUS_COLLAPSE_PANEL_TOP_PADDING = 10;
const OCD_PLUS_COLLAPSE_HANDLE_BOTTOM_GAP = 2;

const OCD_PLUS_CLOSED_BAR_HEIGHT = 42;
const OCD_PLUS_CARD_CORNER_RADIUS = 18;
const OCD_PLUS_PANEL_OPEN_MS = 320;
const OCD_PLUS_PANEL_CLOSE_MS = 280;
const OCD_PLUS_PANEL_FALLBACK_HEIGHT = 120;
const OCD_PLUS_PANEL_OPEN_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const OCD_PLUS_PANEL_CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

const ocdPlusCollapseHandleStyle = {
  width: OCD_PLUS_COLLAPSE_HANDLE_SIZE,
  height: OCD_PLUS_COLLAPSE_HANDLE_SIZE,
  borderRadius: OCD_PLUS_COLLAPSE_HANDLE_RADIUS,
  backgroundColor: 'rgba(255,255,255,0.14)',
  borderWidth: 2,
  borderColor: '#FFFFFF',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 6,
};

export function computeOcdPlusPrice(regularPrice: number): number {
  return Math.round(regularPrice * (1 - OCD_PLUS_DISCOUNT) * 100) / 100;
}

export function formatOcdPrice(price: number) {
  return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── internal alias ─── */
const fmt = formatOcdPrice;

/* ─────────────────────────────────────────
 * Integrated card price bar — a black strip
 * flush with the card's bottom edge (a real
 * part of the card, not a floating pill).
 * Tap → springs open upward into a panel
 * with the member price, savings and CTA;
 * the card itself never changes size.
 * ───────────────────────────────────────── */
export function OcdPlusCardPriceBar({
  regularPrice,
  isSubscriber,
  onPress,
}: {
  regularPrice: number;
  isSubscriber: boolean;
  onPress?: () => void;
}) {
  const memberPrice = computeOcdPlusPrice(regularPrice);
  const savings = Math.max(0, Math.round((regularPrice - memberPrice) * 100) / 100);
  const [isOpen, setIsOpen] = useState(false);
  const [contentMeasured, setContentMeasured] = useState(false);
  const panelProgress = useSharedValue(0);
  const contentReady = useSharedValue(0);
  const expandedContentHeight = useSharedValue(OCD_PLUS_PANEL_FALLBACK_HEIGHT);

  const openPanel = () => {
    setIsOpen(true);
  };

  const finishClosePanel = () => {
    contentReady.value = 0;
    setContentMeasured(false);
    setIsOpen(false);
  };

  const closePanel = () => {
    panelProgress.value = withTiming(
      0,
      { duration: OCD_PLUS_PANEL_CLOSE_MS, easing: OCD_PLUS_PANEL_CLOSE_EASING },
      (finished) => {
        if (finished) {
          runOnJS(finishClosePanel)();
        }
      },
    );
  };

  useEffect(() => {
    if (!isOpen) {
      panelProgress.value = 0;
      return;
    }

    if (!contentMeasured) {
      panelProgress.value = 0;
      return;
    }

    panelProgress.value = 0;
    panelProgress.value = withTiming(1, {
      duration: OCD_PLUS_PANEL_OPEN_MS,
      easing: OCD_PLUS_PANEL_OPEN_EASING,
    });
  }, [isOpen, contentMeasured, panelProgress]);

  const panelShellAnimatedStyle = useAnimatedStyle(() => {
    const progress = panelProgress.value;
    const expandedH = expandedContentHeight.value;
    const ready = contentReady.value > 0;

    const height = ready
      ? interpolate(progress, [0, 1], [OCD_PLUS_CLOSED_BAR_HEIGHT, expandedH], Extrapolation.CLAMP)
      : expandedH;

    const topRadius = interpolate(
      progress,
      [0, 0.2],
      [0, OCD_PLUS_CARD_CORNER_RADIUS],
      Extrapolation.CLAMP,
    );

    return {
      height,
      opacity: ready ? interpolate(progress, [0, 0.08], [0, 1], Extrapolation.CLAMP) : 0,
      borderTopLeftRadius: topRadius,
      borderTopRightRadius: topRadius,
      borderBottomLeftRadius: OCD_PLUS_CARD_CORNER_RADIUS,
      borderBottomRightRadius: OCD_PLUS_CARD_CORNER_RADIUS,
    };
  });

  const closedBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(panelProgress.value, [0, 0.22], [1, 0], Extrapolation.CLAMP),
  }));

  const handleExpandedContentLayout = (height: number) => {
    if (height > 50 && contentReady.value === 0) {
      expandedContentHeight.value = height;
      contentReady.value = 1;
      setContentMeasured(true);
    }
  };

  return (
    <View
      style={{
        alignSelf: 'stretch',
        zIndex: 100,
        elevation: 100,
      }}
    >
      {isOpen ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              overflow: 'hidden',
              backgroundColor: OCD_PLUS_PILL_BG,
            },
            panelShellAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: OCD_PLUS_PILL_BG,
            }}
          >
            <View
              onLayout={(event) => handleExpandedContentLayout(event.nativeEvent.layout.height)}
              style={{
                paddingTop: OCD_PLUS_COLLAPSE_PANEL_TOP_PADDING,
                paddingBottom: 13,
                paddingHorizontal: 13,
                gap: 5,
                backgroundColor: OCD_PLUS_PILL_BG,
              }}
            >
            <View style={{ alignItems: 'center', marginBottom: OCD_PLUS_COLLAPSE_HANDLE_BOTTOM_GAP }}>
              <Pressable
                onPress={closePanel}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="כיווץ"
                style={({ pressed }) => ({
                  ...ocdPlusCollapseHandleStyle,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <ChevronDown size={16} color="#FFFFFF" strokeWidth={2.8} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <OcdPlusMark size={17} />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 11.5,
                  fontWeight: '700',
                  textAlign: 'right',
                  flexShrink: 1,
                }}
              >
                מחיר לחברי המועדון
              </Text>
            </View>

            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.2 }}>
                {fmt(memberPrice)}
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 11.5,
                  fontWeight: '600',
                  textDecorationLine: 'line-through',
                }}
              >
                {fmt(regularPrice)}
              </Text>
            </View>

            <Text
              style={{
                color: 'rgba(255,255,255,0.72)',
                fontSize: 11.5,
                fontWeight: '700',
                textAlign: 'right',
              }}
            >
              חיסכון של {fmt(savings)}
            </Text>

            {!isSubscriber && onPress ? (
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="הצטרפות למועדון הלקוחות"
                style={({ pressed }) => ({
                  marginTop: 2,
                  borderRadius: 999,
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 8,
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: '#000000', fontSize: 12.5, fontWeight: '900' }}>הצטרפו עכשיו</Text>
              </Pressable>
            ) : null}
            </View>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View style={closedBarAnimatedStyle} pointerEvents={isOpen ? 'none' : 'auto'}>
        <Pressable
          onPress={openPanel}
          accessibilityRole="button"
          accessibilityLabel={`מחיר לחברי המועדון ${fmt(memberPrice)}, הקשה להרחבה`}
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
        >
          <View
            style={{
              height: OCD_PLUS_CLOSED_BAR_HEIGHT,
              backgroundColor: OCD_PLUS_PILL_BG,
              borderBottomLeftRadius: OCD_PLUS_CARD_CORNER_RADIUS,
              borderBottomRightRadius: OCD_PLUS_CARD_CORNER_RADIUS,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <ChevronUp size={13} color="rgba(255,255,255,0.6)" strokeWidth={2.6} />
            <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.2 }}>
              {fmt(memberPrice)}
            </Text>
            <OcdPlusMark size={20} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Compact pill CTA under home promo banner — black pill, width fits label + mark. */
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
