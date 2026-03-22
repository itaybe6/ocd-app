import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchMenuItems,
  fetchProducts,
  type ShopifyCollection,
  type ShopifyMenuItem,
  type ShopifyProduct,
} from '../../lib/shopify';
import { useCart } from '../../state/CartContext';

type StoreCategory = {
  id: string;
  name: string;
  subtitle?: string;
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
  }>;
};

type SidebarChildItem = NonNullable<SidebarMenuSection['children']>[number];

export type StoreProduct = {
  id: string;
  name: string;
  subtitle: string;
  categoryId: string;
  price: number;
  handle: string;
  description: string;
  badge?: string;
  featured?: boolean;
  coverColor: string;
  accentColor: string;
  imageUrl: string | null;
  imageAltText: string | null;
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
  { id: 'home', label: 'בית', icon: '⌂' },
  { id: 'menu', label: 'תפריט', icon: '≡' },
  { id: 'admin', label: 'ניהול', icon: '⌘' },
] as const;

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

function formatPrice(price: number) {
  return `₪${price.toLocaleString('he-IL')}.00`;
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
  if (index === 0) return 'SALE';
  if (index === 1) return 'NEW';
  return undefined;
}

function toStoreProduct(product: ShopifyProduct, index: number): StoreProduct {
  const palette = getProductPalette(index);

  return {
    id: product.id,
    name: product.title,
    subtitle: product.productType || 'מוצר מהקטלוג',
    categoryId: product.productType || 'all',
    price: product.price,
    handle: product.handle,
    description: product.description,
    badge: getProductBadge(index),
    featured: index < 2,
    coverColor: palette.coverColor,
    accentColor: palette.accentColor,
    imageUrl: product.imageUrl,
    imageAltText: product.imageAltText,
  };
}

function ProductImage({
  product,
  height,
}: {
  product: StoreProduct;
  height: number;
}) {
  if (product.imageUrl) {
    return (
      <Image
        source={{ uri: product.imageUrl }}
        resizeMode="cover"
        accessibilityLabel={product.imageAltText ?? product.name}
        style={{ width: '100%', height, borderRadius: 18 }}
      />
    );
  }

  return (
    <View
      style={{
        width: '100%',
        height,
        borderRadius: 18,
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
          },
        ]
      : []
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
  onAdminPress,
  onOpenCategory,
  onOpenCart,
  onOpenProduct,
}: {
  onAdminPress: () => void;
  onOpenCategory?: (category: {
    id: string;
    title: string;
    description?: string;
    parentTitle?: string;
  }) => void;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
}) {
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<StoreProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([{ id: 'all', name: 'כל המוצרים' }]);
  const [menuItems, setMenuItems] = useState<ShopifyMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const categoryTabsRef = useRef<ScrollView | null>(null);
  const activeBottomTab = menuOpen ? 'menu' : 'home';
  const { itemCount } = useCart();

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
  const selectedCategoryInfo = useMemo(
    () => categories.find((category) => category.id === selectedCategory) ?? topLevelCategories.find((category) => category.id === selectedCategory),
    [categories, selectedCategory, topLevelCategories]
  );
  const selectedCategoryName = useMemo(
    () => selectedCategoryInfo?.name ?? 'מוצרים',
    [selectedCategoryInfo]
  );
  const categoryPreviewProducts = useMemo(
    () => (selectedCategory === 'all' ? [] : visibleProducts.slice(0, 4)),
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

        const mappedProducts = collectionProducts.map((product, index) => toStoreProduct(product, index));
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
  }, [allProducts, query, selectedCategory]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 18 }}>
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 4,
                minHeight: 60,
              }}
            >
              <Pressable
                onPress={onOpenCart}
                style={{
                  position: 'absolute',
                  left: 0,
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
              <Text style={{ color: '#B7BDC8', marginLeft: 8, fontSize: 12 }}>⌕</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="מה אתם רוצים לחפש?"
                placeholderTextColor="#B7BDC8"
                style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 13 }}
              />
            </View>

            <PromoCarousel />

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

                return (
                  <Pressable key={category.id} onPress={() => setSelectedCategory(category.id)}>
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: isSelected ? '#111827' : '#9CA3AF',
                          fontWeight: isSelected ? '900' : '600',
                          fontSize: 12,
                        }}
                      >
                        {category.name}
                      </Text>
                      <View
                        style={{
                          width: 28,
                          height: 2,
                          borderRadius: 999,
                          backgroundColor: isSelected ? '#111827' : 'transparent',
                        }}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedCategory !== 'all' && !categoryLoading && !!categoryPreviewProducts.length && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>{selectedCategoryName}</Text>
                  <Text style={{ color: '#B1B6C1', fontSize: 11 }}>עד 4 מוצרים מהקטגוריה שבחרת</Text>
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
                      onPress={() => onOpenProduct?.(product)}
                      style={{
                        width: '48%',
                        borderRadius: 18,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#EEF0F3',
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: 174,
                          borderRadius: 18,
                          backgroundColor: product.coverColor,
                          overflow: 'hidden',
                          padding: 10,
                          justifyContent: 'space-between',
                        }}
                      >
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            backgroundColor: '#111827',
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                            {product.badge ?? 'ITEM'}
                          </Text>
                        </View>

                        <ProductImage product={product} height={146} />

                        <View
                          style={{
                            position: 'absolute',
                            right: 10,
                            bottom: 10,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700' }}>+</Text>
                        </View>
                      </View>

                      <View style={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 12, alignItems: 'flex-end' }}>
                        <Text
                          numberOfLines={2}
                          style={{ color: '#111827', fontSize: 14, fontWeight: '800', textAlign: 'right' }}
                        >
                          {product.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ color: '#8D94A1', fontSize: 10, marginTop: 3, textAlign: 'right' }}
                        >
                          {product.subtitle}
                        </Text>
                        <Text style={{ color: '#111827', fontSize: 20, fontWeight: '900', marginTop: 8 }}>
                          {formatPrice(product.price)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={() =>
                    onOpenCategory?.({
                      id: selectedCategory,
                      title: selectedCategoryName,
                      description: selectedCategoryInfo?.subtitle,
                    })
                  }
                  style={{
                    borderRadius: 18,
                    backgroundColor: '#F8F8FA',
                    borderWidth: 1,
                    borderColor: '#ECEFF4',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#111827', fontSize: 15, fontWeight: '800' }}>←</Text>
                  </View>

                  <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 12 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '800', textAlign: 'right' }}>
                      לכל המוצרים
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 3, textAlign: 'right' }}>
                      {selectedCategoryName}
                    </Text>
                  </View>
                </Pressable>
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
                  onPress={() => onOpenProduct?.(product)}
                  style={{
                    width: 156,
                    borderRadius: 18,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <View
                    style={{
                      height: 166,
                      borderRadius: 18,
                      backgroundColor: product.coverColor,
                      overflow: 'hidden',
                      padding: 10,
                      justifyContent: 'space-between',
                    }}
                  >
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: '#111827',
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                        {product.badge ?? 'ITEM'}
                      </Text>
                    </View>

                    <ProductImage product={product} height={146} />

                    <View
                      style={{
                        position: 'absolute',
                        right: 10,
                        bottom: 10,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700' }}>+</Text>
                    </View>
                  </View>

                  <View style={{ paddingHorizontal: 4, paddingTop: 10, alignItems: 'flex-end' }}>
                    <Text style={{ color: '#111827', fontSize: 13, fontWeight: '800' }}>{product.name}</Text>
                    <Text style={{ color: '#8D94A1', fontSize: 10, marginTop: 3 }}>{product.subtitle}</Text>
                    <Text style={{ color: '#111827', fontSize: 20, fontWeight: '900', marginTop: 8 }}>
                      {formatPrice(product.price)}
                    </Text>
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
                      onPress={() => onOpenProduct?.(product)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: '#EEF0F3',
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                        <View style={{ width: 112, padding: 10 }}>
                          <ProductImage product={product} height={118} />
                        </View>

                        <View
                          style={{
                            flex: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 14,
                            alignItems: 'flex-end',
                            justifyContent: 'center',
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
                    </Pressable>
                  ))}
                </View>
              </>
            )}

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

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#EDF0F4',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 18,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            {BOTTOM_NAV_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.id === 'home') {
                    setMenuOpen(false);
                    setSelectedCategory(topLevelCategories[0]?.id ?? 'all');
                    return;
                  }

                  if (item.id === 'menu') {
                    setMenuOpen(true);
                    return;
                  }

                  onAdminPress();
                }}
                style={{ alignItems: 'center', gap: 6, flex: 1 }}
              >
                <View
                  style={{
                    minWidth: 38,
                    height: 30,
                    borderRadius: 15,
                    paddingHorizontal: 10,
                    backgroundColor: activeBottomTab === item.id ? '#111827' : '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: activeBottomTab === item.id ? '#FFFFFF' : item.id === 'admin' ? '#7C4A03' : '#111827',
                      fontSize: 15,
                      fontWeight: '800',
                    }}
                  >
                    {item.icon}
                  </Text>
                </View>
                <Text
                  style={{
                    color: activeBottomTab === item.id ? '#111827' : item.id === 'admin' ? '#7C4A03' : '#A0A7B4',
                    fontSize: 10,
                    fontWeight: activeBottomTab === item.id ? '800' : '700',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
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
}: {
  onBack: () => void;
  categoryId: string;
  categoryTitle: string;
  categoryDescription?: string;
  parentTitle?: string;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
}) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { itemCount } = useCart();

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const collectionProducts = await fetchCollectionProducts(categoryId, 80);
        if (!isMounted) return;
        setProducts(collectionProducts.map((product, index) => toStoreProduct(product, index)));
      } catch (err) {
        if (!isMounted) return;
        setProducts([]);
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת תת הקטגוריה');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [categoryId]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 16 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 18,
              borderWidth: 1,
              borderColor: '#EEF2F7',
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Pressable
                onPress={onBack}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#F2F4F8',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900' }}>→</Text>
              </Pressable>

              <View style={{ alignItems: 'flex-end', gap: 4, flex: 1, marginRight: 12 }}>
                <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '800' }}>SUB CATEGORY</Text>
                <Text style={{ color: '#111827', fontSize: 28, fontWeight: '900', textAlign: 'right' }}>
                  {categoryTitle}
                </Text>
                {!!parentTitle && (
                  <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'right' }}>{parentTitle}</Text>
                )}
              </View>

              <Pressable
                onPress={onOpenCart}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#F2F4F8',
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
            </View>

            <Text style={{ color: '#6B7280', fontSize: 13, lineHeight: 20, textAlign: 'right' }}>
              {categoryDescription?.trim() || 'כל המוצרים של תת הקטגוריה מוצגים כאן בצורה נקייה, מהירה ונוחה.'}
            </Text>

            <View
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 18,
                backgroundColor: '#111827',
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                  {filteredProducts.length} מוצרים זמינים
                </Text>
                <Text style={{ color: '#CBD5E1', fontSize: 11, marginTop: 4 }}>
                  מתעדכן ישירות מתוך Shopify
                </Text>
              </View>

              <View
                style={{
                  minWidth: 64,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>OCD</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#EEF0F3',
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#B7BDC8', marginLeft: 8, fontSize: 12 }}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש בתוך תת הקטגוריה"
              placeholderTextColor="#B7BDC8"
              style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 13 }}
            />
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
            <View style={{ gap: 14 }}>
              {filteredProducts.map((product) => (
                <Pressable
                  key={`category-${product.id}`}
                  onPress={() => onOpenProduct?.(product)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: '#E9EEF5',
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                    <View style={{ width: 124, padding: 10 }}>
                      <ProductImage product={product} height={132} />
                    </View>

                    <View
                      style={{
                        flex: 1,
                        paddingHorizontal: 14,
                        paddingVertical: 16,
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                          {product.name}
                        </Text>
                        <Text style={{ color: '#8D94A1', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                          {product.subtitle}
                        </Text>
                        <Text
                          numberOfLines={3}
                          style={{ color: '#6B7280', fontSize: 12, marginTop: 8, lineHeight: 18, textAlign: 'right' }}
                        >
                          {product.description || 'מוצר מהקטלוג שלך'}
                        </Text>
                      </View>

                      <View
                        style={{
                          width: '100%',
                          marginTop: 14,
                          flexDirection: 'row-reverse',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: '#F8F5EF',
                          }}
                        >
                          <Text style={{ color: '#9A6B16', fontWeight: '800', fontSize: 11 }}>זמין עכשיו</Text>
                        </View>

                        <Text style={{ color: '#111827', fontSize: 22, fontWeight: '900' }}>
                          {formatPrice(product.price)}
                        </Text>
                      </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

export function StoreProductScreen({
  onBack,
  onOpenCart,
  product,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  product: StoreProduct;
}) {
  const { addItem, itemCount, getQuantity } = useCart();
  const productQuantity = getQuantity(product.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 18 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 28,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#E8EDF4',
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
            </View>

            <View
              style={{
                marginHorizontal: 14,
                marginTop: 8,
                marginBottom: 16,
                borderRadius: 26,
                backgroundColor: product.accentColor,
                padding: 18,
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
              borderWidth: 1,
              borderColor: '#E8EDF4',
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
              borderWidth: 1,
              borderColor: '#E8EDF4',
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
            onPress={() => addItem(product)}
            style={{
              borderRadius: 22,
              backgroundColor: '#111827',
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
              {productQuantity ? `הוסף עוד לעגלה (${productQuantity})` : 'הוסף לעגלה'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
