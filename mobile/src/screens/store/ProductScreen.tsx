import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
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
import { Screen } from '../../components/Screen';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { Card } from '../../components/ui/Card';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { fetchProductByHandle, type ShopifyProduct } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import { OcdPlusProductPriceBlock } from '../../components/OcdPlusProductPriceBlock';
import { useAuth } from '../../state/AuthContext';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from './StoreHomeScreen';

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

/** Matches `StoreFloatingTabBar` dock shells — reused for visual consistency in-page. */
const STORE_FLOATING_DOCK_SHADOW = {
  shadowColor: '#000000' as const,
  shadowOpacity: 0.14,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
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

function getCartProduct(product: ShopifyProduct) {
  return {
    id: product.id,
    name: product.title,
    subtitle: product.productType?.trim() ?? '',
    collectionTitle: null,
    price: product.price,
    currencyCode: product.currencyCode,
    handle: product.handle,
    description: product.description,
    imageUrl: product.imageUrl,
    imageAltText: product.imageAltText,
    variantId: product.variantId ?? '',
    variantTitle: product.variantTitle,
    coverColor: '#F3F4F6',
    accentColor: '#FFFFFF',
  };
}

export function ProductScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);

  const handleStoreTabPress = useCallback(
    (tabId: StoreBottomTabId) => {
      if (tabId === 'favorites') {
        navigation.navigate('StoreFavorites');
        return;
      }
      if (tabId === 'search') {
        navigation.navigate('StoreSearch');
        return;
      }
      if (tabId === 'profile') {
        navigation.navigate('Login');
        return;
      }
      if (tabId === 'cart') {
        navigation.navigate('StoreCart');
        return;
      }
      navigation.navigate('Main', {
        initialTab: 'home',
        initialTabRequestId: Date.now(),
      });
    },
    [navigation]
  );

  const { user } = useAuth();
  const isOcdPlusSubscriber = user?.role === 'customer' && !!user.ocd_plus_subscriber;
  const { addItem, getQuantity, updateQuantity, isMutating } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const handle = route.params.handle;
  const [reloadSeq, setReloadSeq] = useState(0);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const galleryItems = useMemo(() => buildGalleryItems(product), [product]);
  const descriptionParts = useMemo(() => normalizeDescription(product?.description ?? ''), [product?.description]);
  const quantityInCart = product ? getQuantity(product.id) : 0;
  const activeImage = galleryItems[activeImageIndex] ?? galleryItems[0] ?? null;
  const imageHeight = 360;
  const productTypeLabel = product?.productType?.trim() ?? '';

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
    clearCartStepperTimer();
  }, [product?.id, clearCartStepperTimer]);

  const addFirstToCartAndOpenStepper = useCallback(() => {
    if (!product?.availableForSale || !product.variantId || isMutating) return;
    setCartPendingOpen(true);
    openCartStepper();
    void addItem(getCartProduct(product)).catch(() => {
      setCartPendingOpen(false);
      setCartStepperOpen(false);
      clearCartStepperTimer();
    });
  }, [addItem, clearCartStepperTimer, isMutating, openCartStepper, product]);

  const onCollapsedCartBarPress = useCallback(() => {
    if (!product?.availableForSale || !product.variantId || isMutating) return;
    if (quantityInCart === 0) {
      void addFirstToCartAndOpenStepper();
      return;
    }
    openCartStepper();
  }, [addFirstToCartAndOpenStepper, isMutating, openCartStepper, product, quantityInCart]);

  const cartStepperIncrement = useCallback(() => {
    if (!product?.availableForSale || isMutating) return;
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
        setActiveImageIndex(0);
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

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              paddingHorizontal: 16,
              paddingBottom: contentPaddingBottom,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.muted, fontWeight: '700' }}>טוען מוצר…</Text>
          </View>
          <StoreFloatingTabBar activeTab={null} onTabPress={handleStoreTabPress} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: contentPaddingBottom }}>
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
          <StoreFloatingTabBar activeTab={null} onTabPress={handleStoreTabPress} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <Screen padded={false} backgroundColor={colors.bg}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: contentPaddingBottom + 20,
              gap: 18,
            }}
            showsVerticalScrollIndicator={false}
          >
        <View
          style={{
            borderRadius: 26,
            overflow: 'hidden',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#0F172A',
            shadowOpacity: 0.1,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <View style={{ height: imageHeight, position: 'relative', backgroundColor: '#EEF2F7' }}>
            {activeImage?.url ? (
              <Image
                source={{ uri: activeImage.url }}
                resizeMode="cover"
                accessibilityLabel={activeImage.altText ?? 'תמונת מוצר'}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#E2E8F0',
                }}
              >
                <Ionicons name="image-outline" size={44} color="#64748B" />
                <Text style={{ marginTop: 10, color: '#475569', fontWeight: '700', ...RTL_TEXT }}>אין תמונה זמינה</Text>
              </View>
            )}

            {galleryItems.length > 1 && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 14,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {galleryItems.map((_, index) => (
                  <View
                    key={`dot-${product.id}-${index}`}
                    style={{
                      height: 6,
                      borderRadius: 3,
                      width: index === activeImageIndex ? 22 : 6,
                      backgroundColor: index === activeImageIndex ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                    }}
                  />
                ))}
              </View>
            )}
          </View>

          {galleryItems.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}
            >
              {galleryItems.map((item, index) => (
                <Pressable
                  key={`${item.id}-thumb`}
                  onPress={() => setActiveImageIndex(index)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: index === activeImageIndex ? colors.text : colors.border,
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  {item.url ? (
                    <Image
                      source={{ uri: item.url }}
                      resizeMode="cover"
                      accessibilityLabel={item.altText ?? `תמונה ${index + 1}`}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' }}>
                      <Ionicons name="image-outline" size={20} color="#64748B" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={{ gap: 10, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 20 }}>
            {!!productTypeLabel && productTypeLabel !== 'מוצרים' && (
              <View style={{ alignSelf: 'flex-end' }}>
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

            <Text
              style={{
                width: '100%',
                color: colors.text,
                fontSize: 24,
                lineHeight: 32,
                fontWeight: '900',
                letterSpacing: -0.3,
                ...RTL_TEXT,
              }}
            >
              {product.title}
            </Text>

            {product.currencyCode === 'ILS' ? (
              <OcdPlusProductPriceBlock
                regularPrice={product.price}
                isOcdPlusSubscriber={isOcdPlusSubscriber}
                onSubscribePress={() => navigation.navigate('StoreOcdPlus')}
                titleSize={24}
              />
            ) : (
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', ...RTL_TEXT }}>
                {formatPrice(product.price, product.currencyCode)}
              </Text>
            )}
          </View>
        </View>

        <Card
          style={{
            gap: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            shadowColor: '#0F172A',
            shadowOpacity: 0.06,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, ...RTL_TEXT }}>תיאור המוצר</Text>
          {descriptionParts.map((part, index) => (
            <Text key={`${product.id}-desc-${index}`} style={{ color: colors.muted, lineHeight: 25, fontSize: 15, ...RTL_TEXT }}>
              {part}
            </Text>
          ))}
        </Card>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#0F172A',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 5,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <View
              style={{
                backgroundColor: '#FAFAFA',
                borderRadius: 999,
                padding: 4,
                borderWidth: 1,
                borderColor: colors.border,
                flexShrink: 0,
                ...STORE_FLOATING_DOCK_SHADOW,
              }}
            >
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="חזרה"
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  minHeight: 44,
                  maxWidth: 44,
                  maxHeight: 44,
                  borderRadius: 22,
                  alignSelf: 'flex-start',
                  flexShrink: 0,
                  overflow: 'hidden',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="arrow-forward" size={22} color={colors.text} />
                </View>
              </Pressable>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 280,
                alignSelf: 'center',
                backgroundColor: '#FAFAFA',
                borderRadius: 999,
                padding: 5,
                paddingHorizontal: 8,
                borderWidth: 1,
                borderColor: colors.border,
                ...STORE_FLOATING_DOCK_SHADOW,
              }}
            >
              <Pressable
                onPress={cartBarStepperExpanded ? undefined : onCollapsedCartBarPress}
                disabled={isMutating || !product.availableForSale || !product.variantId}
                style={({ pressed }) => ({
                  opacity: pressed && !cartBarStepperExpanded ? 0.75 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="הוסף לעגלה"
              >
                <View style={{ minHeight: 46, justifyContent: 'center', overflow: 'visible' }}>
                  <Animated.View
                    style={cartBarCollapsedAnimStyle}
                    pointerEvents={cartBarStepperExpanded ? 'none' : 'box-none'}
                  >
                    <View
                      style={{
                        minHeight: 40,
                        justifyContent: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 8,
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <Ionicons
                        name="cart-outline"
                        size={22}
                        color={isMutating || !product.availableForSale || !product.variantId ? '#94A3B8' : colors.text}
                      />
                      <Text
                        style={{
                          color: isMutating || !product.availableForSale || !product.variantId ? '#94A3B8' : colors.text,
                          fontSize: 14,
                          fontWeight: '900',
                          textAlign: 'right',
                          writingDirection: 'rtl',
                          flexShrink: 1,
                        }}
                        numberOfLines={2}
                      >
                        {isMutating
                          ? 'מעדכן עגלה...'
                          : !product.availableForSale || !product.variantId
                            ? 'לא זמין לרכישה'
                            : quantityInCart
                              ? `הוסף עוד לעגלה (${quantityInCart})`
                              : 'הוסף לעגלה'}
                      </Text>
                    </View>
                  </Animated.View>

                  <Animated.View
                    style={[
                      cartBarStepperAnimStyle,
                      {
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
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
                        minWidth: 176,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: PRODUCT_CART_STEPPER_BAR_BG,
                        borderRadius: 999,
                        gap: 8,
                      }}
                    >
                      <Pressable
                        onPress={cartStepperIncrement}
                        disabled={isMutating || (quantityInCart === 0 && cartPendingOpen)}
                        style={productCartStepperCircleBtn}
                        accessibilityRole="button"
                        accessibilityLabel="הוסף כמות"
                      >
                        <Text
                          style={{
                            color: PRODUCT_CART_STEPPER_ACCENT,
                            fontSize: 20,
                            fontWeight: '500',
                            marginTop: -1,
                          }}
                        >
                          +
                        </Text>
                      </Pressable>
                      <Text
                        style={{
                          color: PRODUCT_CART_STEPPER_ACCENT,
                          fontSize: 17,
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
                        <Text
                          style={{
                            color: PRODUCT_CART_STEPPER_ACCENT,
                            fontSize: 22,
                            fontWeight: '400',
                            marginTop: -2,
                          }}
                        >
                          −
                        </Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                </View>
              </Pressable>
            </View>

            <View
              style={{
                backgroundColor: '#FAFAFA',
                borderRadius: 999,
                padding: 4,
                borderWidth: 1,
                borderColor: colors.border,
                flexShrink: 0,
                ...STORE_FLOATING_DOCK_SHADOW,
              }}
            >
              <FavoriteToggleButton
                active={isFavorite(product.id)}
                loading={isFavoritePending(product.id)}
                onPress={handleFavoriteToggle}
                size={44}
              />
            </View>
          </View>
        </View>
      </ScrollView>
        </Screen>
        <StoreFloatingTabBar activeTab={null} onTabPress={handleStoreTabPress} />
      </View>
    </SafeAreaView>
  );
}
