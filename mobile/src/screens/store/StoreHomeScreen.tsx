import { storeAccent } from '../../theme/storeAccent';
import { radii } from '../../theme/radii';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  type LayoutChangeEvent,
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
import { ArrowLeft, Coins, Heart, House, Menu, Search, ShoppingCart, UserRound } from 'lucide-react-native';
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
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { useStoreResources } from '../../hooks/useStoreResources';
import {
  findMenuItemByCollectionHandle,
  type CollectionProductsSortKey,
  type ShopifyCollection,
  type ShopifyMenuItem,
  type ShopifyProduct,
} from '../../lib/shopify';
import { navLinksToShopifyMenuItems } from '../../lib/shopMenu';
import { getFeaturedBannerMobileUrl } from '../../lib/collections';
import { CatalogFilterSheet } from '../../components/CatalogFilterSheet';
import { EMPTY_CATALOG_FILTERS, countCatalogFilters, filterCatalogProducts, type CatalogFilters } from '../../lib/catalogFilters';
import { ProductCardQuantityControl } from '../../components/ProductCardQuantityControl';
import { ProductBrandBadge } from '../../components/ProductBrandBadge';
import { REMOTE_BRANDS_QUERY_KEY, useBrands } from '../../hooks/useBrands';
import { SHOP_MENU_QUERY_KEY, useShopMenu } from '../../hooks/useShopMenu';
import { HOME_CATEGORY_COVERS_QUERY_KEY, useHomeCategoryCovers } from '../../hooks/useHomeCategoryCovers';
import { SITE_HOME_EXPERIENCE_QUERY_KEY } from '../../hooks/useSiteHomeExperience';
import { HomeShoppingFeed } from '../../components/HomeShoppingFeed';
import { HomeSearchResults } from '../../components/HomeSearchResults';
import { useHomeProductSearch } from '../../hooks/useHomeProductSearch';
import { isPurchasable, needsVariantSelection } from '../../lib/homeShoppingFeed';
import { homeStickySearchOffset } from '../../lib/homeStickySearch';
import { SitePromoPopup } from '../../components/SitePromoPopup';
import type { SiteLinkTarget } from '../../lib/siteHomeContent';
import { HomeBrandsCarousel } from '../../components/HomeBrandsCarousel';
import type { RemoteBrand } from '../../lib/brands';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { StoreSideMenu, type StoreSideMenuHandle, type StoreSideMenuSection } from '../../components/StoreSideMenu';
import { favoriteInputFromStoreProduct } from '../../lib/favorites';
import { STORE_CATALOG_KEY, storeCatalogOptions } from '../../lib/storeCatalog';
import {
  OcdPlusProductPriceBlock,
  OcdPlusCardPriceBar,
  formatOcdPrice,
} from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { OcdPlusHomeBanner } from '../../components/OcdPlusHomeBanner';
import { showToast } from '../../components/toast/Toast';
import { useOcdPlusSubscribeSheet } from '../../context/OcdPlusSubscribeSheetContext';
import { safeNavigate } from '../../navigation/navigationRef';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import { homeTypography } from '../../theme/homeTypography';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';

export type StoreCategory = {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string | null;
};

export type StoreSubcategory = {
  id: string;
  title: string;
  description?: string;
  parentTitle?: string;
  imageUrl?: string | null;
};

type SidebarMenuSection = StoreSideMenuSection;
type SidebarChildItem = NonNullable<StoreSideMenuSection['children']>[number];

/** Virtual strip chip: merged products from parent collection + every child */
const STORE_CATEGORY_ALL_SUBS_ID = '__all_subcategories__';
const EMPTY_SUBCATEGORIES: StoreSubcategory[] = [];

export type StoreProduct = {
  id: string;
  name: string;
  productType?: string;
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
  variantCount?: number;
  hasAvailableVariant?: boolean;
  availableForSale: boolean;
  vendor: string | null;
  tags: string[];
  collectionHandles: string[];
  collectionTitles: string[];
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

export type StoreBottomTabId = 'home' | 'ocdPlus' | 'favorites' | 'search' | 'profile';
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

/** Product grid under category circles on store home. */
const STORE_HOME_CATEGORY_PREVIEW_LIMIT = 6;

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
    productType: normalizedProductType,
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
    variantCount: product.variants?.length,
    hasAvailableVariant: product.variants?.length ? product.variants.some(variant => variant.availableForSale) : undefined,
    availableForSale: product.availableForSale,
    vendor: product.vendor ?? null,
    tags: product.tags ?? [],
    collectionHandles: product.collectionHandles ?? [],
    collectionTitles: product.collectionTitles ?? [],
  };
}

export function ProductImage({
  product,
  height,
  topRadius = radii.surface,
  bottomRadius = radii.surface,
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
          borderRadius: radii.surface,
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
              borderRadius: radii.pill,
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
        borderRadius: radii.surface,
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
            paddingHorizontal: 16,
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
                      borderRadius: radii.pill,
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
                        borderRadius: radii.pill,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? '#334155' : '#E7ECF3',
                        padding: 3,
                        backgroundColor: 'transparent',
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: radii.pill,
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

function renderBottomNavIcon(itemId: StoreBottomTabId, isActive: boolean) {
  const color = isActive ? storeAccent.iconOnPrimary : '#8A8A8A';
  if (itemId === 'ocdPlus') {
    return <OcdPlusMark size={30} variant="glyph" color={isActive ? color : '#111111'} />;
  }
  const Icon = itemId === 'home' ? House : itemId === 'favorites' ? Heart : itemId === 'search' ? Search : UserRound;
  return <Icon size={22} strokeWidth={1.7} color={color} />;
}

/** Shared accent for the selected bottom tab. */
export const STORE_FLOATING_TAB_ACTIVE_BUBBLE_BG = storeAccent.primary;

function AnimatedStoreTabButton({
  focused,
  onPress,
  icon,
  label,
  accessibilityRole = 'tab',
}: {
  focused: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  accessibilityRole?: 'tab' | 'button';
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
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      hitSlop={{ top: 6, bottom: 6 }}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: radii.nested,
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
  const bottomBarHeight = 56; // 44-point targets + 10-point padding + 2-point border.

  return {
    bottomBarInset,
    bottomBarOffset,
    bottomBarHeight,
    contentPaddingBottom: bottomBarHeight + bottomBarOffset + 12,
  };
}

function StoreBottomNavigationMenu({
  menuRef,
  onTabPress,
}: {
  menuRef: React.RefObject<StoreSideMenuHandle | null>;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const { data: navLinks } = useShopMenu();
  const { data: brands = [] } = useBrands();
  const menuItems = useMemo(() => navLinksToShopifyMenuItems(navLinks), [navLinks]);
  const sections = useMemo(() => {
    const items = buildSidebarSectionsFromMenu(menuItems);
    return items.length > 1 ? items.filter(section => section.categoryId !== 'all') : items;
  }, [menuItems]);
  const subcategories = useMemo(() => getTopLevelCategoryChildrenMap(menuItems), [menuItems]);

  return (
    <StoreSideMenu
      ref={menuRef}
      sections={sections}
      brands={brands}
      onSearchPress={() => onTabPress('search')}
      onProfilePress={() => onTabPress('profile')}
      onFavoritesPress={() => onTabPress('favorites')}
      onPressSection={section => {
        if (!section.categoryId) return;
        const item = findMenuItemByCollectionHandle(menuItems, section.categoryId);
        safeNavigate('StoreCategory', {
          categoryId: section.categoryId,
          categoryTitle: section.title,
          categoryDescription: item?.collectionDescription,
          subcategories: subcategories[section.categoryId],
        });
      }}
      onPressChild={(section, child) => safeNavigate('StoreCategory', {
        categoryId: child.categoryId,
        categoryTitle: child.title,
        categoryDescription: child.categoryDescription,
        parentTitle: child.parentTitle ?? section.title,
      })}
      onPressBrand={brand => safeNavigate('StoreCategory', {
        categoryId: brand.handle,
        categoryTitle: brand.label,
        parentTitle: 'חברות נבחרות',
      })}
    />
  );
}

export function StoreFloatingTabBar({
  activeTab,
  onTabPress,
  onMenuPress,
  onCartPress,
}: {
  activeTab: StoreBottomTabId | null;
  onTabPress: (tabId: StoreBottomTabId) => void;
  onMenuPress?: () => void;
  onCartPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { bottomBarOffset } = getStoreBottomBarMetrics(insets.bottom);
  const menuRef = useRef<StoreSideMenuHandle>(null);
  const { itemCount } = useCart();

  return (
    <>
    {!onMenuPress ? <StoreBottomNavigationMenu menuRef={menuRef} onTabPress={onTabPress} /> : null}
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
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          backgroundColor: '#FFFFFF',
          borderRadius: radii.pill,
          padding: 5,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: '#ECECEC',
          shadowColor: '#000000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <AnimatedStoreTabButton
          label="דף הבית"
          focused={activeTab === 'home'}
          onPress={() => onTabPress('home')}
          icon={renderBottomNavIcon('home', activeTab === 'home')}
        />
        <AnimatedStoreTabButton
          label="המועדפים שלי"
          focused={activeTab === 'favorites'}
          onPress={() => onTabPress('favorites')}
          icon={renderBottomNavIcon('favorites', activeTab === 'favorites')}
        />
        <AnimatedStoreTabButton
          label={`עגלת קניות, ${itemCount} פריטים`}
          accessibilityRole="button"
          focused={false}
          onPress={() => onCartPress ? onCartPress() : safeNavigate('StoreCart')}
          icon={<StoreCartIcon itemCount={itemCount} />}
        />
        <AnimatedStoreTabButton
          label="פתיחת תפריט"
          accessibilityRole="button"
          focused={false}
          onPress={() => onMenuPress ? onMenuPress() : menuRef.current?.open()}
          icon={<Menu size={22} strokeWidth={1.7} color="#8A8A8A" />}
        />
      </View>

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: radii.pill,
          padding: 4,
          borderWidth: 1,
          borderColor: '#ECECEC',
          shadowColor: '#000000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <AnimatedStoreTabButton
          label="האזור האישי"
          focused={activeTab === 'profile' || activeTab === 'ocdPlus'}
          onPress={() => onTabPress('profile')}
          icon={renderBottomNavIcon('profile', activeTab === 'profile' || activeTab === 'ocdPlus')}
        />
      </View>
    </View>
    </>
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

/** Short section titles keep the products in focus. */
const HOME_HIGHLIGHT_SECTIONS = [
  { id: 'recommended' as const, title: 'הכי נמכרים', subtitle: '' },
  { id: 'sale' as const, title: 'שווה להכיר', subtitle: 'המבצעים שלנו, במקום אחד' },
  { id: 'new' as const, title: 'חדשים על המדף', subtitle: '' },
] as const;

type HomeHighlightSectionConfig = (typeof HOME_HIGHLIGHT_SECTIONS)[number];

const HOME_NEW_HIGHLIGHT_SECTION = HOME_HIGHLIGHT_SECTIONS.find((section) => section.id === 'new')!;
const HOME_MAIN_HIGHLIGHT_SECTIONS = HOME_HIGHLIGHT_SECTIONS.filter((section) => section.id !== 'new');

/** כרטיס מוצר אופקי לקרוסלות הסקשנים — אותו עיצוב כמו כרטיסי «מארזי ניקיון» */
export function HomeHighlightRailCard({
  product,
  cardWidth,
  remoteBrands,
  isOcdPlusSubscriber,
  favorite,
  favoritePending,
  onPress,
  onToggleFavorite,
  onOpenOcdPlusSheet,
  onChooseVariant,
  canChooseVariant,
}: {
  product: StoreProduct;
  cardWidth?: number;
  remoteBrands: RemoteBrand[];
  isOcdPlusSubscriber: boolean;
  favorite: boolean;
  favoritePending: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onOpenOcdPlusSheet: () => void;
  onChooseVariant?: () => void;
  canChooseVariant?: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = cardWidth ?? Math.min(216, Math.max(178, Math.round(screenWidth * 0.51)));
  const discountPct = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;

  return (
    <View style={[homeProductStyles.card, { width }]}>
      <View style={homeProductStyles.surface}>
        <View style={homeProductStyles.imageArea}>
          <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={product.name} style={homeProductStyles.imageLink}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} resizeMode="contain" accessibilityLabel={product.imageAltText ?? product.name} style={homeProductStyles.image} />
            ) : <Ionicons name="image-outline" size={40} color="#C7C9CC" />}
          </Pressable>
          <View style={homeProductStyles.favorite}>
            <FavoriteToggleButton active={favorite} loading={favoritePending} onPress={onToggleFavorite} size={32} />
          </View>
          <ProductBrandBadge product={product} brands={remoteBrands} size={34} bottom={8} right={8} imageOnly />
          {discountPct > 0 ? <View style={homeProductStyles.discount}><Text style={homeProductStyles.discountText}>{discountPct}% הנחה</Text></View> : null}
          <ProductCardQuantityControl product={product} onChooseVariant={onChooseVariant} canChooseVariant={canChooseVariant} />
        </View>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={'פרטי ' + product.name} style={homeProductStyles.body}>
          <View style={homeProductStyles.priceRow}>
            <Text numberOfLines={1} style={homeProductStyles.price}>{formatOcdPrice(product.price)}</Text>
            {discountPct > 0 ? <Text numberOfLines={1} style={homeProductStyles.oldPrice}>{formatOcdPrice(product.compareAtPrice!)}</Text> : null}
          </View>
          <Text numberOfLines={2} style={homeProductStyles.name}>{product.name}</Text>
          <Text numberOfLines={1} style={homeProductStyles.subtitle}>{product.availableForSale ? product.subtitle : 'אזל מהמלאי'}</Text>
        </Pressable>
        <View style={{ zIndex: 40 }}>
          <OcdPlusCardPriceBar regularPrice={product.price} isSubscriber={isOcdPlusSubscriber} onPress={onOpenOcdPlusSheet} subtle />
        </View>
      </View>
    </View>
  );
}

function HomeProductSectionHeading({ title, subtitle, onShowAll }: { title: string; subtitle: string; onShowAll?: () => void }) {
  return (
    <View style={homeProductStyles.heading}>
      {subtitle ? <Text style={homeTypography.title}>{title}</Text> : null}
      <View style={homeProductStyles.headingRow}>
        <Text style={[subtitle ? homeTypography.subtitle : homeTypography.title, { flex: 1 }]}>{subtitle || title}</Text>
        {onShowAll ? <Pressable onPress={onShowAll} accessibilityRole="button" accessibilityLabel={`הצג הכל — ${title}`} style={homeProductStyles.showAllTouch} hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}>
          {({ pressed }) => <View style={[homeProductStyles.showAll, pressed && homeProductStyles.showAllPressed]}>
            <Text style={homeProductStyles.showAllText}>הצג הכל</Text>
            <ArrowLeft size={12} strokeWidth={1.4} color="#858585" />
          </View>}
        </Pressable> : null}
      </View>
    </View>
  );
}

const homeProductStyles = StyleSheet.create({
  card: { borderRadius: radii.surface, marginBottom: 4, direction: 'ltr', backgroundColor: '#FFFFFF', shadowColor: '#1C252B', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  surface: { borderRadius: radii.surface, borderWidth: 1, borderColor: '#F0F0F0', backgroundColor: '#FFFFFF' },
  imageArea: { height: 174, borderTopLeftRadius: radii.surface, borderTopRightRadius: radii.surface, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  imageLink: { flex: 1, paddingHorizontal: 22, paddingTop: 42, paddingBottom: 12, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  favorite: { position: 'absolute', top: 8, right: 8 },
  discount: { position: 'absolute', bottom: 12, left: 12, borderRadius: radii.badge, backgroundColor: storeAccent.soft, paddingHorizontal: 7, paddingVertical: 4 },
  discountText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: storeAccent.ink },
  body: { paddingHorizontal: 13, paddingTop: 5, paddingBottom: 14, gap: 6 },
  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, height: 24 },
  price: { color: storeAccent.ink, fontSize: 17, lineHeight: 24, fontWeight: '700', writingDirection: 'ltr', flexShrink: 1 },
  oldPrice: { color: '#96999D', fontSize: 11, textDecorationLine: 'line-through', writingDirection: 'ltr', flexShrink: 1 },
  name: { color: '#303236', fontSize: 14, lineHeight: 20, fontWeight: '500', textAlign: 'right', writingDirection: 'rtl', height: 40 },
  subtitle: { color: '#898C90', fontSize: 11, lineHeight: 16, height: 16, textAlign: 'right', writingDirection: 'rtl' },
  heading: { marginBottom: 16, gap: 4 },
  headingRow: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  showAllTouch: { minHeight: 20, justifyContent: 'center', flexShrink: 0 },
  showAll: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 20 },
  showAllText: { color: '#858585', fontSize: 11, lineHeight: 16, fontWeight: '400', writingDirection: 'rtl', includeFontPadding: false },
  showAllPressed: { opacity: 0.55 },
});

/** סקשן שלם בסגנון האתר: eyebrow + כותרת גדולה + קרוסלה אופקית */
function HomeHighlightRailSection({
  section,
  topSpacing = 36,
  onShowAll,
  products,
  remoteBrands,
  isOcdPlusSubscriber,
  onProductPress,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
  onOpenOcdPlusSheet,
}: {
  section: HomeHighlightSectionConfig;
  topSpacing?: number;
  onShowAll: () => void;
  products: StoreProduct[];
  remoteBrands: RemoteBrand[];
  isOcdPlusSubscriber: boolean;
  onProductPress?: (handle: string) => void;
  isFavorite: (productId: string) => boolean;
  isFavoritePending: (productId: string) => boolean;
  onToggleFavorite: (product: StoreProduct) => void;
  onOpenOcdPlusSheet: () => void;
}) {
  if (!products.length) return null;

  return (
    <View style={{ marginTop: topSpacing }}>
      <HomeProductSectionHeading title={section.title} subtitle={section.subtitle} onShowAll={onShowAll} />

      <FlatList
        horizontal
        inverted
        data={products}
        keyExtractor={product => product.id}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -12, direction: 'ltr' }}
        contentContainerStyle={{
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 12,
          paddingBottom: 12,
        }}

        renderItem={({ item: product }) => (
          <HomeHighlightRailCard
            key={`${section.id}-${product.id}`}
            product={product}
            remoteBrands={remoteBrands}
            isOcdPlusSubscriber={isOcdPlusSubscriber}
            favorite={isFavorite(product.id)}
            favoritePending={isFavoritePending(product.id)}
            onPress={() => onProductPress?.(product.handle)}
            onChooseVariant={needsVariantSelection(product) ? () => onProductPress?.(product.handle) : undefined}
            canChooseVariant={isPurchasable(product)}
            onToggleFavorite={() => onToggleFavorite(product)}
            onOpenOcdPlusSheet={onOpenOcdPlusSheet}
          />
        )}
      />
    </View>
  );
}

function HomeBundlesRailSection({
  onShowAll,
  products,
  loading,
  remoteBrands,
  isOcdPlusSubscriber,
  onProductPress,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
  onOpenOcdPlusSheet,
}: {
  onShowAll: () => void;
  products: StoreProduct[];
  loading: boolean;
  remoteBrands: RemoteBrand[];
  isOcdPlusSubscriber: boolean;
  onProductPress?: (handle: string) => void;
  isFavorite: (productId: string) => boolean;
  isFavoritePending: (productId: string) => boolean;
  onToggleFavorite: (product: StoreProduct) => void;
  onOpenOcdPlusSheet: () => void;
}) {
  if (!loading && !products.length) return null;

  return (
    <View style={{ marginTop: 36 }}>
      <HomeProductSectionHeading title="ביחד זה משתלם" subtitle="" onShowAll={onShowAll} />

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color="#111827" />
        </View>
      ) : (
        <FlatList
          horizontal
          inverted
          data={products}
          keyExtractor={product => product.id}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          windowSize={3}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -12, direction: 'ltr' }}
          contentContainerStyle={{
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 12,
            paddingBottom: 12,
          }}

          renderItem={({ item: product }) => (
            <HomeHighlightRailCard
              key={`bundle-${product.id}`}
              product={product}
              remoteBrands={remoteBrands}
              isOcdPlusSubscriber={isOcdPlusSubscriber}
              favorite={isFavorite(product.id)}
              favoritePending={isFavoritePending(product.id)}
              onPress={() => onProductPress?.(product.handle)}
              onToggleFavorite={() => onToggleFavorite(product)}
              onOpenOcdPlusSheet={onOpenOcdPlusSheet}
            />
          )}
        />
      )}
    </View>
  );
}

/** Bento: חוזר 2 → 3 → 2 (בלי שורת full-width).
 * בשורות עם 2 כרטיסים — אחד צר (~40%) ואחד רחב (~60%); השורה השנייה במחזור משקפת.
 */
const HOME_CATEGORY_HANDLE_OVERRIDES: Record<
  string,
  {
    label: string;
    localCover?: number;
    subcategories?: ReadonlyArray<{ id: string; title: string }>;
  }
> = {
  'בישום-חללים': { label: 'בישום חללים', localCover: require('../../../assets/cat-1.webp') },
  'חומרי-ניקיון': { label: 'מוצרי ניקיון', localCover: require('../../../assets/cat-6.webp') },
  'מרככי-כביסה-וטקסטיל': { label: 'מרככי כביסה וטקסטיל', localCover: require('../../../assets/cat-3.webp') },
  'אביזרי-נקיון': { label: 'אביזרי ניקיון', localCover: require('../../../assets/cat-5.webp') },
  'עיצוב-הבית': { label: 'עיצוב הבית', localCover: require('../../../assets/cat-4.webp') },
  'מבצעי-פסח': { label: 'מארזים משתלמים', localCover: require('../../../assets/cat-2.webp') },
  'מארזי-ניקיון-משתלמים-copy': { label: 'מוצרים לבית', localCover: require('../../../assets/cat-7.webp') },
};

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

/** קטגוריות בפריסת Bento — מתחת ל«חברות נבחרות»; טאבי המבצעים/הכי נמכרים/חדשים בתחתית הדף */
function HomeOurCategoriesSection({
  categories,
  mergeFromCategories,
  coverUrlByCategoryId,
  websiteCoverByCategoryId,
  subcategoriesByCategory,
  onOpenCategory,
}: {
  categories: StoreCategory[];
  /** רשימת הקטגוריות המלאה מהחנות — לאיחוד imageUrl כשקיים בשורש הקולקציה אך לא בתפריט העליון */
  mergeFromCategories: StoreCategory[];
  /** תמונות שהושלמו מ־Shopify כשחסרה תמונה בתפריט / במטא */
  coverUrlByCategoryId: Record<string, string>;
  /** תמונות bento עדכניות מדף הבית באתר */
  websiteCoverByCategoryId: Record<string, string>;
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

  /** «טואלטיקה»/«מוצרים לבית» (שורת זוג צרה לצד «מארזים משתלמים» הרחב). */
  const isToiletriesCategory = (category: StoreCategory) => {
    if (category.id === 'מארזי-ניקיון-משתלמים-copy') return true;
    const n = normalizeCategoryTitle(category.name);
    return n.includes('טואל') || n.includes('טואלי');
  };
  /** «מארזי ניקיון משתלמים»/«מארזים משתלמים» (כרטיס רחב לצד טואלטיקה). */
  const isBundlesCategory = (category: StoreCategory) => {
    if (category.id === 'מבצעי-פסח') return true;
    const n = normalizeCategoryTitle(category.name);
    return n.includes('מארז') && (n.includes('ניקיון') || n.includes('משתלמ'));
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

    const hasToiletries = groupItems.some((c) => isToiletriesCategory(c));
    const hasBundles = groupItems.some((c) => isBundlesCategory(c));
    if (hasToiletries && hasBundles) {
      const thisItem = groupItems[itemIndex]!;
      return isToiletriesCategory(thisItem) ? narrowPairW : widePairW;
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
            style={[homeTypography.title, { textAlign: 'center', flexShrink: 1 }]}
          >
            הקטגוריות שלנו
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
        </View>
        <Text
          style={[homeTypography.subtitle, { textAlign: 'center', marginTop: 4, paddingHorizontal: 8 }]}
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
            group.items.some((c) => isToiletriesCategory(c)) &&
            group.items.some((c) => isBundlesCategory(c));
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

                const websiteCover = websiteCoverByCategoryId[category.id];
                const coverUri =
                  websiteCover ??
                  category.imageUrl ??
                  mergeFromCategories.find((c) => c.id === category.id)?.imageUrl ??
                  coverUrlByCategoryId[category.id];

                const localCover = websiteCover ? undefined : HOME_CATEGORY_HANDLE_OVERRIDES[category.id]?.localCover;

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
                        borderRadius: radii.surface,
                        ...storeProductCardShadowStyle,
                      }}
                    >
                      <View
                        style={{
                          width: cardW,
                          height: cardTotalH,
                          borderRadius: radii.surface,
                          overflow: 'hidden',
                          backgroundColor: '#F0F2F5',
                        }}
                      >
                        {localCover ? (
                          <Image
                            source={localCover}
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

const homeHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 6,
  },
  actions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  actionTouch: { width: 44, height: 44 },
  action: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.10)', transform: [{ scale: 0.98 }] },
  announcement: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#292929',
    paddingHorizontal: 18,
    paddingVertical: 5,
  },
  announcementText: {
    color: '#E4E4E4',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  search: {
    marginHorizontal: 18,
    marginBottom: 10,
    height: 44,
    borderRadius: radii.compact,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  stickySearch: { height: 54, backgroundColor: '#000000', zIndex: 20, elevation: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  statusBarBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#000000', zIndex: 30, elevation: 9 },
  searchText: { flex: 1, color: '#77736D', fontSize: 13, textAlign: 'right', writingDirection: 'rtl' },
  searchInput: { flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, color: '#202020', fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  clearSearch: { width: 36, height: '100%', alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
});

export function StoreHomeScreen({
  onProfilePress,
  onFavoritesPress,
  onSearchPress,
  onProductPress,
  onOpenCart,
  onOpenProduct,
  onOpenCategory,
  isOcdPlusSubscriber = false,
  initialTab,
  initialTabRequestId,
}: {
  onProfilePress: () => void;
  onFavoritesPress?: () => void;
  onSearchPress?: () => void;
  isOcdPlusSubscriber?: boolean;
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
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const homeScrollY = useSharedValue(0);
  const homeSearchY = useSharedValue(-1);
  const stickySearchProgress = useDerivedValue(() => Math.min(1,
    homeStickySearchOffset(homeScrollY.value, homeSearchY.value, insets.top) / 48,
  ), [insets.top]);
  const stickySearchStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: homeStickySearchOffset(homeScrollY.value, homeSearchY.value, insets.top) }],
    backgroundColor: interpolateColor(stickySearchProgress.value, [0, 1], ['#000000', '#EFEFED']),
    borderBottomLeftRadius: 18 * stickySearchProgress.value,
    borderBottomRightRadius: 18 * stickySearchProgress.value,
    shadowOpacity: 0.12 * stickySearchProgress.value,
  }), [insets.top]);
  const homeSafeAreaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(stickySearchProgress.value, [0, 1], ['#000000', '#EFEFED']),
  }));
  const stickySearchFieldStyle = useAnimatedStyle(() => ({
    height: 44 - 4 * stickySearchProgress.value,
    marginTop: 2 * stickySearchProgress.value,
    marginHorizontal: 18 + 6 * stickySearchProgress.value,
    borderRadius: radii.compact + (22 - radii.compact) * stickySearchProgress.value,
    backgroundColor: '#FFFFFF',
  }));
  const homeViewportHeight = useSharedValue(0);
  const homeContentY = useSharedValue(-1);
  const bannerViewport = useMemo(() => ({
    scrollY: homeScrollY, height: homeViewportHeight, contentY: homeContentY,
  }), [homeScrollY, homeViewportHeight, homeContentY]);
  const onHomeScroll = useAnimatedScrollHandler(event => {
    homeScrollY.value = event.contentOffset.y;
    homeViewportHeight.value = event.layoutMeasurement.height;
  });
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<StoreProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([{ id: 'all', name: 'כל המוצרים' }]);
  const queryClient = useQueryClient();
  const { fetchProducts, fetchCollectionProducts, fetchCollections, fetchCollectionImage, fetchNewestProducts, refresh: refreshResources } = useStoreResources();
  const { data: remoteBrands = [], isLoading: brandsLoading } = useBrands();
  const [menuItems, setMenuItems] = useState<ShopifyMenuItem[]>([]);
  const { data: navLinks } = useShopMenu();
  const { data: websiteCategoryCovers = {} } = useHomeCategoryCovers();
  const shopMenuItems = useMemo(() => navLinksToShopifyMenuItems(navLinks), [navLinks]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [bundleProducts, setBundleProducts] = useState<StoreProduct[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [homeTabProducts, setHomeTabProducts] = useState<Record<'recommended' | 'sale' | 'new', StoreProduct[]>>({
    recommended: [],
    sale: [],
    new: [],
  });
  const [homeTabLoading, setHomeTabLoading] = useState(false);
  /** כיסויי תמונה לקטגוריות (השלמה מ־API כשאין image בתפריט) */
  const [homeCategoryCoverUrls, setHomeCategoryCoverUrls] = useState<Record<string, string>>({});
  const [selectedHomeSubcategoryId, setSelectedHomeSubcategoryId] = useState<string>(STORE_CATEGORY_ALL_SUBS_ID);
  /** תתי־קטגוריות מהתפריט המרוחק */
  const [homeSubcategoryPreviewUrls, setHomeSubcategoryPreviewUrls] = useState<Record<string, string | undefined>>({});
  const menuRef = useRef<StoreSideMenuHandle>(null);
  const [homeStripSubcategoryPreviewUrls, setHomeStripSubcategoryPreviewUrls] = useState<
    Record<string, string | undefined>
  >({});
  const [homeStripExpandedCategoryId, setHomeStripExpandedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const homeSearch = useHomeProductSearch(query, toStoreProduct);
  const homeScrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const homeSubcategoryTabsRef = useRef<ScrollView | null>(null);
  const searchInputRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const storefrontMountedRef = useRef(true);
  const [activePrimaryTab, setActivePrimaryTab] = useState<StoreMainTabId>('home');
  const lastHandledInitialTabRequestIdRef = useRef<number | undefined>(undefined);
  const storefrontLoadedOnceRef = useRef(false);

  const activeBottomTab = useMemo<StoreBottomTabId>(() => {
    if (activePrimaryTab === 'search') return 'search';
    return 'home';
  }, [activePrimaryTab]);
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (!shopMenuItems.length) return;
    setMenuItems(shopMenuItems);
    setCategories(flattenMenuCategories(shopMenuItems));
  }, [shopMenuItems]);

  const loadStorefrontData = useCallback(async (mode: 'initial' | 'refocus' | 'pull', isCancelled: () => boolean) => {
    try {
      if (mode === 'pull') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);

      setError(null);
      if (mode === 'pull') {
        await refreshResources();
        void queryClient.invalidateQueries({ queryKey: STORE_CATALOG_KEY, refetchType: 'none' });
        void queryClient.invalidateQueries({ queryKey: SHOP_MENU_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: REMOTE_BRANDS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: HOME_CATEGORY_COVERS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: SITE_HOME_EXPERIENCE_QUERY_KEY });
      }
      // Menu data already contains categories; don't wait for a redundant list.
      // A missing fallback category response must not discard loaded products.
      if (!shopMenuItems.length) {
        void fetchCollections().then(liveCollections => {
          if (isCancelled()) return;
          setCategories([{ id: 'all', name: 'כל המוצרים' }, ...liveCollections.map((collection: ShopifyCollection) => ({
            id: collection.handle, name: collection.title, subtitle: collection.description, imageUrl: collection.imageUrl,
          }))]);
        }).catch(() => { /* Product content stays available if category metadata fails. */ });
      }
      const liveProducts = await queryClient.fetchQuery(storeCatalogOptions(queryClient));

      if (isCancelled()) return;
      const mappedProducts = liveProducts.map((product, index) => toStoreProduct(product, index));

      setAllProducts(mappedProducts);
      setVisibleProducts(mappedProducts);
      setFeaturedProducts(mappedProducts.slice(0, 2));
      if (shopMenuItems.length) setCategories(flattenMenuCategories(shopMenuItems));
      storefrontLoadedOnceRef.current = true;
    } catch (err) {
      if (isCancelled()) return;
      setAllProducts([]);
      setVisibleProducts([]);
      setFeaturedProducts([]);
      setCategories([{ id: 'all', name: 'כל המוצרים' }]);
      setMenuItems([]);
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת מוצרים');
    } finally {
      if (mode === 'pull') setRefreshing(false);
      else if (mode === 'initial') setLoading(false);
    }
  }, [queryClient, shopMenuItems, fetchCollections, refreshResources]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isCancelled = () => cancelled;
      const mode = storefrontLoadedOnceRef.current ? 'refocus' : 'initial';
      void loadStorefrontData(mode, isCancelled);
      return () => {
        cancelled = true;
      };
    }, [loadStorefrontData]),
  );

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
    menuRef.current?.close();
  };

  const sidebarSections = useMemo(
    () => (menuItems.length ? buildSidebarSectionsFromMenu(menuItems) : buildSidebarSections(categories)),
    [categories, menuItems]
  );
  const navMenuSections = useMemo(
    () => sidebarSections.filter((section) => section.id !== 'all' && section.categoryId !== 'all'),
    [sidebarSections],
  );
  const topLevelCategories = useMemo(
    () => (menuItems.length ? getTopLevelMenuCategories(menuItems) : categories.filter((category) => category.id !== 'all')),
    [categories, menuItems]
  );
  const topLevelCategoryChildrenMap = useMemo(() => getTopLevelCategoryChildrenMap(menuItems), [menuItems]);

  const topLevelCategoriesBento = useMemo(
    () => swapFragranceAndFabricForBento(swapToiletriesAndBundlesForBento(topLevelCategories)),
    [topLevelCategories],
  );

  const openSiteTarget = useCallback(
    (target: SiteLinkTarget, title?: string) => {
      if (target.type === 'product') {
        onProductPress?.(target.handle);
        return;
      }
      const menuItem = findMenuItemByCollectionHandle(shopMenuItems, target.handle);
      onOpenCategory?.({
        id: target.handle,
        title: menuItem?.title || title || 'קטגוריה',
        description: menuItem?.collectionDescription,
      });
    },
    [onOpenCategory, onProductPress, shopMenuItems],
  );

  const handleOpenBrand = useCallback(
    (brand: RemoteBrand) => {
      onOpenCategory?.({
        id: brand.handle,
        title: brand.label,
        parentTitle: 'חברות נבחרות',
      });
    },
    [onOpenCategory],
  );

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
          const websiteCover = websiteCategoryCovers[cat.id];
          if (websiteCover) {
            next[cat.id] = websiteCover;
            return;
          }
          const bannerUrl = getFeaturedBannerMobileUrl(cat.id);
          if (bannerUrl) {
            next[cat.id] = bannerUrl;
            return;
          }
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
  }, [topLevelCategoryListKey, topLevelCategories, categories, websiteCategoryCovers]);
  const selectedCategoryDirectSubcategories = useMemo(
    () => topLevelCategoryChildrenMap[selectedCategory] ?? [],
    [selectedCategory, topLevelCategoryChildrenMap],
  );
  const effectiveHomeDirectSubcategories = useMemo((): StoreSubcategory[] => {
    if (selectedCategory === 'all') return [];
    return selectedCategoryDirectSubcategories;
  }, [selectedCategory, selectedCategoryDirectSubcategories]);

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
  /** מוצרים לשלושת סקשני הקרוסלות; «הכי נמכרים» נופל חזרה לקטלוג הכללי אם הטעינה הייעודית נכשלה */
  const homeSectionProducts = useMemo(
    () => ({
      recommended: (homeTabProducts.recommended.length ? homeTabProducts.recommended : allProducts).slice(
        0,
        HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT,
      ),
      sale: homeTabProducts.sale.slice(0, HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT),
      new: homeTabProducts.new.slice(0, HOME_HIGHLIGHT_TAB_PRODUCT_LIMIT),
    }),
    [homeTabProducts, allProducts],
  );

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

  /**
   * טעינה עצלה של תצוגות מקדימות לתתי־קטגוריות ברצועת העיגולים שמעל הבנטו.
   * נטען רק כשהמשתמש מרחיב קטגוריה (חיסכון בקריאות API), והתוצאות נשמרות בקאש.
   */
  useEffect(() => {
    if (!homeStripExpandedCategoryId) return;
    const subs = topLevelCategoryChildrenMap[homeStripExpandedCategoryId];
    if (!subs?.length) return;
    /** דילוג אם כל התתי־קטגוריות כבר נטענו (גם undefined נחשב כנטען — כדי לא לבקש שוב) */
    if (subs.every((s) => Object.prototype.hasOwnProperty.call(homeStripSubcategoryPreviewUrls, s.id))) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string | undefined> = {};
      await Promise.all(
        subs.map(async (sub) => {
          if (Object.prototype.hasOwnProperty.call(homeStripSubcategoryPreviewUrls, sub.id)) return;
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
      for (const sub of subs) {
        const overrideUri = resolveFeaturedBrandPreviewUri(sub.title);
        if (overrideUri) next[sub.id] = overrideUri;
      }
      if (!cancelled && Object.keys(next).length) {
        setHomeStripSubcategoryPreviewUrls((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [homeStripExpandedCategoryId, topLevelCategoryChildrenMap, homeStripSubcategoryPreviewUrls]);

  useEffect(() => {
    if (!effectiveHomeDirectSubcategories.length) return;
    if (
      selectedHomeSubcategoryId !== STORE_CATEGORY_ALL_SUBS_ID &&
      !effectiveHomeDirectSubcategories.some((s) => s.id === selectedHomeSubcategoryId)
    ) {
      setSelectedHomeSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
    }
  }, [effectiveHomeDirectSubcategories, selectedHomeSubcategoryId]);

  const handleMenuSearchPress = useCallback(() => {
    if (onSearchPress) {
      searchInputRef.current?.blur();
      onSearchPress();
      return;
    }
    setActivePrimaryTab('search');
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [onSearchPress]);

  const handleMenuSectionPress = useCallback(
    (section: StoreSideMenuSection) => {
      if (!section.categoryId) return;

      if (section.categoryId !== 'all' && onOpenCategory) {
        menuRef.current?.close();
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
    },
    [categories, onOpenCategory, topLevelCategories, topLevelCategoryChildrenMap],
  );

  const handleMenuChildPress = useCallback(
    (
      section: StoreSideMenuSection,
      child: NonNullable<StoreSideMenuSection['children']>[number],
    ) => {
      if (onOpenCategory) {
        menuRef.current?.close();
        onOpenCategory({
          id: child.categoryId,
          title: child.title,
          description: child.categoryDescription,
          parentTitle: child.parentTitle ?? section.title,
        });
        return;
      }

      selectCategoryFromMenu(child.categoryId);
    },
    [onOpenCategory],
  );

  useEffect(() => {
    if (!initialTabRequestId || lastHandledInitialTabRequestIdRef.current === initialTabRequestId) {
      return;
    }

    lastHandledInitialTabRequestIdRef.current = initialTabRequestId;

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
      if (selectedCategory === 'all') {
        setVisibleProducts(allProducts);
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

        setVisibleProducts(mappedProducts);
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
    selectedCategory,
    selectedCategoryName,
    selectedHomeSubcategoryId,
    topLevelCategoryChildrenMap,
  ]);

  const renderHighlightSection = (section: HomeHighlightSectionConfig) => (
    <HomeHighlightRailSection
      key={section.id}
      section={section}
      topSpacing={section.id === 'recommended' ? 16 : 36}
      onShowAll={() => {
        const id = section.id === 'recommended' ? HOME_TAB_RECOMMENDED_HANDLE : HOME_TAB_NEW_HANDLE;
        if (onOpenCategory) onOpenCategory({ id, title: section.title });
        else safeNavigate('StoreCategory', { categoryId: id, categoryTitle: section.title });
      }}
      products={homeTabProducts[section.id]}
      remoteBrands={remoteBrands}
      isOcdPlusSubscriber={isOcdPlusSubscriber}
      onProductPress={handle => {
        const product = homeTabProducts[section.id].find(item => item.handle === handle);
        if (onProductPress) onProductPress(handle);
        else if (onOpenProduct && product) onOpenProduct(product);
        else safeNavigate('Product', { handle });
      }}
      isFavorite={isFavorite}
      isFavoritePending={isFavoritePending}
      onToggleFavorite={product => { void toggleFavorite(favoriteInputFromStoreProduct(product)); }}
      onOpenOcdPlusSheet={openOcdPlusSubscribeSheet}
    />
  );

  const homeHeaderGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'בוקר טוב';
    if (h < 17) return 'צהריים טובים';
    return 'ערב טוב';
  }, []);

  const handleBottomTabPress = (itemId: StoreBottomTabId) => {
    if (itemId === 'home') {
      setQuery('');
      setActivePrimaryTab('home');
      searchInputRef.current?.blur();
      setSelectedCategory('all');
      return;
    }

    if (itemId === 'ocdPlus') {
      menuRef.current?.close();
      searchInputRef.current?.blur();
      openOcdPlusSubscribeSheet();
      return;
    }

    if (itemId === 'search') {
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
      searchInputRef.current?.blur();
      onFavoritesPress?.();
      return;
    }

    if (itemId === 'profile') {
      searchInputRef.current?.blur();
      onProfilePress();
      return;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StoreSideMenu
          ref={menuRef}
          sections={navMenuSections}
          onPressSection={handleMenuSectionPress}
          onPressChild={handleMenuChildPress}
          onSearchPress={handleMenuSearchPress}
          onProfilePress={onProfilePress}
          onFavoritesPress={onFavoritesPress}
          brands={remoteBrands}
          onPressBrand={handleOpenBrand}
        />

        <Animated.ScrollView
          ref={homeScrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={onHomeScroll}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          onLayout={event => { homeViewportHeight.value = event.nativeEvent.layout.height; }}
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={{
            paddingBottom: contentPaddingBottom,
            flexGrow: 1,
            backgroundColor: colors.bg,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { void loadStorefrontData('pull', () => false); }}
              progressViewOffset={insets.top}
              tintColor="#111827"
              colors={['#111827']}
            />
          }
          {...(Platform.OS === 'ios'
            ? { contentInsetAdjustmentBehavior: 'never' as const }
            : {})}
        >
          {/* Announcement and logo scroll with the storefront. */}
          <View style={{ backgroundColor: '#000000', paddingTop: insets.top }}>
            <View style={homeHeaderStyles.announcement}>
              <Text style={homeHeaderStyles.announcementText}>
                {isOcdPlusSubscriber ? 'משלוח חינם לחברי OCD+ בהזמנות מעל 149₪' : 'משלוחים חינם בהזמנות מעל 299₪'}
              </Text>
            </View>
            <View style={homeHeaderStyles.row}>
              <Image
                source={require('../../../assets/logopng/OCDLOGO-04.png')}
                resizeMode="contain"
                accessibilityLabel="OCD"
                style={{ width: 52, height: 38, tintColor: '#FFFFFF' }}
              />
              <View style={homeHeaderStyles.actions}>
                <Pressable
                  onPress={openOcdPlusSubscribeSheet}
                  accessibilityRole="button"
                  accessibilityLabel="מועדון OCD+"
                  style={homeHeaderStyles.actionTouch}
                >
                  {({ pressed }) => (
                    <View style={[homeHeaderStyles.action, pressed && homeHeaderStyles.actionPressed]}>
                      <OcdPlusMark size={27} variant="glyph" color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => showToast({
                    key: 'coins-coming-soon',
                    title: 'המטבעות מגיעים בקרוב',
                    subtitle: 'הפיצ׳ר עדיין לא זמין — נעדכן כשהוא ייפתח.',
                  })}
                  accessibilityRole="button"
                  accessibilityLabel="מטבעות — בקרוב"
                  accessibilityHint="מציג הודעה על הפיצ׳ר שיגיע בהמשך"
                  style={homeHeaderStyles.actionTouch}
                >
                  {({ pressed }) => (
                    <View style={[homeHeaderStyles.action, pressed && homeHeaderStyles.actionPressed]}>
                      <Coins size={23} color="#E3C584" strokeWidth={1.7} />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
          <Animated.View
            collapsable={false}
            onLayout={event => { homeSearchY.value = event.nativeEvent.layout.y; }}
            style={[homeHeaderStyles.stickySearch, stickySearchStyle]}
          >
            <Animated.View style={[homeHeaderStyles.search, stickySearchFieldStyle]}>
              <Search size={18} color="#55524D" strokeWidth={1.5} />
              <TextInput
                ref={searchInputRef}
                value={query}
                onChangeText={setQuery}
                onFocus={() => homeScrollRef.current?.scrollTo({ y: Math.max(0, homeSearchY.value - insets.top), animated: true })}
                placeholder="מה מחפשים לבית?"
                placeholderTextColor="#77736D"
                accessibilityLabel="חיפוש מוצרים בדף הבית"
                returnKeyType="search"
                autoCorrect={false}
                onSubmitEditing={() => Keyboard.dismiss()}
                style={homeHeaderStyles.searchInput}
              />
              {query ? <Pressable onPress={() => { setQuery(''); searchInputRef.current?.focus(); }} accessibilityRole="button" accessibilityLabel="ניקוי החיפוש" style={homeHeaderStyles.clearSearch}><Ionicons name="close" size={19} color="#777777" /></Pressable> : null}
            </Animated.View>
          </Animated.View>
          {homeSearch.needle ? <HomeSearchResults
            query={homeSearch.needle}
            products={homeSearch.products}
            loading={homeSearch.loading}
            error={homeSearch.error}
            onRetry={() => { void homeSearch.retry(); }}
            onClear={() => setQuery('')}
            renderProduct={product => {
              const open = () => {
                Keyboard.dismiss();
                if (onProductPress) onProductPress(product.handle);
                else if (onOpenProduct) onOpenProduct(product);
                else safeNavigate('Product', { handle: product.handle });
              };
              return <HomeHighlightRailCard
                product={product} cardWidth={(windowWidth - 42) / 2} remoteBrands={remoteBrands}
                isOcdPlusSubscriber={isOcdPlusSubscriber}
                favorite={isFavorite(product.id)} favoritePending={isFavoritePending(product.id)}
                onPress={open} onToggleFavorite={() => { void toggleFavorite(favoriteInputFromStoreProduct(product)); }}
                onOpenOcdPlusSheet={openOcdPlusSubscribeSheet}
                onChooseVariant={needsVariantSelection(product) ? open : undefined}
                canChooseVariant={isPurchasable(product)}
              />;
            }}
          /> : <HomeShoppingFeed
            renderProduct={(product, onOpen) => <HomeHighlightRailCard
              product={product}
              cardWidth={(windowWidth - 42) / 2}
              remoteBrands={remoteBrands}
              isOcdPlusSubscriber={isOcdPlusSubscriber}
              favorite={isFavorite(product.id)}
              favoritePending={isFavoritePending(product.id)}
              onPress={onOpen}
              onToggleFavorite={() => { void toggleFavorite(favoriteInputFromStoreProduct(product)); }}
              onOpenOcdPlusSheet={openOcdPlusSubscribeSheet}
              onChooseVariant={needsVariantSelection(product) ? onOpen : undefined}
              canChooseVariant={isPurchasable(product)}
            />}
            sale={{ id: HOME_TAB_SALE_HANDLE, title: 'המבצעים שלנו', products: homeTabProducts.sale }}
            popular={{ id: HOME_TAB_RECOMMENDED_HANDLE, title: 'הכי נמכרים', products: homeTabProducts.recommended }}
            newest={{ id: HOME_TAB_NEW_HANDLE, title: 'חדש אצלנו', products: homeTabProducts.new }}
            catalog={allProducts}
            categories={topLevelCategories.map(category => ({
              id: category.id,
              title: category.name,
            }))}
            loading={loading || homeTabLoading}
            error={error}
            onRetry={() => void loadStorefrontData('pull', () => false)}
            onOpenProduct={product => {
              if (onProductPress) onProductPress(product.handle);
              else if (onOpenProduct) onOpenProduct(product);
              else safeNavigate('Product', { handle: product.handle });
            }}
            onOpenCollection={(id, title) => {
              if (onOpenCategory) onOpenCategory({ id, title });
              else safeNavigate('StoreCategory', { categoryId: id, categoryTitle: title });
            }}
          />}
          <SitePromoPopup onOpenTarget={openSiteTarget} />

          {!homeSearch.needle && <View
            onLayout={event => { homeContentY.value = event.nativeEvent.layout.y; }}
            style={{
              flexGrow: 1,
              gap: 0,
              paddingHorizontal: STORE_HOME_SCROLL_PADDING_H,
              paddingTop: 4,
              backgroundColor: colors.bg,
            }}
          >
            {/* ─── OCD+ promotional banner ── */}
            {!loading && (
              <OcdPlusHomeBanner
                viewport={bannerViewport}
                width={windowWidth}
                edgeBleed={STORE_HOME_SCROLL_PADDING_H}
                isSubscriber={isOcdPlusSubscriber}
                onPress={openOcdPlusSubscribeSheet}
              />
            )}



            <HomeBrandsCarousel
              brands={remoteBrands}
              loading={brandsLoading && remoteBrands.length === 0}
              edgeBleed={STORE_HOME_SCROLL_PADDING_H}
              onOpenBrand={handleOpenBrand}
            />

            {!loading && HOME_HIGHLIGHT_SECTIONS.filter(section => section.id === 'new').map(renderHighlightSection)}

                {!loading && (
                  <HomeBundlesRailSection
                    onShowAll={() => {
                      if (onOpenCategory) onOpenCategory({ id: BUNDLES_COLLECTION_HANDLE, title: 'ביחד זה משתלם' });
                      else safeNavigate('StoreCategory', { categoryId: BUNDLES_COLLECTION_HANDLE, categoryTitle: 'ביחד זה משתלם' });
                    }}
                    products={displayBundleProducts}
                    loading={bundlesLoading}
                    remoteBrands={remoteBrands}
                    isOcdPlusSubscriber={isOcdPlusSubscriber}
                    onProductPress={onProductPress}
                    isFavorite={isFavorite}
                    isFavoritePending={isFavoritePending}
                    onToggleFavorite={(product) => {
                      void toggleFavorite(favoriteInputFromStoreProduct(product));
                    }}
                    onOpenOcdPlusSheet={openOcdPlusSubscribeSheet}
                  />
                )}
          </View>}
        </Animated.ScrollView>
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={[homeHeaderStyles.statusBarBackdrop, { height: insets.top }, homeSafeAreaStyle]}
        />
        <StoreFloatingTabBar
          activeTab={activeBottomTab}
          onTabPress={handleBottomTabPress}
          onMenuPress={() => menuRef.current?.open()}
          onCartPress={onOpenCart}
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
  subcategories?: StoreSubcategory[];
}) {
  const { fetchProducts, fetchCollectionProducts, fetchNewestProducts } = useStoreResources();
  const { data: remoteBrands = [] } = useBrands();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const productListRef = useRef<FlatList<StoreProduct>>(null);
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(STORE_CATEGORY_ALL_SUBS_ID);
  const visibleSubcategories = subcategories ?? EMPTY_SUBCATEGORIES;
  const subcategoryListKey = visibleSubcategories.map(sub => sub.id).join('|');
  const columns = width >= 700 ? 3 : width >= 350 ? 2 : 1;
  const cardWidth = Math.floor((width - 32 - (columns - 1) * 10) / columns);
  const filterCount = countCatalogFilters(filters);

  useLayoutEffect(() => {
    setSelectedSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
    setQuery('');
    setFilters({ ...EMPTY_CATALOG_FILTERS, vendors: [] });
    setFilterOpen(false);
  }, [categoryId]);

  useEffect(() => {
    if (selectedSubcategoryId !== STORE_CATEGORY_ALL_SUBS_ID && !visibleSubcategories.some(sub => sub.id === selectedSubcategoryId)) setSelectedSubcategoryId(STORE_CATEGORY_ALL_SUBS_ID);
  }, [subcategoryListKey, selectedSubcategoryId]);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        /* מזהים לוגיים מהסקשנים בעמוד הבית — לא קולקציות אמיתיות ב-Shopify */
        if (categoryId === HOME_TAB_RECOMMENDED_HANDLE || categoryId === HOME_TAB_NEW_HANDLE) {
          const pseudoProducts =
            categoryId === HOME_TAB_RECOMMENDED_HANDLE
              ? await fetchProducts()
              : await fetchNewestProducts();
          if (!isMounted) return;
          setProducts(pseudoProducts.map((product, index) => toStoreProduct(product, index, categoryTitle, categoryId)));
          return;
        }

        if (!subcategories?.length) {
          const collectionProducts = await fetchCollectionProducts(categoryId);
          if (!isMounted) return;
          setProducts(collectionProducts.map((product, index) => toStoreProduct(product, index, categoryTitle, categoryId)));
          return;
        }

        const subs = visibleSubcategories;
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
  }, [categoryId, categoryTitle, selectedSubcategoryId, subcategories, subcategoryListKey, reload]);


  const filteredProducts = useMemo(() => filterCatalogProducts(products, query, filters), [products, query, filters]);
  const reset = () => { setFilters({ ...EMPTY_CATALOG_FILTERS, vendors: [] }); setQuery(''); };

  return (
    <View style={categoryStyles.root}>
      <View style={[categoryStyles.header, { paddingTop: insets.top + 4 }]}>
        <View style={categoryStyles.nav}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="חזרה" style={categoryStyles.iconButton}><Ionicons name="arrow-forward" size={21} color="#202124" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={categoryStyles.title}>{categoryTitle}</Text>
          </View>
          {onOpenCart ? <CategoryCartButton onOpenCart={onOpenCart} /> : <View style={{ width: 44 }} />}
        </View>
      </View>

      <FlatList
        ref={productListRef}
        key={categoryId + ':' + selectedSubcategoryId + ':' + columns}
        data={loading || error ? [] : filteredProducts}
        keyExtractor={product => product.id}
        numColumns={columns}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: contentPaddingBottom + 20 }}
        columnWrapperStyle={columns > 1 ? { flexDirection: 'row-reverse', gap: 10 } : undefined}
        ItemSeparatorComponent={CategoryRowSeparator}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={<View>
          {parentTitle && parentTitle !== categoryTitle ? <Text style={categoryStyles.eyebrow}>{parentTitle}</Text> : null}
          <View style={categoryStyles.search}>
            <Ionicons name="search-outline" size={19} color="#85888C" />
            <TextInput value={query} onChangeText={setQuery} placeholder="מה מחפשים בקטגוריה?" placeholderTextColor="#94979B" accessibilityLabel="חיפוש בקטגוריה" returnKeyType="search" style={categoryStyles.searchInput} />
            {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="ניקוי החיפוש" style={categoryStyles.clear}><Ionicons name="close-circle" size={18} color="#94979B" /></Pressable> : null}
            <Pressable onPress={() => setFilterOpen(true)} disabled={loading || Boolean(error)} accessibilityRole="button" accessibilityLabel={filterCount > 0 ? `סינון ומיון, ${filterCount} מסננים פעילים` : 'פתיחת סינון ומיון'} accessibilityState={{ disabled: loading || Boolean(error), expanded: filterOpen }} style={[categoryStyles.filterButton, filterCount > 0 && categoryStyles.filterSelected, (loading || Boolean(error)) && { opacity: 0.4 }]}>
              <Ionicons name="options-outline" size={20} color={filterCount > 0 ? '#FFFFFF' : '#303236'} />
              {filterCount > 0 ? <View style={categoryStyles.filterBadge}><Text style={categoryStyles.filterBadgeText}>{filterCount}</Text></View> : null}
            </Pressable>
          </View>
          <View style={categoryStyles.toolbar}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <Text accessibilityLiveRegion="polite" style={categoryStyles.count}>{loading ? 'טוענים…' : error ? '' : filteredProducts.length + ' מוצרים'}</Text>
              {filterCount > 0 ? <Pressable onPress={() => setFilters({ ...EMPTY_CATALOG_FILTERS, vendors: [] })} accessibilityRole="button" style={categoryStyles.reset}><Text style={categoryStyles.resetText}>ניקוי</Text></Pressable> : null}
            </View>
          </View>
          {visibleSubcategories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, direction: 'rtl' }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {[{ id: STORE_CATEGORY_ALL_SUBS_ID, title: 'הכל' }, ...visibleSubcategories].map(sub => <Pressable key={sub.id} onPress={() => setSelectedSubcategoryId(sub.id)} accessibilityRole="button" accessibilityState={{ selected: selectedSubcategoryId === sub.id }} style={[categoryStyles.categoryChip, selectedSubcategoryId === sub.id && categoryStyles.categoryChipSelected]}><Text style={[categoryStyles.categoryChipText, selectedSubcategoryId === sub.id && { color: '#FFFFFF' }]}>{sub.title}</Text></Pressable>)}
          </ScrollView> : null}
        </View>}
        renderItem={({ item: product }) => <HomeHighlightRailCard
          product={product} cardWidth={cardWidth} remoteBrands={remoteBrands}
          isOcdPlusSubscriber={isOcdPlusSubscriber}
          favorite={isFavorite(product.id)} favoritePending={isFavoritePending(product.id)}
          onPress={() => onOpenProduct?.(product)}
          onToggleFavorite={() => { void toggleFavorite(favoriteInputFromStoreProduct(product)); }}
          onOpenOcdPlusSheet={openOcdPlusSubscribeSheet}
        />}
        ListEmptyComponent={<View style={categoryStyles.empty}>
          {loading ? <><ActivityIndicator color="#202124" /><Text style={categoryStyles.emptyText}>מכינים את המוצרים בשבילכם…</Text></> : error ? <>
            <Ionicons name="cloud-offline-outline" size={32} color="#94979B" /><Text style={categoryStyles.emptyTitle}>לא הצלחנו לטעון את המוצרים</Text><Pressable onPress={() => setReload(v => v + 1)} style={categoryStyles.emptyButton} accessibilityRole="button"><Text style={categoryStyles.filterText}>ניסיון נוסף</Text></Pressable>
          </> : <>
            <Ionicons name="search-outline" size={32} color="#94979B" /><Text style={categoryStyles.emptyTitle}>לא מצאנו מוצרים מתאימים</Text><Text style={categoryStyles.emptyText}>{query || filterCount ? 'אפשר לשנות את החיפוש או לנקות את הסינון.' : 'מוצרים חדשים יופיעו כאן בהמשך.'}</Text>
            {query || filterCount ? <Pressable onPress={reset} style={categoryStyles.emptyButton} accessibilityRole="button"><Text style={categoryStyles.filterText}>ניקוי חיפוש וסינון</Text></Pressable> : null}
          </>}
        </View>}
      />
      <StoreFloatingTabBar activeTab={null} onTabPress={onTabPress} />
      <CatalogFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={next => { setFilters(next); setFilterOpen(false); productListRef.current?.scrollToOffset({ offset: 0, animated: false }); }} products={products} query={query} />
    </View>
  );
}

function CategoryRowSeparator() { return <View style={{ height: 12 }} />; }

const categoryStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  nav: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingBottom: 8 },
  iconButton: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: '#202124', textAlign: 'center' },
  eyebrow: { fontSize: 11, lineHeight: 16, color: '#909397', textAlign: 'right', marginBottom: 8 },
  cartCount: { position: 'absolute', top: -1, right: -2, minWidth: 17, height: 17, borderRadius: radii.compact, paddingHorizontal: 4, backgroundColor: '#202124', alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  search: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minHeight: 52, paddingRight: 14, paddingLeft: 4, paddingVertical: 4, borderRadius: radii.surface, backgroundColor: '#F5F5F5' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, color: '#202124', fontSize: 14, textAlign: 'right' },
  clear: { minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', minHeight: 34, paddingVertical: 4, gap: 8 },
  filterButton: { width: 44, height: 44, flexShrink: 0, borderRadius: radii.nested, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  filterSelected: { backgroundColor: '#202124', borderColor: '#202124' },
  filterBadge: { position: 'absolute', top: -3, left: -3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: radii.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#202124', alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: '#202124', fontSize: 10, fontWeight: '700' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#303236' },
  count: { fontSize: 12, color: '#85888C' },
  reset: { minHeight: 36, justifyContent: 'center' },
  resetText: { fontSize: 12, color: '#737373', textDecorationLine: 'underline' },
  categoryChip: { minHeight: 40, paddingHorizontal: 15, borderRadius: radii.pill, backgroundColor: '#F5F5F5', justifyContent: 'center' },
  categoryChipSelected: { backgroundColor: '#202124' },
  categoryChipText: { fontSize: 13, color: '#54565A', textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20, gap: 14 },
  emptyTitle: { fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#303236', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 21, color: '#85888C', textAlign: 'center' },
  emptyButton: { minHeight: 46, paddingHorizontal: 20, borderRadius: radii.surface, backgroundColor: '#F0F0F0', justifyContent: 'center', marginTop: 4 },
});

export function StoreProductScreen({
  onBack,
  onOpenCart,
  product,
  onTabPress,
  isOcdPlusSubscriber = false,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  product: StoreProduct;
  onTabPress: (tabId: StoreBottomTabId) => void;
  isOcdPlusSubscriber?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { addItem, itemCount, getQuantity, isMutating } = useCart();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const { data: remoteBrands = [] } = useBrands();
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
              borderRadius: radii.surface,
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
                  borderRadius: radii.pill,
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
                  borderRadius: radii.pill,
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
                      borderRadius: radii.compact,
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
                borderRadius: radii.surface,
                backgroundColor: '#FFFFFF',
                padding: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <ProductImage product={product} height={320} />
              <ProductBrandBadge
                product={product}
                brands={remoteBrands}
                size={42}
                bottom={14}
                right={14}
              />
            </View>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: radii.surface,
              padding: 18,
              gap: 16,
            }}
          >
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              {!!product.badge && (
                <View
                  style={{
                    borderRadius: radii.pill,
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
                borderRadius: radii.surface,
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
                  onSubscribePress={openOcdPlusSubscribeSheet}
                  titleSize={26}
                  variant="onDark"
                />
                <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>כולל תצוגה ישירה מהקטלוג שלך</Text>
              </View>

              <View
                style={{
                  borderRadius: radii.pill,
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
                  borderRadius: radii.pill,
                  backgroundColor: '#F8F5EF',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#9A6B16', fontWeight: '800', fontSize: 11 }}>קטלוג החנות</Text>
              </View>
              <View
                style={{
                  borderRadius: radii.pill,
                  backgroundColor: '#EEF6F1',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#2F6F49', fontWeight: '800', fontSize: 11 }}>עמוד מוצר מעוצב</Text>
              </View>
              <View
                style={{
                  borderRadius: radii.pill,
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
              borderRadius: radii.surface,
              padding: 18,
              gap: 12,
            }}
          >
            <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'right' }}>למה זה נראה טוב יותר</Text>
            <View
              style={{
                borderRadius: radii.surface,
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
                borderRadius: radii.surface,
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
              borderRadius: radii.surface,
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

function StoreCartIcon({ itemCount }: { itemCount: number }) {
  return (
    <View style={{ position: 'relative' }}>
      <ShoppingCart size={22} color="#8A8A8A" strokeWidth={1.7} />
      {itemCount > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -6,
            right: -8,
            minWidth: 17,
            height: 17,
            paddingHorizontal: itemCount > 9 ? 4 : 0,
            borderRadius: radii.compact,
            backgroundColor: '#262626',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900' }}>
            {itemCount > 99 ? '99+' : itemCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CategoryCartButton({ onOpenCart }: { onOpenCart: () => void }) {
  const { itemCount } = useCart();
  return (
    <Pressable onPress={onOpenCart} accessibilityRole="button" accessibilityLabel={'עגלת קניות, ' + itemCount + ' פריטים'} style={categoryStyles.iconButton}>
      <ShoppingCart size={20} color="#202124" strokeWidth={1.7} />
      {itemCount > 0 ? <View style={categoryStyles.cartCount}><Text style={categoryStyles.cartCountText}>{itemCount}</Text></View> : null}
    </Pressable>
  );
}
