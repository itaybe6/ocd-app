import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { fetchProductByHandle, type ShopifyProduct, type ShopifyProductVariant } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import { OcdPlusProductPriceBlock } from '../../components/OcdPlusProductPriceBlock';
import { useAuth } from '../../state/AuthContext';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { createCheckout } from '../../services/shopify';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

type ProductGalleryItem = {
  id: string;
  url: string | null;
  altText: string | null;
};

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const PRODUCT_CART_STEPPER_AUTO_CLOSE_MS = 3200;

const CART_BAR_MORPH_SPRING = { damping: 18, stiffness: 220, mass: 0.52 } as const;

/** פלטה משותפת עם עמוד העגלה — שומרת תחושה אחידה ונקייה */
const PALETTE = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFBFC',
  border: '#E5E8EE',
  divider: '#F0F2F5',
  text: '#0F172A',
  muted: '#64748B',
  softText: '#94A3B8',
  dark: '#0B1220',
  pill: '#F1F5F9',
};

const PRODUCT_CART_STEPPER_ACCENT = '#0B1220';

const productCartStepperCircleBtn = {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: '#FFFFFF',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') return `₪${price.toLocaleString('he-IL')}.00`;
  return `${price.toLocaleString('he-IL')} ${currencyCode}`;
}

function normalizeDescription(description: string) {
  const trimmed = description.trim();
  if (!trimmed) return ['אין כרגע תיאור למוצר הזה.'];

  return trimmed
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildGalleryItems(product: ShopifyProduct | null): ProductGalleryItem[] {
  if (!product) return [];

  if (product.images.length) {
    return product.images.map((image, index) => ({
      id: `${product.id}-image-${index}`,
      url: image.url,
      altText: image.altText,
    }));
  }

  if (product.imageUrl) {
    return [
      {
        id: `${product.id}-featured`,
        url: product.imageUrl,
        altText: product.imageAltText,
      },
    ];
  }

  return [{ id: `${product.id}-placeholder`, url: null, altText: null }];
}

function getCartProduct(product: ShopifyProduct, activeVariant: ShopifyProductVariant | null) {
  return {
    id: product.id,
    name: product.title,
    subtitle: product.productType?.trim() ?? '',
    collectionTitle: null,
    price: activeVariant?.price ?? product.price,
    currencyCode: activeVariant?.currencyCode ?? product.currencyCode,
    handle: product.handle,
    description: product.description,
    imageUrl: activeVariant?.imageUrl ?? product.imageUrl,
    imageAltText: activeVariant?.imageAltText ?? product.imageAltText,
    variantId: activeVariant?.id ?? product.variantId ?? '',
    variantTitle: activeVariant?.title ?? product.variantTitle,
    coverColor: '#F3F4F6',
    accentColor: '#FFFFFF',
  };
}

export function ProductScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();

  const { user } = useAuth();
  const isOcdPlusSubscriber = user?.role === 'customer' && !!user.ocd_plus_subscriber;
  const { addItem, getQuantity, updateQuantity, isMutating } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const handle = route.params.handle;
  const [reloadSeq, setReloadSeq] = useState(0);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);

  const galleryItems = useMemo(() => buildGalleryItems(product), [product]);
  const descriptionParts = useMemo(() => normalizeDescription(product?.description ?? ''), [product?.description]);
  const quantityInCart = product ? getQuantity(product.id) : 0;
  const galleryFallbackImage = galleryItems[0] ?? null;
  const imageHeight = 360;
  const productTypeLabel = product?.productType?.trim() ?? '';

  // Active variant drives the displayed image, price, and cart variant
  const multipleVariants = (product?.variants.length ?? 0) > 1;
  const activeVariant: ShopifyProductVariant | null = product?.variants[activeVariantIndex] ?? product?.variants[0] ?? null;
  const displayImageUrl = activeVariant?.imageUrl ?? galleryFallbackImage?.url ?? null;
  const displayImageAlt = activeVariant?.imageAltText ?? galleryFallbackImage?.altText ?? null;
  const displayPrice = activeVariant?.price ?? product?.price ?? 0;
  const displayCurrencyCode = activeVariant?.currencyCode ?? product?.currencyCode ?? 'ILS';
  const displayAvailableForSale = activeVariant?.availableForSale ?? product?.availableForSale ?? false;
  const displayVariantId = activeVariant?.id ?? product?.variantId ?? null;

  const [cartStepperOpen, setCartStepperOpen] = useState(false);
  const [cartPendingOpen, setCartPendingOpen] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const cartStepperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCartStepperTimer = useCallback(() => {
    if (cartStepperTimerRef.current !== null) {
      clearTimeout(cartStepperTimerRef.current);
      cartStepperTimerRef.current = null;
    }
  }, []);

  const scheduleCartStepperClose = useCallback(() => {
    clearCartStepperTimer();
    cartStepperTimerRef.current = setTimeout(() => {
      setCartStepperOpen(false);
      cartStepperTimerRef.current = null;
    }, PRODUCT_CART_STEPPER_AUTO_CLOSE_MS);
  }, [clearCartStepperTimer]);

  useEffect(() => () => clearCartStepperTimer(), [clearCartStepperTimer]);

  const openCartStepper = useCallback(() => {
    setCartStepperOpen(true);
    scheduleCartStepperClose();
  }, [scheduleCartStepperClose]);

  useEffect(() => {
    if (quantityInCart > 0) setCartPendingOpen(false);
  }, [quantityInCart]);

  useEffect(() => {
    setCartStepperOpen(false);
    setCartPendingOpen(false);
    setActiveVariantIndex(0);
    clearCartStepperTimer();
  }, [product?.id, clearCartStepperTimer]);

  const addFirstToCartAndOpenStepper = useCallback(() => {
    if (!displayAvailableForSale || !displayVariantId || isMutating) return;
    setCartPendingOpen(true);
    openCartStepper();
    void addItem(getCartProduct(product!, activeVariant)).catch(() => {
      setCartPendingOpen(false);
      setCartStepperOpen(false);
      clearCartStepperTimer();
    });
  }, [addItem, activeVariant, clearCartStepperTimer, displayAvailableForSale, displayVariantId, isMutating, openCartStepper, product]);

  const onCollapsedCartBarPress = useCallback(() => {
    if (!displayAvailableForSale || !displayVariantId || isMutating) return;
    if (quantityInCart === 0) {
      void addFirstToCartAndOpenStepper();
      return;
    }
    openCartStepper();
  }, [addFirstToCartAndOpenStepper, displayAvailableForSale, displayVariantId, isMutating, openCartStepper, quantityInCart]);

  const cartStepperIncrement = useCallback(() => {
    if (!product || !displayAvailableForSale || isMutating) return;
    if (quantityInCart === 0) {
      if (cartPendingOpen) return;
      void addFirstToCartAndOpenStepper();
      return;
    }
    void updateQuantity(product.id, quantityInCart + 1);
    scheduleCartStepperClose();
  }, [
    addFirstToCartAndOpenStepper,
    cartPendingOpen,
    isMutating,
    product,
    quantityInCart,
    scheduleCartStepperClose,
    updateQuantity,
  ]);

  const cartStepperDecrement = useCallback(() => {
    if (!product || isMutating) return;
    if (quantityInCart <= 0) {
      if (cartPendingOpen) {
        setCartPendingOpen(false);
        setCartStepperOpen(false);
        clearCartStepperTimer();
      }
      return;
    }
    if (quantityInCart <= 1) {
      setCartStepperOpen(false);
      clearCartStepperTimer();
    }
    void updateQuantity(product.id, quantityInCart - 1);
    if (quantityInCart > 1) scheduleCartStepperClose();
  }, [
    cartPendingOpen,
    clearCartStepperTimer,
    isMutating,
    product,
    quantityInCart,
    scheduleCartStepperClose,
    updateQuantity,
  ]);

  const cartBarStepperExpanded = cartStepperOpen && (quantityInCart > 0 || cartPendingOpen);
  const cartBarStepperDisplayQty = quantityInCart > 0 ? quantityInCart : cartPendingOpen ? 1 : 0;

  const cartBarMorph = useSharedValue(0);

  useEffect(() => {
    cartBarMorph.value = withSpring(cartBarStepperExpanded ? 1 : 0, CART_BAR_MORPH_SPRING);
  }, [cartBarStepperExpanded]);

  const cartBarCollapsedAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cartBarMorph.value, [0, 0.42, 1], [1, 0.15, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(cartBarMorph.value, [0, 1], [1, 0.93], Extrapolation.CLAMP) },
      { translateY: interpolate(cartBarMorph.value, [0, 1], [0, -5], Extrapolation.CLAMP) },
    ],
  }));

  const cartBarStepperAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cartBarMorph.value, [0, 0.38, 0.72, 1], [0, 0, 0.85, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(cartBarMorph.value, [0, 1], [0.9, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(cartBarMorph.value, [0, 1], [14, 0], Extrapolation.CLAMP) },
    ],
  }));

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setActiveVariantIndex(0);
        const nextProduct = await fetchProductByHandle(handle);
        if (!alive) return;
        setProduct(nextProduct);
        if (!nextProduct) {
          setError('המוצר לא נמצא');
        }
      } catch (e: any) {
        if (!alive) return;
        setProduct(null);
        setError(e?.message ?? 'שגיאה בטעינת המוצר');
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })().catch(() => {});

    return () => {
      alive = false;
    };
  }, [handle, reloadSeq]);

  const handleFavoriteToggle = useCallback(() => {
    if (!product) return;
    void toggleFavorite(favoriteInputFromShopify(product));
  }, [product, toggleFavorite]);

  const handleShare = useCallback(async () => {
    if (!product) return;
    try {
      await Share.share({
        title: product.title,
        message: `${product.title} – ${formatPrice(product.price, product.currencyCode)}`,
      });
    } catch {
      // share dismissed or failed silently
    }
  }, [product]);

  /**
   * Opens Shopify-hosted checkout for the selected variant only (Cart API `cartCreate`).
   * Quantity follows the in-product stepper when already in cart, otherwise 1.
   */
  const handleBuyNow = useCallback(async () => {
    if (!displayVariantId || !displayAvailableForSale || buyNowLoading) return;
    const qty = quantityInCart > 0 ? quantityInCart : 1;
    setBuyNowLoading(true);
    try {
      const { checkoutUrl } = await createCheckout([{ variantId: displayVariantId, quantity: qty }]);
      navigation.navigate('StoreCheckout', { checkoutUrl });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'נסה שוב בעוד רגע';
      Toast.show({
        type: 'error',
        text1: 'לא ניתן לפתוח תשלום',
        text2: message,
      });
    } finally {
      setBuyNowLoading(false);
    }
  }, [
    buyNowLoading,
    displayAvailableForSale,
    displayVariantId,
    navigation,
    quantityInCart,
  ]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: PALETTE.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 12 }}>
          <ActivityIndicator size="large" color={PALETTE.dark} />
          <Text style={{ color: PALETTE.muted, fontSize: 14, fontWeight: '700', ...RTL_TEXT }}>טוען מוצר…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: PALETTE.background }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={{
              backgroundColor: PALETTE.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: PALETTE.divider,
              padding: 18,
              gap: 12,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <Text style={{ color: PALETTE.text, fontWeight: '800', fontSize: 17, letterSpacing: -0.3, ...RTL_TEXT }}>
              לא הצלחנו להציג את המוצר
            </Text>
            {!!error && (
              <Text style={{ color: PALETTE.muted, fontSize: 13.5, lineHeight: 20, ...RTL_TEXT }}>{error}</Text>
            )}
            <Pressable
              onPress={() => setReloadSeq((current) => current + 1)}
              style={({ pressed }) => ({
                marginTop: 4,
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: PALETTE.dark,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: -0.2 }}>רענן</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isCartCtaDisabled = !displayAvailableForSale || !displayVariantId;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.background }}>
      {/* ── Hero image ── */}
      <View style={{ height: imageHeight, position: 'relative', backgroundColor: '#EBEEF3' }}>
        {displayImageUrl ? (
          <Image
            source={{ uri: displayImageUrl }}
            resizeMode="cover"
            accessibilityLabel={displayImageAlt ?? 'תמונת מוצר'}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0', gap: 8 }}>
            <Ionicons name="image-outline" size={42} color="#64748B" />
            <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700', ...RTL_TEXT }}>אין תמונה זמינה</Text>
          </View>
        )}

        {/* פעולות עליונות — חזרה משמאל, שיתוף ומועדפים מימין (RTL) */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 10,
            left: 16,
            right: 16,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* קבוצת פעולות מימין: שיתוף + מועדפים */}
          <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
            <Pressable
              onPress={() => void handleShare()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="שתף מוצר"
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.95)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.7)',
                shadowColor: '#0B1220',
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Ionicons name="share-outline" size={20} color={PALETTE.text} />
            </Pressable>
            <Pressable
              onPress={handleFavoriteToggle}
              disabled={isFavoritePending(product.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="הוסף למועדפים"
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: isFavorite(product.id) ? '#FEE2E2' : 'rgba(255,255,255,0.95)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: isFavorite(product.id) ? '#FECACA' : 'rgba(255,255,255,0.7)',
                shadowColor: '#0B1220',
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
                opacity: pressed || isFavoritePending(product.id) ? 0.72 : 1,
              })}
            >
              {isFavoritePending(product.id) ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Ionicons
                  name={isFavorite(product.id) ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorite(product.id) ? '#DC2626' : PALETTE.text}
                />
              )}
            </Pressable>
          </View>

          {/* כפתור חזרה משמאל */}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.95)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.7)',
              shadowColor: '#0B1220',
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Ionicons name="arrow-back" size={20} color={PALETTE.text} />
          </Pressable>
        </View>
      </View>

      {/* ── תוכן בתוך גיליון לבן צף ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: PALETTE.background,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -28,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 22,
            paddingBottom: 20,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* כותרת + צ'יפ קטגוריה + מחיר בכרטיס לבן ראשי */}
          <View
            style={{
              backgroundColor: PALETTE.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: PALETTE.divider,
              paddingHorizontal: 18,
              paddingVertical: 18,
              gap: 12,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            {!!productTypeLabel && productTypeLabel !== 'מוצרים' && (
              <View style={{ flexDirection: 'row-reverse' }}>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: PALETTE.pill,
                  }}
                >
                  <Text
                    style={{
                      color: PALETTE.muted,
                      fontWeight: '800',
                      fontSize: 11.5,
                      letterSpacing: 0.4,
                      ...RTL_TEXT,
                    }}
                  >
                    {productTypeLabel}
                  </Text>
                </View>
              </View>
            )}

            <Text
              style={{
                color: PALETTE.text,
                fontSize: 24,
                lineHeight: 32,
                fontWeight: '800',
                letterSpacing: -0.5,
                ...RTL_TEXT,
              }}
            >
              {product.title}
            </Text>

            <View style={{ height: 1, backgroundColor: PALETTE.divider, marginVertical: 2 }} />

            {displayCurrencyCode === 'ILS' ? (
              <OcdPlusProductPriceBlock
                regularPrice={displayPrice}
                isOcdPlusSubscriber={isOcdPlusSubscriber}
                onSubscribePress={() => navigation.navigate('StoreOcdPlus')}
                titleSize={24}
              />
            ) : (
              <Text
                style={{
                  color: PALETTE.text,
                  fontSize: 24,
                  fontWeight: '900',
                  letterSpacing: -0.4,
                  ...RTL_TEXT,
                }}
              >
                {formatPrice(displayPrice, displayCurrencyCode)}
              </Text>
            )}
          </View>

          {/* ── וריאציות ── */}
          {multipleVariants && (
            <View
              style={{
                backgroundColor: PALETTE.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: PALETTE.divider,
                paddingVertical: 16,
                gap: 12,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.04,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  color: PALETTE.muted,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                  paddingHorizontal: 18,
                  ...RTL_TEXT,
                }}
              >
                בחר וריאציה
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: 'row-reverse',
                  gap: 8,
                  paddingHorizontal: 18,
                  paddingVertical: 2,
                }}
              >
                {product.variants.map((variant, index) => {
                  const isActive = index === activeVariantIndex;
                  const isUnavailable = !variant.availableForSale;
                  return (
                    <Pressable
                      key={`${variant.id}-pill`}
                      onPress={() => setActiveVariantIndex(index)}
                      disabled={isUnavailable}
                      style={({ pressed }) => ({
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: isActive ? PALETTE.dark : PALETTE.border,
                        backgroundColor: isActive
                          ? PALETTE.dark
                          : isUnavailable
                          ? PALETTE.pill
                          : PALETTE.surfaceMuted,
                        opacity: pressed ? 0.78 : isUnavailable ? 0.55 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: isActive ? '#FFFFFF' : isUnavailable ? PALETTE.softText : PALETTE.text,
                          fontSize: 13.5,
                          fontWeight: '700',
                          letterSpacing: -0.2,
                          textDecorationLine: isUnavailable ? 'line-through' : 'none',
                          ...RTL_TEXT,
                        }}
                        numberOfLines={1}
                      >
                        {variant.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── תיאור המוצר ── */}
          <View
            style={{
              backgroundColor: PALETTE.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: PALETTE.divider,
              paddingHorizontal: 18,
              paddingVertical: 18,
              gap: 10,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <Text
              style={{
                color: PALETTE.muted,
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 0.6,
                ...RTL_TEXT,
              }}
            >
              תיאור המוצר
            </Text>
            <View style={{ gap: 8 }}>
              {descriptionParts.map((part, index) => (
                <Text
                  key={`${product.id}-desc-${index}`}
                  style={{ color: PALETTE.text, lineHeight: 24, fontSize: 14.5, ...RTL_TEXT }}
                >
                  {part}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* ── סרגל פעולות תחתון ── */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            borderTopWidth: 1,
            borderTopColor: PALETTE.divider,
            backgroundColor: PALETTE.surface,
            gap: 10,
          }}
        >
          {/* קנה עכשיו — כפתור משני נקי */}
          <Pressable
            onPress={() => void handleBuyNow()}
            disabled={isMutating || isCartCtaDisabled || buyNowLoading}
            accessibilityRole="button"
            accessibilityLabel="קנה עכשיו"
            style={({ pressed }) => ({
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isCartCtaDisabled ? PALETTE.border : PALETTE.border,
              backgroundColor: PALETTE.surfaceMuted,
              opacity: pressed && !isCartCtaDisabled && !buyNowLoading ? 0.88 : 1,
            })}
          >
            {buyNowLoading ? (
              <ActivityIndicator size="small" color={PALETTE.dark} />
            ) : (
              <Text
                style={{
                  color: isCartCtaDisabled ? PALETTE.softText : PALETTE.text,
                  fontSize: 14.5,
                  fontWeight: '800',
                  letterSpacing: -0.2,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                קנה עכשיו · תשלום מאובטח ב־Shopify
              </Text>
            )}
          </Pressable>

          {/* CTA ראשי — מורף בין כותרת לסטפר, בסגנון בר התשלום בעמוד העגלה */}
          <Pressable
            onPress={cartBarStepperExpanded ? undefined : onCollapsedCartBarPress}
            disabled={isMutating || isCartCtaDisabled}
            accessibilityRole="button"
            accessibilityLabel="הוסף לעגלה"
            style={({ pressed }) => ({
              borderRadius: 18,
              overflow: 'hidden',
              opacity: pressed && !cartBarStepperExpanded ? 0.9 : 1,
              shadowColor: '#0B1220',
              shadowOpacity: 0.22,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 18,
            })}
          >
            <View
              style={{
                minHeight: 62,
                justifyContent: 'center',
                backgroundColor: isCartCtaDisabled ? '#94A3B8' : PALETTE.dark,
                borderRadius: 18,
                overflow: 'hidden',
              }}
            >
              {/* מצב מכווץ — תוית */}
              <Animated.View
                style={cartBarCollapsedAnimStyle}
                pointerEvents={cartBarStepperExpanded ? 'none' : 'box-none'}
              >
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    gap: 10,
                  }}
                >
                  <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '800',
                      letterSpacing: -0.2,
                      textAlign: 'right',
                      writingDirection: 'rtl',
                    }}
                    numberOfLines={1}
                  >
                    {isMutating
                      ? 'מעדכן עגלה...'
                      : isCartCtaDisabled
                      ? 'לא זמין לרכישה'
                      : quantityInCart
                      ? `הוסף עוד לעגלה · ${quantityInCart} בעגלה`
                      : `הוסף לסל · ${formatPrice(displayPrice, displayCurrencyCode)}`}
                  </Text>
                </View>
              </Animated.View>

              {/* מצב מורחב — סטפר */}
              <Animated.View
                style={[
                  cartBarStepperAnimStyle,
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
                pointerEvents={cartBarStepperExpanded ? 'box-none' : 'none'}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    direction: 'ltr',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minWidth: 200,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    gap: 14,
                  }}
                >
                  <Pressable
                    onPress={cartStepperIncrement}
                    disabled={isMutating || (quantityInCart === 0 && cartPendingOpen)}
                    style={productCartStepperCircleBtn}
                    accessibilityRole="button"
                    accessibilityLabel="הוסף כמות"
                  >
                    <Text style={{ color: PRODUCT_CART_STEPPER_ACCENT, fontSize: 22, fontWeight: '500', marginTop: -1 }}>+</Text>
                  </Pressable>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 20,
                      fontWeight: '800',
                      letterSpacing: -0.3,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {cartBarStepperDisplayQty}
                  </Text>
                  <Pressable
                    onPress={cartStepperDecrement}
                    disabled={isMutating || (quantityInCart === 0 && !cartPendingOpen)}
                    style={productCartStepperCircleBtn}
                    accessibilityRole="button"
                    accessibilityLabel="הפחת כמות"
                  >
                    <Text style={{ color: PRODUCT_CART_STEPPER_ACCENT, fontSize: 24, fontWeight: '400', marginTop: -2 }}>−</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
