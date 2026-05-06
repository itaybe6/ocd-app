import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  I18nManager,
  Image,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
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
import Animated, {
  Extrapolation,
  interpolate,
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  fetchCollectionHasProducts,
  fetchCollectionImage,
  fetchCollectionProducts,
  fetchCollectionSummary,
  fetchCollections,
  fetchMenuItems,
  fetchNewestProducts,
  fetchProducts,
  findMenuItemByCollectionHandle,
  type CollectionProductsSortKey,
  type ShopifyCollection,
  type ShopifyMenuItem,
  type ShopifyProduct,
} from '../../lib/shopify';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { favoriteInputFromStoreProduct } from '../../lib/favorites';
import {
  OcdPlusProductPriceBlock,
  OcdPlusFloatingBadge,
  OcdPlusJoinBannerButton,
  formatOcdPrice,
} from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusSubscribeSheet } from '../../components/OcdPlusSubscribeSheet';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import { STORE_BUNDLE_CARD_BODY_MIN_HEIGHT } from '../../theme/storeProductCardLayout';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';

export type StoreCategory = {
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
  compareAtPrice: number | null;
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

/**
 * ─── Bundles section ──────────────────────────────────────────────────────────
 * Set this to your Shopify collection handle for cleaning bundles/kits.
 * Find it at: your-store.myshopify.com/collections/<HANDLE>
 * ─────────────────────────────────────────────────────────────────────────────
 */
const BUNDLES_COLLECTION_HANDLE = 'מבצעי-פסח'; // "מארזי ניקיון משתלמים" on Shopify

/** קולקציית «חברות נבחרות» — נטענת מה־API לפי handle; מוצגת ברצועת סטוריז בנפרד מהבנטו */
const HOME_SELECTED_BRANDS_COLLECTION_HANDLE =
  process.env.EXPO_PUBLIC_HOME_SELECTED_BRANDS_COLLECTION_HANDLE?.trim() ?? '';

/** ריווח אופקי לבלוק התוכן מתחת לבאנר — הקרוסלה של חברות נבחרות יוצאת ל-full-bleed עם margin שלילי באותו ערך */
const STORE_HOME_SCROLL_PADDING_H = 12;

// ─── Home tabs collection handles ─────────────────────────────────────────────
/** מזהה פנימי לטאב «הכי נמכרים» — הנתונים מגיעים מ־`fetchProducts` (BEST_SELLING), לא מקולקציה */
const HOME_TAB_RECOMMENDED_HANDLE = 'best-selling';
const HOME_TAB_SALE_HANDLE        = 'מבצעים';          // "המבצעים שלנו"
/** מזהה לוגי לטאב «הכי חדשים» (מוצרים נמשכים לפי CREATED_AT ב-shopify, לא קולקציה) */
const HOME_TAB_NEW_HANDLE         = 'חדשים';

/**
 * מיון מוצרים בטאב «המבצעים שלנו» בתוך קולקציית `HOME_TAB_SALE_HANDLE`.
 * בעבר נטען גם הוא עם BEST_SELLING — ואז כשהמובילים בחנות נמצאים במבצע, הרשימה יכלה להיות **זהה** לטאב «הכי נמכרים»
 * (שמושך BEST_SELLING על כל הקטלוג). COLLECTION_DEFAULT עוקב אחר ברירת המחדל של הקולקציה ב־Shopify Admin.
 * אם עדיין רוצים סדר אחר — אפשר להחליף ל־MANUAL / PRICE וכו׳ (ראה `CollectionProductsSortKey`).
 */
const HOME_TAB_SALE_COLLECTION_SORT: CollectionProductsSortKey = 'COLLECTION_DEFAULT';

/** עד כמה מוצרים מכל קולקציית טאב (Shopify) — חייב להתאים ל־fetch ול־slice בתצוגה */
const HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT = 10;

/* ─── Banner carousel images ─────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BANNER_IMAGES = [
  require('../../../assets/bannernew1.png'),
  require('../../../assets/newbanner3.png'),
  require('../../../assets/newbnner8.png'),
  require('../../../assets/newbanner5.png'),
  require('../../../assets/newbanner6.png'),
  require('../../../assets/newbanner7.png'),
] as const;

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

export type StoreBottomTabId = 'home' | 'cart' | 'favorites' | 'search' | 'profile';
export type StoreMainTabId = 'home' | 'search';

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

export const CATEGORY_STORY_PRODUCT_OVERRIDES: Record<string, string[]> = {
  'עיצוב הבית': ['מראה | חצי מעוגלת', 'מראה'],
};

const FEATURED_BRAND_IMAGE_OVERRIDES: Record<string, number> = {
  סנו: require('../../../assets/brands/newbrands/sano3.png'),
  SANO: require('../../../assets/brands/newbrands/sano3.png'),
  טאצ: require('../../../assets/brands/newbrands/touchll.png'),
  "טאץ'": require('../../../assets/brands/newbrands/touchll.png'),
  TOUCH: require('../../../assets/brands/newbrands/touchll.png'),
  פינל: require('../../../assets/brands/newbrands/finallll.png'),
  פייל: require('../../../assets/brands/newbrands/finallll.png'),
  FINAL: require('../../../assets/brands/newbrands/finallll.png'),
  יעקובי: require('../../../assets/brands/newbrands/yakobilll.png'),
  YAAKOBY: require('../../../assets/brands/newbrands/yakobilll.png'),
  סאג: require('../../../assets/brands/newbrands/saglll.png'),
  SAG: require('../../../assets/brands/newbrands/saglll.png'),
  סוסייטא: require('../../../assets/brands/newbrands/suslll.png'),
  סוסיטסא: require('../../../assets/brands/newbrands/suslll.png'),
  סוסיטסה: require('../../../assets/brands/newbrands/suslll.png'),
  SUCITESA: require('../../../assets/brands/newbrands/suslll.png'),
  'מוצרי TNX': require('../../../assets/brands/TNX.png'),
  TNX: require('../../../assets/brands/TNX.png'),
  /** Shopify title may use «Tana-Green» (hyphen); matching is normalized below */
  'מוצרי tana green care': require('../../../assets/brands/newbrands/greencarelll.png'),
  'tana green care': require('../../../assets/brands/newbrands/greencarelll.png'),
  'מוצרי פרפיום כביסכל': require('../../../assets/brands/newbrands/kviscallll.png'),
  'מוצרי פרפיום(כביסכל)': require('../../../assets/brands/newbrands/kviscallll.png'),
  'מוצרי פרפיום (כביסכל)': require('../../../assets/brands/newbrands/kviscallll.png'),
  כביסכל: require('../../../assets/brands/newbrands/kviscallll.png'),
};

const KVISCALL_LOGO = require('../../../assets/brands/newbrands/kviscallll.png');

/** כותרת תצוגה לתתי־קטגוריה/מותג — כשכותרת התפריט ב־Shopify ארוכה או בסוגריים */
const FEATURED_SUBCATEGORY_DISPLAY_TITLE_OVERRIDES: Record<string, string> = {
  'מוצרי פרפיום כביסכל': 'כביסכל',
  'מוצרי פרפיום(כביסכל)': 'כביסכל',
  'מוצרי פרפיום (כביסכל)': 'כביסכל',
  כביסכל: 'כביסכל',
};

const KVISCALL_DISPLAY_TITLE = 'כביסכל';

/** Hyphens / spacing / English casing differ between menu titles and map keys */
function normalizeFeaturedBrandTitle(title: string): string {
  return title
    .trim()
    .normalize('NFC')
    .replace(/[\u200c-\u200f\ufeff]/g, '')
    .replace(/[()\uFF08\uFF09\[\]{}«»]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** שורת תפריט «מוצרי פרפיום (כביסכל)» — גרסאות עם סוגריים/אותיות שונות מעט */
function matchesKviscallPerfumeMenuTitle(raw: string): boolean {
  const n = normalizeFeaturedBrandTitle(raw);
  if (!n.includes('פרפיום')) return false;
  return /כביס[סש]כל/.test(n);
}

/** Bundled logos for «חברות נבחרות» — overrides Shopify collection preview URLs. */
function resolveFeaturedBrandPreviewUri(title: string): string | undefined {
  const needle = normalizeFeaturedBrandTitle(title);
  if (!needle) return undefined;
  for (const [key, bundled] of Object.entries(FEATURED_BRAND_IMAGE_OVERRIDES)) {
    if (normalizeFeaturedBrandTitle(key) === needle) {
      const resolved = Image.resolveAssetSource(bundled);
      return resolved?.uri;
    }
  }
  if (matchesKviscallPerfumeMenuTitle(title)) {
    const resolved = Image.resolveAssetSource(KVISCALL_LOGO);
    return resolved?.uri;
  }
  return undefined;
}

function resolveSubcategoryDisplayTitle(title: string): string {
  const needle = normalizeFeaturedBrandTitle(title);
  if (!needle) return title.trim();
  for (const [key, display] of Object.entries(FEATURED_SUBCATEGORY_DISPLAY_TITLE_OVERRIDES)) {
    if (normalizeFeaturedBrandTitle(key) === needle) return display;
  }
  if (matchesKviscallPerfumeMenuTitle(title)) return KVISCALL_DISPLAY_TITLE;
  return title.trim();
}

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

/** OCD+ home promo banner — visible lift on #F5F5F5; shadow on outer View (not Pressable) so iOS/Android render reliably. */
const ocdPlusHomeBannerShadowStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.2,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 14,
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
    if (!product.availableForSale) return;
    if (cartQty === 0) {
      if (pendingOpen || isMutating) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void handleClosedPress();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    if (cartQty <= 0) {
      if (pendingOpen) {
        setPendingOpen(false);
        setShowStepper(false);
        clearCloseTimer();
      }
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (cartQty <= 1) {
      setShowStepper(false);
      clearCloseTimer();
    }
    void updateQuantity(product.id, cartQty - 1);
    if (cartQty > 1) scheduleStepperClose();
  }, [
    cartQty,
    clearCloseTimer,
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
                disabled={(cartQty === 0 && (pendingOpen || isMutating))}
                style={circleBtn}
                accessibilityRole="button"
                accessibilityLabel="הוסף כמות"
              >
                <Text style={{ color: STORE_CARD_QTY_ACCENT, fontSize: 20, fontWeight: '500', marginTop: -1 }}>+</Text>
              </Pressable>
              <Text style={{ color: STORE_CARD_QTY_ACCENT, fontSize: 17, fontWeight: '800' }}>{displayQty}</Text>
              <Pressable
                onPress={decrement}
                disabled={false}
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

export function toStoreProduct(product: ShopifyProduct, index: number, subtitleOverride?: string, categoryIdOverride?: string): StoreProduct {
  const palette = getProductPalette(index);
  const normalizedProductType = product.productType.trim();
  const collectionLabel = product.primaryCollectionTitle?.trim() ?? '';
  const subtitle =
    subtitleOverride?.trim() ||
    collectionLabel ||
    (normalizedProductType && normalizedProductType !== 'מוצרים' ? normalizedProductType : 'כל המוצרים');

  return {
    id: product.id,
    name: product.title,
    subtitle,
    collectionTitle: product.primaryCollectionTitle ?? null,
    categoryId: categoryIdOverride || normalizedProductType || 'all',
    price: product.price,
    compareAtPrice: product.compareAtPrice,
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

export function ProductImage({
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

function StoreOcdLogoMark({ fill, height }: { fill: string; height: number }) {
  const width = height * (71.16 / 112.32);
  return (
    <Svg width={width} height={height} viewBox="0 0 71.16 112.32">
      <Path fill={fill} d="M5.64,100.87c-.29-.14-.64-.27-1.06-.39-.42-.12-.84-.18-1.26-.18-.65,0-1.18.16-1.57.49-.39.33-.59.74-.59,1.23,0,.37.11.68.34.93s.52.46.88.63c.36.17.75.34,1.16.5.33.12.65.26.97.41.32.15.61.33.87.55.26.21.47.48.62.8.15.32.23.71.23,1.18,0,.55-.13,1.04-.39,1.46-.26.42-.63.75-1.09.99s-1.01.35-1.62.35c-.49,0-.94-.06-1.35-.18-.41-.12-.76-.26-1.06-.43s-.54-.3-.72-.41l.32-.56c.2.15.45.3.75.45.29.15.61.28.96.38.34.1.69.15,1.04.15.4,0,.79-.08,1.17-.24s.69-.4.94-.72c.25-.32.37-.73.37-1.22s-.12-.86-.35-1.15c-.23-.29-.53-.53-.9-.72-.36-.19-.75-.35-1.16-.5-.32-.12-.63-.25-.95-.38s-.61-.3-.87-.49c-.26-.19-.47-.42-.62-.69-.15-.27-.23-.6-.23-.98,0-.48.12-.89.36-1.24.24-.35.57-.63.99-.83.42-.2.89-.3,1.42-.31.47,0,.94.06,1.42.18.48.12.9.28,1.25.46l-.27.53ZM10.19,109.84c-.51,0-.92-.15-1.23-.45-.31-.3-.47-.7-.49-1.18v-3.99h.66v3.79c.02.35.13.65.34.88.21.23.53.36.94.38.35,0,.69-.09.99-.28.31-.19.56-.44.75-.76.19-.32.29-.69.29-1.1v-2.91h.66v5.47h-.59l-.07-1.72.1.38c-.09.28-.26.53-.5.76-.24.23-.52.41-.84.54s-.66.2-1.01.2ZM18.61,109.8c-.52,0-1.01-.14-1.47-.41-.46-.28-.79-.63-1.01-1.07l.11-.24v4.24h-.66v-8.14h.59l.07,1.79-.13-.41c.24-.44.6-.8,1.06-1.08.47-.28.97-.43,1.53-.43.52,0,.99.13,1.41.38.42.25.75.59,1,1.03s.37.93.37,1.49-.13,1.04-.39,1.48c-.26.43-.6.77-1.04,1.01-.43.24-.92.36-1.46.36ZM18.5,109.25c.43,0,.82-.1,1.17-.31.35-.21.63-.48.84-.83.21-.35.32-.74.32-1.17s-.1-.83-.31-1.18c-.2-.35-.48-.63-.82-.83-.34-.21-.73-.31-1.15-.31s-.78.09-1.12.28c-.34.19-.61.44-.81.76-.21.32-.33.68-.36,1.08v.45c.03.38.15.73.36,1.05.21.32.48.57.81.75s.69.27,1.08.27ZM25.83,109.8c-.57,0-1.07-.13-1.51-.38s-.78-.59-1.03-1.03c-.25-.43-.37-.92-.37-1.46s.13-1.02.39-1.45.61-.79,1.06-1.05c.44-.26.93-.39,1.48-.39.65,0,1.2.19,1.64.57.44.38.76.88.96,1.5l-4.78,1.85-.2-.48,4.38-1.71-.14.2c-.16-.37-.4-.7-.72-.97-.32-.27-.72-.41-1.18-.41-.42,0-.8.1-1.13.31-.34.21-.6.48-.8.83-.2.34-.3.74-.3,1.18,0,.41.1.79.29,1.15.19.35.46.64.8.85.34.21.74.32,1.19.32.3,0,.59-.06.86-.17.27-.11.52-.26.73-.43l.34.48c-.26.21-.56.37-.9.5-.34.13-.69.2-1.04.2ZM30.84,104.22l.07,1.68-.08-.21c.12-.34.31-.62.57-.87.26-.24.55-.43.87-.56.32-.13.63-.2.93-.2l-.03.64c-.42,0-.8.09-1.14.28-.34.19-.61.44-.81.75s-.3.66-.3,1.06v2.9h-.66v-5.47h.57ZM42.85,108.83c-.11.09-.32.22-.62.38-.3.16-.67.3-1.11.42-.44.12-.92.18-1.46.17-.81-.02-1.54-.16-2.18-.44s-1.18-.65-1.62-1.13-.78-1.02-1.01-1.64c-.23-.62-.35-1.27-.35-1.97,0-.78.12-1.5.36-2.15s.58-1.22,1.02-1.69c.44-.48.97-.84,1.59-1.11s1.3-.39,2.04-.39c.69,0,1.3.09,1.83.28.53.19.97.39,1.3.6l-.8,1.92c-.23-.18-.54-.36-.93-.55-.39-.19-.83-.29-1.34-.29-.39,0-.77.08-1.13.24-.36.16-.68.39-.95.69-.28.3-.49.65-.65,1.04s-.24.83-.24,1.29c0,.49.07.95.22,1.36s.35.76.62,1.06c.27.29.59.52.97.68.38.16.8.24,1.28.24.55,0,1.02-.09,1.41-.27.39-.18.69-.36.9-.56l.84,1.82ZM44.56,98.65h1.96v11.04h-1.96v-11.04ZM51.54,109.86c-.75,0-1.38-.14-1.9-.42-.52-.28-.91-.67-1.18-1.16-.27-.49-.41-1.06-.41-1.71s.16-1.17.48-1.67c.32-.49.74-.89,1.27-1.18.53-.29,1.12-.44,1.78-.44.88,0,1.6.25,2.16.76.56.51.93,1.24,1.1,2.2l-4.76,1.51-.43-1.06,3.44-1.16-.41.18c-.07-.24-.21-.45-.4-.64-.19-.18-.48-.27-.86-.27-.29,0-.54.07-.76.2-.22.14-.39.33-.5.57-.12.25-.18.54-.18.87,0,.38.07.7.21.96.14.26.33.45.57.58.24.13.51.2.81.2.21,0,.42-.04.62-.11.2-.07.4-.17.59-.29l.87,1.45c-.33.19-.68.34-1.06.45-.38.11-.73.17-1.07.17ZM58.85,109.86c-.57,0-1.08-.11-1.55-.34s-.83-.58-1.1-1.06c-.27-.48-.41-1.08-.41-1.82,0-.69.14-1.29.42-1.79s.65-.89,1.11-1.17c.46-.28.94-.41,1.45-.41.61,0,1.07.1,1.38.3.31.2.57.42.78.66l-.08.24.18-.9h1.82v6.11h-1.96v-1.33l.15.42s-.07.05-.17.16-.23.23-.41.38c-.18.15-.41.27-.67.38s-.58.16-.94.16ZM59.41,108.26c.23,0,.44-.03.63-.11.19-.07.35-.17.49-.31.14-.14.26-.3.36-.51v-1.5c-.07-.2-.19-.38-.34-.52-.15-.14-.33-.26-.53-.34-.2-.08-.43-.12-.69-.12-.28,0-.54.07-.78.22s-.43.34-.57.59c-.14.25-.21.54-.21.87s.07.62.22.88c.15.26.35.47.59.62s.52.22.8.22ZM66.64,103.57l.15,1.09-.03-.1c.21-.38.52-.69.91-.93.39-.24.87-.36,1.44-.36s1.06.17,1.45.51c.39.34.58.78.59,1.32v4.58h-1.96v-3.85c0-.27-.08-.49-.22-.65-.14-.16-.36-.24-.68-.24-.3,0-.56.1-.78.29s-.4.46-.52.8c-.12.34-.18.72-.18,1.16v2.49h-1.96v-6.11h1.78ZM25.72,23.65c-.24-.14-.47-.28-.71-.44-2.82-1.86-4.75-4.71-5.42-8.03-.68-3.31-.02-6.69,1.84-9.51h0c1.86-2.82,4.71-4.75,8.03-5.42,3.31-.68,6.69-.02,9.51,1.84,2.82,1.86,4.75,4.71,5.42,8.03.68,3.31.02,6.69-1.84,9.51-1.86,2.82-4.71,4.75-8.03,5.42-3.04.62-6.13.12-8.8-1.41ZM25.31,8.24c-1.18,1.79-1.59,3.92-1.17,6.02.43,2.1,1.65,3.9,3.43,5.08,1.78,1.18,3.92,1.59,6.02,1.17,2.1-.43,3.9-1.65,5.08-3.43,1.18-1.79,1.59-3.92,1.17-6.02-.43-2.1-1.65-3.9-3.43-5.08-1.79-1.18-3.92-1.59-6.02-1.17-2.1.43-3.9,1.65-5.08,3.43h0ZM8.94,53.23c-5.08-4.87-5.25-12.97-.39-18.05,4.87-5.08,12.97-5.25,18.05-.39,2.87,2.75,4.29,6.67,3.86,10.61,1.58-.99,3.27-1.76,5.02-2.32-.22-4.46-2.14-8.72-5.43-11.88-7.06-6.77-18.31-6.53-25.08.54-6.77,7.06-6.53,18.31.54,25.08,3.14,3.01,7.22,4.7,11.41,4.9.98.05,1.97.02,2.95-.1.26-1.82.73-3.61,1.44-5.35-4.33,1.25-9.05.12-12.36-3.04ZM70.79,30.36h-5.42v22.84c-4.33-5.22-10.86-8.55-18.15-8.55-13,0-23.57,10.57-23.57,23.57s10.57,23.57,23.57,23.57,23.57-10.57,23.57-23.57c0-.1,0-.2,0-.3h0V30.36ZM47.22,86.37c-10.01,0-18.15-8.14-18.15-18.15s8.14-18.15,18.15-18.15,18.15,8.14,18.15,18.15-8.14,18.15-18.15,18.15Z" />
    </Svg>
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

/** קטגוריית על «חברות נבחרות» — מוצגת ברצועת סטוריז ולא בגריד הבנטו */
function isSelectedBrandsCategoryName(name: string): boolean {
  const n = normalizeCategoryTitle(name);
  if (n.includes('חברות נבחרות') || n.includes('חברות נבחרים')) return true;
  if (n.includes('מותגים נבחרים') || n.includes('מותגים נבחרות')) return true;
  return (
    (n.includes('חברות') || n.includes('מותגים')) &&
    (n.includes('נבחרות') || n.includes('נבחרים'))
  );
}

/** רק לרשת Bento: מחליף מקומות בין «טואלטיקה» ל־«מארזי ניקיון משתלמים» אם הן סמוכות. */
function swapToiletriesAndBundlesForBento(categories: StoreCategory[]): StoreCategory[] {
  return categories;
}

/** רק לרשת Bento: מערכות בישום ↔ מרככי כביסה וטקסטיל (כרטיס גדול מול ריבוע קטן בשורת 3). */
function swapFragranceAndFabricForBento(categories: StoreCategory[]): StoreCategory[] {
  const isFragranceSystems = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return n.includes('בישום');
  };
  const isFabricSofteners = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return (n.includes('מרככי') || n.includes('מרכך')) && (n.includes('כביסה') || n.includes('טקסטיל'));
  };
  const iFrag = categories.findIndex((c) => isFragranceSystems(c.name));
  const iFab = categories.findIndex((c) => isFabricSofteners(c.name));
  if (iFrag < 0 || iFab < 0 || iFrag === iFab) return categories;
  const out = [...categories];
  [out[iFrag], out[iFab]] = [out[iFab]!, out[iFrag]!];
  return out;
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

export function flattenMenuCategories(menuItems: ShopifyMenuItem[]): StoreCategory[] {
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

export function getTopLevelMenuCategories(menuItems: ShopifyMenuItem[]): StoreCategory[] {
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

export function getTopLevelCategoryChildrenMap(menuItems: ShopifyMenuItem[]): Record<string, StoreSubcategory[]> {
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

/** תתי־קולקציות תחת פריט תפריט בודד — גם כשההורה תיקייה ללא קולקציה (כמו «חברות נבחרות» באתר) */
export function getSubcategoriesForMenuItem(item: ShopifyMenuItem): StoreSubcategory[] {
  if (!item.children?.length) return [];

  if (item.collectionHandle) {
    const map = getTopLevelCategoryChildrenMap([item]);
    const fromMap = map[item.collectionHandle];
    if (fromMap?.length) return fromMap;
  }

  return flatMapMenuChildrenToSubcategories(item.children, item.title);
}

function findSelectedBrandsMenuItem(menuItems: ShopifyMenuItem[]): ShopifyMenuItem | null {
  for (const item of menuItems) {
    /** באתר: הורה ללא קישור קולקציה — רק תפריט נפתח עם ילדים */
    if (isSelectedBrandsCategoryName(item.title)) {
      if (item.collectionHandle || item.children?.length) return item;
    }
    if (item.children?.length) {
      const nested = findSelectedBrandsMenuItem(item.children);
      if (nested) return nested;
    }
  }
  return null;
}

function flatMapMenuChildrenToSubcategories(
  items: ShopifyMenuItem[],
  parentTitle?: string,
): StoreSubcategory[] {
  return items.flatMap((child) => {
    const nested = child.children?.length
      ? flatMapMenuChildrenToSubcategories(child.children, child.title)
      : [];
    const row: StoreSubcategory[] =
      child.collectionHandle != null && child.collectionHandle !== ''
        ? [
            {
              id: child.collectionHandle,
              title: child.title,
              description: child.collectionDescription,
              parentTitle,
              imageUrl: child.collectionImageUrl ?? null,
            },
          ]
        : [];
    return [...row, ...nested];
  });
}

export function getCategoryAvatarLabel(name: string) {
  const words = normalizeCategoryTitle(name).split(' ').filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('') || name.slice(0, 1);
}

/** Tight fit: 70px ring + label (up to 2 lines) + small gaps */
const SUBCATEGORY_STRIP_HEIGHT = 108;

function StoreSubcategoryCircleStrip({
  items,
  selectedId,
  onSelect,
  previewUrls,
  scrollViewRef,
  scrollToEndOnContentSize,
}: {
  items: StoreSubcategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  previewUrls: Record<string, string | undefined>;
  scrollViewRef?: React.RefObject<ScrollView | null>;
  scrollToEndOnContentSize?: boolean;
}) {
  const heightAnim = useSharedValue(0);
  const containerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(1);

  // displayedItems lags behind `items` during cross-fade so old content is
  // visible while fading out before the new content fades in.
  const [displayedItems, setDisplayedItems] = useState<StoreSubcategory[]>(items);

  const itemsKey = items.map((i) => i.id).join('\0');
  const prevItemsKeyRef = useRef('');
  const prevHasItemsRef = useRef(false);

  useEffect(() => {
    const prevKey = prevItemsKeyRef.current;
    const prevHasItems = prevHasItemsRef.current;
    const hasItems = items.length > 0;

    prevItemsKeyRef.current = itemsKey;
    prevHasItemsRef.current = hasItems;

    if (hasItems && !prevHasItems) {
      // Appearing: update content immediately then animate the container in
      // with a smooth ease-out curve (no spring bounce / jump).
      setDisplayedItems(items);
      contentOpacity.value = 1;
      heightAnim.value = withTiming(SUBCATEGORY_STRIP_HEIGHT, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      containerOpacity.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.quad),
      });
    } else if (!hasItems && prevHasItems) {
      // Disappearing: fade + collapse, keep old content visible during animation.
      containerOpacity.value = withTiming(0, {
        duration: 180,
        easing: Easing.in(Easing.quad),
      });
      heightAnim.value = withTiming(0, {
        duration: 260,
        easing: Easing.in(Easing.cubic),
      });
    } else if (hasItems && itemsKey !== prevKey) {
      // Switching between two non-empty sets: cross-fade the content.
      const captured = items;
      contentOpacity.value = withTiming(0, { duration: 110 }, (finished) => {
        if (finished) {
          runOnJS(setDisplayedItems)(captured);
          contentOpacity.value = withTiming(1, { duration: 190 });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const animStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
    opacity: containerOpacity.value,
    overflow: 'hidden',
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <Animated.View style={[contentStyle, { height: SUBCATEGORY_STRIP_HEIGHT }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          style={{ direction: 'rtl' }}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={
            scrollToEndOnContentSize
              ? () => {
                  requestAnimationFrame(() => {
                    scrollViewRef?.current?.scrollToEnd({ animated: false });
                  });
                }
              : undefined
          }
          contentContainerStyle={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 3,
            paddingHorizontal: 0,
            paddingBottom: 2,
          }}
        >
          {displayedItems.map((sub) => {
            const isSelected = selectedId === sub.id;
            const bundledOverrideUri = resolveFeaturedBrandPreviewUri(sub.title);
            const previewUri = bundledOverrideUri ?? previewUrls[sub.id] ?? sub.imageUrl ?? undefined;
            const displayTitle = resolveSubcategoryDisplayTitle(sub.title);
            return (
              <Pressable key={sub.id} onPress={() => onSelect(sub.id)}>
                <View style={{ alignItems: 'center', gap: 4, width: 74 }}>
                  {/* Ring + optional shadow */}
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: '#FFFFFF',
                      // selected shadow — soft lift instead of black fill
                      ...(isSelected
                        ? {
                            shadowColor: '#334155',
                            shadowOpacity: 0.28,
                            shadowRadius: 8,
                            shadowOffset: { width: 0, height: 3 },
                            elevation: 6,
                          }
                        : {
                            shadowColor: '#000',
                            shadowOpacity: 0,
                            shadowRadius: 0,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 0,
                          }),
                    }}
                  >
                    {/* Border ring drawn separately so shadow stays outside */}
                    <View
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? '#334155' : '#E7ECF3',
                        padding: 3,
                        backgroundColor: 'transparent',
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
                        {previewUri ? (
                          <Image
                            source={{ uri: previewUri }}
                            resizeMode="cover"
                            accessibilityLabel={displayTitle}
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : (
                          <Text style={{ color: '#6B7280', fontSize: 18, fontWeight: '800' }}>
                            {getCategoryAvatarLabel(displayTitle)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <Text
                    numberOfLines={2}
                    style={{
                      color: isSelected ? '#1E293B' : '#9CA3AF',
                      fontWeight: isSelected ? '800' : '600',
                      fontSize: 12,
                      lineHeight: 15,
                      textAlign: 'center',
                      maxWidth: 74,
                    }}
                  >
                    {displayTitle}
                  </Text>

                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function renderBottomNavIcon(itemId: StoreBottomTabId, isActive: boolean, colorOverride?: string, sizeOverride?: number) {
  const color = colorOverride ?? (isActive ? '#111111' : '#7B8190');
  const size = sizeOverride ?? 20;
  if (itemId === 'home') {
    return <StoreOcdLogoMark fill={color} height={size} />;
  }
  if (itemId === 'cart') {
    return <ShoppingCart size={size} color={color} strokeWidth={isActive ? 2.4 : 2} />;
  }
  const iconName =
    itemId === 'favorites'
        ? isActive
          ? 'heart'
          : 'heart-outline'
          : itemId === 'search'
            ? isActive
              ? 'search'
              : 'search-outline'
            : isActive
              ? 'person'
              : 'person-outline';

  return <Ionicons name={iconName} size={size} color={color} />;
}

/** Focused bottom-tab bubble fill — pure black (not admin navy). */
export const STORE_FLOATING_TAB_ACTIVE_BUBBLE_BG = '#000000';

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
    const backgroundColor = interpolateColor(progress.value, [0, 1], ['transparent', STORE_FLOATING_TAB_ACTIVE_BUBBLE_BG]);
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
  activeTab: StoreBottomTabId | null;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { bottomBarInset, bottomBarOffset } = getStoreBottomBarMetrics(insets.bottom);
  const { itemCount: cartItemCount } = useCart();

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
          icon={renderBottomNavIcon('home', activeTab === 'home', activeTab === 'home' ? '#FFFFFF' : '#9CA3AF', 30)}
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
          focused={activeTab === 'search'}
          onPress={() => onTabPress('search')}
          icon={renderBottomNavIcon('search', activeTab === 'search', activeTab === 'search' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
        <AnimatedStoreTabButton
          focused={activeTab === 'favorites'}
          onPress={() => onTabPress('favorites')}
          icon={renderBottomNavIcon('favorites', activeTab === 'favorites', activeTab === 'favorites' ? '#FFFFFF' : '#9CA3AF', 22)}
        />
        <AnimatedStoreTabButton
          focused={activeTab === 'profile'}
          onPress={() => onTabPress('profile')}
          icon={renderBottomNavIcon('profile', activeTab === 'profile', activeTab === 'profile' ? '#FFFFFF' : '#9CA3AF', 22)}
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
        <View style={{ position: 'relative', width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
          {cartItemCount > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -2,
                left: -2,
                minWidth: 18,
                height: 18,
                paddingHorizontal: cartItemCount > 9 ? 5 : 0,
                borderRadius: 9,
                backgroundColor: '#111111',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900', lineHeight: 12 }}>
                {cartItemCount > 99 ? '99+' : String(cartItemCount)}
              </Text>
            </View>
          ) : null}
          <AnimatedStoreTabButton
            compact
            focused={activeTab === 'cart'}
            onPress={() => onTabPress('cart')}
            icon={renderBottomNavIcon('cart', activeTab === 'cart', activeTab === 'cart' ? '#FFFFFF' : '#9CA3AF', 22)}
          />
        </View>
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

/* ─── Home banner carousel ───────────────────────────────────────────────── */
function HomeBannerCarousel({ screenWidth }: { screenWidth: number }) {
  const SIDE_PAD = 14;
  const CARD_W = screenWidth - SIDE_PAD * 2;
  const BANNER_HEIGHT = Math.round(CARD_W * 0.5);
  const INTERVAL = 3800;
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  const progress = useSharedValue(0);

  const startProgress = useCallback(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: INTERVAL, easing: Easing.linear });
  }, [progress]);

  useEffect(() => {
    startProgress();
    const timer = setInterval(() => {
      const next = (activeIdxRef.current + 1) % BANNER_IMAGES.length;
      activeIdxRef.current = next;
      setActiveIdx(next);
      scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
      startProgress();
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [screenWidth, startProgress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={{ paddingVertical: 10 }}>
      <View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            activeIdxRef.current = idx;
            setActiveIdx(idx);
            startProgress();
          }}
        >
          {BANNER_IMAGES.map((src, i) => (
            <View
              key={i}
              style={{
                width: screenWidth,
                paddingHorizontal: SIDE_PAD,
              }}
            >
              <View
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Image
                  source={src}
                  style={{ width: CARD_W, height: BANNER_HEIGHT }}
                  resizeMode="cover"
                />
                {/* Progress bar lives inside each card so overflow:hidden clips it to the rounded corners */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      height: 4,
                      backgroundColor: '#9CA3AF',
                    },
                    progressBarStyle,
                  ]}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Benefit icons strip */}
      <View
        style={{
          marginTop: 14,
          marginHorizontal: 14,
          flexDirection: 'row',
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#F0F0F0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
          overflow: 'hidden',
        }}
      >
        {[
          { icon: 'shield-checkmark-outline', label: 'איכות\nמקצועית' },
          { icon: 'pricetag-outline',          label: 'מחירים\nמשתלמים' },
          { icon: 'ribbon-outline',            label: 'מוצרים\nמובילים' },
          { icon: 'car-outline',               label: 'משלוח מהיר\nעד הבית' },
        ].map((item, index, arr) => (
          <View
            key={item.icon}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              paddingHorizontal: 4,
              borderRightWidth: index < arr.length - 1 ? 1 : 0,
              borderRightColor: '#F0F0F0',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#F8F8F8',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name={item.icon as any} size={20} color="#555555" />
            </View>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: '#555555',
                textAlign: 'center',
                lineHeight: 14.5,
                letterSpacing: 0.1,
              }}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** שלושה כפתורים בשורה — סדר ויזואלי (ימין→שמאל): מבצעים · נמכרים · חדשים */
const HOME_SEGMENT_ITEMS = [
  { id: 'sale' as const, name: 'המבצעים שלנו' },
  { id: 'recommended' as const, name: 'הכי נמכרים' },
  { id: 'new' as const, name: 'הכי חדשים' },
] as const;

const HOME_HIGHLIGHT_HEADLINES: Record<
  'recommended' | 'sale' | 'new',
  { title: string; subtitle: string }
> = {
  sale: {
    title: 'המבצעים שלנו',
    subtitle: 'הנחות ומחירים מיוחדים — עודכנו עכשיו',
  },
  recommended: {
    title: 'הכי נמכרים',
    subtitle: 'מה שהכי אוהבים אצלנו כרגע',
  },
  new: {
    title: 'הכי חדשים',
    subtitle: 'חידושים שהגיעו למדף לאחרונה',
  },
};

function HomeHighlightTabsStrip({
  homeTab,
  onTabChange,
}: {
  homeTab: 'recommended' | 'sale' | 'new';
  onTabChange: (tab: 'recommended' | 'sale' | 'new') => void;
}) {
  const { title, subtitle } = HOME_HIGHLIGHT_HEADLINES[homeTab];

  return (
    <View style={{ width: '100%', gap: 20 }}>
      <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
        <Text
          style={{
            color: '#111827',
            fontSize: 22,
            fontWeight: '900',
            textAlign: 'center',
            letterSpacing: 0.2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: '#9CA3AF',
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 19,
            paddingHorizontal: 8,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={{
          width: '100%',
          flexDirection: 'row-reverse',
          direction: 'ltr',
          gap: 6,
          alignItems: 'stretch',
        }}
      >
        {HOME_SEGMENT_ITEMS.map((item) => {
          const isSelected = homeTab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onTabChange(item.id)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    minHeight: 36,
                    flexGrow: 1,
                    paddingVertical: 7,
                    paddingHorizontal: 6,
                    borderRadius: 999,
                    overflow: 'visible',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isSelected ? '#000000' : '#FFFFFF',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: isSelected ? 'transparent' : '#E5E7EB',
                    opacity: pressed ? 0.92 : 1,
                    ...storeProductCardShadowStyle,
                    shadowColor: '#0F172A',
                    shadowOpacity: isSelected ? 0.28 : 0.2,
                    shadowRadius: isSelected ? 14 : 12,
                    shadowOffset: { width: 0, height: isSelected ? 5 : 4 },
                    elevation: isSelected ? 8 : 6,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      fontWeight: isSelected ? '700' : '600',
                      letterSpacing: 0.15,
                      color: isSelected ? '#FFFFFF' : '#374151',
                      textAlign: 'center',
                    }}
                  >
                    {item.name}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bento: חוזר 2 → 3 → 2 (בלי שורת full-width).
 * בשורות עם 2 כרטיסים — אחד צר (~40%) ואחד רחב (~60%); השורה השנייה במחזור משקפת.
 */
const BENTO_PATTERN = [2, 3, 2] as const;

/** גובה תמונה לפי גודל הכרטיס */
const HOME_CATEGORY_IMG_H_PAIR  = 156;
const HOME_CATEGORY_IMG_H_THIRD = 118;
/** גובה אזור גרדיאנט שחור בתחתית הכרטיס */
const HOME_CATEGORY_GRADIENT_MAX_RATIO = 0.6;

/** יחס צר/רחב בשורת 2 (כמו בהדמיה ~40% / ~60%) */
const BENTO_PAIR_NARROW_RATIO = 0.4;

/**
 * מחלק מערך לבלוקי Bento לפי [2,3,2,2,3,2…]
 */
function buildBentoGroups<T>(
  items: T[],
): { cols: 2 | 3; items: T[] }[] {
  const groups: { cols: 2 | 3; items: T[] }[] = [];
  let cursor = 0;
  let patternIndex = 0;
  while (cursor < items.length) {
    const cols = BENTO_PATTERN[patternIndex % BENTO_PATTERN.length];
    const chunk = items.slice(cursor, cursor + cols);
    groups.push({ cols, items: chunk });
    cursor += chunk.length;
    patternIndex++;
  }
  return groups;
}

/** קטגוריות בפריסת Bento — מתחת לבאנר; טאבי המבצעים/הכי נמכרים/חדשים בתחתית הדף */
function HomeOurCategoriesSection({
  categories,
  mergeFromCategories,
  coverUrlByCategoryId,
  subcategoriesByCategory,
  onOpenCategory,
}: {
  categories: StoreCategory[];
  /** רשימת הקטגוריות המלאה מהחנות — לאיחוד imageUrl כשקיים בשורש הקולקציה אך לא בתפריט העליון */
  mergeFromCategories: StoreCategory[];
  /** תמונות שהושלמו מ־Shopify כשחסרה תמונה בתפריט / במטא */
  coverUrlByCategoryId: Record<string, string>;
  subcategoriesByCategory: Record<string, StoreSubcategory[]>;
  onOpenCategory?: (category: {
    id: string;
    title: string;
    description?: string;
    parentTitle?: string;
    subcategories?: StoreSubcategory[];
  }) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const colGap = 10;
  const rowGap = 10;
  const innerWidth = Math.max(0, windowWidth - 24); // pageHorizontalPadding * 2

  const bentoGroups = useMemo(() => buildBentoGroups(categories), [categories]);

  if (!categories.length) return null;

  const narrowPairW = Math.max(0, Math.floor((innerWidth - colGap) * BENTO_PAIR_NARROW_RATIO));
  const widePairW = Math.max(0, innerWidth - colGap - narrowPairW);

  const widthEqualThird = Math.floor((innerWidth - colGap * 2) / 3);

  const imgHForCols = (cols: 2 | 3) =>
    cols === 2 ? HOME_CATEGORY_IMG_H_PAIR : HOME_CATEGORY_IMG_H_THIRD;

  const isToiletriesName = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return n.includes('טואל') || n.includes('טואלי');
  };
  const isBundlesName = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return n.includes('מארז') && n.includes('ניקיון');
  };
  /** תואם גם ל־swapFragranceAndFabricForBento — כרטיס מרככי כביסה וטקסטיל */
  const isFabricSoftenersCategory = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return (n.includes('מרככי') || n.includes('מרכך')) && (n.includes('כביסה') || n.includes('טקסטיל'));
  };
  /** תואם ל־swapFragranceAndFabricForBento — «מערכות בישום» */
  const isFragranceSystemsCategory = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return n.includes('בישום');
  };
  /** אקססוריז / אקססוארים */
  const isAccessoriesCategory = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return n.includes('אקססור') || n.includes('אקססואר');
  };
  /** עיצוב הבית */
  const isHomeDesignCategory = (name: string) => {
    const n = normalizeCategoryTitle(name);
    return n.includes('עיצוב') && n.includes('בית');
  };

  /** רוחב כרטיס בשורת 2 — כאשר הזוג מכיל «טואלטיקה» + «מארזי ניקיון משתלמים» מכריחים:
   *  מארזי ניקיון → wide, טואלטיקה → narrow */
  const pairCardWidth = (
    groupIndex: number,
    itemIndex: number,
    itemCount: number,
    groupItems: StoreCategory[],
  ) => {
    if (itemCount === 1) return widePairW;

    const hasToiletries = groupItems.some((c) => isToiletriesName(c.name));
    const hasBundles = groupItems.some((c) => isBundlesName(c.name));
    if (hasToiletries && hasBundles) {
      const thisItem = groupItems[itemIndex]!;
      return isToiletriesName(thisItem.name) ? narrowPairW : widePairW;
    }

    const slotInCycle = groupIndex % 3;
    const firstTwoRow = slotInCycle === 0;
    const secondTwoRow = slotInCycle === 2;
    if (!firstTwoRow && !secondTwoRow) return widePairW;
    if (firstTwoRow) {
      return itemIndex === 0 ? widePairW : narrowPairW;
    }
    return itemIndex === 0 ? narrowPairW : widePairW;
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', paddingHorizontal: 8 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
          <Text
            style={{
              color: '#111827',
              fontSize: 22,
              fontWeight: '900',
              textAlign: 'center',
              letterSpacing: 0.2,
            }}
          >
            הקטגוריות שלנו
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
        </View>
        <Text
          style={{
            color: '#9CA3AF',
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 19,
            paddingHorizontal: 8,
          }}
        >
          גלו את המגוון המלא לפי נושאים
        </Text>
      </View>
      <View style={{ gap: rowGap }}>
        {bentoGroups.map((group, groupIndex) => {
          const imgH = imgHForCols(group.cols);

          const hasToiletriesAndBundlesPair =
            group.cols === 2 &&
            group.items.length === 2 &&
            group.items.some((c) => isToiletriesName(c.name)) &&
            group.items.some((c) => isBundlesName(c.name));
          /** החלפת מיקום שמאל/ימין ב־row-reverse — רק לזוג הזה */
          const rowItems = hasToiletriesAndBundlesPair
            ? [group.items[1]!, group.items[0]!]
            : group.items;

          return (
            <View
              key={`bento-row-${groupIndex}`}
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'flex-start',
                flexWrap: 'nowrap',
                gap: colGap,
              }}
            >
              {rowItems.map((category, itemIndex) => {
                const cardW =
                  group.cols === 3
                    ? widthEqualThird
                    : pairCardWidth(groupIndex, itemIndex, rowItems.length, rowItems);
                const cardTotalH = imgH;
                const gradientZoneH = Math.min(
                  Math.round(cardTotalH * HOME_CATEGORY_GRADIENT_MAX_RATIO),
                  100,
                );

                const coverUri =
                  category.imageUrl ??
                  mergeFromCategories.find((c) => c.id === category.id)?.imageUrl ??
                  coverUrlByCategoryId[category.id];

                const useLocalFabricCover = isFabricSoftenersCategory(category.name);
                const useLocalFragranceCover = isFragranceSystemsCategory(category.name);
                const useLocalAccessoriesCover = isAccessoriesCategory(category.name);
                const useLocalHomeDesignCover = isHomeDesignCategory(category.name);
                const useLocalBundlesCover = isBundlesName(category.name);

                return (
                  <Pressable
                    key={category.id}
                    onPress={() =>
                      onOpenCategory?.({
                        id: category.id,
                        title: category.name,
                        description: category.subtitle,
                        subcategories: subcategoriesByCategory[category.id],
                      })
                    }
                    style={({ pressed }) => ({
                      width: cardW,
                      height: cardTotalH,
                      opacity: pressed ? 0.88 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: cardW,
                        height: cardTotalH,
                        borderRadius: 18,
                        ...storeProductCardShadowStyle,
                      }}
                    >
                      <View
                        style={{
                          width: cardW,
                          height: cardTotalH,
                          borderRadius: 18,
                          overflow: 'hidden',
                          backgroundColor: '#F0F2F5',
                        }}
                      >
                        {useLocalFabricCover ? (
                          <Image
                            source={require('../../../assets/kvisa1.png')}
                            style={{ width: cardW, height: cardTotalH }}
                            resizeMode="cover"
                            accessibilityLabel={category.name}
                          />
                        ) : useLocalFragranceCover ? (
                          <Image
                            source={require('../../../assets/bisom.png')}
                            style={{ width: cardW, height: cardTotalH }}
                            resizeMode="cover"
                            accessibilityLabel={category.name}
                          />
                        ) : useLocalAccessoriesCover ? (
                          <Image
                            source={require('../../../assets/exxsorie.png')}
                            style={{ width: cardW, height: cardTotalH }}
                            resizeMode="cover"
                            accessibilityLabel={category.name}
                          />
                        ) : useLocalHomeDesignCover ? (
                          <Image
                            source={require('../../../assets/homedesing.png')}
                            style={{ width: cardW, height: cardTotalH }}
                            resizeMode="cover"
                            accessibilityLabel={category.name}
                          />
                        ) : useLocalBundlesCover ? (
                          <Image
                            source={require('../../../assets/marazim2.png')}
                            style={{ width: cardW, height: cardTotalH }}
                            resizeMode="cover"
                            accessibilityLabel={category.name}
                          />
                        ) : coverUri ? (
                          <Image
                            source={{ uri: coverUri }}
                            style={{ width: cardW, height: cardTotalH }}
                            resizeMode="cover"
                            accessibilityLabel={category.name}
                          />
                        ) : (
                          <View
                            style={{
                              width: cardW,
                              height: cardTotalH,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: group.cols === 2 ? 28 : 20,
                                fontWeight: '900',
                                color: '#BCC3CE',
                                writingDirection: 'rtl',
                              }}
                            >
                              {getCategoryAvatarLabel(category.name)}
                            </Text>
                          </View>
                        )}

                        <LinearGradient
                          pointerEvents="none"
                          colors={[
                            'rgba(0,0,0,0)',
                            'rgba(0,0,0,0.45)',
                            'rgba(0,0,0,0.78)',
                          ]}
                          locations={[0, 0.5, 1]}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: gradientZoneH,
                          }}
                        />

                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            paddingHorizontal: group.cols === 3 ? 8 : 11,
                            paddingBottom: 10,
                            paddingTop: 6,
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{
                              color: '#FFFFFF',
                              fontSize: group.cols === 3 ? 11 : 13,
                              lineHeight: group.cols === 3 ? 15 : 18,
                              fontWeight: '800',
                              textAlign: 'right',
                              writingDirection: 'rtl',
                              letterSpacing: 0.2,
                            }}
                          >
                            {category.name}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** חברות נבחרות — עיגולים אופקיים (סטוריז) מתחת ל«הקטגוריות שלנו» */
function HomeSelectedBrandsStoryStrip({
  items,
  previewUrls,
  parentTitle,
  subcategoriesByCategoryId,
  onOpenCategory,
  edgeBleed = STORE_HOME_SCROLL_PADDING_H,
}: {
  items: StoreSubcategory[];
  previewUrls: Record<string, string | undefined>;
  parentTitle: string;
  subcategoriesByCategoryId: Record<string, StoreSubcategory[]>;
  /** יושם כ־marginHorizontal שלילי על הקרוסלה כדי שתגיע עד קצה המסך (שווה ל־padding האופקי של העטיפה) */
  edgeBleed?: number;
  onOpenCategory?: (category: {
    id: string;
    title: string;
    description?: string;
    parentTitle?: string;
    subcategories?: StoreSubcategory[];
  }) => void;
}) {
  if (!items.length) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
        <Text
          style={{
            color: '#111827',
            fontSize: 22,
            fontWeight: '900',
            textAlign: 'center',
            letterSpacing: 0.2,
          }}
        >
          חברות נבחרות
        </Text>
        <Text
          style={{
            color: '#9CA3AF',
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 19,
            paddingHorizontal: 8,
          }}
        >
          לחצו על מותג כדי לצפות במוצרים
        </Text>
      </View>
      <View style={{ marginHorizontal: edgeBleed ? -edgeBleed : 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          /** RTL: גלילה וסדר מימין לשמאל (גם כשהמערכת ב־LTR) */
          style={{ direction: 'rtl' }}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 2,
            paddingHorizontal: 0,
            paddingBottom: 4,
          }}
        >
        {items.map((sub) => {
          const bundledOverrideUri = resolveFeaturedBrandPreviewUri(sub.title);
          const previewUri = bundledOverrideUri ?? previewUrls[sub.id] ?? sub.imageUrl ?? undefined;
          const displayTitle = resolveSubcategoryDisplayTitle(sub.title);
          return (
            <Pressable
              key={sub.id}
              onPress={() =>
                onOpenCategory?.({
                  id: sub.id,
                  title: displayTitle,
                  description: sub.description,
                  parentTitle,
                  subcategories: subcategoriesByCategoryId[sub.id] ?? [],
                })
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
            >
              <View style={{ alignItems: 'center', gap: 6, width: 86 }}>
                <View
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 41,
                    padding: 3,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 2,
                    borderColor: '#E8ECF2',
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 38,
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
                        accessibilityLabel={displayTitle}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <Text style={{ color: '#6B7280', fontSize: 19, fontWeight: '800' }}>
                        {getCategoryAvatarLabel(displayTitle)}
                      </Text>
                    )}
                  </View>
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    color: '#374151',
                    fontWeight: '700',
                    fontSize: 12,
                    lineHeight: 15,
                    textAlign: 'center',
                    writingDirection: 'rtl',
                    maxWidth: 86,
                  }}
                >
                  {displayTitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
        </ScrollView>
      </View>
    </View>
  );
}

export function StoreHomeScreen({
  onProfilePress,
  onFavoritesPress,
  onSearchPress,
  onProductPress,
  onOpenCart,
  onOpenProduct,
  onOpenCategory,
  isOcdPlusSubscriber = false,
  onOcdPlusSubscribePress,
  initialTab,
  initialTabRequestId,
}: {
  onProfilePress: () => void;
  onFavoritesPress?: () => void;
  onSearchPress?: () => void;
  isOcdPlusSubscriber?: boolean;
  onOcdPlusSubscribePress?: () => void;
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
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<StoreProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([{ id: 'all', name: 'כל המוצרים' }]);
  const [menuItems, setMenuItems] = useState<ShopifyMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [bundleProducts, setBundleProducts] = useState<StoreProduct[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [homeTab, setHomeTab] = useState<'recommended' | 'sale' | 'new'>('recommended');
  const [homeTabProducts, setHomeTabProducts] = useState<Record<'recommended' | 'sale' | 'new', StoreProduct[]>>({
    recommended: [],
    sale: [],
    new: [],
  });
  const [homeTabLoading, setHomeTabLoading] = useState(false);
  /** כיסויי תמונה לקטגוריות (השלמה מ־API כשאין image בתפריט) */
  const [homeCategoryCoverUrls, setHomeCategoryCoverUrls] = useState<Record<string, string>>({});
  const [selectedHomeSubcategoryId, setSelectedHomeSubcategoryId] = useState<string>(STORE_CATEGORY_ALL_SUBS_ID);
  const [homeSubcategoryPreviewUrls, setHomeSubcategoryPreviewUrls] = useState<Record<string, string | undefined>>({});
  /** תתי־קטגוריות עם מוצר בלבד (null = בודקים מול Shopify) */
  const [filteredHomeDirectSubcategories, setFilteredHomeDirectSubcategories] = useState<StoreSubcategory[] | null>(null);
  const [brandsStripPreviewUrls, setBrandsStripPreviewUrls] = useState<Record<string, string | undefined>>({});
  /** כשמוגדר handle קבוע והפריט לא נמצא בתפריט — כותרת/תמונה מ־`collection` ב־Storefront */
  const [selectedBrandsApiFallback, setSelectedBrandsApiFallback] = useState<{
    handle: string;
    title: string;
    description: string;
    imageUrl: string | null;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [ocdPlusSubscribeSheetOpen, setOcdPlusSubscribeSheetOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const homeSubcategoryTabsRef = useRef<ScrollView | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const [activePrimaryTab, setActivePrimaryTab] = useState<StoreMainTabId>('home');
  const lastHandledInitialTabRequestIdRef = useRef<number | undefined>(undefined);

  const activeBottomTab = useMemo<StoreBottomTabId>(() => {
    if (activePrimaryTab === 'search') return 'search';
    return 'home';
  }, [activePrimaryTab]);
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();

  useEffect(() => {
    let isMounted = true;

    const loadStorefrontData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [liveProducts, liveCollections] = await Promise.all([
          fetchProducts(),
          fetchCollections(),
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

  // ─── Load bundles collection ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setBundlesLoading(true);
    fetchCollectionProducts(BUNDLES_COLLECTION_HANDLE, 10)
      .then((products) => {
        if (!active) return;
        setBundleProducts(products.map((p, i) => toStoreProduct(p, i, 'מארז ניקיון', BUNDLES_COLLECTION_HANDLE)));
      })
      .catch(() => {
        if (!active) return;
        setBundleProducts([]);
      })
      .finally(() => {
        if (!active) return;
        setBundlesLoading(false);
      });
    return () => { active = false; };
  }, []);

  // ─── Load home tabs collections ────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setHomeTabLoading(true);
    Promise.allSettled([
      fetchProducts(HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT),
      fetchCollectionProducts(HOME_TAB_SALE_HANDLE, HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT, {
        sortKey: HOME_TAB_SALE_COLLECTION_SORT,
      }),
      fetchNewestProducts(HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT),
    ]).then(([rec, sale, newArr]) => {
      if (!active) return;
      setHomeTabProducts({
        recommended: rec.status === 'fulfilled'
          ? rec.value.map((p, i) => toStoreProduct(p, i, '', HOME_TAB_RECOMMENDED_HANDLE))
          : [],
        sale: sale.status === 'fulfilled'
          ? sale.value.map((p, i) => toStoreProduct(p, i, '', HOME_TAB_SALE_HANDLE))
          : [],
        new: newArr.status === 'fulfilled'
          ? newArr.value.map((p, i) => toStoreProduct(p, i, '', HOME_TAB_NEW_HANDLE))
          : [],
      });
    }).finally(() => {
      if (!active) return;
      setHomeTabLoading(false);
    });
    return () => { active = false; };
  }, []);

  // When no dedicated bundle collection is configured, fall back to the first 8 products.
  const displayBundleProducts = useMemo(
    () => (bundleProducts.length > 0 ? bundleProducts : allProducts.slice(0, 8)),
    [bundleProducts, allProducts],
  );

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

  /** ברירת מחדל לפי שם בתפריט; אם הוגדר `EXPO_PUBLIC_HOME_SELECTED_BRANDS_COLLECTION_HANDLE` — רק לפי handle מה־API */
  const selectedBrandsMenuItem = useMemo((): ShopifyMenuItem | null => {
    if (!menuItems.length) return null;
    if (HOME_SELECTED_BRANDS_COLLECTION_HANDLE) {
      return findMenuItemByCollectionHandle(menuItems, HOME_SELECTED_BRANDS_COLLECTION_HANDLE);
    }
    return findSelectedBrandsMenuItem(menuItems);
  }, [menuItems]);

  useEffect(() => {
    if (!HOME_SELECTED_BRANDS_COLLECTION_HANDLE) {
      setSelectedBrandsApiFallback(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (menuItems.length > 0) {
        const pinned = findMenuItemByCollectionHandle(
          menuItems,
          HOME_SELECTED_BRANDS_COLLECTION_HANDLE,
        );
        if (pinned) {
          if (!cancelled) setSelectedBrandsApiFallback(null);
          return;
        }
      }
      try {
        const summary = await fetchCollectionSummary(HOME_SELECTED_BRANDS_COLLECTION_HANDLE);
        if (!cancelled) setSelectedBrandsApiFallback(summary);
      } catch {
        if (!cancelled) setSelectedBrandsApiFallback(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuItems]);

  const selectedBrandsParentCategory = useMemo((): StoreCategory | null => {
    const mi = selectedBrandsMenuItem;
    if (mi?.collectionHandle) {
      return {
        id: mi.collectionHandle,
        name: mi.title,
        subtitle: mi.collectionDescription,
        imageUrl: mi.collectionImageUrl ?? null,
      };
    }
    /** הורה ללא קולקציה — מזהה סינתטי לסינון בנטו (לא מתנגש עם handle אמיתי) */
    if (mi?.children?.length) {
      return {
        id: `menu:${mi.id}`,
        name: mi.title,
        subtitle: mi.collectionDescription,
        imageUrl: mi.collectionImageUrl ?? null,
      };
    }
    const fb = selectedBrandsApiFallback;
    if (fb) {
      return {
        id: fb.handle,
        name: fb.title,
        subtitle: fb.description,
        imageUrl: fb.imageUrl,
      };
    }
    return null;
  }, [selectedBrandsMenuItem, selectedBrandsApiFallback]);

  /** סדר מותאם לרשת הקטגוריות בלבד — ללא «חברות נבחרות» אם היא מופיעה ברמת העל של הבנטו */
  const topLevelCategoriesBento = useMemo(
    () =>
      swapFragranceAndFabricForBento(swapToiletriesAndBundlesForBento(topLevelCategories)).filter(
        (c) => !selectedBrandsParentCategory || c.id !== selectedBrandsParentCategory.id,
      ),
    [topLevelCategories, selectedBrandsParentCategory],
  );

  const brandsStripItems = useMemo((): StoreSubcategory[] => {
    const mi = selectedBrandsMenuItem;
    if (!mi) {
      const fb = selectedBrandsApiFallback;
      if (fb && HOME_SELECTED_BRANDS_COLLECTION_HANDLE) {
        return [{ id: fb.handle, title: fb.title, imageUrl: fb.imageUrl }];
      }
      return [];
    }

    if (mi.children?.length) {
      const children = getSubcategoriesForMenuItem(mi);
      if (children.length > 0) return children;
    }

    if (mi.collectionHandle) {
      return [
        {
          id: mi.collectionHandle,
          title: mi.title,
          imageUrl: mi.collectionImageUrl ?? null,
        },
      ];
    }

    const fb = selectedBrandsApiFallback;
    if (fb && HOME_SELECTED_BRANDS_COLLECTION_HANDLE) {
      return [{ id: fb.handle, title: fb.title, imageUrl: fb.imageUrl }];
    }
    return [];
  }, [selectedBrandsMenuItem, selectedBrandsApiFallback]);

  const brandsStripListKey = useMemo(() => brandsStripItems.map((s) => s.id).join('\0'), [brandsStripItems]);

  const topLevelCategoryListKey = useMemo(
    () => topLevelCategories.map((c) => `${c.id}\0${c.imageUrl ?? ''}`).join('|'),
    [topLevelCategories],
  );

  useEffect(() => {
    if (!topLevelCategories.length) {
      setHomeCategoryCoverUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        topLevelCategories.map(async (cat) => {
          const fromFlat = categories.find((c) => c.id === cat.id)?.imageUrl;
          const resolved = cat.imageUrl ?? fromFlat;
          if (resolved) {
            next[cat.id] = resolved;
            return;
          }
          try {
            const url = await fetchCollectionImage(cat.id);
            if (url) next[cat.id] = url;
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setHomeCategoryCoverUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [topLevelCategoryListKey, topLevelCategories, categories]);
  const selectedCategoryDirectSubcategories = useMemo(
    () => topLevelCategoryChildrenMap[selectedCategory] ?? [],
    [selectedCategory, topLevelCategoryChildrenMap],
  );
  const homeRawSubcategoryListKey = useMemo(
    () => `${selectedCategory}\0${selectedCategoryDirectSubcategories.map((s) => s.id).join('\0')}`,
    [selectedCategory, selectedCategoryDirectSubcategories],
  );
  const effectiveHomeDirectSubcategories = useMemo((): StoreSubcategory[] => {
    if (selectedCategory === 'all') return [];
    if (!selectedCategoryDirectSubcategories.length) return [];
    if (filteredHomeDirectSubcategories === null) return [];
    return filteredHomeDirectSubcategories;
  }, [selectedCategory, selectedCategoryDirectSubcategories, filteredHomeDirectSubcategories]);

  useLayoutEffect(() => {
    if (selectedCategory === 'all' || !selectedCategoryDirectSubcategories.length) {
      setFilteredHomeDirectSubcategories([]);
    } else {
      setFilteredHomeDirectSubcategories(null);
    }
  }, [selectedCategory, homeRawSubcategoryListKey, selectedCategoryDirectSubcategories]);

  useEffect(() => {
    if (selectedCategory === 'all' || !selectedCategoryDirectSubcategories.length) {
      setFilteredHomeDirectSubcategories([]);
      return;
    }
    let cancelled = false;
    const subs = selectedCategoryDirectSubcategories;
    void (async () => {
      try {
        const flags = await Promise.all(subs.map((s) => fetchCollectionHasProducts(s.id)));
        if (!cancelled) setFilteredHomeDirectSubcategories(subs.filter((_, i) => flags[i]));
      } catch {
        if (!cancelled) setFilteredHomeDirectSubcategories(subs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, homeRawSubcategoryListKey]);

  const selectedCategoryInfo = useMemo(
    () => categories.find((category) => category.id === selectedCategory) ?? topLevelCategories.find((category) => category.id === selectedCategory),
    [categories, selectedCategory, topLevelCategories]
  );
  const selectedCategoryName = useMemo(
    () => selectedCategoryInfo?.name ?? 'מוצרים',
    [selectedCategoryInfo]
  );
  const homeSubcategoriesStripItems = useMemo((): StoreSubcategory[] => {
    if (selectedCategory === 'all' || !effectiveHomeDirectSubcategories.length) return [];
    return [
      {
        id: STORE_CATEGORY_ALL_SUBS_ID,
        title: 'הכל',
        parentTitle: selectedCategoryName,
        imageUrl: null,
      },
      ...effectiveHomeDirectSubcategories,
    ];
  }, [selectedCategory, effectiveHomeDirectSubcategories, selectedCategoryName]);
  const homeSubcategoryListKey = useMemo(
    () =>
      `${selectedCategory}\0${STORE_CATEGORY_ALL_SUBS_ID}\0${effectiveHomeDirectSubcategories.map((s) => s.id).join('\0')}`,
    [selectedCategory, effectiveHomeDirectSubcategories],
  );
  const homeHighlightProducts = useMemo(() => {
    const list = homeTabProducts[homeTab];
    if (list.length > 0) return list.slice(0, HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT);
    return allProducts.slice(0, HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT);
  }, [homeTab, homeTabProducts, allProducts]);

  useEffect(() => {
    setSelectedHomeSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedCategory === 'all' || !effectiveHomeDirectSubcategories.length) {
      setHomeSubcategoryPreviewUrls({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const next: Record<string, string | undefined> = {};
      await Promise.all(
        effectiveHomeDirectSubcategories.map(async (sub) => {
          if (sub.imageUrl) {
            next[sub.id] = sub.imageUrl;
            return;
          }
          try {
            const img = await fetchCollectionImage(sub.id);
            next[sub.id] = img ?? undefined;
          } catch {
            next[sub.id] = undefined;
          }
        }),
      );
      for (const sub of effectiveHomeDirectSubcategories) {
        const overrideUri = resolveFeaturedBrandPreviewUri(sub.title);
        if (overrideUri) next[sub.id] = overrideUri;
      }
      if (!cancelled) {
        let allPreview: string | undefined;
        for (const sub of effectiveHomeDirectSubcategories) {
          const u = next[sub.id];
          if (u) { allPreview = u; break; }
        }
        next[STORE_CATEGORY_ALL_SUBS_ID] = allPreview ?? undefined;
        setHomeSubcategoryPreviewUrls(next);
      }
    })();

    return () => { cancelled = true; };
  }, [homeSubcategoryListKey, selectedCategory, effectiveHomeDirectSubcategories]);

  useEffect(() => {
    if (!effectiveHomeDirectSubcategories.length) return;
    if (
      selectedHomeSubcategoryId !== STORE_CATEGORY_ALL_SUBS_ID &&
      !effectiveHomeDirectSubcategories.some((s) => s.id === selectedHomeSubcategoryId)
    ) {
      setSelectedHomeSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
    }
  }, [effectiveHomeDirectSubcategories, selectedHomeSubcategoryId]);

  useEffect(() => {
    if (!brandsStripItems.length) {
      setBrandsStripPreviewUrls({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const next: Record<string, string | undefined> = {};
      await Promise.all(
        brandsStripItems.map(async (sub) => {
          if (sub.imageUrl) {
            next[sub.id] = sub.imageUrl ?? undefined;
            return;
          }
          try {
            const img = await fetchCollectionImage(sub.id);
            next[sub.id] = img ?? undefined;
          } catch {
            next[sub.id] = undefined;
          }
        }),
      );
      for (const sub of brandsStripItems) {
        const overrideUri = resolveFeaturedBrandPreviewUri(sub.title);
        if (overrideUri) next[sub.id] = overrideUri;
      }
      if (!cancelled) setBrandsStripPreviewUrls(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [brandsStripListKey, brandsStripItems]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  useEffect(() => {
    if (!initialTabRequestId || lastHandledInitialTabRequestIdRef.current === initialTabRequestId) {
      return;
    }

    lastHandledInitialTabRequestIdRef.current = initialTabRequestId;
    setMenuOpen(false);

    if (initialTab === 'search') {
      setActivePrimaryTab('search');
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return;
    }

    searchInputRef.current?.blur();
    setActivePrimaryTab('home');
  }, [initialTab, initialTabRequestId]);

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

        const collectionProducts = await fetchCollectionProducts(selectedCategory, STORE_HOME_CATEGORY_PREVIEW_LIMIT);
        if (!isMounted) return;
        const mappedProducts: StoreProduct[] = collectionProducts.map((product, index) =>
          toStoreProduct(product, index, selectedCategoryName, selectedCategory),
        );

        if (!isMounted) return;

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
  }, [
    allProducts,
    query,
    selectedCategory,
    selectedCategoryName,
    selectedHomeSubcategoryId,
    topLevelCategoryChildrenMap,
  ]);

  const homeHeaderGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'בוקר טוב';
    if (h < 17) return 'צהריים טובים';
    return 'ערב טוב';
  }, []);

  const handleBottomTabPress = (itemId: StoreBottomTabId) => {
    if (itemId === 'home') {
      setMenuOpen(false);
      setActivePrimaryTab('home');
      searchInputRef.current?.blur();
      setSelectedCategory('all');
      return;
    }

    if (itemId === 'cart') {
      setMenuOpen(false);
      searchInputRef.current?.blur();
      onOpenCart?.();
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

    if (itemId === 'favorites') {
      setMenuOpen(false);
      searchInputRef.current?.blur();
      onFavoritesPress?.();
      return;
    }

    if (itemId === 'profile') {
      setMenuOpen(false);
      searchInputRef.current?.blur();
      onProfilePress();
      return;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
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
                            if (section.categoryId !== 'all' && onOpenCategory) {
                              setMenuOpen(false);
                              const cat =
                                categories.find((c) => c.id === section.categoryId) ??
                                topLevelCategories.find((c) => c.id === section.categoryId);
                              onOpenCategory({
                                id: section.categoryId,
                                title: cat?.name ?? section.title,
                                description: cat?.subtitle,
                                subcategories: topLevelCategoryChildrenMap[section.categoryId],
                              });
                              return;
                            }
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

        {/* Logo bar */}
        <View style={{ backgroundColor: '#F5F5F5', paddingTop: insets.top }}>
          <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../../assets/logopng/OCDLOGO-04.png')}
              style={{ width: 150, height: 56 }}
              resizeMode="contain"
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: '#F5F5F5' }}
          contentContainerStyle={{
            paddingBottom: contentPaddingBottom,
            flexGrow: 1,
            backgroundColor: '#F5F5F5',
          }}
          showsVerticalScrollIndicator={false}
          {...(Platform.OS === 'ios'
            ? { contentInsetAdjustmentBehavior: 'never' as const }
            : {})}
        >
          {/* Search bar — above banner carousel */}
          <View
            style={{
              paddingHorizontal: STORE_HOME_SCROLL_PADDING_H,
              paddingTop: 8,
              paddingBottom: 10,
              backgroundColor: '#F5F5F5',
            }}
          >
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#E8ECF2',
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
          </View>

          {/* Banner carousel */}
          <HomeBannerCarousel screenWidth={windowWidth} />

          <View
            style={{
              flexGrow: 1,
              gap: 6,
              paddingHorizontal: STORE_HOME_SCROLL_PADDING_H,
              paddingTop: 12,
              backgroundColor: '#F5F5F5',
            }}
          >
            {!loading && topLevelCategories.length > 0 ? (
              <HomeOurCategoriesSection
                categories={topLevelCategoriesBento}
                mergeFromCategories={categories}
                coverUrlByCategoryId={homeCategoryCoverUrls}
                subcategoriesByCategory={topLevelCategoryChildrenMap}
                onOpenCategory={onOpenCategory}
              />
            ) : null}

            {!loading && brandsStripItems.length > 0 && selectedBrandsParentCategory ? (
              <HomeSelectedBrandsStoryStrip
                items={brandsStripItems}
                previewUrls={brandsStripPreviewUrls}
                parentTitle={selectedBrandsParentCategory.name}
                subcategoriesByCategoryId={topLevelCategoryChildrenMap}
                onOpenCategory={onOpenCategory}
              />
            ) : null}

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

            {selectedCategory === 'all' && !loading && !topLevelCategories.length && (
              <>
                <View style={{ alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
                  <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>כל המוצרים</Text>
                  <Text style={{ color: '#B1B6C1', fontSize: 11 }}>all products from your Shopify store</Text>
                </View>

            <View style={{ gap: 12 }}>
              {visibleProducts.map((product) => (
                <View
                  key={`list-${product.id}`}
                  style={{
                    borderRadius: 18,
                    ...storeProductCardShadowStyle,
                  }}
                >
                  <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                      <Pressable
                        onPress={() => onProductPress?.(product.handle)}
                        style={({ pressed }) => ({
                          width: 112,
                          padding: 10,
                          opacity: pressed ? 0.96 : 1,
                        })}
                      >
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
                      </Pressable>

                      <View
                        style={{
                          flex: 1,
                          backgroundColor: '#FFFFFF',
                          borderRadius: 18,
                          overflow: 'hidden',
                          paddingVertical: 10,
                          paddingLeft: 10,
                          paddingRight: 4,
                        }}
                      >
                        <Pressable onPress={() => onProductPress?.(product.handle)}>
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
                        </Pressable>
                        <View style={{ marginTop: 10 }}>
                          <OcdPlusProductPriceBlock
                            regularPrice={product.price}
                            isOcdPlusSubscriber={isOcdPlusSubscriber}
                            onSubscribePress={onOcdPlusSubscribePress}
                            titleSize={20}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
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
                <Text style={{ color: colors.adminHeader, fontSize: 16, fontWeight: '900', marginTop: 6 }}>
                  Midnight in
                </Text>
                <Text style={{ color: colors.adminHeader, fontSize: 18, fontWeight: '900' }}>Spa</Text>
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

            {/* ─── OCD+ promotional banner ── */}
            {!loading && (() => {
              /* Match parent column padding (12); cardW must use content width or layout overflows horizontally. */
              const contentHorizontalPad = 12;
              const bannerRadius = 20;
              const cardW = windowWidth - contentHorizontalPad * 2;
              const cardH = Math.round(cardW * (948 / 1659));
              return (
                <View
                  style={{
                    paddingTop: 8,
                    paddingBottom: 16,
                    alignItems: 'center',
                  }}
                >
                  {!isOcdPlusSubscriber && (
                    <View style={{ width: '100%', alignItems: 'center', marginBottom: 12, paddingHorizontal: 8 }}>
                      <Text
                        style={{
                          color: '#111827',
                          fontSize: 22,
                          fontWeight: '900',
                          textAlign: 'center',
                          letterSpacing: 0.2,
                        }}
                      >
                        עדיין אין לך OCD+?
                      </Text>
                      <Text
                        style={{
                          color: '#9CA3AF',
                          fontSize: 13,
                          fontWeight: '600',
                          textAlign: 'center',
                          marginTop: 6,
                          lineHeight: 19,
                          paddingHorizontal: 4,
                        }}
                      >
                        מצטרפים היום ומקבלים הנחות על כל המוצרים שלנו
                      </Text>
                    </View>
                  )}
                  {/* Relative box: floating CTA sits half on image / half below — same idea as OcdPlusFloatingBadge on cards */}
                  <View
                    style={{
                      width: cardW,
                      position: 'relative',
                      marginBottom: isOcdPlusSubscriber ? 0 : 28,
                    }}
                  >
                    <View
                      style={{
                        width: cardW,
                        borderRadius: bannerRadius,
                        backgroundColor: '#FFFFFF',
                        ...ocdPlusHomeBannerShadowStyle,
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          if (!isOcdPlusSubscriber) setOcdPlusSubscribeSheetOpen(true);
                        }}
                        style={({ pressed }) => ({
                          borderRadius: bannerRadius,
                          overflow: 'hidden',
                          opacity: pressed ? 0.88 : 1,
                        })}
                      >
                        <Image
                          source={require('../../../assets/ocdplusbannernew.png')}
                          style={{
                            width: cardW,
                            height: cardH,
                            borderRadius: bannerRadius,
                          }}
                          resizeMode="stretch"
                        />
                      </Pressable>
                    </View>
                    <View
                      pointerEvents="box-none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        alignItems: 'center',
                        zIndex: 10,
                        transform: [{ translateY: '50%' }],
                      }}
                    >
                      <OcdPlusJoinBannerButton
                        isSubscriber={isOcdPlusSubscriber}
                        onPress={() => setOcdPlusSubscribeSheetOpen(true)}
                      />
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* ─── Bundles section — visible on all home tab regardless of categories ── */}
            {!loading && (bundlesLoading || displayBundleProducts.length > 0) && (
              <View style={{ marginTop: 32 }}>
                <Text
                  style={{
                    color: '#111827',
                    fontSize: 22,
                    fontWeight: '900',
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  מארזי ניקיון משתלמים
                </Text>
                <Text
                  style={{
                    color: '#9CA3AF',
                    fontSize: 13,
                    fontWeight: '500',
                    textAlign: 'center',
                    marginBottom: 20,
                  }}
                >
                  הכנו לכם מארזי ניקיון שווים במיוחד
                </Text>

                {bundlesLoading ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator color="#111827" />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -12 }}
                    contentContainerStyle={{
                      flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
                      gap: 12,
                      paddingHorizontal: 12,
                      paddingBottom: 40,
                    }}
                  >
                    {displayBundleProducts.map((product) => (
                      <View
                        key={`bundle-${product.id}`}
                        style={{
                          width: 160,
                          borderRadius: 18,
                          marginBottom: 6,
                          ...storeProductCardShadowStyle,
                        }}
                      >
                        <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                          <Pressable onPress={() => onProductPress?.(product.handle)}>
                            <View style={{ height: 148, backgroundColor: '#F4F6FA', overflow: 'hidden' }}>
                              <ProductImage product={product} height={148} bottomRadius={0} />
                              <StoreProductCardQuantityControl product={product} closedSize={38} />

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
                                  <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '800' }}>
                                    {product.badge}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </Pressable>
                          <Pressable onPress={() => onProductPress?.(product.handle)}>
                            <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 24 }}>
                              <View style={{ minHeight: STORE_BUNDLE_CARD_BODY_MIN_HEIGHT }}>
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '900', textAlign: 'right' }}>
                                    {formatOcdPrice(product.price)}
                                  </Text>
                                  {!!product.compareAtPrice && (
                                    <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', textDecorationLine: 'line-through' }}>
                                      {formatOcdPrice(product.compareAtPrice)}
                                    </Text>
                                  )}
                                </View>
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
                                {!!product.subtitle ? (
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}
                                  >
                                    {product.subtitle}
                                  </Text>
                                ) : (
                                  <View style={{ marginTop: 2, height: 14 }} />
                                )}
                              </View>
                            </View>
                          </Pressable>
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            bottom: -14,
                            left: 0,
                            right: 0,
                            alignItems: 'center',
                            zIndex: 10,
                          }}
                        >
                          <OcdPlusFloatingBadge
                            regularPrice={product.price}
                            isSubscriber={isOcdPlusSubscriber}
                            onPress={onOcdPlusSubscribePress}
                          />
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* טאבי המבצעים / הכי נמכרים / חדשים + גריד מוצרים — מתחת למארזי ניקיון, בתחתית התוכן */}
            <View style={{ marginTop: 28 }}>
              <HomeHighlightTabsStrip homeTab={homeTab} onTabChange={setHomeTab} />

              {SHOW_PROMO_CAROUSEL && <PromoCarousel />}

              {homeTabLoading ? (
                <View
                  style={{
                    backgroundColor: '#F8F8F8',
                    borderRadius: 16,
                    padding: 18,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <ActivityIndicator color="#111827" />
                  <Text style={{ color: '#111827', fontWeight: '700' }}>טוען מוצרים...</Text>
                </View>
              ) : !!homeHighlightProducts.length ? (
                <View style={{ gap: 14, marginTop: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      flexWrap: 'wrap',
                      alignItems: 'stretch',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    {homeHighlightProducts.map((product) => (
                      <View
                        key={`home-highlight-${homeTab}-${product.id}`}
                        style={{
                          width: '48%',
                          alignSelf: 'stretch',
                          marginBottom: 18,
                          borderRadius: 18,
                          ...storeProductCardShadowStyle,
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                            borderRadius: 18,
                            overflow: 'hidden',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <Pressable onPress={() => onProductPress?.(product.handle)}>
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

                              {/* Favorite — כמו בעמוד קטגוריה */}
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

                              {/* Badge — מתחת ללב */}
                              {!!product.badge && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: 48,
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
                          </Pressable>

                          <View style={{ flex: 1, minHeight: 0 }}>
                            <Pressable
                              onPress={() => onProductPress?.(product.handle)}
                              style={{ flex: 1 }}
                            >
                              <View
                                style={{
                                  flex: 1,
                                  paddingHorizontal: 12,
                                  paddingTop: 10,
                                  paddingBottom: 26,
                                  justifyContent: 'flex-start',
                                }}
                              >
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <Text
                                    style={{
                                      color: '#111827',
                                      fontSize: 16,
                                      fontWeight: '900',
                                      textAlign: 'right',
                                    }}
                                  >
                                    {formatOcdPrice(product.price)}
                                  </Text>
                                  {!!product.compareAtPrice && (
                                    <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through' }}>
                                      {formatOcdPrice(product.compareAtPrice)}
                                    </Text>
                                  )}
                                </View>
                                <Text
                                  numberOfLines={2}
                                  style={{
                                    color: '#111827',
                                    fontSize: 13,
                                    lineHeight: 18,
                                    fontWeight: '700',
                                    textAlign: 'right',
                                    marginTop: 4,
                                  }}
                                >
                                  {product.name}
                                </Text>
                                {!!product.subtitle ? (
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}
                                  >
                                    {product.subtitle}
                                  </Text>
                                ) : (
                                  <View style={{ marginTop: 2, height: 14 }} />
                                )}
                              </View>
                            </Pressable>
                          </View>
                        </View>

                        {/* ── Floating OCD+ badge ── */}
                        <View
                          style={{
                            position: 'absolute',
                            bottom: -16,
                            left: 0,
                            right: 0,
                            alignItems: 'center',
                            zIndex: 10,
                          }}
                        >
                          <OcdPlusFloatingBadge
                            regularPrice={product.price}
                            isSubscriber={isOcdPlusSubscriber}
                            onPress={onOcdPlusSubscribePress}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : !loading ? (
                <View
                  style={{
                    backgroundColor: '#F8F8F8',
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'flex-end',
                    marginTop: 12,
                  }}
                >
                  <Text style={{ color: '#111827', fontWeight: '800' }}>לא נמצאו מוצרים להצגה כאן כרגע</Text>
                </View>
              ) : null}
            </View>

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
        <StoreFloatingTabBar activeTab={activeBottomTab} onTabPress={handleBottomTabPress} />
        <OcdPlusSubscribeSheet
          visible={ocdPlusSubscribeSheetOpen}
          onClose={() => setOcdPlusSubscribeSheetOpen(false)}
          isSubscriber={isOcdPlusSubscriber}
        />
      </View>
    </View>
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
  isOcdPlusSubscriber = false,
  onOcdPlusSubscribePress,
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
  isOcdPlusSubscriber?: boolean;
  onOcdPlusSubscribePress?: () => void;
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
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(STORE_CATEGORY_ALL_SUBS_ID);
  const [subcategoryStripOpen, setSubcategoryStripOpen] = useState(true);
  /** תתי־קטגוריות עם מוצר בלבד; null = בודקים מול Shopify */
  const [visibleSubcategories, setVisibleSubcategories] = useState<StoreSubcategory[] | null>(null);

  const subcategoryListKey = useMemo(
    () =>
      (subcategories?.length ? `${STORE_CATEGORY_ALL_SUBS_ID}\0` : '') + (subcategories?.map((s) => s.id).join('\0') ?? ''),
    [subcategories],
  );

  const subcategoriesWithAll = useMemo((): StoreSubcategory[] => {
    const rows = visibleSubcategories ?? [];
    if (!rows.length) return [];
    return [
      {
        id: STORE_CATEGORY_ALL_SUBS_ID,
        title: 'הכל',
        parentTitle: categoryTitle,
        imageUrl: null,
      },
      ...rows,
    ];
  }, [visibleSubcategories, categoryTitle]);

  useLayoutEffect(() => {
    setSelectedSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
    setSubcategoryStripOpen(true);
    setVisibleSubcategories(null);
  }, [categoryId]);

  useEffect(() => {
    if (!subcategories?.length) {
      setVisibleSubcategories([]);
      return;
    }
    let cancelled = false;
    setVisibleSubcategories(null);
    const subs = subcategories;
    void (async () => {
      try {
        const flags = await Promise.all(subs.map((s) => fetchCollectionHasProducts(s.id)));
        if (!cancelled) setVisibleSubcategories(subs.filter((_, i) => flags[i]));
      } catch {
        if (!cancelled) setVisibleSubcategories(subs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, subcategoryListKey]);

  useEffect(() => {
    if (visibleSubcategories === null) {
      setSubcategoryPreviewUrls({});
      return;
    }
    if (!visibleSubcategories.length) {
      setSubcategoryPreviewUrls({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const next: Record<string, string | undefined> = {};
      await Promise.all(
        visibleSubcategories.map(async (sub) => {
          if (sub.imageUrl) {
            next[sub.id] = sub.imageUrl;
            return;
          }
          try {
            const img = await fetchCollectionImage(sub.id);
            next[sub.id] = img ?? undefined;
          } catch {
            next[sub.id] = undefined;
          }
        }),
      );
      for (const sub of visibleSubcategories) {
        const overrideUri = resolveFeaturedBrandPreviewUri(sub.title);
        if (overrideUri) next[sub.id] = overrideUri;
      }
      if (!cancelled) {
        let allPreview: string | undefined;
        for (const sub of visibleSubcategories) {
          const u = next[sub.id];
          if (u) { allPreview = u; break; }
        }
        next[STORE_CATEGORY_ALL_SUBS_ID] = allPreview ?? undefined;
        setSubcategoryPreviewUrls(next);
      }
    })();

    return () => { cancelled = true; };
  }, [subcategoryListKey, visibleSubcategories]);

  useEffect(() => {
    if (visibleSubcategories === null) return;
    if (
      selectedSubcategoryId !== STORE_CATEGORY_ALL_SUBS_ID &&
      !visibleSubcategories.some((s) => s.id === selectedSubcategoryId)
    ) {
      setSelectedSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
    }
  }, [visibleSubcategories, selectedSubcategoryId]);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      if (visibleSubcategories === null && subcategories?.length) {
        setLoading(true);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (!subcategories?.length) {
          const collectionProducts = await fetchCollectionProducts(categoryId);
          if (!isMounted) return;
          setProducts(collectionProducts.map((product, index) => toStoreProduct(product, index, categoryTitle, categoryId)));
          return;
        }

        const subs = visibleSubcategories ?? [];
        if (!subs.length) {
          const collectionProducts = await fetchCollectionProducts(categoryId);
          if (!isMounted) return;
          setProducts(collectionProducts.map((product, index) => toStoreProduct(product, index, categoryTitle, categoryId)));
          return;
        }

        if (selectedSubcategoryId === STORE_CATEGORY_ALL_SUBS_ID) {
          const handles = [categoryId, ...subs.map((s) => s.id)];
          const buckets = await Promise.all(handles.map((h) => fetchCollectionProducts(h)));
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
          const collectionProducts = await fetchCollectionProducts(selectedSubcategoryId);
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
  }, [categoryId, categoryTitle, selectedSubcategoryId, subcategories, subcategoryListKey, visibleSubcategories]);

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
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
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
          style={{ flex: 1, backgroundColor: '#F5F5F5' }}
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
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 48,
                  }}
                >
                  <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="חיפוש בתוך תת הקטגוריה"
                    placeholderTextColor="#B7BDC8"
                    style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 13, backgroundColor: 'transparent' }}
                  />
                </View>
                {subcategoriesWithAll.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubcategoryStripOpen((open) => !open);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={subcategoryStripOpen ? 'הסתר תתי קטגוריה' : 'הצג תתי קטגוריה'}
                    hitSlop={6}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F3F4F6',
                      borderWidth: 1,
                      borderColor: subcategoryStripOpen ? '#D1D5DB' : '#E8ECF2',
                    }}
                  >
                    <Ionicons
                      name="funnel-outline"
                      size={22}
                      color="#111827"
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {subcategoryStripOpen && subcategoriesWithAll.length > 0 ? (
              <View style={{ marginHorizontal: -16 }}>
                <StoreSubcategoryCircleStrip
                  items={subcategoriesWithAll}
                  selectedId={selectedSubcategoryId}
                  onSelect={setSelectedSubcategoryId}
                  previewUrls={subcategoryPreviewUrls}
                />
              </View>
            ) : null}

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
                alignItems: 'stretch',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              {filteredProducts.map((product) => (
                <View
                  key={`category-${product.id}`}
                  style={{
                    width: '48%',
                    alignSelf: 'stretch',
                    marginBottom: 18,
                    borderRadius: 18,
                    ...storeProductCardShadowStyle,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Pressable onPress={() => onOpenProduct?.(product)}>
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
                    </Pressable>

                    <View style={{ flex: 1, minHeight: 0 }}>
                      <Pressable onPress={() => onOpenProduct?.(product)} style={{ flex: 1 }}>
                        <View
                          style={{
                            flex: 1,
                            paddingHorizontal: 12,
                            paddingTop: 10,
                            paddingBottom: 26,
                            justifyContent: 'flex-start',
                          }}
                        >
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text
                              style={{
                                color: '#111827',
                                fontSize: 16,
                                fontWeight: '900',
                                textAlign: 'right',
                              }}
                            >
                              {formatOcdPrice(product.price)}
                            </Text>
                            {!!product.compareAtPrice && (
                              <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through' }}>
                                {formatOcdPrice(product.compareAtPrice)}
                              </Text>
                            )}
                          </View>
                          <Text
                            numberOfLines={2}
                            style={{
                              color: '#111827',
                              fontSize: 13,
                              lineHeight: 18,
                              fontWeight: '700',
                              textAlign: 'right',
                              marginTop: 4,
                            }}
                          >
                            {product.name}
                          </Text>
                          {!!product.subtitle ? (
                            <Text
                              numberOfLines={1}
                              style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}
                            >
                              {product.subtitle}
                            </Text>
                          ) : (
                            <View style={{ marginTop: 2, height: 14 }} />
                          )}
                        </View>
                      </Pressable>
                    </View>
                  </View>

                  {/* ── Floating OCD+ badge ── */}
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -16,
                      left: 0,
                      right: 0,
                      alignItems: 'center',
                      zIndex: 10,
                    }}
                  >
                    <OcdPlusFloatingBadge
                      regularPrice={product.price}
                      isSubscriber={isOcdPlusSubscriber}
                      onPress={onOcdPlusSubscribePress}
                    />
                  </View>
                </View>
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
        <StoreFloatingTabBar activeTab={null} onTabPress={onTabPress} />
      </View>
    </View>
  );
}

export function StoreProductScreen({
  onBack,
  onOpenCart,
  product,
  onTabPress,
  isOcdPlusSubscriber = false,
  onOcdPlusSubscribePress,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  product: StoreProduct;
  onTabPress: (tabId: StoreBottomTabId) => void;
  isOcdPlusSubscriber?: boolean;
  onOcdPlusSubscribePress?: () => void;
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
              <View style={{ alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
                <OcdPlusProductPriceBlock
                  regularPrice={product.price}
                  isOcdPlusSubscriber={isOcdPlusSubscriber}
                  onSubscribePress={onOcdPlusSubscribePress}
                  titleSize={26}
                  variant="onDark"
                />
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
