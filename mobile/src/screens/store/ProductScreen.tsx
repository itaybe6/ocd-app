import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { Card } from '../../components/ui/Card';
import { favoriteInputFromShopify } from '../../lib/favorites';
import { fetchProductByHandle, type ShopifyProduct } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';
import {
  getStoreBottomBarMetrics,
  StoreFloatingTabBar,
  type StoreBottomTabId,
} from './StoreHomeScreen';

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
    subtitle: product.productType || 'מוצר',
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

function IconCircleButton({
  icon,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
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
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E8F0',
          alignSelf: 'flex-start',
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={20} color="#0F172A" />
      </View>
      {!!badge && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111827',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ProductScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { addItem, itemCount, getQuantity, isMutating } = useCart();
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
  const imageHeight = 340;

  const handleBottomTabPress = (tabId: StoreBottomTabId) => {
    const mainParams =
      tabId === 'categories'
        ? { initialTab: 'categories' as const, initialTabRequestId: Date.now() }
        : { initialTab: 'home' as const, initialTabRequestId: Date.now() };

    if (tabId === 'search') {
      navigation.navigate('StoreSearch');
      return;
    }

    if (tabId === 'ocdPlus') {
      navigation.navigate('StoreOcdPlus');
      return;
    }

    if (tabId === 'favorites') {
      navigation.navigate('StoreFavorites');
      return;
    }

    if (tabId === 'profile') {
      navigation.navigate('Login');
      return;
    }

    navigation.navigate('Main', mainParams);
  };

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

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    void addItem(getCartProduct(product));
  }, [addItem, product]);

  const handleShare = useCallback(async () => {
    if (!product) return;

    try {
      await Share.share({
        message: `${product.title}\n${formatPrice(product.price, product.currencyCode)}`,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'לא הצלחנו לפתוח את השיתוף',
      });
    }
  }, [product]);

  const handleFavoriteToggle = useCallback(() => {
    if (!product) return;
    void toggleFavorite(favoriteInputFromShopify(product));
  }, [product, toggleFavorite]);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.muted, fontWeight: '700' }}>טוען מוצר…</Text>
        </View>
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen>
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
      </Screen>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 12,
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <IconCircleButton icon="arrow-forward" onPress={() => navigation.goBack()} />
          <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
            <IconCircleButton icon="cart-outline" onPress={() => navigation.navigate('StoreCart')} badge={itemCount || undefined} />
            <IconCircleButton icon="share-social-outline" onPress={handleShare} />
            <FavoriteToggleButton
              active={isFavorite(product.id)}
              loading={isFavoritePending(product.id)}
              onPress={handleFavoriteToggle}
              size={44}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentPaddingBottom + 20, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 28,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              overflow: 'hidden',
              padding: 12,
              gap: 12,
            }}
          >
            <View
              style={{
                height: imageHeight,
                borderRadius: 22,
                overflow: 'hidden',
                backgroundColor: '#F8FAFC',
              }}
            >
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
                  <Ionicons name="image-outline" size={42} color="#64748B" />
                  <Text style={{ marginTop: 10, color: '#475569', fontWeight: '700', ...RTL_TEXT }}>אין תמונה זמינה</Text>
                </View>
              )}
            </View>

            {galleryItems.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}
              >
                {galleryItems.map((item, index) => (
                  <Pressable
                    key={`${item.id}-thumb`}
                    onPress={() => setActiveImageIndex(index)}
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 16,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: index === activeImageIndex ? '#111827' : '#E2E8F0',
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
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, ...RTL_TEXT }}>עמוד מוצר</Text>
                <Text style={{ marginTop: 8, color: colors.text, fontSize: 28, fontWeight: '900', ...RTL_TEXT }}>{product.title}</Text>
                <Text style={{ marginTop: 8, color: colors.muted, fontSize: 14, ...RTL_TEXT }}>{product.productType || 'מוצר'}</Text>
              </View>
              <View
                style={{
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>
                  {formatPrice(product.price, product.currencyCode)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: '#E0F2FE',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: '#075985', fontWeight: '800', ...RTL_TEXT }}>{product.productType || 'מוצר'}</Text>
              </View>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: '#ECFCCB',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: '#3F6212', fontWeight: '800', ...RTL_TEXT }}>
                  {quantityInCart ? `כבר בעגלה: ${quantityInCart}` : 'זמין להזמנה'}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleAddToCart}
            disabled={isMutating || !product.availableForSale || !product.variantId}
            style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
          >
            <View
              style={{
                borderRadius: 26,
                backgroundColor: isMutating || !product.availableForSale || !product.variantId ? '#475569' : '#0F172A',
                paddingHorizontal: 18,
                paddingVertical: 17,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>
                {isMutating
                  ? 'מעדכן עגלה...'
                  : !product.availableForSale || !product.variantId
                    ? 'המוצר לא זמין כרגע לרכישה'
                    : quantityInCart
                      ? `הוסף עוד לעגלה (${quantityInCart})`
                      : 'הוסף לעגלה'}
              </Text>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </View>
          </Pressable>

          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18, ...RTL_TEXT }}>תיאור המוצר</Text>
            {descriptionParts.map((part, index) => (
              <Text key={`${product.id}-desc-${index}`} style={{ color: colors.text, lineHeight: 24, ...RTL_TEXT }}>
                {part}
              </Text>
            ))}
          </Card>

          <Card>
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16, ...RTL_TEXT }}>מה קורה מכאן?</Text>
              <Text style={{ color: colors.muted, lineHeight: 22, ...RTL_TEXT }}>
                הוספה לעגלה מתבצעת ישירות מול Shopify, ובמסך העגלה אפשר לעדכן כמויות, להסיר מוצרים ולהמשיך לקופה המאובטחת בתוך האפליקציה.
              </Text>
            </View>
          </Card>
        </ScrollView>

        <StoreFloatingTabBar activeTab="home" onTabPress={handleBottomTabPress} />
      </View>
    </SafeAreaView>
  );
}

