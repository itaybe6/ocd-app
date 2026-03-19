import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchProducts,
  type ShopifyCollection,
  type ShopifyProduct,
} from '../../lib/shopify';

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
  }>;
};

type StoreProduct = {
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
  { id: 'home', label: 'בית', active: true },
  { id: 'search', label: 'חיפוש' },
  { id: 'favorites', label: 'מועדפים' },
  { id: 'profile', label: 'חשבון' },
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

function normalizeCategoryTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim();
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
  onProductPress,
}: {
  onAdminPress: () => void;
  onProductPress?: (handle: string) => void;
}) {
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<StoreProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([{ id: 'all', name: 'כל המוצרים' }]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'group:חומרי ניקיון': true,
  });

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
        if (!isMounted) return;
        const mappedProducts = liveProducts.map((product, index) => toStoreProduct(product, index));
        const mappedCollections: StoreCategory[] = [
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
      } catch (err) {
        if (!isMounted) return;
        setAllProducts([]);
        setVisibleProducts([]);
        setFeaturedProducts([]);
        setCategories([{ id: 'all', name: 'כל המוצרים' }]);
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

  const sidebarSections = useMemo(() => buildSidebarSections(categories), [categories]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

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
                                onPress={() => selectCategoryFromMenu(child.categoryId)}
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

              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onAdminPress();
                }}
                style={{
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: '#EFE3D0',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#7C4A03', fontWeight: '800', textAlign: 'right' }}>ניהול</Text>
              </Pressable>
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
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Pressable
                onPress={() => setMenuOpen(true)}
                style={{
                  minWidth: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F8F8F8',
                }}
              >
                <Text style={{ color: '#111827', fontSize: 11, fontWeight: '800' }}>0</Text>
              </Pressable>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#1F2937', fontSize: 17, fontWeight: '900', letterSpacing: 1.5 }}>
                  OCD SUPER CLEAN
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={onAdminPress}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    height: 34,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#EFE3D0',
                  }}
                >
                  <Text style={{ color: '#7C4A03', fontWeight: '900', textAlign: 'right' }}>ניהול</Text>
                </Pressable>

                <Pressable
                  onPress={() => setMenuOpen(true)}
                  style={{
                    minWidth: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F8F8F8',
                  }}
                >
                  <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700' }}>≡</Text>
                </Pressable>
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

            <View
              style={{
                height: 148,
                borderRadius: 22,
                backgroundColor: '#2A241F',
                overflow: 'hidden',
                padding: 18,
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '48%',
                  backgroundColor: '#4B4239',
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
                  backgroundColor: '#7A6C5E',
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
                  backgroundColor: '#D9D3CC',
                }}
              />
              <View style={{ width: '58%', alignSelf: 'flex-start' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'right' }}>
                  20% הנחה על כל
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'right' }}>
                  מפיצי הריח
                </Text>
                <Text style={{ color: '#D0C5B9', marginTop: 8, fontSize: 11, textAlign: 'right' }}>
                  PROMOTION
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 20,
              }}
            >
              {categories.map((category) => {
                const isSelected = selectedCategory === category.id;

                return (
                  <Pressable key={category.id} onPress={() => setSelectedCategory(category.id)}>
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Text
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
            </View>

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
                    backgroundColor: '#FFFFFF',
                    opacity: pressed ? 0.95 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
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

            <View style={{ alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
              <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900' }}>
                {selectedCategory === 'all'
                  ? 'כל המוצרים'
                  : categories.find((category) => category.id === selectedCategory)?.name ?? 'מוצרים'}
              </Text>
              <Text style={{ color: '#B1B6C1', fontSize: 11 }}>
                {selectedCategory === 'all'
                  ? 'all products from your Shopify store'
                  : 'products from the selected Shopify category'}
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {visibleProducts.map((product) => (
                <Pressable
                  key={`list-${product.id}`}
                  onPress={() => onProductPress?.(product.handle)}
                  style={({ pressed }) => ({
                    backgroundColor: '#FFFFFF',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: '#EEF0F3',
                    overflow: 'hidden',
                    opacity: pressed ? 0.96 : 1,
                    transform: [{ scale: pressed ? 0.995 : 1 }],
                  })}
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

            {!loading && !categoryLoading && !visibleProducts.length && (
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
              <View key={item.id} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: item.active ? '#111827' : '#D5DBE4',
                  }}
                />
                <Text
                  style={{
                    color: item.active ? '#111827' : '#A0A7B4',
                    fontSize: 10,
                    fontWeight: item.active ? '800' : '600',
                  }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
