import { storeAccent } from '../../theme/storeAccent';
import { radii } from '../../theme/radii';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Platform, Pressable, ScrollView as HorizontalScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ArrowLeft, Gift, Minus, Plus, Trash2, Truck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomSheetReady, useInBottomSheet } from '../../components/BottomSheetScreen';
import { computeOcdPlusPrice, OCD_PLUS_FREE_SHIPPING_AT } from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { useOcdPlusSubscribeSheet } from '../../context/OcdPlusSubscribeSheetContext';
import { type CartRecommendation } from '../../lib/shopify';
import { useStoreResources } from '../../hooks/useStoreResources';
import { isCatalogBundleProduct } from '../../lib/productBundles';
import { useCart } from '../../state/CartContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const COLORS = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#FFFFFF',
  border: '#ECECEC',
  divider: '#F0F0F0',
  text: '#0F172A',
  muted: '#64748B',
  softText: '#94A3B8',
  dark: '#0B1220',
  accent: storeAccent.primary,
  danger: '#DC2626',
  pill: '#F1F5F9',
  /** רקע בורר הכמות — אפור בהיר עדין */
  quantityStepperTrack: '#F3F5F8',
  /** בר תשלום צף תחתון — שחור מלא */
  checkoutBar: '#000000',
};

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') {
    return `₪${price.toLocaleString('he-IL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${price.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
}

function CartProductImage({
  imageUrl,
  imageAltText,
  name,
  coverColor,
  accentColor,
}: {
  imageUrl: string | null;
  imageAltText: string | null;
  name: string;
  coverColor: string;
  accentColor: string;
}) {
  if (imageUrl) {
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: radii.compact,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Image
          source={{ uri: imageUrl }}
          resizeMode="cover"
          accessibilityLabel={imageAltText ?? name}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        borderRadius: radii.compact,
        backgroundColor: coverColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 34,
          height: 48,
          borderRadius: radii.compact,
          backgroundColor: accentColor,
        }}
      />
    </View>
  );
}

function CartLineSwipeable({
  children,
  disabled,
  onRemove,
  removeLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <ReanimatedSwipeable
      enabled={!disabled}
      friction={2}
      overshootLeft={false}
      renderLeftActions={() => (
        <View
          style={{
            width: 88,
            alignSelf: 'stretch',
            backgroundColor: COLORS.danger,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => {
              onRemove();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            style={({ pressed }) => ({
              flex: 1,
              alignSelf: 'stretch',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 5,
              opacity: pressed || disabled ? 0.75 : 1,
            })}
          >
            <Trash2 size={22} color="#FFFFFF" strokeWidth={2.1} />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: -0.1 }}>הסרה</Text>
          </Pressable>
        </View>
      )}
    >
      <View style={{ backgroundColor: COLORS.surface }}>{children}</View>
    </ReanimatedSwipeable>
  );
}

function StepperButton({
  onPress,
  children,
  label,
}: {
  onPress: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44 }}
    >
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 32, height: 32, borderRadius: radii.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      </View>
    </Pressable>
  );
}

function RollingQuantity({ value }: { value: number }) {
  const progress = React.useRef(new Animated.Value(1)).current;
  const previous = React.useRef(value);
  const [pair, setPair] = React.useState({ from: value, to: value, dir: 1 });

  React.useEffect(() => {
    if (previous.current === value) return;
    const dir = value > previous.current ? 1 : -1;
    const from = previous.current;
    previous.current = value;
    setPair({ from, to: value, dir });
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, value]);

  const distance = 16;
  const outgoingY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pair.dir * -distance],
  });
  const incomingY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [pair.dir * distance, 0],
  });
  const outgoingOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const incomingOpacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] });
  const digitStyle = {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    lineHeight: 22,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'] as const,
  };

  return (
    <View accessible accessibilityLabel={`כמות: ${value}`} accessibilityLiveRegion="polite" style={{ minWidth: 32, paddingHorizontal: 2, height: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Text style={[digitStyle, { position: 'absolute', opacity: outgoingOpacity, transform: [{ translateY: outgoingY }] }]}>
        {pair.from}
      </Animated.Text>
      <Animated.Text style={[digitStyle, { opacity: incomingOpacity, transform: [{ translateY: incomingY }] }]}>
        {pair.to}
      </Animated.Text>
    </View>
  );
}

const STORE_FREE_SHIPPING_AT = 299;
const DEAL_AT = 600;

function CartRewardBar({ subtotal, freeShippingAt }: { subtotal: number; freeShippingAt: number }) {
  const freeLeft = Math.max(0, freeShippingAt - subtotal);
  const dealLeft = Math.max(0, DEAL_AT - subtotal);
  const hasFree = freeLeft <= 0;
  const hasDeal = dealLeft <= 0;
  const fill = Math.min(100, (subtotal / DEAL_AT) * 100);
  const freeAt = (freeShippingAt / DEAL_AT) * 100;

  return (
    <View style={{ paddingTop: 2, paddingBottom: 6 }}>
      <Text style={{ textAlign: 'center', fontSize: 12, lineHeight: 18, color: '#6B7280' }}>
        {!hasFree ? (
          <>
            הוסיפו עוד{' '}
            <Text style={{ color: storeAccent.ink, fontWeight: '700' }}>₪{Math.round(freeLeft)}</Text>
            {' '}למשלוח חינם
          </>
        ) : !hasDeal ? (
          <>
            <Text style={{ color: storeAccent.ink, fontWeight: '700' }}>יש לך משלוח חינם 🎉</Text>
            {' '}עוד{' '}
            <Text style={{ color: storeAccent.ink, fontWeight: '700' }}>₪{Math.round(dealLeft)}</Text>
            {' '}ומקבלים ₪100 הנחה!
          </>
        ) : (
          <Text style={{ color: storeAccent.ink, fontWeight: '700' }}>
            זכיתם במשלוח חינם ובמבצע קונים ב־600 משלמים 500! 🎉
          </Text>
        )}
      </Text>

      <View style={{ height: 64, marginHorizontal: 18, marginTop: 10 }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 10,
            height: 8,
            borderRadius: radii.pill,
            backgroundColor: storeAccent.soft,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: `${fill}%`,
              backgroundColor: storeAccent.primary,
            }}
          />
        </View>

        <RewardMark percent={freeAt} active={hasFree} label="משלוח חינם">
          <Truck size={14} color={hasFree ? storeAccent.ink : '#A1A1AA'} strokeWidth={2} />
        </RewardMark>
        <RewardMark percent={100} active={hasDeal} label={'קנה ב־₪600\nשלם ₪500'} anchor="start">
          <Gift size={14} color={hasDeal ? storeAccent.ink : '#A1A1AA'} strokeWidth={2} />
        </RewardMark>
      </View>
    </View>
  );
}

function RewardMark({
  percent,
  active,
  label,
  anchor = 'center',
  children,
}: {
  percent: number;
  active: boolean;
  label: string;
  anchor?: 'center' | 'start';
  children: React.ReactNode;
}) {
  const atStart = anchor === 'start';

  return (
    <View
      style={
        atStart
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              alignItems: 'flex-start',
            }
          : {
              position: 'absolute',
              top: 0,
              right: `${percent}%`,
              width: 28,
              marginRight: -14,
              alignItems: 'center',
            }
      }
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.pill,
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: active ? storeAccent.ink : '#D4D4D8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      <Text
        style={{
          marginTop: 3,
          fontSize: 10,
          lineHeight: 13,
          textAlign: atStart ? 'left' : 'center',
          writingDirection: 'rtl',
          color: active ? storeAccent.ink : '#A1A1AA',
          fontWeight: active ? '600' : '500',
          width: atStart ? undefined : 64,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function CartUpsellRail({
  items,
  remainingForFree,
  addingVariantId,
  disabled,
  onAdd,
}: {
  items: CartRecommendation[];
  remainingForFree: number;
  addingVariantId: string | null;
  disabled?: boolean;
  onAdd: (item: CartRecommendation) => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(328, Math.round(width * 0.84));

  if (!items.length) return null;

  return (
    <View
      style={{
        marginHorizontal: -16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#EEEEEE',
        backgroundColor: '#FFFFFF',
        paddingTop: 20,
        paddingBottom: 6,
      }}
    >
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ color: '#202124', fontSize: 17, lineHeight: 24, fontWeight: '600', ...RTL_TEXT }}>
          משלימים את הסל
        </Text>
        <Text style={{ color: '#83868A', fontSize: 12, lineHeight: 19, marginTop: 3, ...RTL_TEXT }}>
          {remainingForFree > 0
            ? `עוד ${formatPrice(remainingForFree, items[0].currencyCode)} למשלוח חינם`
            : 'עוד כמה דברים שיכולים להתאים לכם'}
        </Text>
      </View>

      <HorizontalScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14, transform: [{ scaleX: -1 }] }}
        contentContainerStyle={{ paddingStart: 16, paddingEnd: 16, paddingBottom: 4, gap: 10 }}
      >
        {items.map((item) => {
          const adding = addingVariantId === item.variantId;
          return (
            <View
              key={item.id}
              style={{
                width: cardWidth,
                transform: [{ scaleX: -1 }],
                flexDirection: 'row-reverse',
                alignItems: 'stretch',
                gap: 12,
                borderRadius: radii.surface,
                backgroundColor: '#FAFAFA',
                borderWidth: 1,
                borderColor: '#EDEDED',
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  width: 72,
                  minHeight: 88,
                  flexShrink: 0,
                  borderRadius: radii.surface,
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    accessibilityLabel={item.imageAltText || item.title}
                    style={{ width: 60, height: 76 }}
                    resizeMode="contain"
                  />
                ) : null}
              </View>

              <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 8 }}>
                <Text
                  numberOfLines={2}
                  style={{ color: '#303236', fontSize: 14, fontWeight: '500', lineHeight: 20, ...RTL_TEXT }}
                >
                  {item.title}
                </Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: storeAccent.ink, fontSize: 15, fontWeight: '700', writingDirection: 'ltr', flexShrink: 1 }}>
                    {formatPrice(item.price, item.currencyCode)}
                  </Text>
                  <Pressable
                    onPress={() => onAdd(item)}
                    disabled={disabled || adding}
                    accessibilityRole="button"
                    accessibilityLabel={`הוספת ${item.title} לעגלה`}
                    accessibilityState={{ disabled: disabled || adding, busy: adding }}
                    style={{ width: 44, height: 44 }}
                  >
                    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled || adding ? 0.5 : 1 }}>
                      <View style={{ width: 34, height: 34, borderRadius: radii.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E4', alignItems: 'center', justifyContent: 'center' }}>
                        {adding ? <ActivityIndicator size="small" color="#202124" /> : <Plus size={18} color="#202124" strokeWidth={1.8} />}
                      </View>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </HorizontalScrollView>
    </View>
  );
}

function CartQuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        alignSelf: 'flex-end',
        flexShrink: 0,
        backgroundColor: '#F5F5F5',
        borderRadius: radii.surface,
        marginTop: 8,
        overflow: 'hidden',
      }}
    >
      <StepperButton onPress={onDecrement} label="הפחתת כמות">
        <Minus size={16} color="#111111" strokeWidth={2.2} />
      </StepperButton>
      <RollingQuantity value={quantity} />
      <StepperButton onPress={onIncrement} label="הוספת כמות">
        <Plus size={16} color="#111111" strokeWidth={2.2} />
      </StepperButton>
    </View>
  );
}

function CartOcdPlusSavingsUpsell({
  subtotal,
  currencyCode,
  onJoinPress,
}: {
  subtotal: number;
  currencyCode: string;
  onJoinPress: () => void;
}) {
  const memberSubtotal = computeOcdPlusPrice(subtotal);
  const savings = Math.max(0, Math.round((subtotal - memberSubtotal) * 100) / 100);

  if (savings <= 0) return null;

  return (
    <View
      style={{
        borderRadius: radii.surface,
        backgroundColor: COLORS.dark,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Pressable
          onPress={onJoinPress}
          accessibilityRole="button"
          accessibilityLabel="הצטרפות ל-OCD+"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              backgroundColor: storeAccent.primary,
              borderRadius: radii.pill,
              paddingHorizontal: 16,
              paddingVertical: 8,
              minWidth: 72,
              alignItems: 'center',
              justifyContent: 'center',
              ...(Platform.OS === 'android'
                ? { elevation: 3 }
                : {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.18,
                    shadowRadius: 4,
                  }),
            }}
          >
            <Text style={{ color: storeAccent.onPrimary, fontSize: 13, fontWeight: '900' }}>הצטרף</Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <OcdPlusMark size={21} />
          <Text
            style={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: 12,
              fontWeight: '700',
              textAlign: 'right',
              writingDirection: 'rtl',
            }}
          >
            לחברי OCD+
          </Text>
        </View>
      </View>

      <View
        style={{
          alignItems: 'flex-end',
          gap: 2,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          אפשר לחסוך
        </Text>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 21,
            lineHeight: 25,
            fontWeight: '900',
            letterSpacing: -0.4,
            textAlign: 'right',
          }}
        >
          {formatPrice(savings, currencyCode)}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            fontWeight: '600',
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {`מחיר העגלה לאחר הנחה: ${formatPrice(memberSubtotal, currencyCode)}`}
        </Text>
      </View>
    </View>
  );
}

export function StoreCartScreen({
  onBack,
  onOpenCheckout,
}: {
  onBack: () => void;
  onOpenCheckout: (checkoutUrl: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const inBottomSheet = useInBottomSheet();
  const sheetReady = useBottomSheetReady();
  const { fetchCartRecommendations } = useStoreResources();
  const { isActiveMember } = useOcdPlusMembership();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const isMember = isActiveMember;
  const {
    checkoutUrl,
    items,
    subtotal,
    currencyCode,
    itemCount,
    isBootstrapping,
    isMutating,
    addItem,
    adjustQuantity,
    removeItem,
  } = useCart();
  const [isCheckoutPreparing, setIsCheckoutPreparing] = useState(false);
  const [recommendations, setRecommendations] = useState<CartRecommendation[]>([]);
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);

  const recommendationSeedId = items[0]?.product.id ?? null;
  const recommendationExcludeKey = useMemo(
    () => items.map((item) => item.product.variantId).filter(Boolean).join('|'),
    [items],
  );

  useEffect(() => {
    if (!sheetReady) return;
    if (!recommendationSeedId) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    const exclude = new Set(recommendationExcludeKey.split('|').filter(Boolean));
    void fetchCartRecommendations(recommendationSeedId)
      .then((list) => {
        if (cancelled) return;
        setRecommendations(
          list
            .filter((item) => {
              if (!item.variantId || !item.availableForSale) return false;
              if (exclude.has(item.variantId)) return false;
              if (item.handle === 'mystery-gift' || item.handle === 'מתנה-מסתורית') return false;
              if (item.tags.includes('mystery-gift')) return false;
              if (isCatalogBundleProduct(item.tags)) return false;
              return true;
            })
            .slice(0, 8),
        );
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [recommendationExcludeKey, recommendationSeedId, sheetReady, fetchCartRecommendations]);

  const handleAddRecommendation = useCallback(
    (item: CartRecommendation) => {
      if (isMutating || addingVariantId) return;
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setAddingVariantId(item.variantId);
      void addItem(
        {
          id: item.id,
          name: item.title,
          subtitle: '',
          collectionTitle: null,
          price: item.price,
          currencyCode: item.currencyCode,
          handle: item.handle,
          description: item.description,
          imageUrl: item.imageUrl,
          imageAltText: item.imageAltText,
          variantId: item.variantId,
          variantTitle: item.variantTitle,
          coverColor: '#F4F4F5',
          accentColor: '#FFFFFF',
        },
        1,
      ).finally(() => setAddingVariantId(null));
    },
    [addItem, addingVariantId, isMutating],
  );

  const freeShippingAt = isMember ? OCD_PLUS_FREE_SHIPPING_AT : STORE_FREE_SHIPPING_AT;

  const displaySubtotal = useMemo(
    () => (isMember ? computeOcdPlusPrice(subtotal) : subtotal),
    [isMember, subtotal],
  );

  const memberSavings = useMemo(
    () => (isMember ? Math.max(0, subtotal - displaySubtotal) : 0),
    [displaySubtotal, isMember, subtotal],
  );

  const handleCheckout = () => {
    if (!items.length || !checkoutUrl || isMutating || isCheckoutPreparing) return;
    setIsCheckoutPreparing(true);
    void onOpenCheckout(checkoutUrl).finally(() => setIsCheckoutPreparing(false));
  };

  const checkoutDisabled = isMutating || isCheckoutPreparing || !checkoutUrl;


  /** גובה בר התשלום הצף + מרווח — בלי טאב בר */
  const scrollBottomPadding = 24;
  const handleCartQuantityChange = useCallback(
    (productId: string, delta: number) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      adjustQuantity(productId, delta);
    },
    [adjustQuantity]
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="dark" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.divider,
              zIndex: 2,
            }}
          >
            <View style={{ height: inBottomSheet ? 0 : insets.top, backgroundColor: COLORS.surface }} />
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingTop: inBottomSheet ? 0 : 10,
                paddingBottom: inBottomSheet ? 10 : 14,
              }}
            >
              <View style={{ width: 42, height: inBottomSheet ? 28 : 42 }} />

              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  flexDirection: 'row-reverse',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 18,
                    lineHeight: 26,
                    fontWeight: '700',
                    letterSpacing: -0.3,
                    textAlign: 'center',
                  }}
                >
                  {`עגלת קניות${itemCount > 0 ? ` (${itemCount})` : ''}`}
                </Text>
                {null}
              </View>

              {inBottomSheet ? (
                <View style={{ width: 42, height: 28 }} />
              ) : (
                <Pressable
                  onPress={onBack}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="חזרה"
                  style={({ pressed }) => ({
                    width: 42,
                    height: 42,
                    borderRadius: radii.compact,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFFFFF',
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <ArrowLeft size={21} color={COLORS.text} strokeWidth={2.2} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView
            style={{ flex: 1, minHeight: 0, backgroundColor: COLORS.background }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 18,
              paddingBottom: scrollBottomPadding,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {isBootstrapping && (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.dark} />
            </View>
          )}

          {!isBootstrapping && !items.length && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 56, alignItems: 'center', gap: 10 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '700', ...RTL_TEXT }}>
                העגלה ריקה
              </Text>
              <Text
                style={{
                  color: COLORS.muted,
                  fontSize: 15,
                  lineHeight: 22,
                  writingDirection: 'rtl',
                  textAlign: 'center',
                }}
              >
                אין כאן מוצרים.
              </Text>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => ({
                  marginTop: 8,
                  minWidth: 180,
                  borderRadius: radii.surface,
                  backgroundColor: COLORS.dark,
                  paddingHorizontal: 22,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: pressed ? 0.88 : 1,
                  shadowColor: '#0B1220',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 4,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                  לחנות
                </Text>
              </Pressable>
            </View>
          )}

          {!!items.length && (
            <>
              <CartRewardBar subtotal={subtotal} freeShippingAt={freeShippingAt} />
              <View style={{ gap: 0 }}>
                {items.map((item) => {
                  const variantPart =
                    item.product.variantTitle && item.product.variantTitle !== 'Default Title'
                      ? item.product.variantTitle.trim()
                      : '';

                  const displayQuantity = item.quantity;
                  const unitPrice = isMember
                    ? computeOcdPlusPrice(item.cost.amountPerQuantity)
                    : item.cost.amountPerQuantity;

                  return (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderBottomWidth: 1,
                        borderBottomColor: '#F0F0F0',
                      }}
                    >
                      <View style={{ flexDirection: 'row-reverse', gap: 12, paddingVertical: 16 }}>
                        <View style={{ width: 80, height: 80, flexShrink: 0, borderRadius: radii.compact, overflow: 'hidden', backgroundColor: '#F4F4F5' }}>
                          <CartProductImage
                            imageUrl={item.product.imageUrl}
                            imageAltText={item.product.imageAltText}
                            name={item.product.name}
                            coverColor={item.product.coverColor}
                            accentColor={item.product.accentColor}
                          />
                        </View>

                        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                          <Text
                            numberOfLines={2}
                            style={{
                              color: '#111111',
                              fontSize: 14,
                              fontWeight: '500',
                              lineHeight: 20,
                              ...RTL_TEXT,
                            }}
                          >
                            {item.product.name}
                          </Text>
                          {!!variantPart && (
                            <Text
                              numberOfLines={1}
                              style={{ color: '#9CA3AF', fontSize: 12, lineHeight: 16, marginTop: 2, ...RTL_TEXT }}
                            >
                              {variantPart}
                            </Text>
                          )}
                          <Text style={{ color: storeAccent.ink, fontSize: 14, fontWeight: '700', marginTop: 4 }}>
                            {formatPrice(unitPrice, item.cost.currencyCode)}
                          </Text>
                          <CartQuantityStepper
                            quantity={displayQuantity}
                            onIncrement={() => handleCartQuantityChange(item.product.id, 1)}
                            onDecrement={() => handleCartQuantityChange(item.product.id, -1)}
                          />
                        </View>

                        <Pressable
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            void removeItem(item.product.id);
                          }}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`הסר ${item.product.name} מהעגלה`}
                          style={{ paddingTop: 4 }}
                        >
                          <Trash2 size={16} color="#A1A1AA" strokeWidth={1.8} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              <CartUpsellRail
                items={recommendations}
                remainingForFree={Math.max(0, freeShippingAt - subtotal)}
                addingVariantId={addingVariantId}
                disabled={isMutating}
                onAdd={handleAddRecommendation}
              />
            </>
          )}
        </ScrollView>

          {!!items.length && !isBootstrapping && (
            <View
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: '#E7E5E4',
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: Math.max(12, (inBottomSheet ? 10 : insets.bottom) + 8),
                backgroundColor: '#FFFFFF',
                flexShrink: 0,
                gap: 12,
              }}
            >
              {isMember && memberSavings > 0 ? (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#6B7280', fontSize: 14, ...RTL_TEXT }}>הנחת OCD+</Text>
                  <Text style={{ color: storeAccent.ink, fontSize: 14, fontWeight: '600' }}>
                    −{formatPrice(memberSavings, currencyCode)}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#6B7280', fontSize: 14 }}>סה״כ</Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  {isMember && memberSavings > 0 ? (
                    <Text style={{ color: '#A1A1AA', fontSize: 14, textDecorationLine: 'line-through' }}>
                      {formatPrice(subtotal, currencyCode)}
                    </Text>
                  ) : null}
                  <Text style={{ color: storeAccent.ink, fontSize: 18, fontWeight: '700' }}>
                    {formatPrice(displaySubtotal, currencyCode)}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleCheckout}
                disabled={checkoutDisabled}
                accessibilityRole="button"
                accessibilityLabel="מעבר לתשלום מאובטח"
                style={({ pressed }) => ({
                  opacity: pressed && !checkoutDisabled ? 0.9 : 1,
                })}
              >
                <View
                  style={{
                    minHeight: 52,
                    borderRadius: radii.surface,
                    backgroundColor: checkoutDisabled ? '#4B5563' : storeAccent.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={{ color: checkoutDisabled ? '#FFFFFF' : storeAccent.onPrimary, fontSize: 16, fontWeight: '700' }}>
                    {isCheckoutPreparing ? 'מעדכן…' : 'מעבר לתשלום מאובטח'}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </View>
  );
}
