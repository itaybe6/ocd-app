import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../state/CartContext';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

/** סגירה אוטומטית של בורר הכמות (+/−) לאחר כמה שניות ללא פעולה — כמו במסך מוצר */
const CART_QUANTITY_STEPPER_AUTO_CLOSE_MS = 3200;

const COLORS = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#EDF1F6',
  text: '#0F172A',
  muted: '#64748B',
  softText: '#94A3B8',
  dark: '#0B1220',
  accent: '#00C2A8',
  danger: '#DC2626',
  pill: '#F1F5F9',
  /** בורר כמות פתוח — רקע אפור בהיר, לא ירוק/טורקיז */
  quantityStepperTrack: '#EEF1F5',
  quantityStepperBorder: '#D1D5DB',
  /** תיבת כמות סגורה — מסגרת עדינה */
  quantityChipBorder: '#D1D5DB',
  quantityCircleBorder: '#E2E8F0',
  /** בר תשלום צף תחתון */
  checkoutBar: '#000000',
};

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') {
    return `₪${price.toLocaleString('he-IL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${price.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
}

function CartProductImage({
  imageUrl,
  imageAltText,
  name,
  coverColor,
  accentColor,
}: {
  imageUrl: string | null;
  imageAltText: string | null;
  name: string;
  coverColor: string;
  accentColor: string;
}) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        resizeMode="cover"
        accessibilityLabel={imageAltText ?? name}
        style={{ width: '100%', height: '100%', borderRadius: 14 }}
      />
    );
  }

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        backgroundColor: coverColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 34,
          height: 48,
          borderRadius: 12,
          backgroundColor: accentColor,
        }}
      />
    </View>
  );
}

function CartLineSwipeable({
  children,
  disabled,
  onRemove,
  removeLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <ReanimatedSwipeable
      enabled={!disabled}
      friction={2}
      overshootLeft={false}
      renderLeftActions={() => (
        <View
          style={{
            width: 88,
            alignSelf: 'stretch',
            backgroundColor: COLORS.danger,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => {
              onRemove();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            style={({ pressed }) => ({
              flex: 1,
              alignSelf: 'stretch',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: pressed || disabled ? 0.75 : 1,
            })}
          >
            <Trash2 size={24} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      )}
    >
      <View style={{ backgroundColor: COLORS.surface }}>{children}</View>
    </ReanimatedSwipeable>
  );
}

function CartQuantityPicker({
  productId,
  quantity,
  disabled,
  expanded,
  onExpand,
  onQuantityChange,
}: {
  productId: string;
  quantity: number;
  disabled?: boolean;
  expanded: boolean;
  onExpand: () => void;
  onQuantityChange: (productId: string, nextQty: number) => void;
}) {
  if (!expanded) {
    return (
      <Pressable
        disabled={disabled}
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={`כמות ${quantity}, לחיצה לשינוי`}
        hitSlop={6}
        style={({ pressed }) => ({
          opacity: pressed || disabled ? 0.65 : 1,
          flexShrink: 0,
        })}
      >
        <View
          style={{
            minWidth: 40,
            height: 40,
            paddingHorizontal: 8,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: COLORS.quantityChipBorder,
            backgroundColor: COLORS.surface,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, letterSpacing: -0.2 }}>{quantity}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        backgroundColor: COLORS.quantityStepperTrack,
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: COLORS.quantityStepperBorder,
      }}
    >
      <SurfaceIconButton
        onPress={() => {
          onQuantityChange(productId, quantity + 1);
        }}
        size={30}
        backgroundColor={COLORS.surface}
        borderColor={COLORS.quantityCircleBorder}
        disabled={disabled}
      >
        <Plus size={15} color={COLORS.text} strokeWidth={2.2} />
      </SurfaceIconButton>
      <Text
        style={{
          minWidth: 24,
          textAlign: 'center',
          color: COLORS.text,
          fontSize: 15,
          fontWeight: '700',
        }}
      >
        {quantity}
      </Text>
      <SurfaceIconButton
        onPress={() => {
          onQuantityChange(productId, quantity - 1);
        }}
        size={30}
        backgroundColor={COLORS.surface}
        borderColor={COLORS.quantityCircleBorder}
        disabled={disabled}
      >
        <Minus size={15} color={COLORS.text} strokeWidth={2.2} />
      </SurfaceIconButton>
    </View>
  );
}

function SurfaceIconButton({
  onPress,
  children,
  size,
  backgroundColor,
  borderColor,
  disabled = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  size: number;
  backgroundColor: string;
  borderColor?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        borderWidth: borderColor ? 1 : 0,
        borderColor,
        opacity: pressed || disabled ? 0.55 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function StoreCartScreen({
  onBack,
  onOpenCheckout,
}: {
  onBack: () => void;
  onOpenCheckout: (checkoutUrl: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const {
    checkoutUrl,
    items,
    subtotal,
    currencyCode,
    isBootstrapping,
    isMutating,
    updateQuantity,
    removeItem,
  } = useCart();

  const handleCheckout = () => {
    if (!items.length || !checkoutUrl || isMutating) return;
    onOpenCheckout(checkoutUrl);
  };

  const totalItemCount = useMemo(
    () => items.reduce((sum, line) => sum + line.quantity, 0),
    [items]
  );

  /** גובה בר התשלום הצף + מרווח — בלי טאב בר */
  const floatingCheckoutReserve = 72;
  const scrollBottomPadding = insets.bottom + floatingCheckoutReserve + 28;
  const [openQuantityLineId, setOpenQuantityLineId] = useState<string | null>(null);
  const quantityStepperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearQuantityStepperTimer = useCallback(() => {
    if (quantityStepperTimerRef.current !== null) {
      clearTimeout(quantityStepperTimerRef.current);
      quantityStepperTimerRef.current = null;
    }
  }, []);

  const scheduleQuantityStepperClose = useCallback(() => {
    clearQuantityStepperTimer();
    quantityStepperTimerRef.current = setTimeout(() => {
      setOpenQuantityLineId(null);
      quantityStepperTimerRef.current = null;
    }, CART_QUANTITY_STEPPER_AUTO_CLOSE_MS);
  }, [clearQuantityStepperTimer]);

  useEffect(() => () => clearQuantityStepperTimer(), [clearQuantityStepperTimer]);

  const handleOpenQuantityLine = useCallback(
    (lineId: string) => {
      setOpenQuantityLineId(lineId);
      scheduleQuantityStepperClose();
    },
    [scheduleQuantityStepperClose]
  );

  const handleCartQuantityChange = useCallback(
    (productId: string, nextQty: number) => {
      void updateQuantity(productId, nextQty);
      scheduleQuantityStepperClose();
    },
    [updateQuantity, scheduleQuantityStepperClose]
  );

  const closeQuantityStepper = useCallback(() => {
    clearQuantityStepperTimer();
    setOpenQuantityLineId(null);
  }, [clearQuantityStepperTimer]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="dark" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View
            style={{
              backgroundColor: COLORS.surface,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 6,
              zIndex: 2,
            }}
          >
            <View style={{ height: insets.top, backgroundColor: COLORS.surface }} />
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 14,
              }}
            >
              <Pressable
                onPress={onBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="חזרה"
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.pill,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <ArrowRight size={22} color={COLORS.text} strokeWidth={2.2} />
              </Pressable>

              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 20,
                    fontWeight: '800',
                    letterSpacing: -0.3,
                    textAlign: 'center',
                  }}
                >
                  העגלה שלך
                </Text>
              </View>

              <View style={{ width: 44, height: 44 }} />
            </View>
          </View>

          <ScrollView
            style={{ flex: 1, backgroundColor: COLORS.background }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: scrollBottomPadding,
              gap: 16,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={closeQuantityStepper}
          >
          {isBootstrapping && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingVertical: 32,
                paddingHorizontal: 22,
                alignItems: 'center',
                gap: 14,
              }}
            >
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '700', ...RTL_TEXT }}>טוען את העגלה…</Text>
            </View>
          )}

          {!isBootstrapping && !items.length && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 24,
                paddingVertical: 36,
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.pill,
                  borderWidth: 1,
                  borderColor: COLORS.divider,
                }}
              >
                <ShoppingCart size={28} color={COLORS.muted} strokeWidth={1.75} />
              </View>
              <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: '800', ...RTL_TEXT }}>העגלה עדיין ריקה</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 21, writingDirection: 'rtl', textAlign: 'center' }}>
                ברגע שתוסיף מוצרים מהחנות, הם יופיעו כאן — עם סיכום ברור ומעבר מהיר לתשלום.
              </Text>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => ({
                  marginTop: 6,
                  minWidth: 168,
                  borderRadius: 16,
                  backgroundColor: COLORS.dark,
                  paddingHorizontal: 22,
                  paddingVertical: 14,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', ...RTL_TEXT }}>חזרה לחנות</Text>
              </Pressable>
            </View>
          )}

          {!!items.length && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 20,
              }}
            >
              {items.map((item, index) => {
                const category = (item.product.subtitle ?? '').trim();
                const variantPart =
                  item.product.variantTitle && item.product.variantTitle !== 'Default Title'
                    ? item.product.variantTitle.trim()
                    : '';
                const pageLabel = (item.product.collectionTitle ?? '').trim();
                const subtextLine =
                  category || variantPart
                    ? [category, variantPart].filter(Boolean).join(' • ')
                    : pageLabel;

                return (
                  <View key={item.id}>
                    {index > 0 ? <View style={{ height: 1, backgroundColor: COLORS.divider }} /> : null}
                    <CartLineSwipeable
                      disabled={isMutating}
                      removeLabel={`הסר ${item.product.name} מהעגלה`}
                      onRemove={() => {
                        void removeItem(item.product.id);
                      }}
                    >
                      <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                          <View style={{ flexShrink: 0 }}>
                            <CartQuantityPicker
                              productId={item.product.id}
                              quantity={item.quantity}
                              disabled={isMutating}
                              expanded={openQuantityLineId === item.id}
                              onExpand={() => handleOpenQuantityLine(item.id)}
                              onQuantityChange={handleCartQuantityChange}
                            />
                          </View>

                          <View style={{ flex: 1, minWidth: 0, gap: 5, alignItems: 'flex-end', justifyContent: 'center' }}>
                            <Text
                              numberOfLines={3}
                              style={{
                                color: COLORS.text,
                                fontSize: 15,
                                fontWeight: '800',
                                lineHeight: 21,
                                ...RTL_TEXT,
                              }}
                            >
                              {item.product.name}
                            </Text>
                            {!!subtextLine && (
                              <Text
                                numberOfLines={2}
                                style={{ color: COLORS.muted, fontSize: 12.5, lineHeight: 18, ...RTL_TEXT }}
                              >
                                {subtextLine}
                              </Text>
                            )}
                            <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800', ...RTL_TEXT }}>
                              {formatPrice(item.cost.totalAmount, item.cost.currencyCode)}
                            </Text>
                          </View>

                          <View style={{ width: 72, height: 72 }}>
                            <CartProductImage
                              imageUrl={item.product.imageUrl}
                              imageAltText={item.product.imageAltText}
                              name={item.product.name}
                              coverColor={item.product.coverColor}
                              accentColor={item.product.accentColor}
                            />
                          </View>
                        </View>
                      </View>
                    </CartLineSwipeable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

          {!!items.length && !isBootstrapping && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: Math.max(10, insets.bottom + 8),
                zIndex: 9999,
                borderRadius: 16,
                backgroundColor: isMutating || !checkoutUrl ? '#4B5563' : COLORS.checkoutBar,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 20,
                minHeight: 60,
              }}
            >
              <Pressable
                onPress={handleCheckout}
                disabled={isMutating || !checkoutUrl}
                accessibilityRole="button"
                accessibilityLabel={`מעבר לתשלום, סה״כ ${totalItemCount} פריטים, ${formatPrice(subtotal, currencyCode)}`}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 60,
                  width: '100%',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  opacity: pressed && !isMutating && checkoutUrl ? 0.88 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 17,
                      fontWeight: '800',
                      flexShrink: 0,
                      lineHeight: 22,
                      includeFontPadding: false,
                    }}
                  >
                    {formatPrice(subtotal, currencyCode)}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 10,
                      flexShrink: 0,
                      marginStart: 12,
                    }}
                  >
                    <View
                      style={{
                        minWidth: 32,
                        height: 32,
                        paddingHorizontal: totalItemCount > 9 ? 7 : 0,
                        borderRadius: 16,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#000000', fontSize: 15, fontWeight: '800', lineHeight: 20, includeFontPadding: false }}>
                        {totalItemCount > 99 ? '99+' : totalItemCount}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '800',
                        lineHeight: 21,
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                    >
                      {isMutating ? 'מעדכן…' : 'מעבר לתשלום'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </View>
  );
}
