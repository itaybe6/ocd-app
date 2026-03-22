import React, { Children, cloneElement, isValidElement, memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { endOfWeek, startOfWeek } from 'date-fns';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { supabase } from '../../lib/supabase';
import { fetchProducts, type ShopifyProduct } from '../../lib/shopify';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const ProductPickerCellRenderer = memo(({ children, ...props }: any) => {
  const itemY = useSharedValue(0);
  const itemHeight = useSharedValue(0);
  return (
    <View
      {...props}
      onLayout={(ev) => {
        itemY.value = ev.nativeEvent.layout.y;
        itemHeight.value = ev.nativeEvent.layout.height;
      }}
    >
      {Children.map(children, (child) => {
        if (isValidElement(child)) {
          return cloneElement(child as any, { itemY, itemHeight });
        }
        return child;
      })}
    </View>
  );
});

function AnimatedProductRow({
  item,
  index,
  scrollY,
  selected,
  onPress,
  itemY,
  itemHeight,
}: {
  item: ProductLite;
  index: number;
  scrollY: { value: number };
  selected: boolean;
  onPress: () => void;
  itemY?: { value: number };
  itemHeight?: { value: number };
}) {
  const stylez = useAnimatedStyle(() => {
    if (!itemY || !itemHeight || itemHeight.value === 0) return {};

    const top = itemY.value;
    const h = itemHeight.value;
    const y = scrollY.value;

    return {
      opacity: interpolate(y, [top - 1, top, top + h], [1, 1, 0], Extrapolate.CLAMP),
      transform: [
        { perspective: h * 4 },
        {
          translateY: interpolate(y, [top - index - 1, top - index, top - index + 1], [0, 0, 1], Extrapolate.CLAMP),
        },
        {
          scale: interpolate(y, [top - 1, top, top + h], [1, 1, 0.96], Extrapolate.CLAMP),
        },
      ],
    };
  }, [index]);

  return (
    <Animated.View style={stylez}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          pickerStyles.productRow,
          selected && pickerStyles.productRowSelected,
          pressed && !selected && pickerStyles.productRowPressed,
        ]}
      >
        {selected && <View style={pickerStyles.selectedStrip} />}

        <ProductThumb imageUrl={item.imageUrl} size={58} />

        <View style={pickerStyles.productMeta}>
          <Text numberOfLines={2} style={[pickerStyles.productTitle, selected && pickerStyles.productTitleSelected]}>
            {item.title}
          </Text>
          {!!item.productType && <Text style={pickerStyles.productType}>{item.productType}</Text>}
          <Text style={[pickerStyles.productPrice, selected && pickerStyles.productPriceSelected]}>
            {formatPrice(item.price, item.currencyCode)}
          </Text>
        </View>

        {selected && (
          <View style={pickerStyles.checkCircle}>
            <Text style={pickerStyles.checkMark}>✓</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ─── Product picker modal ─── */
function ProductPickerModal({
  visible,
  products,
  loading,
  multi,
  selectedHandles,
  onChangeSelectedHandles,
  onClose,
}: {
  visible: boolean;
  products: ProductLite[];
  loading: boolean;
  multi?: boolean;
  selectedHandles: string[];
  onChangeSelectedHandles: (handles: string[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
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

  const selectedSet = useMemo(() => new Set(selectedHandles), [selectedHandles]);
  const selectedCount = selectedHandles.length;

  return (
    <ModalSheet visible={visible} onClose={onClose} containerStyle={pickerStyles.sheet}>
      {/* Header */}
      <View style={pickerStyles.headerRow}>
        <Text style={pickerStyles.headerTitle}>{multi ? 'בחר מוצרים' : 'בחר מוצר'}</Text>
        <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>
          {multi ? (
            <Pressable
              onPress={() => onChangeSelectedHandles([])}
              style={[pickerStyles.closeBtn, { backgroundColor: 'rgba(239,68,68,0.10)' }]}
            >
              <Text style={[pickerStyles.closeBtnText, { color: colors.danger }]}>נקה</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={pickerStyles.closeBtn}>
            <Text style={pickerStyles.closeBtnText}>{multi ? `סגור (${selectedCount})` : 'סגור'}</Text>
          </Pressable>
        </View>
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
        <AnimatedFlatList
          data={filtered}
          keyExtractor={(item: any, index: number) => item?.handle ?? String(index)}
          contentContainerStyle={pickerStyles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          CellRendererComponent={ProductPickerCellRenderer}
          renderItem={({ item, index }: any) => {
            const product = item as ProductLite;
            const isSelected = selectedSet.has(product.handle);
            return (
              <AnimatedProductRow
                item={product}
                index={index}
                scrollY={scrollY}
                selected={isSelected}
                onPress={() => {
                  if (!multi) {
                    onChangeSelectedHandles([product.handle]);
                    onClose();
                    return;
                  }
                  const next = new Set(selectedSet);
                  if (next.has(product.handle)) next.delete(product.handle);
                  else next.add(product.handle);
                  onChangeSelectedHandles(Array.from(next));
                }}
              />
            );
          }}
          ListEmptyComponent={
            <View style={pickerStyles.emptyWrap}>
              <Text style={pickerStyles.emptyText}>לא נמצאו מוצרים{q ? ` עבור "${q}"` : ''}</Text>
            </View>
          }
        />
      )}

      {multi ? (
        <View style={pickerStyles.footerRow}>
          <Button title="אישור" fullWidth={false} onPress={onClose} />
          <Text style={pickerStyles.footerHint}>
            נבחרו {selectedCount}
          </Text>
        </View>
      ) : null}
    </ModalSheet>
  );
}

const pickerStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    maxHeight: '82%',
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
    paddingTop: 0,
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
  listContent: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: colors.muted, fontWeight: '700' },
  productRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    overflow: 'hidden',
    position: 'relative',
  },
  productRowSelected: {
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderColor: 'rgba(37,99,235,0.30)',
  },
  productRowPressed: { backgroundColor: 'rgba(15,23,42,0.04)' },
  selectedStrip: {
    position: 'absolute',
    right: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(37,99,235,0.8)',
  },
  productMeta: { flex: 1, gap: 3, alignItems: 'flex-end' },
  productTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'right',
  },
  productTitleSelected: { color: 'rgba(37,99,235,1)' },
  productType: { color: colors.muted, fontWeight: '600', fontSize: 11, textAlign: 'right' },
  productPrice: { color: colors.muted, fontWeight: '900', fontSize: 13, textAlign: 'right', marginTop: 2 },
  productPriceSelected: { color: 'rgba(37,99,235,0.9)' },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(37,99,235,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: 'rgba(37,99,235,1)', fontSize: 13, fontWeight: '900' },
  footerRow: {
    paddingTop: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 6,
  },
  footerHint: { color: colors.muted, fontWeight: '800' },
});

/* ─── Main screen ─── */
export function StoreManagementScreen() {
  const { setIsLoading } = useLoading();
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [customersCount, setCustomersCount] = useState<number | null>(null);
  const [ordersThisWeek, setOrdersThisWeek] = useState<number | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushScope, setPushScope] = useState<'general' | 'product'>('general');
  const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 10);
    return d;
  });
  const [iosPickerMode, setIosPickerMode] = useState<'date' | 'time'>('date');

  const selectedProducts = useMemo(() => {
    const map = new Map(products.map((p) => [p.handle, p]));
    return selectedHandles.map((h) => map.get(h)).filter(Boolean) as ProductLite[];
  }, [products, selectedHandles]);

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

  const refreshStoreStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 0 }).toISOString(); // Sunday
      const end = endOfWeek(now, { weekStartsOn: 0 }).toISOString();

      const [custRes, jobsRes, instRes, specRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('date', start).lte('date', end),
        supabase.from('installation_jobs').select('id', { count: 'exact', head: true }).gte('date', start).lte('date', end),
        supabase.from('special_jobs').select('id', { count: 'exact', head: true }).gte('date', start).lte('date', end),
      ]);

      if (custRes.error) throw custRes.error;
      if (jobsRes.error) throw jobsRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      setCustomersCount(custRes.count ?? 0);
      setOrdersThisWeek((jobsRes.count ?? 0) + (instRes.count ?? 0) + (specRes.count ?? 0));
    } catch (e: any) {
      setCustomersCount(null);
      setOrdersThisWeek(null);
      Toast.show({ type: 'error', text1: 'טעינת נתוני חנות נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStoreStats();
  }, [refreshStoreStats]);

  const openWizard = () => {
    setWizardStep(0);
    setPushTitle('');
    setPushBody('');
    setPushScope('general');
    setSelectedHandles([]);
    setScheduleMode('now');
    const d = new Date();
    d.setMinutes(d.getMinutes() + 10);
    setScheduledAt(d);
    setWizardOpen(true);
  };

  const submitWizard = async () => {
    const t = pushTitle.trim();
    const b = pushBody.trim();
    if (!t || !b) {
      Toast.show({ type: 'error', text1: 'חסרים שדות', text2: 'יש להזין כותרת ותוכן' });
      return;
    }
    if (scheduleMode === 'scheduled') {
      const now = Date.now();
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < now + 30_000) {
        Toast.show({ type: 'error', text1: 'תזמון לא תקין', text2: 'בחר תאריך/שעה לפחות 30 שניות קדימה' });
        return;
      }
    }

    const payload: any = {
      title: t,
      body: b,
      scope: pushScope,
      productHandles: pushScope === 'product' ? selectedHandles : [],
      scheduleAt: scheduleMode === 'scheduled' ? scheduledAt.toISOString() : null,
      imageUrl: null,
    };

    try {
      setIsLoading(true);
      const secret = process.env.EXPO_PUBLIC_ADMIN_BROADCAST_SECRET?.trim();
      const { data, error } = await supabase.functions.invoke('send-broadcast-push', {
        body: payload,
        headers: secret ? { 'x-admin-secret': secret } : undefined,
      });
      if (error) throw error;
      const mode = (data as any)?.mode ?? null;
      if (mode === 'scheduled') {
        Toast.show({ type: 'success', text1: 'הפוש תוזמן', text2: 'הוא יישלח בזמן שבחרת (בהרצת המתזמן בשרת)' });
      } else {
        const total = (data as any)?.totalTokens ?? null;
        const ok = (data as any)?.successCount ?? null;
        const bad = (data as any)?.errorCount ?? null;
        Toast.show({
          type: 'success',
          text1: 'הפוש שוגר',
          text2: total != null ? `נשלח: ${ok ?? '—'} תקין, ${bad ?? '—'} שגוי (סה״כ ${total})` : undefined,
        });
      }
      setWizardOpen(false);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שליחה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const canNextTitle = !!pushTitle.trim();
  const canNextBody = !!pushBody.trim();

  const stepTitle = useMemo(() => {
    return ['כותרת', 'סוג', 'מוצרים', 'תוכן', 'תזמון'][wizardStep] ?? '';
  }, [wizardStep]);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── Store stats ─── */}
        <View style={s.statsGrid}>
          <View style={s.statTile}>
            <Text style={s.statLabel}>פריטים בחנות</Text>
            <Text style={s.statValue}>{loadingProducts ? '—' : String(products.length)}</Text>
            <Text style={s.statHint}>מוצרים שנטענו</Text>
          </View>

          <View style={s.statTile}>
            <Text style={s.statLabel}>הזמנות השבוע</Text>
            <Text style={s.statValue}>{statsLoading ? '—' : String(ordersThisWeek ?? 0)}</Text>
            <Text style={s.statHint}>משימות (כל הסוגים)</Text>
          </View>

          <View style={s.statTile}>
            <Text style={s.statLabel}>לקוחות</Text>
            <Text style={s.statValue}>{statsLoading ? '—' : String(customersCount ?? 0)}</Text>
            <Text style={s.statHint}>במערכת</Text>
          </View>
        </View>

        {/* ─── Push launch hero card ─── */}
        <Pressable
          onPress={openWizard}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(37,99,235,0.10)' }}
          style={({ pressed }) => [s.pushLauncher, pressed && s.pushLauncherPressed]}
        >
          <View style={s.pushLauncherInner}>
            {/* Rounded frame (makes it feel like a window/button) */}
            <View style={s.pushLauncherFrame} />

            {/* Decorative glow */}
            <View style={s.pushLauncherGlowA} />
            <View style={s.pushLauncherGlowB} />

            <View style={s.pushLauncherRow}>
              <View style={s.pushLauncherIconWrap}>
                <Text style={s.pushLauncherIcon}>📣</Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Text style={s.pushLauncherTitle}>שיגור פושים</Text>
                  <View style={s.pushLauncherTag}>
                    <Text style={s.pushLauncherTagText}>Wizard</Text>
                  </View>
                </View>
                <Text style={s.pushLauncherSub}>פוש כללי או מוצר • עכשיו או מתוזמן</Text>

                <View style={s.pushLauncherMetaRow}>
                  <View style={s.metaPill}>
                    <Text style={s.metaPillText}>5 שלבים</Text>
                  </View>
                  <View style={s.metaPillMuted}>
                    <Text style={s.metaPillMutedText}>כותרת • סוג • מוצרים • תוכן • תזמון</Text>
                  </View>
                </View>
              </View>

              <View style={s.pushLauncherChevronWrap}>
                <Text style={s.pushLauncherChevron}>‹</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Products status pill */}
        <View style={s.statusRow}>
          <View style={[s.statusDot, loadingProducts && { backgroundColor: colors.warning }]} />
          <Text style={s.statusText}>
            {loadingProducts ? 'טוען מוצרים…' : `${products.length} מוצרים זמינים לבחירה`}
          </Text>
        </View>

      </ScrollView>

      {/* ─── Wizard full-screen modal ─── */}
      <Modal
        visible={wizardOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWizardOpen(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={wz.root}>
          <StatusBar barStyle="dark-content" />

          {/* Header */}
          <View style={wz.header}>
            <Pressable
              onPress={() => {
                if (wizardStep === 0) setWizardOpen(false);
                else setWizardStep((p) => p - 1);
              }}
              hitSlop={10}
              style={({ pressed }) => [wz.navBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={wz.navBtnText}>{wizardStep === 0 ? '✕' : '‹ חזרה'}</Text>
            </Pressable>

            <Text style={wz.headerTitle}>שיגור פוש</Text>

            <View style={wz.stepBadge}>
              <Text style={wz.stepBadgeText}>{wizardStep + 1} / 5</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={wz.progressTrack}>
            <View style={[wz.progressFill, { width: `${((wizardStep + 1) / 5) * 100}%` as any }]} />
          </View>

          {/* Step label row */}
          <View style={wz.stepLabelRow}>
            {['כותרת', 'סוג', 'מוצרים', 'תוכן', 'תזמון'].map((lab, idx) => {
              const active = idx === wizardStep;
              const done = idx < wizardStep;
              return (
                <View key={lab} style={wz.stepLabelItem}>
                  <View style={[wz.stepDot, active && wz.stepDotActive, done && wz.stepDotDone]}>
                    {done
                      ? <Text style={wz.stepDotCheck}>✓</Text>
                      : <Text style={[wz.stepDotNum, active && wz.stepDotNumActive]}>{idx + 1}</Text>}
                  </View>
                  <Text style={[wz.stepLabelText, active && wz.stepLabelTextActive]}>{lab}</Text>
                </View>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={wz.content}
          >
            {wizardStep === 0 ? (
              <View style={wz.stepContent}>
                <Text style={wz.stepHeading}>מה כותרת הפוש?</Text>
                <Text style={wz.stepHint}>הכותרת היא הדבר הראשון שהמשתמש יראה</Text>
                <Input
                  label="כותרת"
                  value={pushTitle}
                  onChangeText={setPushTitle}
                  placeholder="לדוגמה: מבצע חדש בחנות 🎉"
                />
                {!!pushTitle.trim() && (
                  <View style={wz.previewChip}>
                    <View style={wz.previewChipBar} />
                    <View style={{ flex: 1 }}>
                      <Text style={wz.previewChipLabel}>תצוגה מקדימה</Text>
                      <Text style={wz.previewChipTitle} numberOfLines={1}>{pushTitle.trim()}</Text>
                    </View>
                    <Text style={{ fontSize: 22 }}>🔔</Text>
                  </View>
                )}
              </View>
            ) : null}

            {wizardStep === 1 ? (
              <View style={wz.stepContent}>
                <Text style={wz.stepHeading}>סוג הפוש</Text>
                <Text style={wz.stepHint}>בחר אם הפוש כללי או קשור למוצר ספציפי</Text>
                <View style={{ gap: 12 }}>
                  <Pressable
                    onPress={() => setPushScope('general')}
                    style={[wz.scopeCard, pushScope === 'general' && wz.scopeCardActive]}
                  >
                    <View style={wz.scopeCardLeft}>
                      <Text style={wz.scopeCardIcon}>📢</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[wz.scopeCardTitle, pushScope === 'general' && wz.scopeCardTitleActive]}>
                        כללי
                      </Text>
                      <Text style={wz.scopeCardSub}>פוש שלא קשור למוצר ספציפי</Text>
                    </View>
                    {pushScope === 'general' && <View style={wz.scopeCheck}><Text style={wz.scopeCheckText}>✓</Text></View>}
                  </Pressable>

                  <Pressable
                    onPress={() => setPushScope('product')}
                    style={[wz.scopeCard, pushScope === 'product' && wz.scopeCardActive]}
                  >
                    <View style={wz.scopeCardLeft}>
                      <Text style={wz.scopeCardIcon}>🛍</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[wz.scopeCardTitle, pushScope === 'product' && wz.scopeCardTitleActive]}>
                        קשור למוצר
                      </Text>
                      <Text style={wz.scopeCardSub}>לחיצה על הפוש תפתח מוצר באפליקציה</Text>
                    </View>
                    {pushScope === 'product' && <View style={wz.scopeCheck}><Text style={wz.scopeCheckText}>✓</Text></View>}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {wizardStep === 2 ? (
              <View style={wz.stepContent}>
                <Text style={wz.stepHeading}>בחירת מוצרים</Text>
                <Text style={wz.stepHint}>
                  {pushScope !== 'product'
                    ? 'שלב זה לא רלוונטי לפוש כללי — אפשר לעבור הלאה'
                    : 'אפשר לבחור מוצר אחד או יותר (אופציונלי)'}
                </Text>

                {pushScope === 'product' ? (
                  <>
                    <Pressable
                      onPress={() => setProductPickerOpen(true)}
                      disabled={loadingProducts}
                      style={({ pressed }) => [wz.productTrigger, pressed && wz.productTriggerPressed]}
                    >
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={wz.productTriggerLabel}>מוצרים נבחרים</Text>
                        {loadingProducts ? (
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={wz.productTriggerValue}>טוען…</Text>
                          </View>
                        ) : (
                          <Text numberOfLines={1} style={[wz.productTriggerValue, !selectedHandles.length && wz.productTriggerPlaceholder]}>
                            {selectedHandles.length ? `${selectedHandles.length} מוצרים נבחרו` : 'לחץ לבחירת מוצרים…'}
                          </Text>
                        )}
                      </View>
                      <Text style={wz.productTriggerChevron}>‹</Text>
                    </Pressable>

                    {selectedProducts.length > 0 && (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        {selectedProducts.slice(0, 4).map((p) => (
                          <View key={p.handle} style={wz.selectedProductRow}>
                            <ProductThumb imageUrl={p.imageUrl} size={44} />
                            <View style={{ flex: 1 }}>
                              <Text style={wz.selectedProductTitle} numberOfLines={1}>{p.title}</Text>
                              <Text style={wz.selectedProductPrice}>{formatPrice(p.price, p.currencyCode)}</Text>
                            </View>
                            <Pressable
                              onPress={() => setSelectedHandles((prev) => prev.filter((h) => h !== p.handle))}
                              hitSlop={8}
                            >
                              <Text style={{ color: colors.muted, fontSize: 18, fontWeight: '600' }}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                        {selectedProducts.length > 4 && (
                          <Text style={{ color: colors.muted, textAlign: 'right', fontWeight: '700', fontSize: 12 }}>
                            ועוד {selectedProducts.length - 4} מוצרים…
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={wz.skipNote}>
                    <Text style={{ fontSize: 24 }}>⏭</Text>
                    <Text style={wz.skipNoteText}>ניתן לדלג לשלב הבא</Text>
                  </View>
                )}
              </View>
            ) : null}

            {wizardStep === 3 ? (
              <View style={wz.stepContent}>
                <Text style={wz.stepHeading}>תוכן הפוש</Text>
                <Text style={wz.stepHint}>מה ירצה לראות המשתמש כשמגיעה ההתראה?</Text>
                <Input
                  label="גוף ההתראה"
                  value={pushBody}
                  onChangeText={setPushBody}
                  placeholder="לדוגמה: 20% הנחה על כל המוצרים עד חצות 🛒"
                  multiline
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
                {(!!pushTitle.trim() || !!pushBody.trim()) && (
                  <View style={wz.previewChip}>
                    <View style={wz.previewChipBar} />
                    <View style={{ flex: 1 }}>
                      <Text style={wz.previewChipLabel}>תצוגה מקדימה</Text>
                      {!!pushTitle.trim() && <Text style={wz.previewChipTitle} numberOfLines={1}>{pushTitle.trim()}</Text>}
                      {!!pushBody.trim() && <Text style={wz.previewChipBody} numberOfLines={2}>{pushBody.trim()}</Text>}
                    </View>
                    <Text style={{ fontSize: 22 }}>🔔</Text>
                  </View>
                )}
              </View>
            ) : null}

            {wizardStep === 4 ? (
              <View style={wz.stepContent}>
                <Text style={wz.stepHeading}>תזמון שליחה</Text>
                <Text style={wz.stepHint}>מתי לשלוח את הפוש?</Text>

                <View style={{ gap: 12 }}>
                  <Pressable
                    onPress={() => setScheduleMode('now')}
                    style={[wz.scopeCard, scheduleMode === 'now' && wz.scopeCardActive]}
                  >
                    <View style={wz.scopeCardLeft}>
                      <Text style={wz.scopeCardIcon}>⚡</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[wz.scopeCardTitle, scheduleMode === 'now' && wz.scopeCardTitleActive]}>שלח עכשיו</Text>
                      <Text style={wz.scopeCardSub}>שיגור מיידי לכל המשתמשים</Text>
                    </View>
                    {scheduleMode === 'now' && <View style={wz.scopeCheck}><Text style={wz.scopeCheckText}>✓</Text></View>}
                  </Pressable>

                  <Pressable
                    onPress={() => setScheduleMode('scheduled')}
                    style={[wz.scopeCard, scheduleMode === 'scheduled' && wz.scopeCardActive]}
                  >
                    <View style={wz.scopeCardLeft}>
                      <Text style={wz.scopeCardIcon}>🗓</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[wz.scopeCardTitle, scheduleMode === 'scheduled' && wz.scopeCardTitleActive]}>תזמן לתאריך ושעה</Text>
                      <Text style={wz.scopeCardSub}>בחר מועד שיגור בעתיד</Text>
                    </View>
                    {scheduleMode === 'scheduled' && <View style={wz.scopeCheck}><Text style={wz.scopeCheckText}>✓</Text></View>}
                  </Pressable>
                </View>

                {scheduleMode === 'scheduled' ? (
                  <View style={{ marginTop: 16, gap: 12 }}>
                    <View style={wz.datetimeDisplay}>
                      <Text style={wz.datetimeDisplayLabel}>מועד נבחר</Text>
                      <Text style={wz.datetimeDisplayValue}>{scheduledAt.toLocaleString('he-IL')}</Text>
                    </View>

                    {Platform.OS === 'android' ? (
                      <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Button title="בחר תאריך" variant="secondary" onPress={() =>
                            DateTimePickerAndroid.open({
                              value: scheduledAt, mode: 'date', is24Hour: true,
                              onChange: (_e, d) => { if (!d) return; const n = new Date(scheduledAt); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setScheduledAt(n); },
                            })
                          } />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button title="בחר שעה" variant="secondary" onPress={() =>
                            DateTimePickerAndroid.open({
                              value: scheduledAt, mode: 'time', is24Hour: true,
                              onChange: (_e, d) => { if (!d) return; const n = new Date(scheduledAt); n.setHours(d.getHours(), d.getMinutes(), 0, 0); setScheduledAt(n); },
                            })
                          } />
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                          <Pressable onPress={() => setIosPickerMode('date')} style={[wz.modePill, iosPickerMode === 'date' && wz.modePillActive]}>
                            <Text style={[wz.modePillText, iosPickerMode === 'date' && wz.modePillTextActive]}>תאריך</Text>
                          </Pressable>
                          <Pressable onPress={() => setIosPickerMode('time')} style={[wz.modePill, iosPickerMode === 'time' && wz.modePillActive]}>
                            <Text style={[wz.modePillText, iosPickerMode === 'time' && wz.modePillTextActive]}>שעה</Text>
                          </Pressable>
                        </View>
                        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: colors.border }}>
                          <DateTimePicker
                            value={scheduledAt} mode={iosPickerMode} display="inline"
                            themeVariant="light"
                            onChange={(_e, d) => {
                              if (!d) return;
                              const n = new Date(scheduledAt);
                              if (iosPickerMode === 'date') n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                              else n.setHours(d.getHours(), d.getMinutes(), 0, 0);
                              setScheduledAt(n);
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Summary card */}
                <View style={wz.summaryCard}>
                  <Text style={wz.summaryTitle}>סיכום הפוש</Text>
                  <View style={wz.summaryRow}>
                    <Text style={wz.summaryVal} numberOfLines={1}>{pushTitle.trim() || '—'}</Text>
                    <Text style={wz.summaryKey}>כותרת</Text>
                  </View>
                  <View style={wz.summaryRow}>
                    <Text style={wz.summaryVal} numberOfLines={2}>{pushBody.trim() || '—'}</Text>
                    <Text style={wz.summaryKey}>תוכן</Text>
                  </View>
                  <View style={wz.summaryRow}>
                    <Text style={wz.summaryVal}>{pushScope === 'general' ? 'כללי' : `קשור למוצר (${selectedHandles.length})`}</Text>
                    <Text style={wz.summaryKey}>סוג</Text>
                  </View>
                  <View style={wz.summaryRow}>
                    <Text style={wz.summaryVal}>{scheduleMode === 'now' ? 'מיידי' : scheduledAt.toLocaleString('he-IL')}</Text>
                    <Text style={wz.summaryKey}>תזמון</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={wz.footer}>
            {wizardStep < 4 ? (
              <Pressable
                style={({ pressed }) => [wz.nextBtn, pressed && wz.nextBtnPressed]}
                onPress={() => {
                  if (wizardStep === 0 && !canNextTitle) return Toast.show({ type: 'error', text1: 'חסרה כותרת' });
                  if (wizardStep === 3 && !canNextBody) return Toast.show({ type: 'error', text1: 'חסר תוכן' });
                  setWizardStep((p) => Math.min(4, p + 1));
                }}
              >
                <Text style={wz.nextBtnText}>הבא</Text>
                <Text style={wz.nextBtnArrow}>←</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [wz.sendBtn, pressed && wz.sendBtnPressed]}
                onPress={submitWizard}
              >
                <Text style={wz.sendBtnText}>{scheduleMode === 'scheduled' ? '🗓 תזמן פוש' : '📣 שגר עכשיו'}</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <ProductPickerModal
        visible={productPickerOpen}
        products={products}
        loading={loadingProducts}
        multi
        selectedHandles={selectedHandles}
        onChangeSelectedHandles={setSelectedHandles}
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

  /* ── Store stats ── */
  statsGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
    flexWrap: 'wrap',
  },
  statTile: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 110,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  statLabel: { color: '#64748B', fontWeight: '800', fontSize: 12, textAlign: 'right' },
  statValue: { color: '#0F172A', fontWeight: '900', fontSize: 24, textAlign: 'right', marginTop: 6, letterSpacing: -0.4 },
  statHint: { color: '#94A3B8', fontWeight: '700', fontSize: 11, textAlign: 'right', marginTop: 6 },

  /* ── Push launcher (simple beautiful button card) ── */
  pushLauncher: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  pushLauncherPressed: { opacity: 0.92, transform: [{ scale: 0.992 }] },
  pushLauncherInner: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(37,99,235,0.20)',
    overflow: 'hidden',
  },
  pushLauncherFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  pushLauncherGlowA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.12)',
    top: -90,
    right: -80,
  },
  pushLauncherGlowB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.10)',
    bottom: -70,
    left: -70,
  },
  pushLauncherRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  pushLauncherIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushLauncherIcon: { fontSize: 22 },
  pushLauncherTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  pushLauncherSub: { color: '#475569', fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  pushLauncherTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
  },
  pushLauncherTagText: { color: '#166534', fontWeight: '900', fontSize: 11 },
  pushLauncherMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
  },
  metaPillText: { color: '#1D4ED8', fontWeight: '900', fontSize: 12 },
  metaPillMuted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.14)',
  },
  metaPillMutedText: { color: '#64748B', fontWeight: '800', fontSize: 11 },
  pushLauncherChevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushLauncherChevron: { color: '#64748B', fontSize: 22, fontWeight: '600' },

  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  statusText: { color: colors.muted, fontWeight: '700', fontSize: 13 },

  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronIcon: { color: colors.muted, fontSize: 18, fontWeight: '600' },
});

/* ─────────────────────────────────────────────────────────
   Wizard (full-screen modal) styles
───────────────────────────────────────────────────────── */
const wz = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* Header */
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
  },
  navBtn: {
    minWidth: 70,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  navBtnText: { color: '#475569', fontWeight: '800', fontSize: 14 },
  stepBadge: {
    minWidth: 70,
    alignItems: 'flex-end',
    paddingRight: 2,
  },
  stepBadgeText: { color: '#94A3B8', fontWeight: '800', fontSize: 13 },

  /* Progress */
  progressTrack: {
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#2563EB',
    borderRadius: 999,
  },

  /* Step label row */
  stepLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 4,
  },
  stepLabelItem: { alignItems: 'center', gap: 4, flex: 1 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  stepDotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  stepDotNum: { color: '#94A3B8', fontWeight: '900', fontSize: 11 },
  stepDotNumActive: { color: '#FFFFFF' },
  stepDotCheck: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  stepLabelText: { color: '#94A3B8', fontWeight: '700', fontSize: 10, textAlign: 'center' },
  stepLabelTextActive: { color: '#2563EB', fontWeight: '900' },

  /* Scroll content */
  content: { padding: 16, gap: 14, paddingBottom: 16 },

  /* Step content wrapper */
  stepContent: { gap: 14 },
  stepHeading: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  stepHint: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 20,
  },

  /* Preview chip */
  previewChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 4,
  },
  previewChipBar: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#0EA5E9',
  },
  previewChipLabel: { color: '#0369A1', fontWeight: '800', fontSize: 10, textAlign: 'right', marginBottom: 2 },
  previewChipTitle: { color: '#0F172A', fontWeight: '900', fontSize: 13, textAlign: 'right' },
  previewChipBody: { color: '#475569', fontWeight: '600', fontSize: 12, textAlign: 'right', marginTop: 2 },

  /* Scope / schedule cards */
  scopeCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  scopeCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  scopeCardLeft: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCardIcon: { fontSize: 22 },
  scopeCardTitle: { color: '#0F172A', fontWeight: '900', fontSize: 15, textAlign: 'right' },
  scopeCardTitleActive: { color: '#1D4ED8' },
  scopeCardSub: { color: '#94A3B8', fontWeight: '600', fontSize: 12, textAlign: 'right', marginTop: 2 },
  scopeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCheckText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },

  /* Product trigger */
  productTrigger: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  productTriggerPressed: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  productTriggerLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  productTriggerValue: { color: '#0F172A', fontWeight: '900', fontSize: 14, textAlign: 'right', marginTop: 2 },
  productTriggerPlaceholder: { color: '#94A3B8', fontWeight: '700' },
  productTriggerChevron: { color: '#94A3B8', fontSize: 22, fontWeight: '600' },

  /* Selected product row */
  selectedProductRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  selectedProductTitle: { color: '#0F172A', fontWeight: '800', fontSize: 13, textAlign: 'right' },
  selectedProductPrice: { color: '#64748B', fontWeight: '700', fontSize: 12, textAlign: 'right', marginTop: 2 },

  /* Skip note */
  skipNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skipNoteText: { color: '#64748B', fontWeight: '700', fontSize: 14 },

  /* Datetime */
  datetimeDisplay: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  datetimeDisplayLabel: { color: '#94A3B8', fontWeight: '800', fontSize: 12 },
  datetimeDisplayValue: { color: '#0F172A', fontWeight: '900', fontSize: 14 },

  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  modePillActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  modePillText: { color: '#64748B', fontWeight: '800', fontSize: 13 },
  modePillTextActive: { color: '#1D4ED8' },

  /* Summary card */
  summaryCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 4,
  },
  summaryTitle: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 10,
  },
  summaryKey: { color: '#94A3B8', fontWeight: '800', fontSize: 12, minWidth: 48, textAlign: 'left' },
  summaryVal: { color: '#0F172A', fontWeight: '700', fontSize: 13, textAlign: 'right', flex: 1 },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  nextBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#1D4ED8',
  },
  nextBtnPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  nextBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  nextBtnArrow: { color: '#93C5FD', fontSize: 18, fontWeight: '900' },

  sendBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#0F172A',
  },
  sendBtnPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  sendBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
});
