import React, { Children, cloneElement, isValidElement, memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { fetchProducts, type ShopifyProduct } from '../../lib/shopify';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';

type ProductLite = {
  handle: string;
  title: string;
  imageUrl: string | null;
  price: number;
  currencyCode: string;
  productType: string;
};

function toLite(p: ShopifyProduct): ProductLite {
  return {
    handle: p.handle,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price,
    currencyCode: p.currencyCode,
    productType: p.productType,
  };
}

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') return `₪${price.toLocaleString('he-IL')}.00`;
  return `${price.toLocaleString('he-IL')} ${currencyCode}`;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const ITEM_HEIGHT = 170;

/* ─── Product image placeholder ─── */
function ProductThumb({ imageUrl, size = 56 }: { imageUrl: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.05)' }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: 'rgba(37,99,235,0.07)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.44, color: 'rgba(37,99,235,0.35)' }}>🛍</Text>
    </View>
  );
}

/* ─── Custom cell renderer provides itemY ─── */
const CustomCellRendererComponent = memo(({ children, ...props }: any) => {
  const itemY = useSharedValue(0);
  return (
    <View
      {...props}
      onLayout={(e) => {
        itemY.set(e.nativeEvent.layout.y);
      }}
    >
      {Children.map(children, (child) => {
        if (isValidElement(child)) {
          return cloneElement(child, { itemY } as any);
        }
        return child;
      })}
    </View>
  );
});
CustomCellRendererComponent.displayName = 'CustomCellRendererComponent';

function AnimatedProductRow({
  item,
  index,
  scrollY,
  itemY,
  headerHeight,
  selected,
  onPress,
}: {
  item: ProductLite;
  index: number;
  scrollY: any;
  itemY: any;
  headerHeight: number;
  selected: boolean;
  onPress: () => void;
}) {
  const rContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [itemY.value - index - 1 - headerHeight, itemY.value - index - headerHeight, itemY.value - index + 1 - headerHeight],
            [0, 0, 1]
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [itemY.value - 1 - headerHeight, itemY.value - headerHeight, itemY.value + ITEM_HEIGHT - headerHeight],
            [1, 1, 0.9]
          ),
        },
      ],
    };
  });

  const backdropAnimatedProps = useAnimatedProps(() => {
    const intensity = interpolate(
      scrollY.value,
      [itemY.value - 1 - headerHeight, itemY.value - headerHeight, itemY.value + ITEM_HEIGHT - headerHeight],
      [0, 0, 15]
    );
    return { intensity } as any;
  });

  return (
    <Animated.View style={[animRowStyles.container, rContainerStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          animRowStyles.card,
          selected && animRowStyles.cardSelected,
          pressed && !selected && { transform: [{ scale: 0.995 }], opacity: 0.96 },
        ]}
      >
        {/* Left column (meta pills) */}
        <View style={animRowStyles.leftCol}>
          <View style={animRowStyles.badgeTop} />
          <View style={animRowStyles.badgeBottom} />
        </View>

        {/* Main content */}
        <View style={animRowStyles.content}>
          <View style={animRowStyles.meta}>
            <Text numberOfLines={2} style={[animRowStyles.title, selected && animRowStyles.titleSelected]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={animRowStyles.sub}>
              {item.productType || 'מוצר'}
            </Text>
            <Text style={[animRowStyles.price, selected && animRowStyles.priceSelected]}>
              {formatPrice(item.price, item.currencyCode)}
            </Text>
          </View>

          <View style={animRowStyles.imageWrap}>
            <ProductThumb imageUrl={item.imageUrl} size={110} />
          </View>
        </View>

        {selected && <View style={animRowStyles.selectedStrip} />}
      </Pressable>

      {Platform.OS === 'ios' && (
        <AnimatedBlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint="light"
          animatedProps={backdropAnimatedProps}
        />
      )}
    </Animated.View>
  );
}

const animRowStyles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  card: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
  },
  cardSelected: {
    borderColor: 'rgba(37,99,235,0.35)',
    backgroundColor: 'rgba(37,99,235,0.07)',
  },
  selectedStrip: {
    position: 'absolute',
    right: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(37,99,235,0.85)',
  },
  leftCol: {
    width: 56,
    paddingTop: 18,
    alignItems: 'center',
    gap: 10,
  },
  badgeTop: {
    width: 36,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.28)',
  },
  badgeBottom: {
    width: 32,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.22)',
  },
  content: {
    flex: 1,
    padding: 12,
    flexDirection: 'row-reverse',
    gap: 12,
    alignItems: 'center',
  },
  meta: { flex: 1, alignItems: 'flex-end' },
  title: { color: colors.text, fontWeight: '900', fontSize: 15, textAlign: 'right' },
  titleSelected: { color: 'rgba(37,99,235,1)' },
  sub: { color: colors.muted, marginTop: 6, fontWeight: '700', fontSize: 11, textAlign: 'right' },
  price: { color: colors.text, marginTop: 10, fontWeight: '900', fontSize: 14, textAlign: 'right' },
  priceSelected: { color: 'rgba(37,99,235,0.95)' },
  imageWrap: {
    width: 122,
    height: 132,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ─── Product picker modal ─── */
function ProductPickerModal({
  visible,
  products,
  loading,
  selectedHandle,
  onSelect,
  onClose,
}: {
  visible: boolean;
  products: ProductLite[];
  loading: boolean;
  selectedHandle: string;
  onSelect: (p: ProductLite) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = Platform.OS === 'ios' ? insets.top + 45 : 0;
  const [q, setQ] = useState('');
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.productType.toLowerCase().includes(query)
    );
  }, [products, q]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(240)}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.52)' }]}
        />
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(280)}
          exiting={FadeOutDown.duration(240)}
          style={pickerStyles.sheet}
        >
          {/* Handle bar */}
          <View style={pickerStyles.handleRow}>
            <View style={pickerStyles.handle} />
          </View>

          {/* Header */}
          <View style={pickerStyles.headerRow}>
            <Text style={pickerStyles.headerTitle}>בחר מוצר</Text>
            <Pressable onPress={onClose} style={pickerStyles.closeBtn}>
              <Text style={pickerStyles.closeBtnText}>סגור</Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={pickerStyles.searchWrap}>
            <Text style={pickerStyles.searchIcon}>⌕</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="חפש מוצר…"
              placeholderTextColor="rgba(100,116,139,0.6)"
              style={pickerStyles.searchInput}
            />
          </View>

          {/* List */}
          {loading ? (
            <View style={pickerStyles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
              <Text style={pickerStyles.loadingText}>טוען מוצרים…</Text>
            </View>
          ) : (
            <Animated.FlatList
              data={filtered}
              keyExtractor={(item) => item.handle}
              contentContainerStyle={pickerStyles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={onScroll}
              CellRendererComponent={CustomCellRendererComponent as any}
              renderItem={({ item, index }: any) => (
                <AnimatedProductRow
                  item={item}
                  index={index}
                  scrollY={scrollY}
                  itemY={(undefined as any)}
                  headerHeight={headerHeight}
                  selected={item.handle === selectedHandle}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={pickerStyles.emptyWrap}>
                  <Text style={pickerStyles.emptyText}>לא נמצאו מוצרים{q ? ` עבור "${q}"` : ''}</Text>
                </View>
              }
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    maxHeight: '82%',
    paddingBottom: 28,
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 44, height: 5, borderRadius: 999, backgroundColor: colors.border },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
    paddingTop: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.10)',
  },
  closeBtnText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  searchWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: { color: 'rgba(100,116,139,0.7)', fontSize: 16 },
  searchInput: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: { paddingBottom: 10 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: colors.muted, fontWeight: '700' },
});

/* ─── Main screen ─── */
export function StoreManagementScreen() {
  const { setIsLoading } = useLoading();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [useProductImage, setUseProductImage] = useState(true);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedHandle, setSelectedHandle] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.handle === selectedHandle) ?? null,
    [products, selectedHandle]
  );

  const effectiveImageUrl = useMemo(() => {
    if (useProductImage) return selectedProduct?.imageUrl ?? '';
    return customImageUrl.trim();
  }, [customImageUrl, selectedProduct?.imageUrl, useProductImage]);

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const list = await fetchProducts(60);
      setProducts(list.map(toLite));
    } catch (e: any) {
      setProducts([]);
      Toast.show({ type: 'error', text1: 'טעינת מוצרים נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const sendBroadcast = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      Toast.show({ type: 'error', text1: 'חסרים שדות', text2: 'יש להזין כותרת וטקסט' });
      return;
    }
    if (!selectedHandle) {
      Toast.show({ type: 'error', text1: 'חסר מוצר', text2: 'בחר מוצר כדי שההתראה תפתח אותו באפליקציה' });
      return;
    }

    const payload = {
      title: t,
      body: b,
      productHandle: selectedHandle,
      productTitle: selectedProduct?.title ?? null,
      imageUrl: effectiveImageUrl || null,
    };

    try {
      setIsLoading(true);
      const secret = process.env.EXPO_PUBLIC_ADMIN_BROADCAST_SECRET?.trim();
      const { data, error } = await supabase.functions.invoke('send-broadcast-push', {
        body: payload,
        headers: secret ? { 'x-admin-secret': secret } : undefined,
      });
      if (error) throw error;
      const total = (data as any)?.totalTokens ?? null;
      const ok = (data as any)?.successCount ?? null;
      const bad = (data as any)?.errorCount ?? null;
      Toast.show({
        type: 'success',
        text1: 'ההתראה שוגרה',
        text2: total != null ? `נשלח: ${ok ?? '—'} תקין, ${bad ?? '—'} שגוי (סה״כ ${total})` : undefined,
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שליחה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── Notification preview ─── */
  const canPreview = title.trim() || body.trim();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', fontSize: 18 }}>שיגור פושים</Text>
          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right', lineHeight: 20 }}>
            שגר התראה לכל המשתמשים. בלחיצה על ההתראה, המשתמש יגיע למוצר שבחרת.
          </Text>
        </Card>

        {/* Notification text */}
        <Card>
          <Text style={s.sectionLabel}>תוכן ההתראה</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            <Input label="כותרת" value={title} onChangeText={setTitle} placeholder="לדוגמה: מבצע חדש בחנות" />
            <Input
              label="גוף ההתראה"
              value={body}
              onChangeText={setBody}
              placeholder="לדוגמה: 20% הנחה על כל המוצרים עד חצות"
              multiline
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
          </View>

          {/* Live preview chip */}
          {canPreview && (
            <View style={s.previewChip}>
              <View style={s.previewChipBar} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={s.previewChipTitle}>{title.trim() || 'כותרת…'}</Text>
                <Text numberOfLines={2} style={s.previewChipBody}>{body.trim() || 'תוכן…'}</Text>
              </View>
              {!!effectiveImageUrl && (
                <Image
                  source={{ uri: effectiveImageUrl }}
                  style={{ width: 44, height: 44, borderRadius: 10 }}
                  resizeMode="cover"
                />
              )}
            </View>
          )}
        </Card>

        {/* Product link */}
        <Card>
          <Text style={s.sectionLabel}>מוצר לקישור</Text>

          <Pressable
            onPress={() => setProductPickerOpen(true)}
            disabled={loadingProducts}
            style={({ pressed }) => [s.productTrigger, pressed && s.productTriggerPressed]}
          >
            {/* Left: image */}
            <ProductThumb imageUrl={selectedProduct?.imageUrl ?? null} size={52} />

            {/* Center: text */}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={s.productTriggerLabel}>מוצר</Text>
              {loadingProducts ? (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={s.productTriggerValue}>טוען מוצרים…</Text>
                </View>
              ) : (
                <Text numberOfLines={1} style={[s.productTriggerValue, !selectedProduct && s.productTriggerPlaceholder]}>
                  {selectedProduct ? selectedProduct.title : 'בחר מוצר…'}
                </Text>
              )}
              {selectedProduct && (
                <Text style={s.productTriggerPrice}>
                  {formatPrice(selectedProduct.price, selectedProduct.currencyCode)}
                </Text>
              )}
            </View>

            {/* Right: chevron */}
            <View style={s.chevronWrap}>
              <Text style={s.chevronIcon}>‹</Text>
            </View>
          </Pressable>

          {selectedProduct && (
            <Pressable onPress={() => setSelectedHandle('')} style={s.clearBtn}>
              <Text style={s.clearBtnText}>× הסר בחירה</Text>
            </Pressable>
          )}
        </Card>

        {/* Image source */}
        <Card>
          <Text style={s.sectionLabel}>תמונה להתראה</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() => setUseProductImage(true)}
              style={[s.imgToggleBtn, useProductImage && s.imgToggleBtnActive]}
            >
              <Text style={[s.imgToggleBtnText, useProductImage && s.imgToggleBtnTextActive]}>תמונת המוצר</Text>
            </Pressable>
            <Pressable
              onPress={() => setUseProductImage(false)}
              style={[s.imgToggleBtn, !useProductImage && s.imgToggleBtnActive]}
            >
              <Text style={[s.imgToggleBtnText, !useProductImage && s.imgToggleBtnTextActive]}>קישור מותאם</Text>
            </Pressable>
          </View>

          {!useProductImage && (
            <View style={{ marginTop: 10 }}>
              <Input value={customImageUrl} onChangeText={setCustomImageUrl} placeholder="https://example.com/image.jpg" />
            </View>
          )}

          {!!effectiveImageUrl && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.muted, textAlign: 'right', fontWeight: '700', fontSize: 12, marginBottom: 8 }}>
                תצוגה מקדימה
              </Text>
              <Image
                source={{ uri: effectiveImageUrl }}
                style={{ width: '100%', height: 170, borderRadius: 18, backgroundColor: 'rgba(15,23,42,0.05)' }}
                resizeMode="cover"
              />
              <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right', fontSize: 11 }}>
                ב־iOS נדרשת Notification Service Extension לתמונה בפוש.
              </Text>
            </View>
          )}
        </Card>

        {/* Send */}
        <Button title="שגר פוש לכל המשתמשים" onPress={sendBroadcast} />
      </ScrollView>

      <ProductPickerModal
        visible={productPickerOpen}
        products={products}
        loading={loadingProducts}
        selectedHandle={selectedHandle}
        onSelect={(p) => setSelectedHandle(p.handle)}
        onClose={() => setProductPickerOpen(false)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'right',
    fontSize: 15,
  },

  /* Preview chip */
  previewChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.07)',
    overflow: 'hidden',
  },
  previewChipBar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(37,99,235,0.6)',
  },
  previewChipTitle: { color: colors.text, fontWeight: '800', fontSize: 13, textAlign: 'right' },
  previewChipBody: { color: colors.muted, fontSize: 11, marginTop: 3, textAlign: 'right' },

  /* Product trigger button */
  productTrigger: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  productTriggerPressed: { backgroundColor: 'rgba(37,99,235,0.05)', borderColor: 'rgba(37,99,235,0.25)' },
  productTriggerLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  productTriggerValue: { color: colors.text, fontWeight: '900', fontSize: 14, textAlign: 'right', marginTop: 1 },
  productTriggerPlaceholder: { color: colors.muted, fontWeight: '700' },
  productTriggerPrice: { color: colors.primary, fontWeight: '800', fontSize: 12, textAlign: 'right', marginTop: 2 },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronIcon: { color: colors.muted, fontSize: 18, fontWeight: '600' },

  /* Clear selection */
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  clearBtnText: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  /* Image toggle buttons */
  imgToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  imgToggleBtnActive: {
    borderColor: 'rgba(37,99,235,0.45)',
    backgroundColor: 'rgba(37,99,235,0.09)',
  },
  imgToggleBtnText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  imgToggleBtnTextActive: { color: 'rgba(37,99,235,1)' },
});
