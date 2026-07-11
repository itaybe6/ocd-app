import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { computeOcdPlusPrice } from '../../components/OcdPlusProductPriceBlock';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { useCart } from '../../state/CartContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const COLORS = {
  /** רקע ראשי — אוף-וייט עדין שמרים את האפליקציה אווירירית */
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFBFC',
  border: '#E5E8EE',
  divider: '#F0F2F5',
  text: '#0F172A',
  muted: '#64748B',
  softText: '#94A3B8',
  dark: '#0B1220',
  accent: '#00C2A8',
  danger: '#DC2626',
  pill: '#F1F5F9',
  /** רקע בורר הכמות — אפור בהיר עדין */
  quantityStepperTrack: '#F3F5F8',
  /** בר תשלום צף תחתון — שחור מלא */
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
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#F4F6F9',
        }}
      >
        <Image
          source={{ uri: imageUrl }}
          resizeMode="cover"
          accessibilityLabel={imageAltText ?? name}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
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
              gap: 5,
              opacity: pressed || disabled ? 0.75 : 1,
            })}
          >
            <Trash2 size={22} color="#FFFFFF" strokeWidth={2.1} />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: -0.1 }}>הסרה</Text>
          </Pressable>
        </View>
      )}
    >
      <View style={{ backgroundColor: COLORS.surface }}>{children}</View>
    </ReanimatedSwipeable>
  );
}

function StepperButton({
  onPress,
  children,
  disabled = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        opacity: pressed || disabled ? 0.55 : 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function CartQuantityStepper({
  quantity,
  disabled,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  disabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const isRemoveStep = quantity <= 1;

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        flexShrink: 0,
        backgroundColor: COLORS.quantityStepperTrack,
        borderRadius: 999,
        padding: 3,
        gap: 2,
      }}
    >
      <StepperButton onPress={onIncrement} disabled={disabled}>
        <Plus size={14} color={COLORS.text} strokeWidth={2.4} />
      </StepperButton>
      <Text
        style={{
          minWidth: 26,
          textAlign: 'center',
          color: COLORS.text,
          fontSize: 14,
          fontWeight: '700',
        }}
      >
        {quantity}
      </Text>
      <StepperButton onPress={onDecrement} disabled={disabled}>
        {isRemoveStep ? (
          <Trash2 size={13} color={COLORS.danger} strokeWidth={2.2} />
        ) : (
          <Minus size={14} color={COLORS.text} strokeWidth={2.4} />
        )}
      </StepperButton>
    </View>
  );
}

export function StoreCartScreen({
  onBack,
  onOpenCheckout,
}: {
  onBack: () => void;
  onOpenCheckout: (checkoutUrl: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { isActiveMember } = useOcdPlusMembership();
  const isMember = isActiveMember;
  const {
    checkoutUrl,
    items,
    subtotal,
    currencyCode,
    isBootstrapping,
    isMutating,
    updateQuantity,
    removeItem,
    getQuantity,
  } = useCart();
  const [isCheckoutPreparing, setIsCheckoutPreparing] = useState(false);

  const displaySubtotal = useMemo(
    () => (isMember ? computeOcdPlusPrice(subtotal) : subtotal),
    [isMember, subtotal],
  );

  const memberSavings = useMemo(
    () => (isMember ? Math.max(0, subtotal - displaySubtotal) : 0),
    [displaySubtotal, isMember, subtotal],
  );

  const handleCheckout = () => {
    if (!items.length || !checkoutUrl || isMutating || isCheckoutPreparing) return;
    setIsCheckoutPreparing(true);
    void onOpenCheckout(checkoutUrl).finally(() => setIsCheckoutPreparing(false));
  };

  const checkoutDisabled = isMutating || isCheckoutPreparing || !checkoutUrl;

  const totalItemCount = useMemo(
    () => items.reduce((sum, line) => sum + line.quantity, 0),
    [items]
  );

  /** גובה בר התשלום הצף + מרווח — בלי טאב בר */
  const floatingCheckoutReserve = 72;
  const scrollBottomPadding = insets.bottom + floatingCheckoutReserve + 28;
  const handleCartQuantityChange = useCallback(
    (productId: string, nextQty: number) => {
      if (nextQty <= 0) {
        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        void removeItem(productId);
        return;
      }
      void updateQuantity(productId, nextQty);
    },
    [removeItem, updateQuantity]
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="dark" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.divider,
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
              <View style={{ width: 42, height: 42 }} />

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
                  flexDirection: 'row-reverse',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 19,
                    fontWeight: '800',
                    letterSpacing: -0.3,
                    textAlign: 'center',
                  }}
                >
                  העגלה שלך
                </Text>
                {totalItemCount > 0 ? (
                  <View
                    style={{
                      minWidth: 26,
                      height: 22,
                      paddingHorizontal: 8,
                      borderRadius: 11,
                      backgroundColor: COLORS.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.muted,
                        fontSize: 12,
                        fontWeight: '700',
                        lineHeight: 16,
                        includeFontPadding: false,
                      }}
                    >
                      {totalItemCount > 99 ? '99+' : totalItemCount}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={onBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="חזרה"
                style={({ pressed }) => ({
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.surfaceMuted,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <ArrowLeft size={21} color={COLORS.text} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1, backgroundColor: COLORS.background }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 18,
              paddingBottom: scrollBottomPadding,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {isBootstrapping && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: COLORS.divider,
                paddingVertical: 36,
                paddingHorizontal: 22,
                alignItems: 'center',
                gap: 14,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.04,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <ActivityIndicator size="large" color={COLORS.dark} />
              <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', ...RTL_TEXT }}>טוען את העגלה…</Text>
            </View>
          )}

          {!isBootstrapping && !items.length && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: COLORS.divider,
                paddingHorizontal: 24,
                paddingVertical: 40,
                alignItems: 'center',
                gap: 14,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <View
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.surfaceMuted,
                  borderWidth: 1,
                  borderColor: COLORS.divider,
                }}
              >
                <ShoppingCart size={32} color={COLORS.muted} strokeWidth={1.75} />
              </View>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, ...RTL_TEXT }}>
                העגלה עדיין ריקה
              </Text>
              <Text
                style={{
                  color: COLORS.muted,
                  fontSize: 13.5,
                  lineHeight: 21,
                  writingDirection: 'rtl',
                  textAlign: 'center',
                  paddingHorizontal: 6,
                }}
              >
                ברגע שתוסיף מוצרים מהחנות, הם יופיעו כאן — עם סיכום ברור ומעבר מהיר לתשלום.
              </Text>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => ({
                  marginTop: 8,
                  minWidth: 180,
                  borderRadius: 16,
                  backgroundColor: COLORS.dark,
                  paddingHorizontal: 22,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: pressed ? 0.88 : 1,
                  shadowColor: '#0B1220',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 4,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: -0.2 }}>
                  חזרה לחנות
                </Text>
              </Pressable>
            </View>
          )}

          {!!items.length && (
            <>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 4,
                  marginBottom: -4,
                }}
              >
                <Text
                  style={{
                    color: COLORS.muted,
                    fontSize: 12.5,
                    fontWeight: '700',
                    letterSpacing: 0.2,
                    ...RTL_TEXT,
                  }}
                >
                  {totalItemCount} {totalItemCount === 1 ? 'פריט' : 'פריטים'}
                </Text>
                <Text
                  style={{
                    color: COLORS.softText,
                    fontSize: 11.5,
                    fontWeight: '600',
                    ...RTL_TEXT,
                  }}
                >
                  החלק שמאלה למחיקה
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                {items.map((item) => {
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

                  const displayQuantity = getQuantity(item.product.id) || item.quantity;
                  const linePrice = isMember
                    ? computeOcdPlusPrice(item.cost.totalAmount)
                    : item.cost.totalAmount;

                  return (
                    <View
                      key={item.id}
                      style={{
                        borderRadius: 24,
                        backgroundColor: COLORS.surface,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: '#EFF2F6',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.03,
                        shadowRadius: 14,
                        elevation: 1,
                      }}
                    >
                      <CartLineSwipeable
                        disabled={isMutating}
                        removeLabel={`הסר ${item.product.name} מהעגלה`}
                        onRemove={() => {
                          if (Platform.OS !== 'web') {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                          void removeItem(item.product.id);
                        }}
                      >
                        <View style={{ padding: 14 }}>
                          <View style={{ flexDirection: 'row-reverse', gap: 14 }}>
                            <View style={{ width: 84, height: 84, flexShrink: 0 }}>
                              <CartProductImage
                                imageUrl={item.product.imageUrl}
                                imageAltText={item.product.imageAltText}
                                name={item.product.name}
                                coverColor={item.product.coverColor}
                                accentColor={item.product.accentColor}
                              />
                            </View>

                            <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
                              <View style={{ gap: 3, alignItems: 'flex-end' }}>
                                <Text
                                  numberOfLines={2}
                                  style={{
                                    color: COLORS.text,
                                    fontSize: 14.5,
                                    fontWeight: '700',
                                    lineHeight: 20,
                                    letterSpacing: -0.2,
                                    ...RTL_TEXT,
                                  }}
                                >
                                  {item.product.name}
                                </Text>
                                {!!subtextLine && (
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: COLORS.softText, fontSize: 12, lineHeight: 16, ...RTL_TEXT }}
                                  >
                                    {subtextLine}
                                  </Text>
                                )}
                              </View>

                              <View
                                style={{
                                  flexDirection: 'row-reverse',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginTop: 10,
                                }}
                              >
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                                  <Text
                                    style={{
                                      color: COLORS.text,
                                      fontSize: 16.5,
                                      fontWeight: '800',
                                      letterSpacing: -0.3,
                                    }}
                                  >
                                    {formatPrice(linePrice, item.cost.currencyCode)}
                                  </Text>
                                  {isMember && (
                                    <Text
                                      style={{
                                        color: COLORS.softText,
                                        fontSize: 12,
                                        fontWeight: '600',
                                        textDecorationLine: 'line-through',
                                      }}
                                    >
                                      {formatPrice(item.cost.totalAmount, item.cost.currencyCode)}
                                    </Text>
                                  )}
                                </View>

                                <CartQuantityStepper
                                  quantity={displayQuantity}
                                  disabled={isMutating}
                                  onIncrement={() =>
                                    handleCartQuantityChange(item.product.id, displayQuantity + 1)
                                  }
                                  onDecrement={() =>
                                    handleCartQuantityChange(item.product.id, displayQuantity - 1)
                                  }
                                />
                              </View>
                            </View>
                          </View>
                        </View>
                      </CartLineSwipeable>
                    </View>
                  );
                })}
              </View>

              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: '#EFF2F6',
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.03,
                  shadowRadius: 14,
                  elevation: 1,
                  gap: 14,
                }}
              >
                <Text
                  style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    fontWeight: '800',
                    letterSpacing: 0.6,
                    ...RTL_TEXT,
                  }}
                >
                  סיכום הזמנה
                </Text>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.muted, fontSize: 14, fontWeight: '600', ...RTL_TEXT }}>
                    סכום ביניים
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    {isMember ? (
                      <Text
                        style={{
                          color: COLORS.softText,
                          fontSize: 13,
                          fontWeight: '600',
                          textDecorationLine: 'line-through',
                        }}
                      >
                        {formatPrice(subtotal, currencyCode)}
                      </Text>
                    ) : null}
                    <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>
                      {formatPrice(displaySubtotal, currencyCode)}
                    </Text>
                  </View>
                </View>

                {isMember && memberSavings > 0 ? (
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <OcdPlusMark size={16} />
                      <Text style={{ color: COLORS.muted, fontSize: 14, fontWeight: '600', ...RTL_TEXT }}>
                        הנחת OCD+ (13%)
                      </Text>
                    </View>
                    <Text style={{ color: '#059669', fontSize: 15, fontWeight: '700' }}>
                      −{formatPrice(memberSavings, currencyCode)}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.muted, fontSize: 14, fontWeight: '600', ...RTL_TEXT }}>משלוח</Text>
                  <Text style={{ color: COLORS.softText, fontSize: 13, fontWeight: '600', ...RTL_TEXT }}>
                    מחושב בקופה
                  </Text>
                </View>

                <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 2 }} />

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2, ...RTL_TEXT }}>
                    סך הכל
                  </Text>
                  <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 }}>
                    {formatPrice(displaySubtotal, currencyCode)}
                  </Text>
                </View>
              </View>
            </>
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
                borderRadius: 18,
                backgroundColor: checkoutDisabled ? '#4B5563' : COLORS.checkoutBar,
                shadowColor: '#0B1220',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.22,
                shadowRadius: 20,
                elevation: 18,
                minHeight: 62,
              }}
            >
              <Pressable
                onPress={handleCheckout}
                disabled={checkoutDisabled}
                accessibilityRole="button"
                accessibilityLabel={`מעבר לתשלום, סה״כ ${totalItemCount} פריטים, ${formatPrice(displaySubtotal, currencyCode)}`}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 62,
                  width: '100%',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  opacity: pressed && !checkoutDisabled ? 0.9 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 18,
                      fontWeight: '800',
                      letterSpacing: -0.3,
                      flexShrink: 0,
                      lineHeight: 23,
                      includeFontPadding: false,
                    }}
                  >
                    {formatPrice(displaySubtotal, currencyCode)}
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
                        minWidth: 28,
                        height: 28,
                        paddingHorizontal: totalItemCount > 9 ? 8 : 0,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.16)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 18, includeFontPadding: false }}>
                        {totalItemCount > 99 ? '99+' : totalItemCount}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '800',
                        letterSpacing: -0.2,
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
