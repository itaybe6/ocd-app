import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, Pressable, Share, StatusBar, StyleSheet, Text, View } from 'react-native';
import Toast from '../../components/toast/Toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { fetchProductByHandle, type ShopifyProduct, type ShopifyProductVariant } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { createCheckout } from '../../services/shopify';
import { useBrands } from '../../hooks/useBrands';
import { ProductBrandBadge } from '../../components/ProductBrandBadge';
import { ProductDescription } from '../../components/ProductDescription';
import { OcdPlusMemberPriceHint, computeOcdPlusPrice, formatOcdPrice } from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { useOcdPlusSubscribeSheet } from '../../context/OcdPlusSubscribeSheetContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

type ProductGalleryItem = {
  id: string;
  type: 'image' | 'video';
  url: string | null;
  altText: string | null;
  previewUrl: string | null;
};

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

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
  gold: '#C18D39',
  galleryBg: '#F5F7F9',
  success: '#16A34A',
  danger: '#DC2626',
};

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') return `₪${price.toLocaleString('he-IL')}.00`;
  return `${price.toLocaleString('he-IL')} ${currencyCode}`;
}

function buildGalleryItems(product: ShopifyProduct | null): ProductGalleryItem[] {
  if (!product) return [];

  if (product.media.length) {
    return product.media.map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      altText: item.altText,
      previewUrl: item.previewUrl,
    }));
  }

  if (product.images.length) {
    return product.images.map((image, index) => ({
      id: `${product.id}-image-${index}`,
      type: 'image' as const,
      url: image.url,
      altText: image.altText,
      previewUrl: null,
    }));
  }

  if (product.imageUrl) {
    return [
      {
        id: `${product.id}-featured`,
        type: 'image',
        url: product.imageUrl,
        altText: product.imageAltText,
        previewUrl: null,
      },
    ];
  }

  return [{ id: `${product.id}-placeholder`, type: 'image', url: null, altText: null, previewUrl: null }];
}

function galleryUrlsMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const strip = (url: string) => url.split('?')[0];
  return strip(a) === strip(b);
}

/** אינדקס בגלריה לתמונת וריאציה; אם אין תמונה לוריאציה — חוזרים לתמונה הראשית (0) */
function findGalleryIndexForVariant(
  galleryItems: ProductGalleryItem[],
  variantImageUrl: string | null | undefined,
): number {
  if (!variantImageUrl || galleryItems.length === 0) return 0;
  const index = galleryItems.findIndex(
    (item) => item.type === 'image' && galleryUrlsMatch(item.url, variantImageUrl),
  );
  return index >= 0 ? index : 0;
}

/** תצוגת סרטון בגלריה — תמונת preview + play (ניגון אמיתי בלייטבוקס; transform על ההורה שובר Video ב־iOS) */
function GalleryVideoPreview({
  previewUrl,
  altText,
  width,
  height,
}: {
  previewUrl: string | null;
  altText: string | null;
  width: number;
  height: number;
}) {
  return (
    <View style={{ width, height, backgroundColor: '#0F172A' }}>
      {previewUrl ? (
        <Image
          source={{ uri: previewUrl }}
          resizeMode="cover"
          accessibilityLabel={altText ?? 'סרטון מוצר'}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#E8ECF0' }} />
      )}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15,23,42,0.28)',
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(255,255,255,0.94)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#0F172A',
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Ionicons name="play" size={28} color="#0F172A" style={{ marginLeft: 3 }} />
        </View>
      </View>
    </View>
  );
}

/** נגן סרטון בלייטבוקס — בלי poster של expo-av (חוסם אינטראקציה) ובלי transform על ההורה */
function LightboxVideoPlayer({
  url,
  previewUrl,
  altText,
  isActive,
  width,
}: {
  url: string;
  previewUrl: string | null;
  altText: string | null;
  isActive: boolean;
  width: number;
}) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    setHasStarted(false);
    setIsPlaying(false);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!isActive) {
          await videoRef.current?.pauseAsync();
          if (!cancelled) setIsPlaying(false);
          return;
        }
        await videoRef.current?.playAsync();
        if (!cancelled) {
          setHasStarted(true);
          setIsPlaying(true);
        }
      } catch {
        // playAsync יכול להיכשל לפני שהקובץ נטען — לא מסמנים שגיאה כאן
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isActive, url]);

  return (
    <View style={{ width, height: '100%', justifyContent: 'center', backgroundColor: '#000000' }}>
      <Video
        key={url}
        ref={videoRef}
        source={{ uri: url }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay={isActive}
        useNativeControls
        onPlaybackStatusUpdate={(status) => {
          if (!status.isLoaded) {
            if ('error' in status && status.error) setLoadError(true);
            return;
          }
          setLoadError(false);
          setIsPlaying(status.isPlaying);
          if (status.isPlaying) setHasStarted(true);
        }}
        onError={() => setLoadError(true)}
        accessibilityLabel={altText ?? 'סרטון מוצר'}
      />
      {(!hasStarted || loadError) && previewUrl ? (
        <Image
          source={{ uri: previewUrl }}
          resizeMode="contain"
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            opacity: isPlaying ? 0 : 1,
          }}
        />
      ) : null}
      {loadError ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
            gap: 8,
            paddingHorizontal: 24,
          }}
        >
          <Ionicons name="alert-circle-outline" size={36} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            לא ניתן לנגן את הסרטון
          </Text>
        </View>
      ) : null}
    </View>
  );
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

/** כפתור עגול צף — ניווט/שיתוף/מועדפים מעל הגלריה */
function FloatingCircleButton({
  onPress,
  disabled,
  label,
  children,
  active = false,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: active ? '#FEE2E2' : 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: active ? 'rgba(220,38,38,0.2)' : 'rgba(15,23,42,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0F172A',
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

export function ProductScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { addItem, getQuantity, updateQuantity, isMutating } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const { data: remoteBrands = [] } = useBrands();
  const { isActiveMember } = useOcdPlusMembership();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const handle = route.params.handle;
  const [reloadSeq, setReloadSeq] = useState(0);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);

  const galleryItems = useMemo(() => buildGalleryItems(product), [product]);
  const quantityInCart = product ? getQuantity(product.id) : 0;
  const galleryFallbackImage = galleryItems[0] ?? null;
  const imageHeight = Dimensions.get('window').width;
  const productTypeLabel = product?.productType?.trim() ?? '';

  // Active variant drives the displayed image, price, and cart variant
  const multipleVariants = (product?.variants.length ?? 0) > 1;
  const activeVariant: ShopifyProductVariant | null = product?.variants[activeVariantIndex] ?? product?.variants[0] ?? null;
  const displayPrice = activeVariant?.price ?? product?.price ?? 0;
  const displayCompareAtPrice = activeVariant?.compareAtPrice ?? product?.compareAtPrice ?? null;
  const displayIsOnSale = !!displayCompareAtPrice && displayCompareAtPrice > displayPrice;
  const displayCurrencyCode = activeVariant?.currencyCode ?? product?.currencyCode ?? 'ILS';
  const displayAvailableForSale = activeVariant?.availableForSale ?? product?.availableForSale ?? false;
  const displayVariantId = activeVariant?.id ?? product?.variantId ?? null;
  const discountPercent = displayIsOnSale
    ? Math.round((1 - displayPrice / displayCompareAtPrice!) * 100)
    : 0;
  const ocdPlusPrice = useMemo(() => computeOcdPlusPrice(displayPrice), [displayPrice]);
  const checkoutUnitPrice = isActiveMember ? ocdPlusPrice : displayPrice;

  const isCartCtaDisabled = !displayAvailableForSale || !displayVariantId;

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
  /** התמונה מתכווצת ומתעמעמת מעט בגלילה — נותן עומק בלי לפגוע בביצועים */
  const galleryZoomStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, imageHeight * 0.9], [1, 0.35], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [-imageHeight, 0], [1.35, 1], Extrapolation.CLAMP) },
    ],
  }));

  // כמות מקומית — מסונכרנת עם העגלה ומשתנה ע"י הסטפר
  const [pendingQty, setPendingQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);

  // איפוס בחלפת מוצר
  useEffect(() => {
    setPendingQty(1);
    setActiveVariantIndex(0);
    setActiveGalleryIndex(0);
  }, [product?.id]);

  // מעבר לתמונת הוריאציה בגלריה — רק אם לוריאציה יש תמונה משלה; אחרת נשארים על הראשית
  useEffect(() => {
    if (!product || galleryItems.length === 0) return;

    const targetIndex = activeVariant?.imageUrl
      ? findGalleryIndexForVariant(galleryItems, activeVariant.imageUrl)
      : 0;

    setActiveGalleryIndex(targetIndex);
    requestAnimationFrame(() => {
      galleryScrollRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
      });
    });
  }, [activeVariant?.id, activeVariant?.imageUrl, galleryItems, product]);

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

  // גובה סרגל הפעולות הצף התחתון — משמש לחישוב padding בגלילה
  const actionBarHeight = Math.max(insets.bottom, 12) + 112;

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
          <FloatingCircleButton onPress={() => void handleShare()} label="שתף מוצר">
            <Ionicons name="share-outline" size={19} color={PALETTE.text} />
          </FloatingCircleButton>

          <FloatingCircleButton
            onPress={handleFavoriteToggle}
            disabled={isFavoritePending(product.id)}
            label="הוסף למועדפים"
            active={isFavorite(product.id)}
          >
            {isFavoritePending(product.id) ? (
              <ActivityIndicator size="small" color={PALETTE.danger} />
            ) : (
              <Ionicons
                name={isFavorite(product.id) ? 'heart' : 'heart-outline'}
                size={19}
                color={isFavorite(product.id) ? PALETTE.danger : PALETTE.text}
              />
            )}
          </FloatingCircleButton>
        </View>

        {/* כפתור חזרה */}
        <FloatingCircleButton onPress={() => navigation.goBack()} label="חזרה">
          <Ionicons name="arrow-back" size={19} color={PALETTE.text} />
        </FloatingCircleButton>
      </View>

      {/* ── גלילה ראשית ── */}
      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ paddingBottom: actionBarHeight, backgroundColor: '#FFFFFF' }}
        showsVerticalScrollIndicator={false}
        bounces
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ── גלריית תמונות — sticky: translateY מנטרל גלילה ── */}
        <Animated.View style={[{ height: imageHeight, backgroundColor: PALETTE.galleryBg, overflow: 'hidden' }, stickyImageStyle]}>
          {galleryItems.length > 0 ? (
            <>
              <Animated.View style={[{ flex: 1 }, galleryZoomStyle]}>
                <FlatList
                  ref={galleryScrollRef}
                  data={galleryItems}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                      galleryScrollRef.current?.scrollToIndex({
                        index: info.index,
                        animated: true,
                      });
                    }, 80);
                  }}
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
                      {item.type === 'video' && item.url ? (
                        <GalleryVideoPreview
                          previewUrl={item.previewUrl}
                          altText={item.altText}
                          width={imageHeight}
                          height={imageHeight}
                        />
                      ) : item.url ? (
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
              </Animated.View>

              {/* מונה תמונות + נקודות אינדיקטור */}
              {galleryItems.length > 1 && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 44,
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  >
                    {galleryItems.map((item, i) => (
                      <View
                        key={item.id}
                        style={{
                          width: i === activeGalleryIndex ? (item.type === 'video' ? 22 : 18) : 7,
                          height: i === activeGalleryIndex && item.type === 'video' ? 14 : 7,
                          borderRadius: 4,
                          backgroundColor: i === activeGalleryIndex ? '#0F172A' : 'rgba(15,23,42,0.25)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i === activeGalleryIndex && item.type === 'video' ? (
                          <Ionicons name="play" size={8} color="#FFFFFF" style={{ marginLeft: 1 }} />
                        ) : null}
                      </View>
                    ))}
                  </View>
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
              renderItem={({ item, index }) => {
                const slideWidth = Dimensions.get('window').width;
                const isNearActive = Math.abs(index - lightboxIndex) <= 1;
                return (
                  <View style={{ width: slideWidth, height: '100%', justifyContent: 'center' }}>
                    {item.type === 'video' && item.url ? (
                      isNearActive ? (
                        <LightboxVideoPlayer
                          url={item.url}
                          previewUrl={item.previewUrl}
                          altText={item.altText}
                          isActive={lightboxVisible && index === lightboxIndex}
                          width={slideWidth}
                        />
                      ) : item.previewUrl ? (
                        <Image
                          source={{ uri: item.previewUrl }}
                          resizeMode="contain"
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <View style={{ flex: 1, backgroundColor: '#000000' }} />
                      )
                    ) : item.url ? (
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
                );
              }}
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

        {/* ── גיליון תוכן — מכסה את תחתית התמונה בעיגול ── */}
        <View
          style={{
            marginTop: -30,
            position: 'relative',
            zIndex: 2,
            overflow: 'visible',
          }}
        >
          {product ? (
            <ProductBrandBadge
              product={{
                tags: product.tags,
                collectionHandles: product.collectionHandles,
                collectionTitles: product.collectionTitles,
              }}
              brands={remoteBrands}
              size={42}
              top={-21}
              right={20}
              zIndex={20}
            />
          ) : null}
          <View
            style={{
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundColor: '#FFFFFF',
            }}
          >
          {/* ידית גרירה ויזואלית */}
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
          </View>

          {/* ── כותרת ומחיר ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
            {/* שורת תגיות: זמינות (ימין) + קטגוריה (שמאל) */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: displayAvailableForSale ? PALETTE.success : PALETTE.danger,
                  }}
                />
                <Text
                  style={{
                    color: displayAvailableForSale ? PALETTE.success : PALETTE.danger,
                    fontSize: 12,
                    fontWeight: '700',
                    ...RTL_TEXT,
                  }}
                >
                  {displayAvailableForSale ? 'במלאי' : 'אזל מהמלאי'}
                </Text>
              </View>

              {!!productTypeLabel && productTypeLabel !== 'מוצרים' && (
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
                      color: '#475569',
                      fontWeight: '800',
                      fontSize: 11,
                      letterSpacing: 0.5,
                      ...RTL_TEXT,
                    }}
                  >
                    {productTypeLabel}
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={{
                color: PALETTE.text,
                fontSize: 22,
                lineHeight: 30,
                fontWeight: '800',
                letterSpacing: -0.3,
                ...RTL_TEXT,
              }}
            >
              {product.title}
            </Text>

            {/* מחיר */}
            <View style={{ marginTop: 16, alignItems: 'flex-end', gap: 8 }}>
              {isActiveMember ? (
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <OcdPlusMark size={22} />
                    <Text
                      style={{
                        color: PALETTE.muted,
                        fontSize: 13,
                        fontWeight: '700',
                        letterSpacing: -0.1,
                        ...RTL_TEXT,
                      }}
                    >
                      מחיר לחברי OCD+
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: PALETTE.text,
                      fontSize: 32,
                      fontWeight: '900',
                      letterSpacing: -1,
                      lineHeight: 38,
                      ...RTL_TEXT,
                    }}
                  >
                    {formatOcdPrice(ocdPlusPrice)}
                  </Text>
                  <Text
                    style={{
                      color: PALETTE.softText,
                      fontSize: 13.5,
                      fontWeight: '500',
                      ...RTL_TEXT,
                    }}
                  >
                    מחיר רגיל:{' '}
                    <Text style={{ textDecorationLine: 'line-through' }}>
                      {formatPrice(displayPrice, displayCurrencyCode)}
                    </Text>
                  </Text>
                </View>
              ) : (
                <>
                  {displayIsOnSale && discountPercent > 0 && (
                    <View
                      style={{
                        backgroundColor: PALETTE.danger,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', writingDirection: 'rtl' }}>
                        {discountPercent}% הנחה
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text
                      style={{
                        color: PALETTE.text,
                        fontSize: 30,
                        fontWeight: '900',
                        letterSpacing: -0.8,
                        lineHeight: 34,
                        ...RTL_TEXT,
                      }}
                    >
                      {formatPrice(displayPrice, displayCurrencyCode)}
                    </Text>
                    {displayIsOnSale && (
                      <Text
                        style={{
                          color: PALETTE.softText,
                          fontSize: 15,
                          fontWeight: '600',
                          textDecorationLine: 'line-through',
                          ...RTL_TEXT,
                        }}
                      >
                        {formatPrice(displayCompareAtPrice!, displayCurrencyCode)}
                      </Text>
                    )}
                  </View>
                  <OcdPlusMemberPriceHint
                    regularPrice={displayPrice}
                    isOcdPlusSubscriber={false}
                    onPress={openOcdPlusSubscribeSheet}
                  />
                </>
              )}
            </View>
          </View>

          {/* ── וריאציות ── */}
          {multipleVariants && (
            <View style={{ paddingTop: 22, paddingHorizontal: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: PALETTE.gold }} />
                  <Text
                    style={{
                      color: PALETTE.text,
                      fontSize: 15,
                      fontWeight: '800',
                      letterSpacing: -0.2,
                      ...RTL_TEXT,
                    }}
                  >
                    בחירת וריאציה
                  </Text>
                </View>
                {activeVariant && (
                  <Text
                    style={{
                      color: PALETTE.muted,
                      fontSize: 13,
                      fontWeight: '500',
                      maxWidth: '50%',
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
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isActive ? '#000000' : PALETTE.border,
                          backgroundColor: isActive ? '#000000' : '#FFFFFF',
                          opacity: isUnavailable ? 0.35 : 1,
                        }}
                      >
                        {isActive && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                        <Text
                          style={{
                            color: isActive ? '#FFFFFF' : '#334155',
                            fontSize: 13.5,
                            fontWeight: isActive ? '800' : '600',
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
          )}

          {/* ── תיאור המוצר ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: PALETTE.gold }} />
              <Text
                style={{
                  color: PALETTE.text,
                  fontSize: 15,
                  fontWeight: '800',
                  letterSpacing: -0.2,
                  ...RTL_TEXT,
                }}
              >
                תיאור המוצר
              </Text>
            </View>
            <ProductDescription
              description={product.description}
              descriptionHtml={product.descriptionHtml}
            />
          </View>

          {/* ── פרטי אמון ── */}
          <View
            style={{
              flexDirection: 'row-reverse',
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 28,
              gap: 10,
            }}
          >
            {[
              { icon: 'shield-checkmark-outline' as const, label: 'תשלום מאובטח' },
              { icon: 'refresh-outline' as const, label: 'החזרה קלה' },
              { icon: 'flash-outline' as const, label: 'משלוח מהיר' },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: PALETTE.surfaceMuted,
                  borderWidth: 1,
                  borderColor: PALETTE.divider,
                  borderRadius: 18,
                  paddingVertical: 14,
                  paddingHorizontal: 6,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#EEF2F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={item.icon} size={19} color="#475569" />
                </View>
                <Text style={{ color: '#475569', fontSize: 11.5, fontWeight: '700', textAlign: 'center' }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── סרגל פעולות תחתון קבוע ── */}
      <View
        style={{
          position: 'absolute',
          bottom: Math.max(insets.bottom, 10),
          left: 12,
          right: 12,
          zIndex: 20,
          borderRadius: 26,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View
          style={{
            borderRadius: 26,
            overflow: 'hidden',
            padding: 8,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderWidth: 1,
            borderColor: 'rgba(226,232,240,0.78)',
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
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' }}>
                    {cartButtonLabel}
                  </Text>
                  {!isCartCtaDisabled && (
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                      {isActiveMember
                        ? formatOcdPrice(checkoutUnitPrice * pendingQty)
                        : formatPrice(checkoutUnitPrice * pendingQty, displayCurrencyCode)}
                    </Text>
                  )}
                </View>
              </>
            )}
          </Pressable>

          {/* סטפר כמות — קפסולה אחת */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 58,
              borderRadius: 18,
              backgroundColor: 'rgba(241,245,249,0.76)',
              paddingHorizontal: 6,
              gap: 2,
            }}
          >
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
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: '400', color: isCartCtaDisabled ? '#CBD5E1' : '#000000', lineHeight: 26, includeFontPadding: false }}>+</Text>
            </Pressable>

            {/* כמות */}
            <View style={{ width: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ textAlign: 'center', fontSize: 18, fontWeight: '800', color: isCartCtaDisabled ? '#CBD5E1' : '#000000', fontVariant: ['tabular-nums'], includeFontPadding: false }}>
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
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: '300', color: isCartCtaDisabled ? '#CBD5E1' : '#000000', lineHeight: 28, includeFontPadding: false }}>−</Text>
            </Pressable>
          </View>
        </View>
        </View>
      </View>
    </View>
  );
}
