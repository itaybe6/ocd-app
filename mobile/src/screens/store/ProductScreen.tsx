import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
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
import { Card } from '../../components/ui/Card';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { fetchProductByHandle, type ShopifyProduct, type ShopifyProductVariant } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import { OcdPlusProductPriceBlock } from '../../components/OcdPlusProductPriceBlock';
import { useAuth } from '../../state/AuthContext';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';

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

const PRODUCT_CART_STEPPER_BAR_BG = '#E5E7EB';
const PRODUCT_CART_STEPPER_ACCENT = '#000000';

const productCartStepperCircleBtn = {
  width: 32,
  height: 32,
  borderRadius: 16,
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
    if (!displayAvailableForSale || isMutating) return;
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

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.muted, fontWeight: '700' }}>טוען מוצר…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18, ...RTL_TEXT }}>לא הצלחנו להציג את המוצר</Text>
            {!!error && <Text style={{ color: colors.muted, marginTop: 8, ...RTL_TEXT }}>{error}</Text>}
            <Pressable
              onPress={() => setReloadSeq((current) => current + 1)}
              style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.94 : 1 })}
            >
              <View
                style={{
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.elevated,
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '900' }}>רענן</Text>
              </View>
            </Pressable>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#EEF2F7' }}>
      {/* ── Full-bleed image hero ── */}
      <View style={{ height: imageHeight, position: 'relative', backgroundColor: '#EEF2F7' }}>
        {displayImageUrl ? (
          <Image
            source={{ uri: displayImageUrl }}
            resizeMode="cover"
            accessibilityLabel={displayImageAlt ?? 'תמונת מוצר'}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' }}>
            <Ionicons name="image-outline" size={44} color="#64748B" />
            <Text style={{ marginTop: 10, color: '#475569', fontWeight: '700', ...RTL_TEXT }}>אין תמונה זמינה</Text>
          </View>
        )}

        {/* Top action bar — share + favorite + back, grouped together on the left */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 10,
            left: 16,
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => void handleShare()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="שתף מוצר"
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Ionicons name="share-outline" size={20} color="#0F172A" />
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
              borderRadius: 21,
              backgroundColor: isFavorite(product.id) ? 'rgba(254,226,226,0.96)' : 'rgba(255,255,255,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
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
                color={isFavorite(product.id) ? '#DC2626' : '#0F172A'}
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Ionicons name="arrow-forward" size={20} color="#0F172A" />
          </Pressable>
        </View>
      </View>

      {/* ── Content sheet ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -28,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: 18,
            paddingBottom: 20,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand row */}
          {!!productTypeLabel && productTypeLabel !== 'מוצרים' && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 20 }}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: '#EEF2FF',
                  borderWidth: 1,
                  borderColor: '#C7D2FE',
                }}
              >
                <Text style={{ color: '#4338CA', fontWeight: '800', fontSize: 12, ...RTL_TEXT }}>{productTypeLabel}</Text>
              </View>
            </View>
          )}

          {/* Title */}
          <Text
            style={{
              paddingHorizontal: 20,
              color: colors.text,
              fontSize: 26,
              lineHeight: 34,
              fontWeight: '900',
              letterSpacing: -0.4,
              ...RTL_TEXT,
            }}
          >
            {product.title}
          </Text>

          {/* Price */}
          {displayCurrencyCode === 'ILS' ? (
            <View style={{ paddingHorizontal: 20 }}>
              <OcdPlusProductPriceBlock
                regularPrice={displayPrice}
                isOcdPlusSubscriber={isOcdPlusSubscriber}
                onSubscribePress={() => navigation.navigate('StoreOcdPlus')}
                titleSize={24}
              />
            </View>
          ) : (
            <Text style={{ paddingHorizontal: 20, color: colors.text, fontSize: 24, fontWeight: '900', ...RTL_TEXT }}>
              {formatPrice(displayPrice, displayCurrencyCode)}
            </Text>
          )}

          {/* ── Variant pills ── */}
          {multipleVariants && (
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', ...RTL_TEXT }}>בחר וריאציה</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 2 }}
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
                        paddingVertical: 11,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: isActive ? '#0F172A' : colors.border,
                        backgroundColor: isActive ? '#0F172A' : isUnavailable ? '#F1F5F9' : colors.card,
                        opacity: pressed ? 0.78 : isUnavailable ? 0.55 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: isActive ? '#FFFFFF' : isUnavailable ? '#94A3B8' : colors.text,
                          fontSize: 14,
                          fontWeight: '800',
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

          {/* Description */}
          <Card
            style={{
              marginHorizontal: 20,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bg,
              shadowColor: '#0F172A',
              shadowOpacity: 0.04,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, ...RTL_TEXT }}>תיאור המוצר</Text>
            {descriptionParts.map((part, index) => (
              <Text key={`${product.id}-desc-${index}`} style={{ color: colors.muted, lineHeight: 25, fontSize: 15, ...RTL_TEXT }}>
                {part}
              </Text>
            ))}
          </Card>
        </ScrollView>

        {/* ── Cart bar ── */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Pressable
            onPress={cartBarStepperExpanded ? undefined : onCollapsedCartBarPress}
            disabled={isMutating || !displayAvailableForSale || !displayVariantId}
            accessibilityRole="button"
            accessibilityLabel="הוסף לעגלה"
            style={({ pressed }) => ({
              borderRadius: 999,
              overflow: 'hidden',
              opacity: pressed && !cartBarStepperExpanded ? 0.82 : 1,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            })}
          >
            <View
              style={{
                minHeight: 60,
                justifyContent: 'center',
                backgroundColor: !displayAvailableForSale || !displayVariantId ? '#94A3B8' : '#0F172A',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              {/* Collapsed label */}
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
                    gap: 8,
                  }}
                >
                  <Ionicons name="cart-outline" size={22} color="#FFFFFF" />
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '900',
                      textAlign: 'right',
                      writingDirection: 'rtl',
                    }}
                    numberOfLines={1}
                  >
                      {isMutating
                          ? 'מעדכן עגלה...'
                          : !displayAvailableForSale || !displayVariantId
                            ? 'לא זמין לרכישה'
                            : quantityInCart
                              ? `הוסף עוד לעגלה (${quantityInCart})`
                              : `הוסף לסל · ${formatPrice(displayPrice, displayCurrencyCode)}`}
                  </Text>
                </View>
              </Animated.View>

              {/* Expanded stepper */}
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
                    minWidth: 180,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    gap: 12,
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
