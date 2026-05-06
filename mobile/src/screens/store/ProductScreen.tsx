import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, Share, StatusBar, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { fetchProductByHandle, type ShopifyProduct, type ShopifyProductVariant } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import { computeOcdPlusPrice, formatOcdPrice } from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusMark } from '../../components/OcdPlusMark';
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
    collectionTitle: product.primaryCollectionTitle ?? null,
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
  const imageHeight = Dimensions.get('window').width;
  const productTypeLabel = product?.productType?.trim() ?? '';

  // Active variant drives the displayed image, price, and cart variant
  const multipleVariants = (product?.variants.length ?? 0) > 1;
  const activeVariant: ShopifyProductVariant | null = product?.variants[activeVariantIndex] ?? product?.variants[0] ?? null;
  const displayImageUrl = activeVariant?.imageUrl ?? galleryFallbackImage?.url ?? null;
  const displayImageAlt = activeVariant?.imageAltText ?? galleryFallbackImage?.altText ?? null;
  const displayPrice = activeVariant?.price ?? product?.price ?? 0;
  const displayCompareAtPrice = activeVariant?.compareAtPrice ?? product?.compareAtPrice ?? null;
  const displayIsOnSale = !!displayCompareAtPrice && displayCompareAtPrice > displayPrice;
  const displayCurrencyCode = activeVariant?.currencyCode ?? product?.currencyCode ?? 'ILS';
  const displayAvailableForSale = activeVariant?.availableForSale ?? product?.availableForSale ?? false;
  const displayVariantId = activeVariant?.id ?? product?.variantId ?? null;

  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const galleryScrollRef = useRef<FlatList>(null);
  const lightboxScrollRef = useRef<FlatList>(null);

  // Sticky image: translateY = scrollY כדי לנטרל את הגלילה ולשמור את התמונה במקום
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const stickyImageStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(
        scrollY.value,
        [0, imageHeight],
        [0, imageHeight],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  // כמות מקומית — מסונכרנת עם העגלה ומשתנה ע"י הסטפר
  const [pendingQty, setPendingQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);

  // איפוס בחלפת מוצר
  useEffect(() => {
    setPendingQty(1);
    setActiveVariantIndex(0);
  }, [product?.id]);

  // סנכרון pendingQty עם העגלה לאחר שינוי חיצוני
  useEffect(() => {
    if (quantityInCart > 0) {
      setPendingQty(quantityInCart);
    }
  }, [quantityInCart]);

  // לוגיקת כפתור ראשי
  const isInCart = quantityInCart > 0;
  const isQtyModified = isInCart && pendingQty !== quantityInCart;

  const cartButtonLabel = isCartCtaDisabled
    ? 'לא זמין'
    : !isInCart
      ? 'הוסף לעגלה'
      : isQtyModified
        ? 'עדכן כמות בעגלה'
        : 'הסר מוצר מהעגלה';

  const cartButtonBg = isCartCtaDisabled
    ? '#94A3B8'
    : !isInCart
      ? '#000000'
      : isQtyModified
        ? '#16A34A'
        : '#DC2626';

  const cartButtonIcon = !isInCart
    ? 'cart-outline'
    : isQtyModified
      ? 'checkmark-circle-outline'
      : 'trash-outline';

  const handleCartButton = useCallback(() => {
    if (isMutating || isCartCtaDisabled || !product) return;
    if (!isInCart) {
      void addItem(getCartProduct(product, activeVariant), pendingQty);
    } else if (isQtyModified) {
      void updateQuantity(product.id, pendingQty);
    } else {
      void updateQuantity(product.id, 0);
    }
  }, [activeVariant, addItem, isCartCtaDisabled, isInCart, isMutating, isQtyModified, pendingQty, product, updateQuantity]);

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
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 12 }}>
          <ActivityIndicator size="large" color={PALETTE.dark} />
          <Text style={{ color: PALETTE.muted, fontSize: 14, fontWeight: '700', ...RTL_TEXT }}>טוען מוצר…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
          <View style={{ gap: 14 }}>
            <Text style={{ color: PALETTE.text, fontWeight: '800', fontSize: 18, letterSpacing: -0.4, ...RTL_TEXT }}>
              לא הצלחנו להציג את המוצר
            </Text>
            {!!error && (
              <Text style={{ color: PALETTE.muted, fontSize: 14, lineHeight: 22, ...RTL_TEXT }}>{error}</Text>
            )}
            <Pressable
              onPress={() => setReloadSeq((current) => current + 1)}
              style={({ pressed }) => ({
                marginTop: 4,
                borderRadius: 16,
                paddingVertical: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: PALETTE.dark,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: -0.2 }}>נסה שוב</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isCartCtaDisabled = !displayAvailableForSale || !displayVariantId;

  // גובה סרגל הפעולות התחתון — נשמר כקבוע כדי לחשב את ה-padding בגלילה
  const actionBarHeight = Math.max(insets.bottom, 14) + 4 + 12 + 62;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* ── כפתורי ניווט — צפים מעל הכל ── */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 14,
          right: 14,
          zIndex: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* מועדפים + שיתוף */}
        <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
          {/* שיתוף */}
          <Pressable
            onPress={() => void handleShare()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="שתף מוצר"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 5,
            }}
          >
            <Ionicons name="share-outline" size={19} color={PALETTE.text} />
          </Pressable>

          {/* מועדפים */}
          <Pressable
            onPress={handleFavoriteToggle}
            disabled={isFavoritePending(product.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="הוסף למועדפים"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: isFavorite(product.id) ? '#FEE2E2' : '#FFFFFF',
              borderWidth: 1,
              borderColor: isFavorite(product.id) ? 'rgba(220,38,38,0.2)' : 'rgba(0,0,0,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 5,
            }}
          >
            {isFavoritePending(product.id) ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons
                name={isFavorite(product.id) ? 'heart' : 'heart-outline'}
                size={19}
                color={isFavorite(product.id) ? '#DC2626' : PALETTE.text}
              />
            )}
          </Pressable>
        </View>

        {/* כפתור חזרה */}
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 5,
          }}
        >
          <Ionicons name="arrow-back" size={19} color={PALETTE.text} />
        </Pressable>
      </View>

      {/* ── גלילה ראשית ── */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: actionBarHeight }}
        showsVerticalScrollIndicator={false}
        bounces
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ── גלריית תמונות — sticky: translateY מנטרל גלילה ── */}
        <Animated.View style={[{ height: imageHeight, backgroundColor: '#FFFFFF' }, stickyImageStyle]}>
          {galleryItems.length > 0 ? (
            <>
              <FlatList
                ref={galleryScrollRef}
                data={galleryItems}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / imageHeight);
                  setActiveGalleryIndex(index);
                }}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => {
                      setLightboxIndex(index);
                      setLightboxVisible(true);
                    }}
                    style={{ width: imageHeight, height: imageHeight }}
                  >
                    {item.url ? (
                      <Image
                        source={{ uri: item.url }}
                        resizeMode="cover"
                        accessibilityLabel={item.altText ?? 'תמונת מוצר'}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8ECF0', gap: 8 }}>
                        <Ionicons name="image-outline" size={48} color="#94A3B8" />
                        <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '700', ...RTL_TEXT }}>אין תמונה זמינה</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              />

              {/* נקודות אינדיקטור */}
              {galleryItems.length > 1 && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 40,
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {galleryItems.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === activeGalleryIndex ? 18 : 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: i === activeGalleryIndex ? '#000000' : 'rgba(0,0,0,0.25)',
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8ECF0', gap: 8 }}>
              <Ionicons name="image-outline" size={48} color="#94A3B8" />
              <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '700', ...RTL_TEXT }}>אין תמונה זמינה</Text>
            </View>
          )}
        </Animated.View>
        {/* ── מודל תמונה מלאה ── */}
        <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
          <StatusBar hidden />
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
            {/* כפתור סגירה */}
            <Pressable
              onPress={() => setLightboxVisible(false)}
              hitSlop={12}
              style={{
                position: 'absolute',
                top: insets.top + 12,
                right: 16,
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>

            {/* מונה תמונות */}
            {galleryItems.length > 1 && (
              <View style={{ position: 'absolute', top: insets.top + 14, left: 0, right: 0, zIndex: 10, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>
                  {lightboxIndex + 1} / {galleryItems.length}
                </Text>
              </View>
            )}

            {/* גלריה במצב מלא */}
            <FlatList
              ref={lightboxScrollRef}
              data={galleryItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `lightbox-${item.id}`}
              initialScrollIndex={lightboxIndex}
              getItemLayout={(_, index) => ({
                length: Dimensions.get('window').width,
                offset: Dimensions.get('window').width * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setLightboxIndex(index);
              }}
              renderItem={({ item }) => (
                <View style={{ width: Dimensions.get('window').width, height: '100%', justifyContent: 'center' }}>
                  {item.url ? (
                    <Image
                      source={{ uri: item.url }}
                      resizeMode="contain"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Ionicons name="image-outline" size={64} color="#64748B" />
                    </View>
                  )}
                </View>
              )}
            />

            {/* נקודות אינדיקטור במודל */}
            {galleryItems.length > 1 && (
              <View style={{ position: 'absolute', bottom: insets.bottom + 28, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                {galleryItems.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === lightboxIndex ? 18 : 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: i === lightboxIndex ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        </Modal>

        {/* גיליון לבן — מכסה את תחתית התמונה בעיגול */}
        <View
          style={{
            marginTop: -28,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.13,
            shadowRadius: 16,
            elevation: 14,
          }}
        >
        <LinearGradient
          colors={['#FFFFFF', '#F4F5F7', '#ECEEF2', '#F4F5F7', '#FFFFFF']}
          locations={[0, 0.18, 0.45, 0.75, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          {/* ── כותרת ומחיר ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 }}>
            {!!productTypeLabel && productTypeLabel !== 'מוצרים' && (
              <View style={{ flexDirection: 'row-reverse', marginBottom: 10 }}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: '#F1F5F9',
                  }}
                >
                  <Text
                    style={{
                      color: '#64748B',
                      fontWeight: '700',
                      fontSize: 11,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
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
                color: '#0F172A',
                fontSize: 20,
                lineHeight: 28,
                fontWeight: '500',
                letterSpacing: -0.2,
                marginBottom: 16,
                ...RTL_TEXT,
              }}
            >
              {product.title}
            </Text>

            {/* מחיר */}
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              {/* שורת מחיר: מחיר נוכחי + מחיר מקורי עם קו */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <Text
                  style={{
                    color: '#0F172A',
                    fontSize: 26,
                    fontWeight: '700',
                    letterSpacing: -0.5,
                    ...RTL_TEXT,
                  }}
                >
                  {formatPrice(displayPrice, displayCurrencyCode)}
                </Text>
                {displayIsOnSale && (
                  <Text
                    style={{
                      color: '#94A3B8',
                      fontSize: 16,
                      fontWeight: '400',
                      textDecorationLine: 'line-through',
                      ...RTL_TEXT,
                    }}
                  >
                    {formatPrice(displayCompareAtPrice!, displayCurrencyCode)}
                  </Text>
                )}
              </View>

              {/* OCD+ — תגית מחיר חבר */}
              {displayCurrencyCode === 'ILS' && (
                <Pressable
                  onPress={() => navigation.navigate('StoreOcdPlus')}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    alignSelf: 'flex-end',
                  }}
                >
                  <OcdPlusMark size={18} />
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500', writingDirection: 'rtl' }}>
                      עם
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', writingDirection: 'rtl' }}>
                      OCD+
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500', writingDirection: 'rtl' }}>
                      המחיר הוא רק
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', writingDirection: 'rtl' }}>
                      {formatOcdPrice(computeOcdPlusPrice(displayPrice))}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── וריאציות ── */}
          {multipleVariants && (
            <>
              <View style={{ height: 1, backgroundColor: '#DDE1E8', marginHorizontal: 20 }} />
              <View style={{ paddingTop: 18, paddingBottom: 18, paddingHorizontal: 20, gap: 14 }}>
                {/* כותרת + שם הנבחר */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text
                    style={{
                      color: '#0F172A',
                      fontSize: 14,
                      fontWeight: '800',
                      letterSpacing: -0.2,
                      ...RTL_TEXT,
                    }}
                  >
                    בחר וריאציה
                  </Text>
                  {activeVariant && (
                    <Text
                      style={{
                        color: '#64748B',
                        fontSize: 13,
                        fontWeight: '500',
                        ...RTL_TEXT,
                      }}
                      numberOfLines={1}
                    >
                      {activeVariant.title}
                    </Text>
                  )}
                </View>

                {/* תגיות ווריאציות — עוטפות לשורות */}
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  {product.variants.map((variant, index) => {
                    const isActive = index === activeVariantIndex;
                    const isUnavailable = !variant.availableForSale;
                    return (
                      <Pressable
                        key={`${variant.id}-tag`}
                        onPress={() => setActiveVariantIndex(index)}
                        disabled={isUnavailable}
                      >
                        <View
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isActive ? '#000000' : '#CBD5E1',
                            backgroundColor: isActive ? '#000000' : '#FFFFFF',
                            opacity: isUnavailable ? 0.35 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? '#FFFFFF' : '#334155',
                              fontSize: 13.5,
                              fontWeight: isActive ? '700' : '500',
                              textDecorationLine: isUnavailable ? 'line-through' : 'none',
                              ...RTL_TEXT,
                            }}
                          >
                            {variant.title}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* ── תיאור המוצר ── */}
          <View style={{ height: 1, backgroundColor: '#DDE1E8', marginHorizontal: 20 }} />
          <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, gap: 10 }}>
            <Text
              style={{
                color: '#64748B',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                ...RTL_TEXT,
              }}
            >
              תיאור המוצר
            </Text>
            <View style={{ gap: 8 }}>
              {descriptionParts.map((part, index) => (
                <Text
                  key={`${product.id}-desc-${index}`}
                  style={{ color: '#334155', lineHeight: 25, fontSize: 14.5, ...RTL_TEXT }}
                >
                  {part}
                </Text>
              ))}
            </View>
          </View>

          {/* ── פרטי אמון ── */}
          <View style={{ height: 1, backgroundColor: '#DDE1E8', marginHorizontal: 20, marginTop: 16 }} />
          <View
            style={{
              flexDirection: 'row-reverse',
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            {[
              { icon: 'shield-checkmark-outline' as const, label: 'תשלום מאובטח' },
              { icon: 'refresh-outline' as const, label: 'החזרה קלה' },
              { icon: 'flash-outline' as const, label: 'משלוח מהיר' },
            ].map((item, i) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 5,
                  borderRightWidth: i < 2 ? 1 : 0,
                  borderRightColor: '#F0F2F5',
                }}
              >
                <Ionicons name={item.icon} size={20} color="#64748B" />
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>
        </View>
      </Animated.ScrollView>

      {/* ── סרגל פעולות תחתון קבוע ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 16) + 4,
          borderTopWidth: 1,
          borderTopColor: '#F0F2F5',
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.07,
          shadowRadius: 12,
          elevation: 14,
        }}
      >
        {/* שורה: [כפתור פעולה]  [− כמות +] */}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', width: '100%' }}>

          {/* כפתור ראשי — דינמי לפי מצב */}
          <Pressable
            onPress={handleCartButton}
            disabled={isMutating || isCartCtaDisabled}
            accessibilityRole="button"
            accessibilityLabel={cartButtonLabel}
            style={{
              flex: 1,
              height: 58,
              borderRadius: 18,
              backgroundColor: cartButtonBg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              paddingHorizontal: 18,
              shadowColor: cartButtonBg,
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 5 },
              elevation: 8,
            }}
          >
            {isMutating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={cartButtonIcon} size={20} color="#FFFFFF" />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                    {cartButtonLabel}
                  </Text>
                  {!isCartCtaDisabled && (
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', textAlign: 'center' }}>
                      {formatPrice(displayPrice * pendingQty, displayCurrencyCode)}
                    </Text>
                  )}
                </View>
              </>
            )}
          </Pressable>

          {/* סטפר כמות */}
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 58, gap: 4, paddingHorizontal: 2 }}>
            {/* + */}
            <Pressable
              onPress={() => { if (!isMutating && !isCartCtaDisabled) setPendingQty((p) => p + 1); }}
              disabled={isMutating || isCartCtaDisabled}
              accessibilityRole="button"
              accessibilityLabel="הוסף כמות"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: '400', color: isCartCtaDisabled ? '#CBD5E1' : '#000000', lineHeight: 28, includeFontPadding: false }}>+</Text>
            </Pressable>

            {/* כמות */}
            <View style={{ width: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ textAlign: 'center', fontSize: 18, fontWeight: '700', color: isCartCtaDisabled ? '#CBD5E1' : '#000000', fontVariant: ['tabular-nums'], includeFontPadding: false }}>
                {pendingQty}
              </Text>
            </View>

            {/* − */}
            <Pressable
              onPress={() => { if (!isMutating && !isCartCtaDisabled) setPendingQty((p) => Math.max(1, p - 1)); }}
              disabled={isMutating || isCartCtaDisabled}
              accessibilityRole="button"
              accessibilityLabel="הפחת כמות"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 26, fontWeight: '300', color: isCartCtaDisabled ? '#CBD5E1' : '#000000', lineHeight: 30, includeFontPadding: false }}>−</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
