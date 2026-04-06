import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingCart } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchMenuItems,
  fetchProducts,
  type ShopifyCollection,
  type ShopifyMenuItem,
  type ShopifyProduct,
} from '../../lib/shopify';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { favoriteInputFromStoreProduct } from '../../lib/favorites';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';

type StoreCategory = {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string | null;
};

type SidebarMenuSection = {
  id: string;
  title: string;
  categoryId?: string;
  children?: Array<{
    id: string;
    title: string;
    categoryId: string;
    parentTitle?: string;
    categoryDescription?: string;
    categoryImageUrl?: string | null;
  }>;
};

type SidebarChildItem = NonNullable<SidebarMenuSection['children']>[number];

export type StoreSubcategory = {
  id: string;
  title: string;
  description?: string;
  parentTitle?: string;
  imageUrl?: string | null;
};

/** Virtual strip chip: merged products from parent collection + every child */
const STORE_CATEGORY_ALL_SUBS_ID = '__all_subcategories__';

export type StoreProduct = {
  id: string;
  name: string;
  subtitle: string;
  collectionTitle: string | null;
  categoryId: string;
  price: number;
  currencyCode: string;
  handle: string;
  description: string;
  badge?: string;
  featured?: boolean;
  coverColor: string;
  accentColor: string;
  imageUrl: string | null;
  imageAltText: string | null;
  variantId: string;
  variantTitle: string | null;
  availableForSale: boolean;
};

type CollectionCard = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
};

type PromoSlide = {
  id: string;
  variant: 'diffusers' | 'kits' | 'spa' | 'fresh';
  eyebrow: string;
  title: string[];
  subtitle: string;
  backgroundColor: string;
  panelColor: string;
  bottleColors: [string, string];
};

const COLLECTIONS: CollectionCard[] = [
  {
    id: 'c-1',
    title: 'קולקציית חדרי שירות',
    subtitle: 'סדר מלא',
    color: '#D9D7CF',
  },
  {
    id: 'c-2',
    title: 'קולקציית האמבט',
    subtitle: 'רוגע וניקיון',
    color: '#1E2020',
  },
];

const BOTTOM_NAV_ITEMS = [
  { id: 'home', label: 'בית' },
  { id: 'categories', label: 'קטגוריות' },
  { id: 'ocdPlus', label: 'OCD+' },
  { id: 'favorites', label: 'אהבתי' },
  { id: 'search', label: 'חיפוש' },
  { id: 'profile', label: 'חשבון' },
] as const;

export type StoreBottomTabId = (typeof BOTTOM_NAV_ITEMS)[number]['id'];
export type StoreMainTabId = 'home' | 'categories' | 'search';

const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'promo-1',
    variant: 'diffusers',
    eyebrow: 'PROMOTION',
    title: ['20% הנחה על כל', 'מפיצי הריח'],
    subtitle: 'מבצע חם לבית נקי וריחני',
    backgroundColor: '#2A241F',
    panelColor: '#4B4239',
    bottleColors: ['#D9D3CC', '#7A6C5E'],
  },
  {
    id: 'promo-2',
    variant: 'kits',
    eyebrow: 'NEW ARRIVAL',
    title: ['מארזי ניקיון', 'במראה חדש'],
    subtitle: 'עיצוב מינימליסטי עם תחושה יוקרתית',
    backgroundColor: '#1F3140',
    panelColor: '#36536C',
    bottleColors: ['#E6EEF4', '#9AAFC1'],
  },
  {
    id: 'promo-3',
    variant: 'spa',
    eyebrow: 'BEST SELLER',
    title: ['קולקציית ספא', 'במחיר מיוחד'],
    subtitle: 'מוצרים אהובים לאמבט ולבית',
    backgroundColor: '#3A2D2A',
    panelColor: '#6A5248',
    bottleColors: ['#F1E2D3', '#B89C8A'],
  },
  {
    id: 'promo-4',
    variant: 'fresh',
    eyebrow: 'LIMITED EDITION',
    title: ['ניחוחות חדשים', 'לאווירה מושלמת'],
    subtitle: 'דמו לעיצוב קרוסלה אוטומטית',
    backgroundColor: '#223128',
    panelColor: '#425B4B',
    bottleColors: ['#DCE8DD', '#93A897'],
  },
];

const SHOW_PROMO_CAROUSEL = false;

const CATEGORY_STORY_PRODUCT_OVERRIDES: Record<string, string[]> = {
  'עיצוב הבית': ['מראה | חצי מעוגלת', 'מראה'],
};

const FEATURED_BRAND_IMAGE_OVERRIDES: Record<string, number> = {
  סנו: require('../../../assets/brands/sano.png'),
  טאצ: require('../../../assets/brands/touch.jpg'),
  "טאץ'": require('../../../assets/brands/touch.jpg'),
  TOUCH: require('../../../assets/brands/touch.jpg'),
  פינל: require('../../../assets/brands/final.jpg'),
  פייל: require('../../../assets/brands/final.jpg'),
  FINAL: require('../../../assets/brands/final.jpg'),
  יעקובי: require('../../../assets/brands/yaakoby-logo.png'),
  YAAKOBY: require('../../../assets/brands/yaakoby-logo.png'),
  סאג: require('../../../assets/brands/sag.png'),
  SAG: require('../../../assets/brands/sag.png'),
  סוסייטא: require('../../../assets/brands/logotipo-sucitesa-color-vertical.png'),
  סוסיטסא: require('../../../assets/brands/logotipo-sucitesa-color-vertical.png'),
  סוסיטסה: require('../../../assets/brands/logotipo-sucitesa-color-vertical.png'),
  SUCITESA: require('../../../assets/brands/logotipo-sucitesa-color-vertical.png'),
  'מוצרי TNX': require('../../../assets/brands/TNX.png'),
  TNX: require('../../../assets/brands/TNX.png'),
};

function formatPrice(price: number) {
  return `₪${price.toLocaleString('he-IL')}.00`;
}

/** Extra View with overflow:hidden clips content; shadow stays on Pressable parent (iOS). */
const storeProductCardShadowStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

/** Product grid under category circles on store home. */
const STORE_HOME_CATEGORY_PREVIEW_LIMIT = 6;

/** Closed +: gray corner, black glyph. In-cart chip: black fill, white numeral. */
const STORE_CARD_QTY_BAR_BG = '#E5E7EB';
const STORE_CARD_QTY_ACCENT = '#000000';
const STORE_CARD_QTY_CHIP_FILL = '#000000';
const STORE_CARD_QTY_CHIP_TEXT = '#FFFFFF';

/** Stepper stays open ~this long; then shows qty chip (tap chip to edit again). */
const STORE_CARD_STEPPER_AUTO_CLOSE_MS = 3200;

/** Wolt-style: quarter + → expandable bar → auto-close to qty chip. */
function StoreProductCardQuantityControl({
  product,
  closedSize = 44,
  borderTopLeftRadius = 18,
}: {
  product: StoreProduct;
  closedSize?: number;
  borderTopLeftRadius?: number;
}) {
  const { getQuantity, addItem, updateQuantity, isMutating } = useCart();
  const trackW = useSharedValue(0);
  const closedSv = useSharedValue(closedSize);
  const radiusSv = useSharedValue(borderTopLeftRadius);
  const collapsedW = useSharedValue(closedSize);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [showStepper, setShowStepper] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleStepperClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setShowStepper(false);
      closeTimerRef.current = null;
    }, STORE_CARD_STEPPER_AUTO_CLOSE_MS);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const openStepper = useCallback(() => {
    setShowStepper(true);
    scheduleStepperClose();
  }, [scheduleStepperClose]);

  useEffect(() => {
    closedSv.value = closedSize;
  }, [closedSize, closedSv]);
  useEffect(() => {
    radiusSv.value = borderTopLeftRadius;
  }, [borderTopLeftRadius, radiusSv]);

  const cartQty = getQuantity(product.id);
  const isExpanded = showStepper && (cartQty > 0 || pendingOpen);
  const displayQty = cartQty > 0 ? cartQty : pendingOpen ? 1 : 0;
  const inCartChipMode = useSharedValue(0);

  useEffect(() => {
    if (cartQty > 0) setPendingOpen(false);
  }, [cartQty]);

  useEffect(() => {
    const chipW =
      cartQty > 0 ? Math.max(closedSize, 18 + String(cartQty).length * 13) : closedSize;
    collapsedW.value = chipW;
  }, [cartQty, closedSize, collapsedW]);

  useEffect(() => {
    const on = cartQty > 0 && !isExpanded ? 1 : 0;
    inCartChipMode.value = withTiming(on, { duration: 200 });
  }, [cartQty, isExpanded, inCartChipMode]);

  const openProgress = useSharedValue(isExpanded ? 1 : 0);
  useEffect(() => {
    openProgress.value = withSpring(isExpanded ? 1 : 0, { damping: 16, stiffness: 220, mass: 0.55 });
  }, [isExpanded, openProgress]);

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) trackW.value = w;
    },
    [trackW],
  );

  const shellStyle = useAnimatedStyle(() => {
    const tw = trackW.value;
    const startW = collapsedW.value;
    const cs = closedSv.value;
    const r = radiusSv.value;
    const targetW = tw > 0 ? tw : startW;
    const w = interpolate(openProgress.value, [0, 1], [startW, targetW], Extrapolation.CLAMP);
    const br = interpolate(openProgress.value, [0, 1], [cs, 12], Extrapolation.CLAMP);
    const tl = interpolate(openProgress.value, [0, 1], [0, r], Extrapolation.CLAMP);
    return {
      width: w,
      height: cs + 4,
      borderBottomRightRadius: br,
      borderTopLeftRadius: tl,
      backgroundColor: interpolateColor(
        inCartChipMode.value,
        [0, 1],
        [STORE_CARD_QTY_BAR_BG, STORE_CARD_QTY_CHIP_FILL],
      ),
      overflow: 'hidden' as const,
    };
  });

  const stepperOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0.35, 0.72], [0, 1], Extrapolation.CLAMP),
  }));

  const handleClosedPress = useCallback(() => {
    if (!product.availableForSale || !product.variantId || isMutating) return;
    setPendingOpen(true);
    openStepper();
    void addItem(product).catch(() => {
      setPendingOpen(false);
      setShowStepper(false);
      clearCloseTimer();
    });
  }, [addItem, clearCloseTimer, isMutating, openStepper, product]);

  const increment = useCallback(() => {
    if (!product.availableForSale || isMutating) return;
    if (cartQty === 0) {
      if (pendingOpen) return;
      void handleClosedPress();
      return;
    }
    void updateQuantity(product.id, cartQty + 1);
    scheduleStepperClose();
  }, [
    cartQty,
    handleClosedPress,
    isMutating,
    pendingOpen,
    product.availableForSale,
    product.id,
    scheduleStepperClose,
    updateQuantity,
  ]);

  const decrement = useCallback(() => {
    if (isMutating) return;
    if (cartQty <= 0) {
      if (pendingOpen) {
        setPendingOpen(false);
        setShowStepper(false);
        clearCloseTimer();
      }
      return;
    }
    if (cartQty <= 1) {
      setShowStepper(false);
      clearCloseTimer();
    }
    void updateQuantity(product.id, cartQty - 1);
    if (cartQty > 1) scheduleStepperClose();
  }, [
    cartQty,
    clearCloseTimer,
    isMutating,
    pendingOpen,
    product.id,
    scheduleStepperClose,
    updateQuantity,
  ]);

  if (!product.availableForSale || !product.variantId) {
    return null;
  }

  const circleBtn = {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const plusSize = Math.max(18, Math.round(closedSize * 0.42));

  return (
    <>
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject} onLayout={onTrackLayout} />
      <Animated.View style={[shellStyle, { position: 'absolute', top: 0, left: 0, zIndex: 12 }]}>
        {isExpanded ? (
          <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, stepperOpacity]}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                direction: 'ltr',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
              }}
            >
              <Pressable
                onPress={increment}
                disabled={isMutating || (cartQty === 0 && pendingOpen)}
                style={circleBtn}
                accessibilityRole="button"
                accessibilityLabel="הוסף כמות"
              >
                <Text style={{ color: STORE_CARD_QTY_ACCENT, fontSize: 20, fontWeight: '500', marginTop: -1 }}>+</Text>
              </Pressable>
              <Text style={{ color: STORE_CARD_QTY_ACCENT, fontSize: 17, fontWeight: '800' }}>{displayQty}</Text>
              <Pressable
                onPress={decrement}
                disabled={isMutating || (cartQty === 0 && !pendingOpen)}
                style={circleBtn}
                accessibilityRole="button"
                accessibilityLabel="הפחת כמות"
              >
                <Text style={{ color: STORE_CARD_QTY_ACCENT, fontSize: 22, fontWeight: '400', marginTop: -2 }}>−</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : cartQty > 0 ? (
          <Pressable
            onPress={openStepper}
            accessibilityRole="button"
            accessibilityLabel={`כמות בעגלה ${cartQty}, לחץ לעריכה`}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              style={{
                color: STORE_CARD_QTY_CHIP_TEXT,
                fontSize: 17,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {cartQty}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleClosedPress}
            disabled={isMutating}
            accessibilityRole="button"
            accessibilityLabel="הוסף לעגלה"
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              style={{
                color: STORE_CARD_QTY_ACCENT,
                fontSize: plusSize,
                fontWeight: '400',
                lineHeight: plusSize + 2,
                marginTop: -Math.round(closedSize * 0.08),
                marginLeft: -Math.round(closedSize * 0.06),
              }}
            >
              +
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </>
  );
}

function getProductPalette(index: number) {
  const palettes = [
    { coverColor: '#89A89C', accentColor: '#DCE9E2' },
    { coverColor: '#F2EADD', accentColor: '#FCF8F2' },
    { coverColor: '#E7F0D6', accentColor: '#F8FBEF' },
    { coverColor: '#DDEAF3', accentColor: '#F5FAFD' },
  ];

  return palettes[index % palettes.length];
}

function getProductBadge(index: number) {
  if (index === 0) return 'מבצע';
  if (index === 1) return 'חדש';
  return undefined;
}

function toStoreProduct(product: ShopifyProduct, index: number, subtitleOverride?: string, categoryIdOverride?: string): StoreProduct {
  const palette = getProductPalette(index);
  const normalizedProductType = product.productType.trim();
  const subtitle = subtitleOverride?.trim() || (normalizedProductType && normalizedProductType !== 'מוצרים' ? normalizedProductType : 'כל המוצרים');

  return {
    id: product.id,
    name: product.title,
    subtitle,
    collectionTitle: null,
    categoryId: categoryIdOverride || normalizedProductType || 'all',
    price: product.price,
    currencyCode: product.currencyCode,
    handle: product.handle,
    description: product.description,
    badge: getProductBadge(index),
    featured: index < 2,
    coverColor: palette.coverColor,
    accentColor: palette.accentColor,
    imageUrl: product.imageUrl,
    imageAltText: product.imageAltText,
    variantId: product.variantId ?? '',
    variantTitle: product.variantTitle,
    availableForSale: product.availableForSale,
  };
}

function ProductImage({
  product,
  height,
  topRadius = 18,
  bottomRadius = 18,
}: {
  product: StoreProduct;
  height: number;
  /** Image area joins card body below — use 0 so the bottom is square. */
  topRadius?: number;
  bottomRadius?: number;
}) {
  const imageRadii = {
    borderTopLeftRadius: topRadius,
    borderTopRightRadius: topRadius,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  };

  if (product.imageUrl) {
    return (
      <Image
        source={{ uri: product.imageUrl }}
        resizeMode="cover"
        accessibilityLabel={product.imageAltText ?? product.name}
        style={{ width: '100%', height, ...imageRadii }}
      />
    );
  }

  return (
    <View
      style={{
        width: '100%',
        height,
        ...imageRadii,
        backgroundColor: product.coverColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 58,
          height: Math.max(72, Math.round(height * 0.65)),
          borderRadius: 18,
          backgroundColor: product.accentColor,
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 14,
        }}
      >
        <View
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
}

function HeaderLogo() {
  return (
    <View style={{ width: 56, height: 76, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={42} height={66} viewBox="0 0 71.16 112.32">
        <Path
          fill="#1F2937"
          d="M5.64,100.87c-.29-.14-.64-.27-1.06-.39-.42-.12-.84-.18-1.26-.18-.65,0-1.18.16-1.57.49-.39.33-.59.74-.59,1.23,0,.37.11.68.34.93s.52.46.88.63c.36.17.75.34,1.16.5.33.12.65.26.97.41.32.15.61.33.87.55.26.21.47.48.62.8.15.32.23.71.23,1.18,0,.55-.13,1.04-.39,1.46-.26.42-.63.75-1.09.99s-1.01.35-1.62.35c-.49,0-.94-.06-1.35-.18-.41-.12-.76-.26-1.06-.43s-.54-.3-.72-.41l.32-.56c.2.15.45.3.75.45.29.15.61.28.96.38.34.1.69.15,1.04.15.4,0,.79-.08,1.17-.24s.69-.4.94-.72c.25-.32.37-.73.37-1.22s-.12-.86-.35-1.15c-.23-.29-.53-.53-.9-.72-.36-.19-.75-.35-1.16-.5-.32-.12-.63-.25-.95-.38s-.61-.3-.87-.49c-.26-.19-.47-.42-.62-.69-.15-.27-.23-.6-.23-.98,0-.48.12-.89.36-1.24.24-.35.57-.63.99-.83.42-.2.89-.3,1.42-.31.47,0,.94.06,1.42.18.48.12.9.28,1.25.46l-.27.53ZM10.19,109.84c-.51,0-.92-.15-1.23-.45-.31-.3-.47-.7-.49-1.18v-3.99h.66v3.79c.02.35.13.65.34.88.21.23.53.36.94.38.35,0,.69-.09.99-.28.31-.19.56-.44.75-.76.19-.32.29-.69.29-1.1v-2.91h.66v5.47h-.59l-.07-1.72.1.38c-.09.28-.26.53-.5.76-.24.23-.52.41-.84.54s-.66.2-1.01.2ZM18.61,109.8c-.52,0-1.01-.14-1.47-.41-.46-.28-.79-.63-1.01-1.07l.11-.24v4.24h-.66v-8.14h.59l.07,1.79-.13-.41c.24-.44.6-.8,1.06-1.08.47-.28.97-.43,1.53-.43.52,0,.99.13,1.41.38.42.25.75.59,1,1.03s.37.93.37,1.49-.13,1.04-.39,1.48c-.26.43-.6.77-1.04,1.01-.43.24-.92.36-1.46.36ZM18.5,109.25c.43,0,.82-.1,1.17-.31.35-.21.63-.48.84-.83.21-.35.32-.74.32-1.17s-.1-.83-.31-1.18c-.2-.35-.48-.63-.82-.83-.34-.21-.73-.31-1.15-.31s-.78.09-1.12.28c-.34.19-.61.44-.81.76-.21.32-.33.68-.36,1.08v.45c.03.38.15.73.36,1.05.21.32.48.57.81.75s.69.27,1.08.27ZM25.83,109.8c-.57,0-1.07-.13-1.51-.38s-.78-.59-1.03-1.03c-.25-.43-.37-.92-.37-1.46s.13-1.02.39-1.45.61-.79,1.06-1.05c.44-.26.93-.39,1.48-.39.65,0,1.2.19,1.64.57.44.38.76.88.96,1.5l-4.78,1.85-.2-.48,4.38-1.71-.14.2c-.16-.37-.4-.7-.72-.97-.32-.27-.72-.41-1.18-.41-.42,0-.8.1-1.13.31-.34.21-.6.48-.8.83-.2.34-.3.74-.3,1.18,0,.41.1.79.29,1.15.19.35.46.64.8.85.34.21.74.32,1.19.32.3,0,.59-.06.86-.17.27-.11.52-.26.73-.43l.34.48c-.26.21-.56.37-.9.5-.34.13-.69.2-1.04.2ZM30.84,104.22l.07,1.68-.08-.21c.12-.34.31-.62.57-.87.26-.24.55-.43.87-.56.32-.13.63-.2.93-.2l-.03.64c-.42,0-.8.09-1.14.28-.34.19-.61.44-.81.75s-.3.66-.3,1.06v2.9h-.66v-5.47h.57ZM42.85,108.83c-.11.09-.32.22-.62.38-.3.16-.67.3-1.11.42-.44.12-.92.18-1.46.17-.81-.02-1.54-.16-2.18-.44s-1.18-.65-1.62-1.13-.78-1.02-1.01-1.64c-.23-.62-.35-1.27-.35-1.97,0-.78.12-1.5.36-2.15s.58-1.22,1.02-1.69c.44-.48.97-.84,1.59-1.11s1.3-.39,2.04-.39c.69,0,1.3.09,1.83.28.53.19.97.39,1.3.6l-.8,1.92c-.23-.18-.54-.36-.93-.55-.39-.19-.83-.29-1.34-.29-.39,0-.77.08-1.13.24-.36.16-.68.39-.95.69-.28.3-.49.65-.65,1.04s-.24.83-.24,1.29c0,.49.07.95.22,1.36s.35.76.62,1.06c.27.29.59.52.97.68.38.16.8.24,1.28.24.55,0,1.02-.09,1.41-.27.39-.18.69-.36.9-.56l.84,1.82ZM44.56,98.65h1.96v11.04h-1.96v-11.04ZM51.54,109.86c-.75,0-1.38-.14-1.9-.42-.52-.28-.91-.67-1.18-1.16-.27-.49-.41-1.06-.41-1.71s.16-1.17.48-1.67c.32-.49.74-.89,1.27-1.18.53-.29,1.12-.44,1.78-.44.88,0,1.6.25,2.16.76.56.51.93,1.24,1.1,2.2l-4.76,1.51-.43-1.06,3.44-1.16-.41.18c-.07-.24-.21-.45-.4-.64-.19-.18-.48-.27-.86-.27-.29,0-.54.07-.76.2-.22.14-.39.33-.5.57-.12.25-.18.54-.18.87,0,.38.07.7.21.96.14.26.33.45.57.58.24.13.51.2.81.2.21,0,.42-.04.62-.11.2-.07.4-.17.59-.29l.87,1.45c-.33.19-.68.34-1.06.45-.38.11-.73.17-1.07.17ZM58.85,109.86c-.57,0-1.08-.11-1.55-.34s-.83-.58-1.1-1.06c-.27-.48-.41-1.08-.41-1.82,0-.69.14-1.29.42-1.79s.65-.89,1.11-1.17c.46-.28.94-.41,1.45-.41.61,0,1.07.1,1.38.3.31.2.57.42.78.66l-.08.24.18-.9h1.82v6.11h-1.96v-1.33l.15.42s-.07.05-.17.16-.23.23-.41.38c-.18.15-.41.27-.67.38s-.58.16-.94.16ZM59.41,108.26c.23,0,.44-.03.63-.11.19-.07.35-.17.49-.31.14-.14.26-.3.36-.51v-1.5c-.07-.2-.19-.38-.34-.52-.15-.14-.33-.26-.53-.34-.2-.08-.43-.12-.69-.12-.28,0-.54.07-.78.22s-.43.34-.57.59c-.14.25-.21.54-.21.87s.07.62.22.88c.15.26.35.47.59.62s.52.22.8.22ZM66.64,103.57l.15,1.09-.03-.1c.21-.38.52-.69.91-.93.39-.24.87-.36,1.44-.36s1.06.17,1.45.51c.39.34.58.78.59,1.32v4.58h-1.96v-3.85c0-.27-.08-.49-.22-.65-.14-.16-.36-.24-.68-.24-.3,0-.56.1-.78.29s-.4.46-.52.8c-.12.34-.18.72-.18,1.16v2.49h-1.96v-6.11h1.78ZM25.72,23.65c-.24-.14-.47-.28-.71-.44-2.82-1.86-4.75-4.71-5.42-8.03-.68-3.31-.02-6.69,1.84-9.51h0c1.86-2.82,4.71-4.75,8.03-5.42,3.31-.68,6.69-.02,9.51,1.84,2.82,1.86,4.75,4.71,5.42,8.03.68,3.31.02,6.69-1.84,9.51-1.86,2.82-4.71,4.75-8.03,5.42-3.04.62-6.13.12-8.8-1.41ZM25.31,8.24c-1.18,1.79-1.59,3.92-1.17,6.02.43,2.1,1.65,3.9,3.43,5.08,1.78,1.18,3.92,1.59,6.02,1.17,2.1-.43,3.9-1.65,5.08-3.43,1.18-1.79,1.59-3.92,1.17-6.02-.43-2.1-1.65-3.9-3.43-5.08-1.79-1.18-3.92-1.59-6.02-1.17-2.1.43-3.9,1.65-5.08,3.43h0ZM8.94,53.23c-5.08-4.87-5.25-12.97-.39-18.05,4.87-5.08,12.97-5.25,18.05-.39,2.87,2.75,4.29,6.67,3.86,10.61,1.58-.99,3.27-1.76,5.02-2.32-.22-4.46-2.14-8.72-5.43-11.88-7.06-6.77-18.31-6.53-25.08.54-6.77,7.06-6.53,18.31.54,25.08,3.14,3.01,7.22,4.7,11.41,4.9.98.05,1.97.02,2.95-.1.26-1.82.73-3.61,1.44-5.35-4.33,1.25-9.05.12-12.36-3.04ZM70.79,30.36h-5.42v22.84c-4.33-5.22-10.86-8.55-18.15-8.55-13,0-23.57,10.57-23.57,23.57s10.57,23.57,23.57,23.57,23.57-10.57,23.57-23.57c0-.1,0-.2,0-.3h0V30.36ZM47.22,86.37c-10.01,0-18.15-8.14-18.15-18.15s8.14-18.15,18.15-18.15,18.15,8.14,18.15,18.15-8.14,18.15-18.15,18.15Z"
        />
      </Svg>
    </View>
  );
}

function PromoCarousel() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);

  useEffect(() => {
    if (!carouselWidth || PROMO_SLIDES.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setActiveIndex((current) => {
        const nextIndex = (current + 1) % PROMO_SLIDES.length;
        scrollRef.current?.scrollTo({
          x: nextIndex * carouselWidth,
          animated: true,
        });
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [carouselWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (!nextWidth || nextWidth === carouselWidth) return;
    setCarouselWidth(nextWidth);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!carouselWidth) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  return (
    <View onLayout={handleLayout}>
      <View
        style={{
          height: 148,
          borderRadius: 22,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {PROMO_SLIDES.map((slide) => (
            <PromoSlideCard key={slide.id} slide={slide} width={carouselWidth || 320} />
          ))}
        </ScrollView>
      </View>

      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {PROMO_SLIDES.map((slide, index) => (
          <View
            key={slide.id}
            style={{
              width: index === activeIndex ? 18 : 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: index === activeIndex ? '#111827' : '#D7DDE6',
            }}
          />
        ))}
      </View>
    </View>
  );
}

function PromoSlideCard({
  slide,
  width,
}: {
  slide: PromoSlide;
  width: number;
}) {
  const textBlock = (
    <View style={{ width: '56%', alignSelf: 'flex-start', zIndex: 2 }}>
      {slide.title.map((line) => (
        <Text
          key={line}
          style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'right' }}
        >
          {line}
        </Text>
      ))}
      <Text style={{ color: '#E5E7EB', marginTop: 6, fontSize: 11, textAlign: 'right' }}>{slide.subtitle}</Text>
      <Text style={{ color: '#D0C5B9', marginTop: 6, fontSize: 11, textAlign: 'right' }}>{slide.eyebrow}</Text>
    </View>
  );

  return (
    <View
      style={{
        width,
        height: 148,
        borderRadius: 22,
        backgroundColor: slide.backgroundColor,
        overflow: 'hidden',
        padding: 18,
        justifyContent: 'space-between',
      }}
    >
      {slide.variant === 'diffusers' && (
        <>
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '48%',
              backgroundColor: slide.panelColor,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 18,
              bottom: 0,
              width: 76,
              height: 128,
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
              backgroundColor: slide.bottleColors[1],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 100,
              bottom: 0,
              width: 44,
              height: 104,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              backgroundColor: slide.bottleColors[0],
            }}
          />
          {textBlock}
        </>
      )}

      {slide.variant === 'kits' && (
        <>
          <View
            style={{
              position: 'absolute',
              left: -16,
              top: -12,
              width: 128,
              height: 128,
              borderRadius: 28,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 22,
              top: 22,
              width: 118,
              height: 84,
              borderRadius: 18,
              backgroundColor: slide.panelColor,
              transform: [{ rotate: '-8deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 40,
              bottom: 20,
              width: 88,
              height: 44,
              borderRadius: 14,
              backgroundColor: slide.bottleColors[1],
              transform: [{ rotate: '8deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 70,
              top: 36,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: slide.bottleColors[0],
            }}
          />
          {textBlock}
        </>
      )}

      {slide.variant === 'spa' && (
        <>
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '52%',
              height: '100%',
              backgroundColor: slide.panelColor,
              borderTopLeftRadius: 40,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 28,
              bottom: 22,
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: slide.bottleColors[0],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 96,
              bottom: 18,
              width: 82,
              height: 12,
              borderRadius: 999,
              backgroundColor: slide.bottleColors[1],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 124,
              bottom: 42,
              width: 18,
              height: 52,
              borderRadius: 10,
              backgroundColor: '#F4EFEA',
            }}
          />
          {textBlock}
        </>
      )}

      {slide.variant === 'fresh' && (
        <>
          <View
            style={{
              position: 'absolute',
              right: -24,
              top: -10,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: slide.panelColor,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 32,
              top: 24,
              width: 78,
              height: 78,
              borderRadius: 22,
              backgroundColor: slide.bottleColors[1],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 110,
              top: 54,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: slide.bottleColors[0],
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              width: 90,
              height: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          />
          {textBlock}
        </>
      )}
    </View>
  );
}

function normalizeCategoryTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim();
}

function buildSidebarSectionsFromMenu(menuItems: ShopifyMenuItem[]): SidebarMenuSection[] {
  const sections: SidebarMenuSection[] = [{ id: 'all', title: 'כל המוצרים', categoryId: 'all' }];

  const toChildItems = (
    items: ShopifyMenuItem[],
    prefix?: string
  ): SidebarChildItem[] => {
    return items.flatMap((item) => {
      const lineageTitle = prefix ? `${prefix} / ${item.title}` : item.title;
      const nextChildren = item.children?.length ? toChildItems(item.children, lineageTitle) : [];
      const currentItem: SidebarChildItem[] = item.collectionHandle
        ? [
            {
              id: `child:${item.id}`,
              title: item.title,
              categoryId: item.collectionHandle,
              parentTitle: prefix,
              categoryDescription: item.collectionDescription,
              categoryImageUrl: item.collectionImageUrl,
            },
          ]
        : [];

      return currentItem.concat(nextChildren);
    });
  };

  menuItems.forEach((item) => {
    const childItems = item.children?.length ? toChildItems(item.children) : [];

    if (childItems.length) {
      sections.push({
        id: `menu:${item.id}`,
        title: item.title,
        categoryId: item.collectionHandle,
        children: childItems,
      });
      return;
    }

    if (!item.collectionHandle) return;

    sections.push({
      id: `menu:${item.id}`,
      title: item.title,
      categoryId: item.collectionHandle,
    });
  });

  return sections;
}

function flattenMenuCategories(menuItems: ShopifyMenuItem[]): StoreCategory[] {
  const orderedCategories: StoreCategory[] = [{ id: 'all', name: 'כל המוצרים' }];
  const seenHandles = new Set<string>(['all']);

  const visitItems = (items: ShopifyMenuItem[]) => {
    items.forEach((item) => {
      if (item.collectionHandle && !seenHandles.has(item.collectionHandle)) {
        seenHandles.add(item.collectionHandle);
        orderedCategories.push({
          id: item.collectionHandle,
          name: item.title,
          subtitle: item.collectionDescription,
          imageUrl: item.collectionImageUrl,
        });
      }

      if (item.children?.length) {
        visitItems(item.children);
      }
    });
  };

  visitItems(menuItems);

  return orderedCategories;
}

function getTopLevelMenuCategories(menuItems: ShopifyMenuItem[]): StoreCategory[] {
  return menuItems.flatMap((item) =>
    item.collectionHandle
      ? [
          {
            id: item.collectionHandle,
            name: item.title,
            subtitle: item.collectionDescription,
            imageUrl: item.collectionImageUrl,
          },
        ]
      : []
  );
}

function getTopLevelCategoryChildrenMap(menuItems: ShopifyMenuItem[]): Record<string, StoreSubcategory[]> {
  const toSubcategories = (items: ShopifyMenuItem[], parentTitle?: string): StoreSubcategory[] =>
    items.flatMap((item) => {
      const nestedSubcategories = item.children?.length ? toSubcategories(item.children, item.title) : [];
      const currentSubcategory: StoreSubcategory[] = item.collectionHandle
        ? [
            {
              id: item.collectionHandle,
              title: item.title,
              description: item.collectionDescription,
              parentTitle,
              imageUrl: item.collectionImageUrl,
            },
          ]
        : [];

      return currentSubcategory.concat(nestedSubcategories);
    });

  return menuItems.reduce<Record<string, StoreSubcategory[]>>((acc, item) => {
    if (!item.collectionHandle) return acc;
    acc[item.collectionHandle] = item.children?.length ? toSubcategories(item.children, item.title) : [];
    return acc;
  }, {});
}

function getCategoryAvatarLabel(name: string) {
  const words = normalizeCategoryTitle(name).split(' ').filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('') || name.slice(0, 1);
}

function renderBottomNavIcon(itemId: StoreBottomTabId, isActive: boolean, colorOverride?: string, sizeOverride?: number) {
  const color = colorOverride ?? (isActive ? '#111111' : '#7B8190');
  const size = sizeOverride ?? 20;
  const iconName =
    itemId === 'home'
      ? isActive
        ? 'home'
        : 'home-outline'
      : itemId === 'favorites'
        ? isActive
          ? 'heart'
          : 'heart-outline'
        : itemId === 'categories'
        ? isActive
          ? 'grid'
          : 'grid-outline'
        : itemId === 'ocdPlus'
          ? isActive
            ? 'sparkles'
            : 'sparkles-outline'
          : itemId === 'search'
            ? isActive
              ? 'search'
              : 'search-outline'
            : isActive
              ? 'person'
              : 'person-outline';

  return <Ionicons name={iconName} size={size} color={color} />;
}

function AnimatedStoreTabButton({
  focused,
  onPress,
  icon,
  compact = false,
}: {
  focused: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  const progress = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, progress]);

  const animatedBubbleStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(progress.value, [0, 1], ['transparent', '#000000']);
    const scale = withTiming(pressed.value ? 0.94 : 1, { duration: 140 });

    return {
      backgroundColor,
      transform: [{ scale }],
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.78, { duration: 160 }),
    transform: [{ translateY: withTiming(focused ? 0 : 1, { duration: 160 }) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      style={{
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            width: compact ? 42 : 40,
            height: compact ? 42 : 40,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 0,
          },
          animatedBubbleStyle,
        ]}
      >
        {icon}
      </Animated.View>
      <Animated.Text
        style={[
          {
            fontSize: 11,
            fontWeight: focused ? '800' : '600',
            color: focused ? '#111111' : '#7B8190',
            textAlign: 'center',
            height: 0,
            opacity: 0,
          },
          animatedLabelStyle,
        ]}
      >
        {' '}
      </Animated.Text>
    </Pressable>
  );
}

export function getStoreBottomBarMetrics(insetsBottom: number) {
  const bottomBarInset = Math.max(4, Math.min(insetsBottom, 8));
  const bottomBarOffset = 4 + insetsBottom;
  const bottomBarHeight = 70 + bottomBarInset;

  return {
    bottomBarInset,
    bottomBarOffset,
    bottomBarHeight,
    contentPaddingBottom: bottomBarHeight + bottomBarOffset + 12,
  };
}

export function StoreFloatingTabBar({
  activeTab,
  onTabPress,
}: {
  activeTab: StoreBottomTabId;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { bottomBarInset, bottomBarOffset } = getStoreBottomBarMetrics(insets.bottom);

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomBarOffset,
        zIndex: 9999,
        elevation: 9999,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 999,
          padding: 4,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          shadowColor: '#000000',
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <AnimatedStoreTabButton
          compact
          focused={activeTab === 'home'}
          onPress={() => onTabPress('home')}
          icon={renderBottomNavIcon('home', activeTab === 'home', activeTab === 'home' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
      </View>

      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          backgroundColor: '#FFFFFF',
          borderRadius: 999,
          padding: 5,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          shadowColor: '#000000',
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <AnimatedStoreTabButton
          focused={activeTab === 'categories'}
          onPress={() => onTabPress('categories')}
          icon={renderBottomNavIcon('categories', activeTab === 'categories', activeTab === 'categories' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
        <AnimatedStoreTabButton
          focused={activeTab === 'favorites'}
          onPress={() => onTabPress('favorites')}
          icon={renderBottomNavIcon('favorites', activeTab === 'favorites', activeTab === 'favorites' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
        <AnimatedStoreTabButton
          focused={activeTab === 'ocdPlus'}
          onPress={() => onTabPress('ocdPlus')}
          icon={renderBottomNavIcon('ocdPlus', activeTab === 'ocdPlus', activeTab === 'ocdPlus' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
        <AnimatedStoreTabButton
          focused={activeTab === 'search'}
          onPress={() => onTabPress('search')}
          icon={renderBottomNavIcon('search', activeTab === 'search', activeTab === 'search' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
      </View>

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 999,
          padding: 4,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          shadowColor: '#000000',
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <AnimatedStoreTabButton
          compact
          focused={activeTab === 'profile'}
          onPress={() => onTabPress('profile')}
          icon={renderBottomNavIcon('profile', activeTab === 'profile', activeTab === 'profile' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
      </View>
    </View>
  );
}

function buildSidebarSections(categories: StoreCategory[]): SidebarMenuSection[] {
  const directCategories = categories.filter((category) => category.id !== 'all');
  const prefixCounts = new Map<string, number>();

  directCategories.forEach((category) => {
    const words = normalizeCategoryTitle(category.name).split(' ');
    if (words.length >= 2) {
      const prefix = `${words[0]} ${words[1]}`;
      prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
    }
  });

  const groupedPrefixes = new Set(
    Array.from(prefixCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([prefix]) => prefix)
  );

  const sections: SidebarMenuSection[] = [{ id: 'all', title: 'כל המוצרים', categoryId: 'all' }];
  const usedCategoryIds = new Set<string>(['all']);

  groupedPrefixes.forEach((prefix) => {
    const matchingCategories = directCategories.filter((category) =>
      normalizeCategoryTitle(category.name).startsWith(`${prefix} `) || normalizeCategoryTitle(category.name) === prefix
    );

    if (!matchingCategories.length) return;

    sections.push({
      id: `group:${prefix}`,
      title: prefix,
      children: matchingCategories.map((category) => ({
        id: `child:${category.id}`,
        title: normalizeCategoryTitle(category.name).replace(`${prefix} `, '') || category.name,
        categoryId: category.id,
      })),
    });

    matchingCategories.forEach((category) => usedCategoryIds.add(category.id));
  });

  directCategories.forEach((category) => {
    if (usedCategoryIds.has(category.id)) return;

    sections.push({
      id: category.id,
      title: category.name,
      categoryId: category.id,
    });
  });

  return sections;
}

export function StoreHomeScreen({
  onProfilePress,
  onFavoritesPress,
  onOcdPlusPress,
  onSearchPress,
  onProductPress,
  onOpenCart,
  onOpenProduct,
  onOpenCategory,
  initialTab,
  initialTabRequestId,
}: {
  onProfilePress: () => void;
  onFavoritesPress?: () => void;
  onOcdPlusPress?: () => void;
  onSearchPress?: () => void;
  onProductPress?: (handle: string) => void;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
  onOpenCategory?: (category: {
    id: string;
    title: string;
    description?: string;
    parentTitle?: string;
    subcategories?: StoreSubcategory[];
  }) => void;
  initialTab?: StoreMainTabId;
  initialTabRequestId?: number;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const categoryCardWidth = Math.max(150, Math.floor((windowWidth - 40) / 2));
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<StoreProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([{ id: 'all', name: 'כל המוצרים' }]);
  const [menuItems, setMenuItems] = useState<ShopifyMenuItem[]>([]);
  const [categoryStoryImages, setCategoryStoryImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const categoryTabsRef = useRef<ScrollView | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const [activePrimaryTab, setActivePrimaryTab] = useState<StoreMainTabId>('home');
  const [categoriesSheetOpen, setCategoriesSheetOpen] = useState(false);
  const [categoriesSheetMounted, setCategoriesSheetMounted] = useState(false);
  const categoriesSheetWasOpenRef = useRef(false);
  const categoriesSheetHeight = Math.round(windowHeight * 0.9);
  const categoriesSheetHeightSV = useSharedValue(categoriesSheetHeight);
  const categoriesSheetPanStartY = useSharedValue(0);
  const categoriesBackdropOpacity = useSharedValue(0);
  const categoriesSheetTranslateY = useSharedValue(0);
  const lastHandledInitialTabRequestIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    categoriesSheetHeightSV.value = categoriesSheetHeight;
  }, [categoriesSheetHeight, categoriesSheetHeightSV]);

  const closeCategoriesSheet = useCallback(() => setCategoriesSheetOpen(false), []);

  const categoriesSheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-32, 32])
        .onStart(() => {
          categoriesSheetPanStartY.value = categoriesSheetTranslateY.value;
        })
        .onUpdate((e) => {
          const h = categoriesSheetHeightSV.value;
          const y = Math.max(0, categoriesSheetPanStartY.value + e.translationY);
          categoriesSheetTranslateY.value = y;
          categoriesBackdropOpacity.value = interpolate(y, [0, h], [1, 0], Extrapolation.CLAMP);
        })
        .onEnd((e) => {
          const h = categoriesSheetHeightSV.value;
          const y = categoriesSheetTranslateY.value;
          const shouldClose = y > h * 0.22 || e.velocityY > 700;
          if (shouldClose) {
            runOnJS(closeCategoriesSheet)();
          } else {
            categoriesSheetTranslateY.value = withSpring(0, { damping: 24, stiffness: 320, mass: 0.88 });
            categoriesBackdropOpacity.value = withTiming(1, { duration: 200 });
          }
        }),
    [closeCategoriesSheet],
  );

  useEffect(() => {
    const wantOpen = categoriesSheetOpen;
    if (wantOpen && !categoriesSheetWasOpenRef.current) {
      categoriesSheetWasOpenRef.current = true;
      categoriesSheetTranslateY.value = categoriesSheetHeight;
      categoriesBackdropOpacity.value = 0;
      setCategoriesSheetMounted(true);
      requestAnimationFrame(() => {
        categoriesBackdropOpacity.value = withTiming(1, { duration: 220 });
        categoriesSheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 300, mass: 0.82 });
      });
      return;
    }
    if (!wantOpen && categoriesSheetWasOpenRef.current) {
      categoriesSheetWasOpenRef.current = false;
      categoriesBackdropOpacity.value = withTiming(0, { duration: 200 });
      categoriesSheetTranslateY.value = withTiming(categoriesSheetHeight, { duration: 270 }, (finished) => {
        if (finished) {
          runOnJS(setCategoriesSheetMounted)(false);
        }
      });
    }
  }, [categoriesSheetOpen, categoriesSheetHeight]);

  const categoriesSheetBackdropStyle = useAnimatedStyle(() => ({
    opacity: categoriesBackdropOpacity.value,
  }));

  const categoriesSheetPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: categoriesSheetTranslateY.value }],
  }));

  const activeBottomTab = useMemo<StoreBottomTabId>(() => {
    if (categoriesSheetOpen) return 'categories';
    if (activePrimaryTab === 'search') return 'search';
    return 'home';
  }, [categoriesSheetOpen, activePrimaryTab]);
  const { itemCount, addItem } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();

  useEffect(() => {
    let isMounted = true;

    const loadStorefrontData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [liveProducts, liveCollections] = await Promise.all([
          fetchProducts(24),
          fetchCollections(50),
        ]);
        let liveMenuItems: ShopifyMenuItem[] = [];

        try {
          liveMenuItems = await fetchMenuItems();
        } catch {
          liveMenuItems = [];
        }

        if (!isMounted) return;
        const mappedProducts = liveProducts.map((product, index) => toStoreProduct(product, index));
        const mappedCollections: StoreCategory[] = liveMenuItems.length
          ? flattenMenuCategories(liveMenuItems)
          : [
              { id: 'all', name: 'כל המוצרים' },
              ...liveCollections.map((collection: ShopifyCollection) => ({
                id: collection.handle,
                name: collection.title,
                subtitle: collection.description,
                imageUrl: collection.imageUrl,
              })),
            ];

        setAllProducts(mappedProducts);
        setVisibleProducts(mappedProducts);
        setFeaturedProducts(mappedProducts.slice(0, 2));
        setCategories(mappedCollections);
        setMenuItems(liveMenuItems);
      } catch (err) {
        if (!isMounted) return;
        setAllProducts([]);
        setVisibleProducts([]);
        setFeaturedProducts([]);
        setCategories([{ id: 'all', name: 'כל המוצרים' }]);
        setMenuItems([]);
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת מוצרים');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    loadStorefrontData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectCategoryFromMenu = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setMenuOpen(false);
  };

  const sidebarSections = useMemo(
    () => (menuItems.length ? buildSidebarSectionsFromMenu(menuItems) : buildSidebarSections(categories)),
    [categories, menuItems]
  );
  const topLevelCategories = useMemo(
    () => (menuItems.length ? getTopLevelMenuCategories(menuItems) : categories.filter((category) => category.id !== 'all')),
    [categories, menuItems]
  );
  const topLevelCategoryChildrenMap = useMemo(() => getTopLevelCategoryChildrenMap(menuItems), [menuItems]);
  const topLevelCategoryRows = useMemo(() => {
    const rows: StoreCategory[][] = [];

    for (let index = 0; index < topLevelCategories.length; index += 2) {
      rows.push(topLevelCategories.slice(index, index + 2));
    }

    return rows;
  }, [topLevelCategories]);
  const featuredBrandsSection = useMemo(
    () => sidebarSections.find((section) => normalizeCategoryTitle(section.title) === 'חברות נבחרות'),
    [sidebarSections]
  );
  const featuredBrands = useMemo(
    () =>
      (featuredBrandsSection?.children ?? []).map((child) => ({
        id: child.categoryId,
        title: child.title,
        description: child.categoryDescription,
        parentTitle: child.parentTitle ?? featuredBrandsSection?.title,
        imageUrl: child.categoryImageUrl,
      })),
    [featuredBrandsSection]
  );
  const selectedCategoryInfo = useMemo(
    () => categories.find((category) => category.id === selectedCategory) ?? topLevelCategories.find((category) => category.id === selectedCategory),
    [categories, selectedCategory, topLevelCategories]
  );
  const selectedCategoryName = useMemo(
    () => selectedCategoryInfo?.name ?? 'מוצרים',
    [selectedCategoryInfo]
  );
  const categoryPreviewProducts = useMemo(
    () => (selectedCategory === 'all' ? [] : visibleProducts.slice(0, STORE_HOME_CATEGORY_PREVIEW_LIMIT)),
    [selectedCategory, visibleProducts]
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  useEffect(() => {
    if (selectedCategory !== 'all') return;
    if (!topLevelCategories.length) return;

    setSelectedCategory(topLevelCategories[0].id);
  }, [selectedCategory, topLevelCategories]);

  useEffect(() => {
    if (!initialTabRequestId || lastHandledInitialTabRequestIdRef.current === initialTabRequestId) {
      return;
    }

    lastHandledInitialTabRequestIdRef.current = initialTabRequestId;
    setMenuOpen(false);

    if (initialTab === 'categories') {
      searchInputRef.current?.blur();
      setActivePrimaryTab('home');
      setCategoriesSheetOpen(true);
      return;
    }

    if (initialTab === 'search') {
      setActivePrimaryTab('search');
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return;
    }

    searchInputRef.current?.blur();
    setActivePrimaryTab('home');
    if (topLevelCategories.length) {
      setSelectedCategory(topLevelCategories[0].id);
    }
  }, [initialTab, initialTabRequestId, topLevelCategories]);

  useEffect(() => {
    let isMounted = true;

    const loadCategoryStoryImages = async () => {
      if (!topLevelCategories.length) return;

      try {
        const imageEntries = await Promise.all(
          topLevelCategories.map(async (category) => {
            try {
              const categoryProducts = await fetchCollectionProducts(category.id, 8);
              const productsWithImages = categoryProducts.filter((product) => !!product.imageUrl);
              const preferredTitleFragments = CATEGORY_STORY_PRODUCT_OVERRIDES[category.name] ?? [];

              if (!productsWithImages.length) {
                return [category.id, category.imageUrl ?? ''] as const;
              }

              const preferredProduct = preferredTitleFragments.length
                ? productsWithImages.find((product) =>
                    preferredTitleFragments.some((fragment) => product.title.includes(fragment))
                  )
                : undefined;

              if (preferredProduct?.imageUrl) {
                return [category.id, preferredProduct.imageUrl] as const;
              }

              const randomProduct = productsWithImages[Math.floor(Math.random() * productsWithImages.length)];
              return [category.id, randomProduct.imageUrl ?? category.imageUrl ?? ''] as const;
            } catch {
              return [category.id, category.imageUrl ?? ''] as const;
            }
          })
        );

        if (!isMounted) return;

        setCategoryStoryImages(
          imageEntries.reduce<Record<string, string>>((acc, [categoryId, imageUrl]) => {
            if (imageUrl) {
              acc[categoryId] = imageUrl;
            }
            return acc;
          }, {})
        );
      } catch {
        if (!isMounted) return;
        setCategoryStoryImages({});
      }
    };

    loadCategoryStoryImages();

    return () => {
      isMounted = false;
    };
  }, [topLevelCategories]);

  useEffect(() => {
    let isMounted = true;

    const loadCategoryProducts = async () => {
      const normalizedQuery = query.trim().toLowerCase();

      if (selectedCategory === 'all') {
        const filteredProducts = allProducts.filter((product) => {
          return (
            !normalizedQuery ||
            product.name.toLowerCase().includes(normalizedQuery) ||
            product.subtitle.toLowerCase().includes(normalizedQuery) ||
            product.description.toLowerCase().includes(normalizedQuery)
          );
        });
        setVisibleProducts(filteredProducts);
        return;
      }

      try {
        setCategoryLoading(true);
        setError(null);
        const collectionProducts = await fetchCollectionProducts(selectedCategory, 40);
        if (!isMounted) return;

        const mappedProducts = collectionProducts.map((product, index) =>
          toStoreProduct(product, index, selectedCategoryName, selectedCategory)
        );
        const filteredProducts = mappedProducts.filter((product) => {
          return (
            !normalizedQuery ||
            product.name.toLowerCase().includes(normalizedQuery) ||
            product.subtitle.toLowerCase().includes(normalizedQuery) ||
            product.description.toLowerCase().includes(normalizedQuery)
          );
        });

        setVisibleProducts(filteredProducts);
      } catch (err) {
        if (!isMounted) return;
        setVisibleProducts([]);
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת קטגוריה');
      } finally {
        if (!isMounted) return;
        setCategoryLoading(false);
      }
    };

    loadCategoryProducts();

    return () => {
      isMounted = false;
    };
  }, [allProducts, query, selectedCategory, selectedCategoryName]);

  const handleBottomTabPress = (itemId: StoreBottomTabId) => {
    if (itemId === 'home') {
      setMenuOpen(false);
      setCategoriesSheetOpen(false);
      setActivePrimaryTab('home');
      searchInputRef.current?.blur();
      setSelectedCategory(topLevelCategories[0]?.id ?? 'all');
      return;
    }

    if (itemId === 'categories') {
      setMenuOpen(false);
      searchInputRef.current?.blur();
      setCategoriesSheetOpen((open) => !open);
      return;
    }

    if (itemId === 'search') {
      setMenuOpen(false);
      if (onSearchPress) {
        searchInputRef.current?.blur();
        onSearchPress();
        return;
      }

      setActivePrimaryTab('search');
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return;
    }

    if (itemId === 'ocdPlus') {
      setMenuOpen(false);
      searchInputRef.current?.blur();
      onOcdPlusPress?.();
      return;
    }

    if (itemId === 'favorites') {
      setMenuOpen(false);
      searchInputRef.current?.blur();
      onFavoritesPress?.();
      return;
    }

    setMenuOpen(false);
    searchInputRef.current?.blur();
    onProfilePress();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Modal
          visible={menuOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            onPress={() => setMenuOpen(false)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(17,24,39,0.16)',
              paddingLeft: 48,
              alignItems: 'flex-end',
            }}
          >
            <View
              style={{
                width: '82%',
                maxWidth: 320,
                height: '100%',
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 16,
                paddingTop: 58,
                paddingBottom: 24,
                borderTopLeftRadius: 28,
                borderBottomLeftRadius: 28,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900' }}>קטגוריות</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>
                  בחירה מהירה מהקטגוריות של Shopify
                </Text>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {sidebarSections.map((section) => {
                  const isDirectItem = !section.children?.length;
                  const isExpanded = !!expandedSections[section.id];
                  const isSelected = section.categoryId === selectedCategory;

                  return (
                    <View key={section.id}>
                      <Pressable
                        onPress={() => {
                          if (isDirectItem && section.categoryId) {
                            selectCategoryFromMenu(section.categoryId);
                            return;
                          }

                          toggleSection(section.id);
                        }}
                        style={{
                          borderRadius: 14,
                          paddingHorizontal: 14,
                          paddingVertical: 14,
                          backgroundColor: isSelected ? '#111827' : '#F7F8FB',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text
                            style={{
                              color: isSelected ? '#FFFFFF' : '#111827',
                              fontWeight: '800',
                              textAlign: 'right',
                              flexShrink: 1,
                            }}
                          >
                            {section.title}
                          </Text>

                          {!isDirectItem && (
                            <Text
                              style={{
                                color: '#6B7280',
                                fontSize: 16,
                                marginLeft: 10,
                              }}
                            >
                              {isExpanded ? '⌄' : '‹'}
                            </Text>
                          )}
                        </View>
                      </Pressable>

                      {!!section.children?.length && isExpanded && (
                        <View
                          style={{
                            marginTop: 8,
                            marginRight: 10,
                            gap: 6,
                            borderRightWidth: 2,
                            borderRightColor: '#ECEFF4',
                            paddingRight: 10,
                          }}
                        >
                          {section.children.map((child) => {
                            const isChildSelected = selectedCategory === child.categoryId;

                            return (
                              <Pressable
                                key={child.id}
                                onPress={() => {
                                  if (onOpenCategory) {
                                    setMenuOpen(false);
                                    onOpenCategory({
                                      id: child.categoryId,
                                      title: child.title,
                                      description: child.categoryDescription,
                                      parentTitle: child.parentTitle ?? section.title,
                                    });
                                    return;
                                  }

                                  selectCategoryFromMenu(child.categoryId);
                                }}
                                style={{
                                  borderRadius: 12,
                                  paddingHorizontal: 12,
                                  paddingVertical: 11,
                                  backgroundColor: isChildSelected ? '#111827' : '#FBFBFC',
                                }}
                              >
                                <Text
                                  style={{
                                    color: isChildSelected ? '#FFFFFF' : '#374151',
                                    textAlign: 'right',
                                    fontWeight: '700',
                                  }}
                                >
                                  {child.title}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

            </View>
          </Pressable>
        </Modal>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: contentPaddingBottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 18 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 4,
                minHeight: 60,
              }}
            >
              <Pressable
                onPress={onOpenCart}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: '#F8F8FA',
                  borderWidth: 1,
                  borderColor: '#ECEFF4',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingCart size={18} color="#111827" />
                {itemCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 4,
                      backgroundColor: '#111827',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{itemCount}</Text>
                  </View>
                )}
              </Pressable>

              <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 42 }}>
                <HeaderLogo />
              </View>

              <View style={{ width: 42 }} />
            </View>

            <View
              style={{
                backgroundColor: '#F7F8FB',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF0F3',
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row-reverse',
                alignItems: 'center',
              }}
            >
              <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginLeft: 8 }} />
              <TextInput
                ref={searchInputRef}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (text.trim()) {
                    setActivePrimaryTab('search');
                  }
                }}
                placeholder="מה אתם רוצים לחפש?"
                placeholderTextColor="#B7BDC8"
                style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 13 }}
              />
            </View>

            {SHOW_PROMO_CAROUSEL && <PromoCarousel />}

            <ScrollView
              ref={categoryTabsRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={() => {
                requestAnimationFrame(() => {
                  categoryTabsRef.current?.scrollToEnd({ animated: false });
                });
              }}
              contentContainerStyle={{
                flexDirection: 'row-reverse',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 20,
                paddingHorizontal: 4,
              }}
            >
              {topLevelCategories.map((category) => {
                const isSelected = selectedCategory === category.id;
                const storyImageUrl = categoryStoryImages[category.id] || category.imageUrl;

                return (
                  <Pressable key={category.id} onPress={() => setSelectedCategory(category.id)}>
                    <View style={{ alignItems: 'center', gap: 8, width: 82 }}>
                      <View
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 35,
                          padding: 3,
                          backgroundColor: isSelected ? '#111827' : '#FFFFFF',
                          borderWidth: 1,
                          borderColor: isSelected ? '#111827' : '#E7ECF3',
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                            borderRadius: 32,
                            overflow: 'hidden',
                            backgroundColor: '#F4F6FA',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {storyImageUrl ? (
                            <Image
                              source={{ uri: storyImageUrl }}
                              resizeMode="cover"
                              accessibilityLabel={category.name}
                              style={{ width: '100%', height: '100%' }}
                            />
                          ) : (
                            <Text style={{ color: '#6B7280', fontSize: 18, fontWeight: '800' }}>
                              {getCategoryAvatarLabel(category.name)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text
                        numberOfLines={2}
                        style={{
                          color: isSelected ? '#111827' : '#9CA3AF',
                          fontWeight: isSelected ? '900' : '600',
                          fontSize: 12,
                          lineHeight: 16,
                          textAlign: 'center',
                          minHeight: 32,
                        }}
                      >
                        {category.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedCategory !== 'all' && !categoryLoading && !!categoryPreviewProducts.length && (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    width: '100%',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 8, justifyContent: 'center' }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        width: '100%',
                        color: '#111827',
                        fontSize: 24,
                        fontWeight: '900',
                        textAlign: 'right',
                        lineHeight: 28,
                      }}
                    >
                      {selectedCategoryName}
                    </Text>
                    <Text
                      style={{
                        width: '100%',
                        color: '#B1B6C1',
                        fontSize: 11,
                        lineHeight: 15,
                        textAlign: 'right',
                      }}
                    >
                      עד {STORE_HOME_CATEGORY_PREVIEW_LIMIT} מוצרים מהקטגוריה שבחרת
                    </Text>
                  </View>
                  <View style={{ flexShrink: 0, justifyContent: 'center' }}>
                    <Pressable
                      onPress={() =>
                        onOpenCategory?.({
                          id: selectedCategory,
                          title: selectedCategoryName,
                          description: selectedCategoryInfo?.subtitle,
                          subcategories: topLevelCategoryChildrenMap[selectedCategory] ?? [],
                        })
                      }
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <View
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          minHeight: 36,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: '#000000',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>לכל המוצרים</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row-reverse',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  {categoryPreviewProducts.map((product) => (
                    <Pressable
                      key={`preview-${product.id}`}
                      onPress={() => onProductPress?.(product.handle)}
                      style={{
                        width: '48%',
                        borderRadius: 18,
                        ...storeProductCardShadowStyle,
                      }}
                    >
                      <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                      {/* Image area */}
                      <View
                        style={{
                          height: 160,
                          backgroundColor: '#F4F6FA',
                          overflow: 'hidden',
                        }}
                      >
                        <ProductImage product={product} height={160} bottomRadius={0} />

                        <StoreProductCardQuantityControl product={product} closedSize={44} />

                        {/* Badge — top-right */}
                        {!!product.badge && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              backgroundColor: '#111827',
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              zIndex: 1,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                              {product.badge}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Info section: price first, then name, then subtitle */}
                      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
                        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                          {formatPrice(product.price)}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: '#111827',
                            fontSize: 13,
                            lineHeight: 18,
                            fontWeight: '700',
                            textAlign: 'right',
                            marginTop: 3,
                          }}
                        >
                          {product.name}
                        </Text>
                        {!!product.subtitle && (
                          <Text
                            numberOfLines={1}
                            style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}
                          >
                            {product.subtitle}
                          </Text>
                        )}
                      </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {selectedCategory !== 'all' && !loading && !categoryLoading && !categoryPreviewProducts.length && (
              <View
                style={{
                  backgroundColor: '#F8F8F8',
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ color: '#111827', fontWeight: '800' }}>לא נמצאו מוצרים בקטגוריה הזו</Text>
              </View>
            )}

            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>הנמכרים ביותר</Text>
              <Text style={{ color: '#B1B6C1', fontSize: 11 }}>the lifestyle and fragrance collection</Text>
            </View>

            {(loading || categoryLoading) && (
              <View
                style={{
                  backgroundColor: '#F8F8F8',
                  borderRadius: 16,
                  padding: 18,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <ActivityIndicator color="#111827" />
                <Text style={{ color: '#111827', fontWeight: '700' }}>טוען מוצרים מ-Shopify...</Text>
              </View>
            )}

            {!!error && !loading && (
              <View
                style={{
                  backgroundColor: '#FFF4F4',
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ color: '#991B1B', fontWeight: '800' }}>לא הצלחנו לטעון מוצרים כרגע</Text>
                <Text style={{ color: '#B91C1C', marginTop: 6, textAlign: 'right' }}>{error}</Text>
              </View>
            )}

            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              {featuredProducts.map((product) => (
                <Pressable
                  key={product.id}
                  onPress={() => onProductPress?.(product.handle)}
                  style={({ pressed }) => ({
                    width: 156,
                    borderRadius: 18,
                    ...storeProductCardShadowStyle,
                    opacity: pressed ? 0.95 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  {/* Image area */}
                  <View style={{ height: 152, backgroundColor: '#F4F6FA', overflow: 'hidden' }}>
                    <ProductImage product={product} height={152} bottomRadius={0} />

                    <StoreProductCardQuantityControl product={product} closedSize={40} />

                    {/* Favorite — top-right */}
                    <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                      <FavoriteToggleButton
                        active={isFavorite(product.id)}
                        loading={isFavoritePending(product.id)}
                        onPress={(event) => {
                          event?.stopPropagation();
                          void toggleFavorite(favoriteInputFromStoreProduct(product));
                        }}
                        size={32}
                      />
                    </View>

                    {/* Badge — below favorite */}
                    {!!product.badge && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 48,
                          right: 10,
                          backgroundColor: '#111827',
                          borderRadius: 999,
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          zIndex: 1,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                          {product.badge}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Info section: price first, then name, then subtitle */}
                  <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 }}>
                    <Text style={{ color: '#111827', fontSize: 15, fontWeight: '900', textAlign: 'right' }}>
                      {formatPrice(product.price)}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: '#111827',
                        fontSize: 12,
                        lineHeight: 17,
                        fontWeight: '700',
                        textAlign: 'right',
                        marginTop: 3,
                      }}
                    >
                      {product.name}
                    </Text>
                    {!!product.subtitle && (
                      <Text numberOfLines={1} style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}>
                        {product.subtitle}
                      </Text>
                    )}
                  </View>
                  </View>
                </Pressable>
              ))}
            </View>

            {selectedCategory === 'all' && (
              <>
                <View style={{ alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
                  <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>כל המוצרים</Text>
                  <Text style={{ color: '#B1B6C1', fontSize: 11 }}>all products from your Shopify store</Text>
                </View>

            <View style={{ gap: 12 }}>
              {visibleProducts.map((product) => (
                <Pressable
                  key={`list-${product.id}`}
                  onPress={() => onProductPress?.(product.handle)}
                  style={({ pressed }) => ({
                    borderRadius: 18,
                    ...storeProductCardShadowStyle,
                    opacity: pressed ? 0.96 : 1,
                    transform: [{ scale: pressed ? 0.995 : 1 }],
                  })}
                >
                  <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                    <View style={{ width: 112, padding: 10 }}>
                      <View style={{ position: 'relative' }}>
                        <ProductImage product={product} height={118} bottomRadius={0} />
                        <View
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                          }}
                        >
                          <FavoriteToggleButton
                            active={isFavorite(product.id)}
                            loading={isFavoritePending(product.id)}
                            onPress={(event) => {
                              event?.stopPropagation();
                              void toggleFavorite(favoriteInputFromStoreProduct(product));
                            }}
                            size={32}
                          />
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 18,
                        overflow: 'hidden',
                      }}
                    >
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                        {product.name}
                      </Text>
                      <Text style={{ color: '#8D94A1', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                        {product.subtitle}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{ color: '#6B7280', fontSize: 12, marginTop: 8, textAlign: 'right' }}
                      >
                        {product.description || 'מוצר מהקטלוג שלך'}
                      </Text>
                      <Text style={{ color: '#111827', fontSize: 20, fontWeight: '900', marginTop: 10 }}>
                        {formatPrice(product.price)}
                      </Text>
                    </View>
                  </View>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={{ alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
              <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>מומלץ במיוחד עבורך</Text>
            </View>

            <View
              style={{
                backgroundColor: '#F8F5EF',
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 16,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#C8A467', fontSize: 9, fontWeight: '800' }}>EXCLUSIVE</Text>
                <Text style={{ color: '#1F2937', fontSize: 16, fontWeight: '900', marginTop: 6 }}>
                  Midnight in
                </Text>
                <Text style={{ color: '#1F2937', fontSize: 18, fontWeight: '900' }}>Spa</Text>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', marginTop: 10 }}>
                  ₪120.00
                </Text>
              </View>

              <View
                style={{
                  width: 84,
                  height: 72,
                  borderRadius: 16,
                  backgroundColor: '#111111',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: '#D7A14B',
                  }}
                />
              </View>
            </View>

            <View style={{ alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
              <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>הקולקציות שלנו</Text>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              {COLLECTIONS.map((collection) => (
                <View
                  key={collection.id}
                  style={{
                    width: '48%',
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: collection.color,
                    height: 152,
                    justifyContent: 'flex-end',
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: collection.id === 'c-2' ? 'rgba(0,0,0,0.18)' : 'transparent',
                    }}
                  />
                  <Text
                    style={{
                      color: collection.id === 'c-2' ? '#FFFFFF' : '#111827',
                      fontSize: 15,
                      fontWeight: '800',
                      textAlign: 'right',
                    }}
                  >
                    {collection.title}
                  </Text>
                  <Text
                    style={{
                      color: collection.id === 'c-2' ? '#E5E7EB' : '#6B7280',
                      fontSize: 11,
                      marginTop: 4,
                      textAlign: 'right',
                    }}
                  >
                    {collection.subtitle}
                  </Text>
                </View>
              ))}
            </View>
              </>
            )}

            {selectedCategory === 'all' && !loading && !categoryLoading && !visibleProducts.length && (
              <View
                style={{
                  backgroundColor: '#F8F8F8',
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ color: '#111827', fontWeight: '800' }}>לא נמצאו מוצרים לחיפוש הזה</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <Modal
          visible={categoriesSheetMounted}
          animationType="none"
          transparent
          onRequestClose={closeCategoriesSheet}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <Animated.View
                pointerEvents="box-none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15, 23, 42, 0.5)' }, categoriesSheetBackdropStyle]}
              >
                <Pressable
                  style={StyleSheet.absoluteFillObject}
                  onPress={closeCategoriesSheet}
                  accessibilityRole="button"
                  accessibilityLabel="סגור קטגוריות"
                />
              </Animated.View>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: categoriesSheetHeight,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingBottom: 12,
                    overflow: 'hidden',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.14,
                    shadowRadius: 16,
                    elevation: 24,
                  },
                  categoriesSheetPanelStyle,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <GestureDetector gesture={categoriesSheetPanGesture}>
                    <View
                      style={{ paddingTop: 10, paddingBottom: 8 }}
                      accessible
                      accessibilityLabel="אזור אחיזה: גרור למטה לסגירת קטגוריות"
                    >
                      <View style={{ alignItems: 'center', paddingBottom: 6 }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
                      </View>
                      <View style={{ paddingHorizontal: 20, gap: 6 }}>
                        <Text
                          style={{
                            color: '#C18D39',
                            fontSize: 10,
                            fontWeight: '800',
                            letterSpacing: 2.5,
                            textAlign: 'right',
                          }}
                        >
                          SHOP BY CATEGORY
                        </Text>
                        <Text
                          style={{
                            color: '#111827',
                            fontSize: 22,
                            fontWeight: '900',
                            letterSpacing: -0.3,
                            textAlign: 'right',
                          }}
                        >
                          קטגוריות
                        </Text>
                        <Text
                          style={{
                            color: '#6B7280',
                            fontSize: 13,
                            lineHeight: 20,
                            textAlign: 'right',
                          }}
                        >
                          בחרו קטגוריה כדי לראות את כל המוצרים שלה
                        </Text>
                      </View>
                    </View>
                  </GestureDetector>
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 18 }}
                  >
                    <View style={{ gap: 14 }}>
                      {topLevelCategoryRows.map((row, rowIndex) => (
                        <View
                          key={`category-sheet-row-${rowIndex}`}
                          style={{
                            flexDirection: 'row-reverse',
                            justifyContent: 'space-between',
                          }}
                        >
                          {row.map((category) => {
                            const storyImageUrl = categoryStoryImages[category.id] || category.imageUrl;
                            const subcategories = topLevelCategoryChildrenMap[category.id] ?? [];
                            const gradientId = `categorySheetGradient-${category.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

                            return (
                              <View
                                key={`category-sheet-grid-${category.id}`}
                                style={{
                                  width: categoryCardWidth,
                                  borderRadius: 24,
                                  shadowColor: '#0F172A',
                                  shadowOpacity: 0.06,
                                  shadowRadius: 12,
                                  shadowOffset: { width: 0, height: 6 },
                                  elevation: 3,
                                }}
                              >
                                <Pressable
                                  onPress={() => {
                                    onOpenCategory?.({
                                      id: category.id,
                                      title: category.name,
                                      description: category.subtitle,
                                      subcategories,
                                    });
                                    closeCategoriesSheet();
                                  }}
                                  style={({ pressed }) => ({
                                    borderRadius: 24,
                                    backgroundColor: '#FFFFFF',
                                    transform: [{ scale: pressed ? 0.992 : 1 }],
                                  })}
                                >
                                  <View
                                    style={{
                                      height: 192,
                                      borderRadius: 24,
                                      overflow: 'hidden',
                                      backgroundColor: '#EEF2F7',
                                    }}
                                  >
                                    {storyImageUrl ? (
                                      <Image
                                        source={{ uri: storyImageUrl }}
                                        resizeMode="cover"
                                        accessibilityLabel={category.name}
                                        style={{ width: '100%', height: '100%', borderRadius: 24 }}
                                      />
                                    ) : (
                                      <View
                                        style={{
                                          flex: 1,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: '#F4F6FA',
                                        }}
                                      >
                                        <Text style={{ color: '#6B7280', fontSize: 28, fontWeight: '800' }}>
                                          {getCategoryAvatarLabel(category.name)}
                                        </Text>
                                      </View>
                                    )}

                                    <View
                                      style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        top: 0,
                                        bottom: 0,
                                        justifyContent: 'flex-end',
                                      }}
                                    >
                                      <Svg
                                        width="100%"
                                        height="100%"
                                        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                                      >
                                        <Defs>
                                          <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                                            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                                            <Stop offset="35%" stopColor="#000000" stopOpacity="0" />
                                            <Stop offset="70%" stopColor="#000000" stopOpacity="0.42" />
                                            <Stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
                                          </SvgLinearGradient>
                                        </Defs>
                                        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
                                      </Svg>

                                      <View
                                        style={{
                                          paddingHorizontal: 14,
                                          paddingTop: 26,
                                          paddingBottom: 14,
                                        }}
                                      >
                                        <View
                                          style={{
                                            flexDirection: 'row-reverse',
                                            alignItems: 'flex-end',
                                          }}
                                        >
                                          <View style={{ alignItems: 'flex-end', flex: 1 }}>
                                            <Text
                                              numberOfLines={2}
                                              style={{
                                                color: '#FFFFFF',
                                                fontSize: 17,
                                                lineHeight: 22,
                                                fontWeight: '900',
                                                textAlign: 'right',
                                              }}
                                            >
                                              {category.name}
                                            </Text>
                                          </View>
                                        </View>
                                      </View>
                                    </View>
                                  </View>
                                </Pressable>
                              </View>
                            );
                          })}
                          {row.length === 1 && <View style={{ width: categoryCardWidth }} />}
                        </View>
                      ))}
                    </View>

                    {!!featuredBrands.length && (
                      <View style={{ gap: 16, marginTop: 8 }}>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={{ color: '#111827', fontSize: 22, fontWeight: '900' }}>חברות נבחרות</Text>
                          <Text style={{ color: '#9CA3AF', fontSize: 12 }}>מותגים נבחרים לרכישה מהירה</Text>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{
                            flexDirection: 'row-reverse',
                            gap: 20,
                            paddingHorizontal: 4,
                            paddingBottom: 4,
                          }}
                        >
                          {featuredBrands.map((brand) => {
                            const brandImageOverride = FEATURED_BRAND_IMAGE_OVERRIDES[brand.title];
                            return (
                              <Pressable
                                key={`categories-sheet-brand-${brand.id}`}
                                onPress={() => {
                                  onOpenCategory?.({
                                    id: brand.id,
                                    title: brand.title,
                                    description: brand.description,
                                    parentTitle: brand.parentTitle ?? featuredBrandsSection?.title,
                                  });
                                  closeCategoriesSheet();
                                }}
                                style={({ pressed }) => ({
                                  alignItems: 'center',
                                  gap: 8,
                                  opacity: pressed ? 0.75 : 1,
                                })}
                              >
                                <View
                                  style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 40,
                                    backgroundColor: '#C18D39',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 74,
                                      height: 74,
                                      borderRadius: 37,
                                      backgroundColor: '#FFFFFF',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: 68,
                                        height: 68,
                                        borderRadius: 34,
                                        overflow: 'hidden',
                                        backgroundColor: '#F5F7FA',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {brandImageOverride ? (
                                        <Image
                                          source={brandImageOverride}
                                          resizeMode="cover"
                                          accessibilityLabel={brand.title}
                                          style={{ width: '100%', height: '100%' }}
                                        />
                                      ) : brand.imageUrl ? (
                                        <Image
                                          source={{ uri: brand.imageUrl }}
                                          resizeMode="cover"
                                          accessibilityLabel={brand.title}
                                          style={{ width: '100%', height: '100%' }}
                                        />
                                      ) : (
                                        <Text style={{ color: '#6B7280', fontSize: 20, fontWeight: '800' }}>
                                          {getCategoryAvatarLabel(brand.title)}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: '#111827',
                                    fontSize: 12,
                                    fontWeight: '700',
                                    textAlign: 'center',
                                    maxWidth: 80,
                                  }}
                                >
                                  {brand.title}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>
        <StoreFloatingTabBar activeTab={activeBottomTab} onTabPress={handleBottomTabPress} />
      </View>
    </SafeAreaView>
  );
}

export function StoreCategoryScreen({
  onBack,
  categoryId,
  categoryTitle,
  categoryDescription,
  parentTitle,
  onOpenCart,
  onOpenProduct,
  onOpenCategory,
  onTabPress,
  subcategories,
}: {
  onBack: () => void;
  categoryId: string;
  categoryTitle: string;
  categoryDescription?: string;
  parentTitle?: string;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
  onOpenCategory?: (category: {
    id: string;
    title: string;
    description?: string;
    parentTitle?: string;
    subcategories?: StoreSubcategory[];
  }) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
  subcategories?: StoreSubcategory[];
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { itemCount, addItem } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const [subcategoryPreviewUrls, setSubcategoryPreviewUrls] = useState<Record<string, string | undefined>>({});
  const [subcategorySheetOpen, setSubcategorySheetOpen] = useState(false);
  const [subcategorySheetMounted, setSubcategorySheetMounted] = useState(false);
  const subcategorySheetWasOpenRef = useRef(false);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(STORE_CATEGORY_ALL_SUBS_ID);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const subcategorySheetHeight = Math.round(windowHeight * 0.75);
  const subcategorySheetHeightSV = useSharedValue(subcategorySheetHeight);
  const subcategorySheetPanStartY = useSharedValue(0);
  const subcategorySheetBackdropOpacity = useSharedValue(0);
  const subcategorySheetTranslateY = useSharedValue(0);

  useEffect(() => {
    subcategorySheetHeightSV.value = subcategorySheetHeight;
  }, [subcategorySheetHeight, subcategorySheetHeightSV]);

  const closeSubcategorySheet = useCallback(() => {
    setSubcategorySheetOpen(false);
  }, []);

  const subcategorySheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-32, 32])
        .onStart(() => {
          subcategorySheetPanStartY.value = subcategorySheetTranslateY.value;
        })
        .onUpdate((e) => {
          const h = subcategorySheetHeightSV.value;
          const next = subcategorySheetPanStartY.value + e.translationY;
          const y = Math.max(0, next);
          subcategorySheetTranslateY.value = y;
          subcategorySheetBackdropOpacity.value = interpolate(y, [0, h], [1, 0], Extrapolation.CLAMP);
        })
        .onEnd((e) => {
          const h = subcategorySheetHeightSV.value;
          const y = subcategorySheetTranslateY.value;
          const vy = e.velocityY;
          const shouldClose = y > h * 0.22 || vy > 700;
          if (shouldClose) {
            runOnJS(closeSubcategorySheet)();
          } else {
            subcategorySheetTranslateY.value = withSpring(0, { damping: 24, stiffness: 320, mass: 0.88 });
            subcategorySheetBackdropOpacity.value = withTiming(1, { duration: 200 });
          }
        }),
    [closeSubcategorySheet],
  );

  useEffect(() => {
    const wantOpen = !!(subcategorySheetOpen && subcategories?.length);

    if (wantOpen && !subcategorySheetWasOpenRef.current) {
      subcategorySheetWasOpenRef.current = true;
      subcategorySheetTranslateY.value = subcategorySheetHeight;
      subcategorySheetBackdropOpacity.value = 0;
      setSubcategorySheetMounted(true);
      requestAnimationFrame(() => {
        subcategorySheetBackdropOpacity.value = withTiming(1, { duration: 220 });
        subcategorySheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 300, mass: 0.82 });
      });
      return;
    }

    if (!wantOpen && subcategorySheetWasOpenRef.current) {
      subcategorySheetWasOpenRef.current = false;
      subcategorySheetBackdropOpacity.value = withTiming(0, { duration: 200 });
      subcategorySheetTranslateY.value = withTiming(subcategorySheetHeight, { duration: 270 }, (finished) => {
        if (finished) {
          runOnJS(setSubcategorySheetMounted)(false);
        }
      });
    }
  }, [subcategorySheetOpen, subcategories?.length, subcategorySheetHeight]);

  const subcategorySheetBackdropStyle = useAnimatedStyle(() => ({
    opacity: subcategorySheetBackdropOpacity.value,
  }));

  const subcategorySheetPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: subcategorySheetTranslateY.value }],
  }));

  const subcategoriesWithAll = useMemo((): StoreSubcategory[] => {
    if (!subcategories?.length) return [];
    return [
      {
        id: STORE_CATEGORY_ALL_SUBS_ID,
        title: 'הכל',
        parentTitle: categoryTitle,
        imageUrl: null,
      },
      ...subcategories,
    ];
  }, [subcategories, categoryTitle]);

  const subcategoryListKey = useMemo(
    () =>
      (subcategories?.length ? `${STORE_CATEGORY_ALL_SUBS_ID}\0` : '') + (subcategories?.map((s) => s.id).join('\0') ?? ''),
    [subcategories],
  );

  useEffect(() => {
    setSelectedSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
    setSubcategorySheetOpen(false);
  }, [categoryId]);

  useEffect(() => {
    if (!subcategories?.length) {
      setSubcategoryPreviewUrls({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const next: Record<string, string | undefined> = {};
      await Promise.all(
        subcategories.map(async (sub) => {
          try {
            const prods = await fetchCollectionProducts(sub.id, 16);
            const withImg = prods.filter((p) => p.imageUrl);
            if (!withImg.length) {
              next[sub.id] = sub.imageUrl ?? undefined;
              return;
            }
            const pick = withImg[Math.floor(Math.random() * withImg.length)];
            next[sub.id] = pick.imageUrl ?? sub.imageUrl ?? undefined;
          } catch {
            next[sub.id] = sub.imageUrl ?? undefined;
          }
        }),
      );
      if (!cancelled) {
        let allPreview: string | undefined;
        for (const sub of subcategories) {
          const u = next[sub.id];
          if (u) {
            allPreview = u;
            break;
          }
        }
        next[STORE_CATEGORY_ALL_SUBS_ID] = allPreview ?? subcategories[0]?.imageUrl ?? undefined;
        setSubcategoryPreviewUrls(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subcategoryListKey, subcategories]);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!subcategories?.length) {
          const collectionProducts = await fetchCollectionProducts(categoryId, 80);
          if (!isMounted) return;
          setProducts(collectionProducts.map((product, index) => toStoreProduct(product, index, categoryTitle, categoryId)));
          return;
        }

        if (selectedSubcategoryId === STORE_CATEGORY_ALL_SUBS_ID) {
          const handles = [categoryId, ...subcategories.map((s) => s.id)];
          const buckets = await Promise.all(handles.map((h) => fetchCollectionProducts(h, 80)));
          if (!isMounted) return;
          const byId = new Map<string, ShopifyProduct>();
          for (const bucket of buckets) {
            for (const p of bucket) {
              if (!byId.has(p.id)) byId.set(p.id, p);
            }
          }
          const merged = Array.from(byId.values());
          setProducts(merged.map((product, index) => toStoreProduct(product, index, categoryTitle, categoryId)));
        } else {
          const collectionProducts = await fetchCollectionProducts(selectedSubcategoryId, 80);
          if (!isMounted) return;
          setProducts(
            collectionProducts.map((product, index) =>
              toStoreProduct(product, index, categoryTitle, selectedSubcategoryId),
            ),
          );
        }
      } catch (err) {
        if (!isMounted) return;
        setProducts([]);
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת תת הקטגוריה');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [categoryId, categoryTitle, selectedSubcategoryId, subcategories, subcategoryListKey]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      return (
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.subtitle.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, products]);

  const categoryHeaderScrollY = useSharedValue(0);
  const [categoryStickyInteractive, setCategoryStickyInteractive] = useState(false);

  const setStickyFromScroll = useCallback((stuck: boolean) => {
    setCategoryStickyInteractive(stuck);
  }, []);

  useAnimatedReaction(
    () => categoryHeaderScrollY.value > 20,
    (isStuck, prev) => {
      if (prev !== isStuck) {
        runOnJS(setStickyFromScroll)(isStuck);
      }
    },
  );

  const categoryScrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      categoryHeaderScrollY.value = e.contentOffset.y;
    },
  });

  const categoryStickyHeaderShellStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      categoryHeaderScrollY.value,
      [0, 28, 52],
      ['rgba(255,255,255,0)', 'rgba(255,255,255,0.92)', '#FFFFFF'],
    );
    const borderRgba = interpolateColor(
      categoryHeaderScrollY.value,
      [24, 48],
      ['rgba(232,236,242,0)', 'rgba(232,236,242,1)'],
    );
    return {
      backgroundColor: bg,
      borderBottomColor: borderRgba,
      borderBottomWidth: interpolate(
        categoryHeaderScrollY.value,
        [28, 48],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      shadowOpacity: interpolate(
        categoryHeaderScrollY.value,
        [36, 58],
        [0, 0.09],
        Extrapolation.CLAMP,
      ),
      elevation: interpolate(categoryHeaderScrollY.value, [36, 58], [0, 5], Extrapolation.CLAMP),
    };
  });

  const categoryStickyHeaderInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(categoryHeaderScrollY.value, [6, 32], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          categoryHeaderScrollY.value,
          [6, 28],
          [10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const renderCategoryHeaderRow = useCallback(
    () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
        <View style={{ width: 44, alignItems: 'center' }}>
          {onOpenCart ? (
            <Pressable
              onPress={onOpenCart}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E8ECF2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShoppingCart size={17} color="#111827" />
              {itemCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 9,
                    paddingHorizontal: 4,
                    backgroundColor: '#111827',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900' }}>{itemCount}</Text>
                </View>
              )}
            </Pressable>
          ) : (
            <View style={{ width: 40, height: 40 }} />
          )}
        </View>

        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            color: '#0F172A',
            fontSize: 19,
            fontWeight: '800',
            lineHeight: 24,
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
        >
          {categoryTitle}
        </Text>

        <View style={{ width: 44, alignItems: 'center' }}>
          <Pressable
            onPress={onBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E8ECF2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#111827', fontSize: 17, fontWeight: '700' }}>→</Text>
          </Pressable>
        </View>
      </View>
    ),
    [categoryTitle, itemCount, onOpenCart, onBack],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Animated.View
          pointerEvents={categoryStickyInteractive ? 'box-none' : 'none'}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              paddingTop: insets.top,
              shadowColor: '#0F172A',
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
            },
            categoryStickyHeaderShellStyle,
          ]}
        >
          <Animated.View style={[{ paddingHorizontal: 16, paddingBottom: 6 }, categoryStickyHeaderInnerStyle]}>
            {renderCategoryHeaderRow()}
          </Animated.View>
        </Animated.View>

        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 4,
            paddingBottom: contentPaddingBottom,
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={categoryScrollHandler}
        >
          <View style={{ gap: 16 }}>
            {renderCategoryHeaderRow()}

          <View style={{ gap: 12 }}>
            {!!subcategories?.length ? (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#F1F5F9',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginLeft: 8 }} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="חיפוש בתוך תת הקטגוריה"
                    placeholderTextColor="#B7BDC8"
                    style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 13, backgroundColor: 'transparent' }}
                  />
                </View>
                <Pressable
                  onPress={() => setSubcategorySheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="סינון לפי תת קטגוריה"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#F1F5F9',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="options-outline" size={22} color="#111827" />
                </Pressable>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: '#F1F5F9',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginLeft: 8 }} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="חיפוש בתוך תת הקטגוריה"
                  placeholderTextColor="#B7BDC8"
                  style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 13, backgroundColor: 'transparent' }}
                />
              </View>
            )}
          </View>

          {loading && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 18,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <ActivityIndicator color="#111827" />
              <Text style={{ color: '#111827', fontWeight: '700' }}>טוען מוצרים מהקטגוריה...</Text>
            </View>
          )}

          {!!error && !loading && (
            <View
              style={{
                backgroundColor: '#FFF4F4',
                borderRadius: 18,
                padding: 16,
                alignItems: 'flex-end',
              }}
            >
              <Text style={{ color: '#991B1B', fontWeight: '800' }}>לא הצלחנו לטעון את תת הקטגוריה</Text>
              <Text style={{ color: '#B91C1C', marginTop: 6, textAlign: 'right' }}>{error}</Text>
            </View>
          )}

          {!loading && !error && (
            <View
              style={{
                flexDirection: 'row-reverse',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              {filteredProducts.map((product) => (
                <Pressable
                  key={`category-${product.id}`}
                  onPress={() => onOpenProduct?.(product)}
                  style={{
                    width: '48%',
                    borderRadius: 18,
                    ...storeProductCardShadowStyle,
                  }}
                >
                  <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  {/* Image area */}
                  <View style={{ height: 160, backgroundColor: '#F4F6FA', overflow: 'hidden' }}>
                    <ProductImage product={product} height={160} bottomRadius={0} />

                    <StoreProductCardQuantityControl product={product} closedSize={44} />

                    {/* Favorite — top-right */}
                    <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                      <FavoriteToggleButton
                        active={isFavorite(product.id)}
                        loading={isFavoritePending(product.id)}
                        onPress={(event) => {
                          event?.stopPropagation();
                          void toggleFavorite(favoriteInputFromStoreProduct(product));
                        }}
                        size={32}
                      />
                    </View>

                    {/* Badge — below favorite */}
                    {!!product.badge && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 48,
                          right: 10,
                          backgroundColor: '#111827',
                          borderRadius: 999,
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          zIndex: 1,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                          {product.badge}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Info: price first, then name, then subtitle */}
                  <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                      {formatPrice(product.price)}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: '#111827',
                        fontSize: 13,
                        lineHeight: 18,
                        fontWeight: '700',
                        textAlign: 'right',
                        marginTop: 3,
                      }}
                    >
                      {product.name}
                    </Text>
                    {!!product.subtitle && (
                      <Text
                        numberOfLines={1}
                        style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}
                      >
                        {product.subtitle}
                      </Text>
                    )}
                  </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {!loading && !error && !filteredProducts.length && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 20,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '900' }}>לא נמצאו מוצרים בחיפוש הזה</Text>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>נסה לחפש שם מוצר או מילת מפתח אחרת</Text>
            </View>
          )}
          </View>
        </Animated.ScrollView>
        <StoreFloatingTabBar activeTab="categories" onTabPress={onTabPress} />

        <Modal
          visible={subcategorySheetMounted}
          animationType="none"
          transparent
          onRequestClose={() => setSubcategorySheetOpen(false)}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <Animated.View
                pointerEvents="box-none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15, 23, 42, 0.5)' }, subcategorySheetBackdropStyle]}
              >
                <Pressable
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => setSubcategorySheetOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="סגור סינון"
                />
              </Animated.View>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: subcategorySheetHeight,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingBottom: insets.bottom + 16,
                    overflow: 'hidden',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.14,
                    shadowRadius: 16,
                    elevation: 24,
                  },
                  subcategorySheetPanelStyle,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <GestureDetector gesture={subcategorySheetPanGesture}>
                    <View
                      style={{ paddingTop: 10, paddingBottom: 8 }}
                      accessible
                      accessibilityLabel="אזור אחיזה: גרור למטה לסגירת תתי הקטגוריה"
                    >
                      <View style={{ alignItems: 'center', paddingBottom: 6 }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
                      </View>
                      <Text
                        style={{
                          textAlign: 'right',
                          paddingHorizontal: 20,
                          fontSize: 18,
                          fontWeight: '800',
                          color: '#0F172A',
                        }}
                      >
                        תתי קטגוריה
                      </Text>
                    </View>
                  </GestureDetector>
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                      flexDirection: 'row-reverse',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      paddingHorizontal: 12,
                      paddingTop: 4,
                      paddingBottom: 20,
                      gap: 16,
                    }}
                  >
                {subcategoriesWithAll.map((subcategory) => {
                  const previewUri =
                    subcategoryPreviewUrls[subcategory.id] ?? subcategory.imageUrl ?? undefined;
                  const isSelected = selectedSubcategoryId === subcategory.id;
                  const chipW = Math.min(90, Math.floor((windowWidth - 24 - 16) / 3));
                  return (
                    <Pressable
                      key={`subcategory-sheet-${subcategory.id}`}
                      onPress={() => {
                        setSelectedSubcategoryId(subcategory.id);
                        setSubcategorySheetOpen(false);
                      }}
                      style={{ width: chipW, alignItems: 'center' }}
                    >
                      <View style={{ alignItems: 'center', gap: 6, width: '100%' }}>
                        <View
                          style={{
                            width: Math.min(72, chipW - 6),
                            height: Math.min(72, chipW - 6),
                            borderRadius: 999,
                            padding: 3,
                            backgroundColor: '#FFFFFF',
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected ? '#2563EB' : '#E7ECF3',
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              borderRadius: 999,
                              overflow: 'hidden',
                              backgroundColor: '#F4F6FA',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {previewUri ? (
                              <Image
                                source={{ uri: previewUri }}
                                resizeMode="cover"
                                accessibilityLabel={subcategory.title}
                                style={{ width: '100%', height: '100%' }}
                              />
                            ) : (
                              <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '800' }}>
                                {getCategoryAvatarLabel(subcategory.title)}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: isSelected ? '#2563EB' : '#111827',
                            fontWeight: isSelected ? '800' : '700',
                            fontSize: 11,
                            lineHeight: 14,
                            textAlign: 'center',
                            minHeight: 28,
                          }}
                        >
                          {subcategory.title}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                  </ScrollView>
                </View>
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>
      </View>
    </View>
  );
}

export function StoreSearchScreen({
  onBack: _onBack,
  onOpenCart: _onOpenCart,
  onOpenProduct,
  onTabPress,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { width: windowWidth } = useWindowDimensions();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<TextInput | null>(null);

  const loadProducts = useCallback(async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);
      const liveProducts = await fetchProducts(80);
      const shuffledProducts = liveProducts
        .map((product, index) => toStoreProduct(product, index))
        .sort(() => Math.random() - 0.5);

      setProducts(shuffledProducts);
    } catch (err) {
      setProducts([]);
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת החיפוש');
    } finally {
      if (isPullToRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        return (
          !normalizedQuery ||
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.subtitle.toLowerCase().includes(normalizedQuery) ||
          product.description.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 30);
  }, [normalizedQuery, products]);

  const gridGap = 3;
  const horizontalPadding = 3;
  const gridItemSize = Math.floor((windowWidth - horizontalPadding * 2 - gridGap * 2) / 3);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: contentPaddingBottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void loadProducts(true);
              }}
              tintColor="#111827"
              colors={['#111827']}
              progressViewOffset={18}
            />
          }
        >
          <View style={{ gap: 3 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingBottom: 10,
                backgroundColor: '#FFFFFF',
              }}
            >
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  backgroundColor: '#EFF1F4',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  height: 42,
                }}
              >
                <Ionicons name="search-outline" size={18} color="#8E8E93" style={{ marginLeft: 8 }} />
                <TextInput
                  ref={searchInputRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="חיפוש"
                  placeholderTextColor="#8E8E93"
                  style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 14 }}
                />
              </View>
            </View>

            {loading && (
              <View
                style={{
                  minHeight: 180,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color="#111827" />
              </View>
            )}

            {!!error && !loading && (
              <View
                style={{
                  marginHorizontal: 12,
                  borderRadius: 16,
                  padding: 16,
                  backgroundColor: '#FFF4F4',
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ color: '#991B1B', fontWeight: '800' }}>לא הצלחנו לטעון את החיפוש</Text>
                <Text style={{ color: '#B91C1C', marginTop: 6, textAlign: 'right' }}>{error}</Text>
              </View>
            )}

            {!loading && !error && (
              <View
                style={{
                  flexDirection: 'row-reverse',
                  flexWrap: 'wrap',
                  paddingHorizontal: horizontalPadding,
                  gap: gridGap,
                }}
              >
                {filteredProducts.map((product) => (
                  <Pressable
                    key={`search-${product.id}`}
                    onPress={() => onOpenProduct?.(product)}
                    style={{
                      width: gridItemSize,
                      height: gridItemSize,
                      backgroundColor: '#F4F4F5',
                      overflow: 'hidden',
                    }}
                  >
                    {product.imageUrl ? (
                      <Image
                        source={{ uri: product.imageUrl }}
                        resizeMode="cover"
                        accessibilityLabel={product.imageAltText ?? product.name}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <ProductImage product={product} height={gridItemSize} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {!loading && !error && !filteredProducts.length && (
              <View
                style={{
                  minHeight: 180,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 24,
                }}
              >
                <Text style={{ color: '#111827', fontWeight: '900' }}>לא נמצאו מוצרים</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <StoreFloatingTabBar activeTab="search" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}

export function StoreProductScreen({
  onBack,
  onOpenCart,
  product,
  onTabPress,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  product: StoreProduct;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { addItem, itemCount, getQuantity, isMutating } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const productQuantity = getQuantity(product.id);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: contentPaddingBottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 18 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 28,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPress={onBack}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900' }}>→</Text>
              </Pressable>

              <View style={{ alignItems: 'flex-end', gap: 3, flex: 1, marginRight: 12 }}>
                <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '800' }}>PRODUCT PAGE</Text>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>{product.subtitle}</Text>
              </View>

              <Pressable
                onPress={onOpenCart}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <ShoppingCart size={18} color="#111827" />
                {itemCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 4,
                      backgroundColor: '#111827',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{itemCount}</Text>
                  </View>
                )}
              </Pressable>

              <FavoriteToggleButton
                active={isFavorite(product.id)}
                loading={isFavoritePending(product.id)}
                onPress={() => {
                  void toggleFavorite(favoriteInputFromStoreProduct(product));
                }}
                size={42}
              />
            </View>

            <View
              style={{
                marginHorizontal: 14,
                marginTop: 8,
                marginBottom: 16,
                borderRadius: 26,
                backgroundColor: '#FFFFFF',
                padding: 0,
              }}
            >
              <ProductImage product={product} height={320} />
            </View>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 18,
              gap: 16,
            }}
          >
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              {!!product.badge && (
                <View
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: '#111827',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{product.badge}</Text>
                </View>
              )}

              <Text style={{ color: '#111827', fontSize: 30, fontWeight: '900', textAlign: 'right' }}>
                {product.name}
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'right' }}>{product.subtitle}</Text>
            </View>

            <View
              style={{
                borderRadius: 20,
                padding: 16,
                backgroundColor: '#111827',
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900' }}>{formatPrice(product.price)}</Text>
                <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>כולל תצוגה ישירה מהקטלוג שלך</Text>
              </View>

              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>זמין במלאי</Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'right' }}>תיאור המוצר</Text>
              <Text style={{ color: '#4B5563', fontSize: 14, lineHeight: 24, textAlign: 'right' }}>
                {product.description?.trim() ||
                  'מוצר נבחר מתוך הקטלוג שלך עם עיצוב נקי, חוויית גלישה נעימה ותצוגה ברורה של כל המידע החשוב.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: '#F8F5EF',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#9A6B16', fontWeight: '800', fontSize: 11 }}>קטלוג Shopify</Text>
              </View>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: '#EEF6F1',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#2F6F49', fontWeight: '800', fontSize: 11 }}>עמוד מוצר מעוצב</Text>
              </View>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: '#EEF2FF',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#4F46E5', fontWeight: '800', fontSize: 11 }}>{product.handle}</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 18,
              gap: 12,
            }}
          >
            <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'right' }}>למה זה נראה טוב יותר</Text>
            <View
              style={{
                borderRadius: 18,
                backgroundColor: '#F8FAFC',
                padding: 14,
                alignItems: 'flex-end',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '800', textAlign: 'right' }}>תמונה גדולה ונקייה</Text>
              <Text style={{ color: '#6B7280', marginTop: 6, fontSize: 13, lineHeight: 20, textAlign: 'right' }}>
                המוצר מקבל נוכחות חזקה יותר עם היררכיה ברורה בין תמונה, שם, מחיר ותיאור.
              </Text>
            </View>
            <View
              style={{
                borderRadius: 18,
                backgroundColor: '#F8FAFC',
                padding: 14,
                alignItems: 'flex-end',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '800', textAlign: 'right' }}>מבנה מסודר למכירה</Text>
              <Text style={{ color: '#6B7280', marginTop: 6, fontSize: 13, lineHeight: 20, textAlign: 'right' }}>
                כל הפרטים החשובים מוצגים מיד, בלי עומס ויזואלי ובלי לחפש מידע בתוך הרשימה.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              void addItem(product);
            }}
            disabled={isMutating || !product.availableForSale || !product.variantId}
            style={{
              borderRadius: 22,
              backgroundColor: isMutating || !product.availableForSale || !product.variantId ? '#475569' : '#111827',
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
              {isMutating
                ? 'מעדכן עגלה...'
                : !product.availableForSale || !product.variantId
                  ? 'המוצר לא זמין כרגע לרכישה'
                  : productQuantity
                    ? `הוסף עוד לעגלה (${productQuantity})`
                    : 'הוסף לעגלה'}
            </Text>
          </Pressable>
          </View>
        </ScrollView>
        <StoreFloatingTabBar activeTab="home" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
