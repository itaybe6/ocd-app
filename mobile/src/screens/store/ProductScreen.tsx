import { radii } from '../../theme/radii';
import { storeAccent } from '../../theme/storeAccent';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { type ShopifyProduct, type ShopifyProductVariant } from '../../lib/shopify';
import { useStoreResources } from '../../hooks/useStoreResources';
import { useProductViewTracking } from '../../hooks/useProductViewTracking';
import { bundleTiersForVariant, isCatalogBundleProduct, type ProductBundleTier } from '../../lib/productBundles';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { useBrands } from '../../hooks/useBrands';
import { findProductBrand, normalizeBrandImageUrl } from '../../lib/brands';
import { ProductDescription } from '../../components/ProductDescription';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { ProductReviews } from '../../components/ProductReviews';
import { ProductBundlePicker } from '../../components/ProductBundlePicker';
import { computeOcdPlusPrice } from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { useOcdPlusSubscribeSheet } from '../../context/OcdPlusSubscribeSheetContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { useInBottomSheet } from '../../components/BottomSheetScreen';

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
const PALETTE = { text: '#202124', muted: '#85888C', danger: '#AE3655' };

// Keep the current image visible without letting long galleries widen the page.
function galleryDotIndices(count: number, activeIndex: number) {
  const visibleCount = Math.min(count, 5);
  const start = Math.max(0, Math.min(activeIndex - Math.floor(visibleCount / 2), count - visibleCount));
  return Array.from({ length: visibleCount }, (_, offset) => start + offset);
}

function formatPrice(price: number, currencyCode: string) {
  const amount = price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currencyCode === 'ILS' ? `₪${amount}` : `${amount} ${currencyCode}`;
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
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15,23,42,0.28)',
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radii.pill,
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

/** נגן סרטון בלייטבוקס — בלי poster (חוסם אינטראקציה) ובלי transform על ההורה */
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
  const player = useVideoPlayer(url, (video) => {
    video.loop = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const [hasFrame, setHasFrame] = useState(false);
  const loadError = status === 'error' || Boolean(error);

  useEffect(() => {
    setHasFrame(false);
  }, [url]);

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  return (
    <View style={{ width, height: '100%', justifyContent: 'center', backgroundColor: '#000000' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls
        onFirstFrameRender={() => setHasFrame(true)}
        accessibilityLabel={altText ?? 'סרטון מוצר'}
      />
      {(!hasFrame || loadError) && previewUrl ? (
        <Image
          source={{ uri: previewUrl }}
          resizeMode="contain"
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            opacity: isPlaying ? 0 : 1,
          }}
        />
      ) : null}
      {loadError ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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

/** Compact navigation actions shared by loading, error and product states. */
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
      style={[styles.navButton, active && styles.activeFavorite, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

export function ProductScreen({ navigation, route }: Props) {
  const { fetchProductByHandle, fetchProductBundleTiers, readProduct } = useStoreResources();
  const insets = useSafeAreaInsets();
  const inBottomSheet = useInBottomSheet();
  const { addItem, getQuantity, updateQuantity, isMutating } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const { data: remoteBrands = [] } = useBrands();
  const { isActiveMember } = useOcdPlusMembership();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const handle = route.params.handle;
  const [reloadSeq, setReloadSeq] = useState(0);
  const [loading, setLoading] = useState(() => !readProduct(handle));
  const [product, setProduct] = useState<ShopifyProduct | null>(() => readProduct(handle) ?? null);
  useProductViewTracking(product?.handle === handle ? product : null);
  const [error, setError] = useState<string | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [bundleTiers, setBundleTiers] = useState<ProductBundleTier[]>([]);
  const [selectedBundleQty, setSelectedBundleQty] = useState(1);

  const galleryItems = useMemo(() => buildGalleryItems(product), [product]);
  const quantityInCart = product ? getQuantity(product.id) : 0;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const galleryWidth = screenWidth - 32;
  const imageHeight = Math.min(320, galleryWidth * 0.8, screenHeight * 0.34);
  const brand = useMemo(() => product ? findProductBrand(product, remoteBrands) : null, [product, remoteBrands]);
  const brandImage = normalizeBrandImageUrl(brand?.image);
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
  const visibleBundleTiers = useMemo(
    () => bundleTiersForVariant(bundleTiers, activeVariant?.title ?? null),
    [activeVariant?.title, bundleTiers],
  );
  const selectedBundle = visibleBundleTiers.find((tier) => tier.qty === selectedBundleQty) ?? null;
  const discountPercent = displayIsOnSale
    ? Math.round((1 - displayPrice / displayCompareAtPrice!) * 100)
    : 0;
  const ocdPlusPrice = useMemo(() => computeOcdPlusPrice(displayPrice), [displayPrice]);
  const checkoutUnitPrice = selectedBundle ? selectedBundle.price : isActiveMember ? ocdPlusPrice : displayPrice;

  const isCartCtaDisabled = selectedBundle
    ? !selectedBundle.availableForSale
    : !displayAvailableForSale || !displayVariantId;

  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const galleryScrollRef = useRef<FlatList>(null);
  const lightboxScrollRef = useRef<FlatList>(null);

  // כמות מקומית — מסונכרנת עם העגלה ומשתנה ע"י הסטפר
  const [pendingQty, setPendingQty] = useState(1);

  // איפוס בחלפת מוצר
  useEffect(() => {
    setPendingQty(1);
    setSelectedBundleQty(1);
    setActiveVariantIndex(0);
    setActiveGalleryIndex(0);
  }, [product?.id]);

  useEffect(() => {
    setSelectedBundleQty(1);
  }, [activeVariant?.id]);

  // מעבר לתמונת הוריאציה בגלריה — רק אם לוריאציה יש תמונה משלה; אחרת נשארים על הראשית
  useEffect(() => {
    if (!product || galleryItems.length === 0) return;

    const targetIndex = activeVariant?.imageUrl
      ? findGalleryIndexForVariant(galleryItems, activeVariant.imageUrl)
      : 0;

    setActiveGalleryIndex(targetIndex);
    const frame = requestAnimationFrame(() => {
      galleryScrollRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeVariant?.id, activeVariant?.imageUrl, galleryItems, product, galleryWidth]);

  // סנכרון pendingQty עם העגלה לאחר שינוי חיצוני
  useEffect(() => {
    if (quantityInCart > 0) {
      setPendingQty(quantityInCart);
    }
  }, [quantityInCart]);

  // לוגיקת כפתור ראשי
  const isInCart = !selectedBundle && quantityInCart > 0;
  const isQtyModified = isInCart && pendingQty !== quantityInCart;

  const cartButtonLabel = isCartCtaDisabled
    ? 'לא זמין'
    : !isInCart
      ? 'הוסף לעגלה'
      : isQtyModified
        ? 'עדכן כמות בעגלה'
        : 'הסר מוצר מהעגלה';

  const handleCartButton = useCallback(() => {
    if (isMutating || isCartCtaDisabled || !product) return;
    if (!isInCart) {
      if (selectedBundle) {
        void addItem(
          {
            ...getCartProduct(product, activeVariant),
            id: selectedBundle.variantId,
            name: `${product.title} — ${selectedBundle.label} (${selectedBundle.qty} יח')`,
            price: selectedBundle.price,
            variantId: selectedBundle.variantId,
            variantTitle: `${selectedBundle.label} · ${selectedBundle.qty} יח'`,
          },
          pendingQty,
        );
      } else {
        void addItem(getCartProduct(product, activeVariant), pendingQty);
      }
    } else if (isQtyModified) {
      void updateQuantity(product.id, pendingQty);
    } else {
      void updateQuantity(product.id, 0);
    }
  }, [activeVariant, addItem, isCartCtaDisabled, isInCart, isMutating, isQtyModified, pendingQty, product, selectedBundle, updateQuantity]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cachedProduct = readProduct(handle);
        setProduct(cachedProduct ?? null);
        setLoading(!cachedProduct);
        setError(null);
        setBundleTiers([]);
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
  }, [handle, reloadSeq, fetchProductByHandle, readProduct]);

  useEffect(() => {
    if (!product || isCatalogBundleProduct(product.tags)) {
      setBundleTiers([]);
      return;
    }

    let alive = true;
    fetchProductBundleTiers(product.handle)
      .then((tiers) => {
        if (alive) setBundleTiers(tiers);
      })
      .catch(() => {
        if (alive) setBundleTiers([]);
      });

    return () => {
      alive = false;
    };
  }, [product, fetchProductBundleTiers]);

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

  const header = <View style={[styles.header, { paddingTop: inBottomSheet ? 4 : insets.top + 4 }]}>
    <FloatingCircleButton onPress={() => navigation.goBack()} label="חזרה"><Ionicons name="arrow-forward" size={21} color={PALETTE.text} /></FloatingCircleButton>
    <Text style={styles.headerLabel} numberOfLines={1}>פרטי מוצר</Text>
    <FloatingCircleButton onPress={() => void handleShare()} disabled={!product} label="שיתוף מוצר"><Ionicons name="share-outline" size={20} color={PALETTE.text} /></FloatingCircleButton>
    <FavoriteToggleButton size={44} onPress={handleFavoriteToggle} disabled={!product} loading={!!product && isFavoritePending(product.id)} active={!!product && isFavorite(product.id)} />
  </View>;

  if (loading || !product) return <View style={styles.page}>
    {header}
    <View style={styles.empty}>
      {loading ? <ActivityIndicator color={PALETTE.text} /> : <Ionicons name="cloud-offline-outline" size={32} color={PALETTE.muted} />}
      <Text style={styles.sectionTitle}>{loading ? 'טוענים את המוצר…' : 'לא הצלחנו להציג את המוצר'}</Text>
      {!loading ? <><Text style={styles.emptyText}>אפשר לנסות לטעון אותו שוב.</Text><Pressable accessibilityRole="button" onPress={() => setReloadSeq(current => current + 1)} style={styles.retryButton}><Text style={styles.actionLabel}>ניסיון נוסף</Text></Pressable></> : null}
    </View>
  </View>;

  return <View style={styles.page}>
    {header}
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.gallery, { height: imageHeight }]}>
        <FlatList
          ref={galleryScrollRef} data={galleryItems} horizontal pagingEnabled
          initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
          style={{ direction: 'ltr' }} showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          getItemLayout={(_, index) => ({ length: galleryWidth, offset: galleryWidth * index, index })}
          onMomentumScrollEnd={event => setActiveGalleryIndex(Math.max(0, Math.min(galleryItems.length - 1, Math.round(event.nativeEvent.contentOffset.x / galleryWidth))))}
          renderItem={({ item, index }) => <Pressable
            accessibilityRole="button" accessibilityLabel={item.type === 'video' ? 'פתיחת סרטון המוצר' : 'הגדלת תמונת המוצר'}
            onPress={() => { setLightboxIndex(index); setLightboxVisible(true); }}
            style={{ width: galleryWidth, height: imageHeight, alignItems: 'center', justifyContent: 'center' }}
          >
            {item.type === 'video' && item.url ? <GalleryVideoPreview previewUrl={item.previewUrl} altText={item.altText} width={galleryWidth} height={imageHeight} />
              : item.url ? <Image source={{ uri: item.url }} resizeMode="contain" accessibilityLabel={item.altText ?? product.title} style={styles.galleryImage} />
              : <Ionicons name="image-outline" size={42} color="#C4C6C9" />}
          </Pressable>}
        />
        <View pointerEvents="none" style={styles.expandHint}><Ionicons name="expand-outline" size={17} color={PALETTE.muted} /></View>
        {displayIsOnSale && discountPercent > 0 ? <View style={styles.saleBadge}><Text style={styles.saleText}>{discountPercent}% הנחה</Text></View> : null}
      </View>
      {galleryItems.length > 1 ? <View style={styles.galleryPagination}>
        <View style={styles.dots}>{galleryDotIndices(galleryItems.length, activeGalleryIndex).map((index, position, indices) => {
          const item = galleryItems[index];
          const selected = index === activeGalleryIndex;
          const continues = (position === 0 && index > 0) || (position === indices.length - 1 && index < galleryItems.length - 1);
          return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.type === 'video' ? 'סרטון' : 'תמונה'} ${index + 1}`} accessibilityState={{ selected }} style={styles.dotHit} onPress={() => { setActiveGalleryIndex(index); galleryScrollRef.current?.scrollToIndex({ index, animated: true }); }}><View style={[styles.dot, continues && !selected && styles.dotContinuation, selected && styles.dotActive]} /></Pressable>;
        })}</View>
        <Text style={styles.galleryCount}>{activeGalleryIndex + 1} / {galleryItems.length}</Text>
      </View> : null}

      <View style={styles.productSummary}>
        <View style={styles.metadata}>
          <View style={styles.brandRow}>
            {brandImage ? <View style={styles.brandLogo}><Image source={{ uri: brandImage }} resizeMode="contain" style={{ width: 26, height: 26 }} accessible={false} /></View> : null}
            <Text style={styles.brandName} numberOfLines={1}>{brand?.label || product.vendor || productTypeLabel}</Text>
          </View>
          <Text style={[styles.availability, !displayAvailableForSale && styles.unavailable]}>{displayAvailableForSale ? 'במלאי' : 'אזל מהמלאי'}</Text>
        </View>
        <Text style={styles.productTitle}>{product.title}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(isActiveMember ? ocdPlusPrice : displayPrice, displayCurrencyCode)}</Text>
          {isActiveMember || displayIsOnSale ? <Text style={styles.oldPrice}>{formatPrice(isActiveMember ? displayPrice : displayCompareAtPrice!, displayCurrencyCode)}</Text> : null}
          {isActiveMember ? <Text style={styles.memberCaption}>מחיר חבר</Text> : null}
        </View>
        {isActiveMember ? <View style={styles.membershipRow}><OcdPlusMark size={21} /><Text style={styles.membershipText}>הטבת המועדון שלכם כבר כלולה במחיר</Text><Ionicons name="checkmark" size={17} color={PALETTE.text} /></View>
          : <Pressable onPress={openOcdPlusSubscribeSheet} accessibilityRole="button" accessibilityLabel={`מחיר לחברי OCD+, ${formatPrice(ocdPlusPrice, displayCurrencyCode)}, לפרטי המועדון`} style={styles.membershipRow}><OcdPlusMark size={21} /><Text style={styles.membershipText}>לחברי OCD+</Text><Text style={styles.memberPrice}>{formatPrice(ocdPlusPrice, displayCurrencyCode)}</Text><Ionicons name="arrow-back" size={16} color={PALETTE.muted} /></Pressable>}
      </View>

      {multipleVariants ? <View style={styles.section}>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>בחרו אפשרות</Text><Text style={styles.selectedVariant} numberOfLines={1}>{activeVariant?.title}</Text></View>
        <View style={styles.variantOptions}>{product.variants.map((variant, index) => {
          const selected = index === activeVariantIndex;
          return <Pressable key={variant.id} onPress={() => setActiveVariantIndex(index)} disabled={!variant.availableForSale}
            accessibilityRole="button" accessibilityLabel={`${variant.title}${variant.availableForSale ? '' : ', לא במלאי'}`} accessibilityState={{ selected, disabled: !variant.availableForSale }}
            style={[styles.variant, selected && styles.variantSelected, !variant.availableForSale && styles.disabled]}>
            <Text style={[styles.variantText, selected && { color: storeAccent.ink }]}>{variant.title}</Text>
            {selected ? <Ionicons name="checkmark" size={15} color={storeAccent.ink} /> : null}
          </Pressable>;
        })}</View>
      </View> : null}

      {visibleBundleTiers.length > 0 ? <ProductBundlePicker unitPrice={displayPrice} tiers={visibleBundleTiers} selectedQty={selectedBundle?.qty ?? 1} onSelect={setSelectedBundleQty} /> : null}
      <View style={styles.descriptionSection}>
        <Text style={styles.sectionTitle}>קצת על המוצר</Text>
        <ProductDescription description={product.description} descriptionHtml={product.descriptionHtml} textStyle={{ color: '#676A6E', fontSize: 14, lineHeight: 24 }} toggleColor={storeAccent.ink} bulletColor="#8A8D91" />
      </View>
      <ProductReviews key={product.handle} handle={product.handle} title={product.title} />
    </ScrollView>

    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.purchaseRow}>
        <View style={[styles.stepper, (isMutating || isCartCtaDisabled) && styles.disabled]}>
          <Pressable onPress={() => setPendingQty(qty => qty + 1)} disabled={isMutating || isCartCtaDisabled} accessibilityRole="button" accessibilityLabel="הוסף כמות" style={styles.stepperButton}><Ionicons name="add" size={20} color={PALETTE.text} /></Pressable>
          <Text style={styles.quantity}>{pendingQty}</Text>
          <Pressable onPress={() => setPendingQty(qty => Math.max(1, qty - 1))} disabled={isMutating || isCartCtaDisabled || pendingQty <= 1} accessibilityRole="button" accessibilityLabel="הפחת כמות" style={[styles.stepperButton, pendingQty <= 1 && styles.disabled]}><Ionicons name="remove" size={20} color={PALETTE.text} /></Pressable>
        </View>
        <Pressable onPress={handleCartButton} disabled={isMutating || isCartCtaDisabled} accessibilityRole="button" accessibilityLabel={cartButtonLabel} accessibilityState={{ disabled: isMutating || isCartCtaDisabled, busy: isMutating }} style={[styles.cartButton, isCartCtaDisabled && styles.disabled, isInCart && !isQtyModified && styles.removeButton]}>
          {isMutating ? <ActivityIndicator color={isInCart && !isQtyModified ? PALETTE.text : '#FFFFFF'} /> : <>
            <Text style={[styles.actionLabel, isInCart && !isQtyModified && { color: PALETTE.text }]}>{cartButtonLabel}</Text>
            {!isCartCtaDisabled ? <Text style={[styles.actionPrice, isInCart && !isQtyModified && { color: PALETTE.muted }]}>{formatPrice(checkoutUnitPrice * pendingQty, displayCurrencyCode)}</Text> : null}
          </>}
        </Pressable>
      </View>
    </View>
    <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
          {lightboxVisible ? <StatusBar hidden /> : null}
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
            {/* כפתור סגירה */}
            <Pressable
              onPress={() => setLightboxVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="סגירת התמונה המוגדלת"
              hitSlop={12}
              style={{
                position: 'absolute',
                top: insets.top + 12,
                right: 16,
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: radii.pill,
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
              initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `lightbox-${item.id}`}
              initialScrollIndex={lightboxIndex}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                setLightboxIndex(index);
              }}
              renderItem={({ item, index }) => {
                const slideWidth = screenWidth;
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
              <View style={{ position: 'absolute', bottom: insets.bottom + 28, left: 0, right: 0, direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}>
                {galleryDotIndices(galleryItems.length, lightboxIndex).map((i) => (
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
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  headerLabel: { flex: 1, color: '#83868A', fontSize: 13, textAlign: 'right', paddingRight: 4 },
  navButton: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  activeFavorite: { backgroundColor: storeAccent.soft },
  disabled: { opacity: 0.4 },
  scrollContent: { paddingBottom: 28 },
  gallery: { marginHorizontal: 16, borderRadius: radii.surface, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  expandHint: { position: 'absolute', bottom: 12, left: 12, width: 32, height: 32, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  saleBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.badge, backgroundColor: storeAccent.soft },
  saleText: { color: storeAccent.ink, fontSize: 11, fontWeight: '600' },
  galleryPagination: { marginHorizontal: 20, height: 30, direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  galleryCount: { color: '#929599', fontSize: 11, fontVariant: ['tabular-nums'], writingDirection: 'ltr', flexShrink: 0 },
  dots: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', flexShrink: 1 },
  dotHit: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: '#D8DADD' },
  dotContinuation: { width: 3, height: 3, opacity: 0.65 },
  dotActive: { width: 16, backgroundColor: storeAccent.primary },
  productSummary: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  metadata: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 },
  brandLogo: { width: 32, height: 32, borderRadius: radii.pill, borderWidth: 1, borderColor: '#ECEDEE', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#7F8286', fontSize: 12, flexShrink: 1, textAlign: 'right' },
  availability: { color: '#7F8286', fontSize: 11 },
  unavailable: { color: '#AC5252' },
  productTitle: { color: '#202124', fontSize: 22, lineHeight: 30, fontWeight: '600', ...RTL_TEXT },
  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  price: { color: storeAccent.ink, fontSize: 27, lineHeight: 34, fontWeight: '700', writingDirection: 'ltr', fontVariant: ['tabular-nums'] },
  oldPrice: { color: '#96999D', fontSize: 14, textDecorationLine: 'line-through', writingDirection: 'ltr' },
  memberCaption: { color: '#7F8286', fontSize: 12 },
  membershipRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 13, borderRadius: radii.surface, backgroundColor: storeAccent.soft, flexWrap: 'wrap' },
  membershipText: { color: storeAccent.ink, fontSize: 12, flex: 1, ...RTL_TEXT },
  memberPrice: { color: storeAccent.ink, fontSize: 15, fontWeight: '600', writingDirection: 'ltr' },
  section: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: '#202124', fontSize: 16, lineHeight: 23, fontWeight: '600', ...RTL_TEXT },
  selectedVariant: { color: '#8A8D91', fontSize: 12, maxWidth: '50%', ...RTL_TEXT },
  variantOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  variant: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, borderRadius: radii.surface, borderWidth: 1, borderColor: '#E7E8EA', backgroundColor: '#FFFFFF' },
  variantSelected: { backgroundColor: storeAccent.soft, borderColor: storeAccent.primary },
  variantText: { color: '#5C5F63', fontSize: 13, fontWeight: '500', ...RTL_TEXT },
  descriptionSection: { marginHorizontal: 20, marginTop: 26, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E8EA', gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E8EA', backgroundColor: '#FFFFFF' },
  purchaseRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: radii.surface, backgroundColor: '#F5F5F5', paddingHorizontal: 2 },
  stepperButton: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  quantity: { color: '#202124', fontSize: 16, fontWeight: '600', minWidth: 26, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cartButton: { flex: 1, minHeight: 54, paddingHorizontal: 10, paddingVertical: 8, gap: 2, borderRadius: radii.surface, backgroundColor: storeAccent.primary, alignItems: 'center', justifyContent: 'center' },
  removeButton: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E7E8EA' },
  actionLabel: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  actionPrice: { color: '#FFFFFF', fontSize: 12, lineHeight: 17, writingDirection: 'ltr' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  emptyText: { color: '#8A8D91', fontSize: 14, textAlign: 'center' },
  retryButton: { backgroundColor: storeAccent.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: radii.surface },
});
