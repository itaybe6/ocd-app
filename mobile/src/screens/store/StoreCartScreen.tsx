import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useCart } from '../../state/CartContext';
import {
  getStoreBottomBarMetrics,
  StoreFloatingTabBar,
  type StoreBottomTabId,
} from './StoreHomeScreen';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const COLORS = {
  background: '#F3F5F7',
  surface: '#FFFFFF',
  border: '#E6EAF0',
  text: '#111827',
  muted: '#6B7280',
  softText: '#97A1AF',
  dark: '#121826',
  accent: '#00C2A8',
  accentSoft: '#E7FBF7',
  danger: '#B91C1C',
  dangerSoft: '#FFF3F2',
  pill: '#EFF3F6',
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
        style={{ width: '100%', height: '100%', borderRadius: 20 }}
      />
    );
  }

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 20,
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

function SurfaceActionButton({
  onPress,
  disabled = false,
  label,
  backgroundColor,
  borderColor,
  textColor,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  backgroundColor: string;
  borderColor?: string;
  textColor: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ flex: 1, opacity: pressed || disabled ? 0.55 : 1 })}>
      <View
        style={{
          minHeight: 48,
          borderRadius: 18,
          backgroundColor,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
        }}
      >
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '800', ...RTL_TEXT }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 4,
      }}
    >
      <Text style={{ color: COLORS.softText, fontSize: 11, fontWeight: '700', ...RTL_TEXT }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>{value}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: emphasized ? COLORS.text : COLORS.muted, fontSize: 14, fontWeight: emphasized ? '800' : '600', ...RTL_TEXT }}>
        {label}
      </Text>
      <Text style={{ color: COLORS.text, fontSize: emphasized ? 16 : 14, fontWeight: emphasized ? '900' : '700' }}>{value}</Text>
    </View>
  );
}

export function StoreCartScreen({
  onBack,
  onTabPress,
  onOpenCheckout,
}: {
  onBack: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
  onOpenCheckout: (checkoutUrl: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom, bottomBarHeight, bottomBarOffset } = getStoreBottomBarMetrics(insets.bottom);
  const {
    checkoutUrl,
    items,
    itemCount,
    subtotal,
    currencyCode,
    isBootstrapping,
    isMutating,
    updateQuantity,
    removeItem,
    clearCart,
    refreshCart,
  } = useCart();

  const handleCheckout = () => {
    if (!items.length || !checkoutUrl || isMutating) return;
    onOpenCheckout(checkoutUrl);
  };

  const handleRefresh = () => {
    void refreshCart();
  };

  const handleClearCart = () => {
    if (!items.length) return;

    Toast.show({
      type: 'info',
      text1: 'העגלה תנוקה מיידית',
      text2: 'אפשר להוסיף שוב כל מוצר בכל רגע',
    });
    void clearCart();
  };

  const checkoutFooterOffset = bottomBarOffset + bottomBarHeight + 12;
  const checkoutFooterHeight = items.length ? 128 : 0;
  const bottomPadding = contentPaddingBottom + checkoutFooterHeight + 28;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomPadding,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: 'row-reverse',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 2,
            }}
          >
            <Pressable
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900' }}>→</Text>
            </Pressable>

            <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: '900', ...RTL_TEXT }}>העגלה שלך</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 4, ...RTL_TEXT }}>
                {itemCount ? `${itemCount} פריטים מוכנים להמשך רכישה` : 'כאן תראה את כל מה שבחרת לפני המעבר לקופה'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
            <StatPill label="פריטים" value={`${itemCount}`} />
            <StatPill label="סכום ביניים" value={formatPrice(subtotal, currencyCode)} />
          </View>

          {isBootstrapping && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 24,
                alignItems: 'center',
                gap: 12,
              }}
            >
              <ActivityIndicator size="large" color={COLORS.text} />
              <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '900', ...RTL_TEXT }}>טוען את עגלת Shopify...</Text>
            </View>
          )}

          {!isBootstrapping && !items.length && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 22,
                paddingVertical: 28,
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.pill,
                }}
              >
                <ShoppingCart size={26} color={COLORS.text} />
              </View>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '900', ...RTL_TEXT }}>העגלה עדיין ריקה</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 21, ...RTL_TEXT }}>
                ברגע שתוסיף מוצרים מהחנות, הם יופיעו כאן במבנה נקי ונוח עם מעבר מהיר לתשלום.
              </Text>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => ({
                  marginTop: 4,
                  minWidth: 160,
                  borderRadius: 18,
                  backgroundColor: COLORS.dark,
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', ...RTL_TEXT }}>חזרה לחנות</Text>
              </Pressable>
            </View>
          )}

          {!!items.length && (
            <View style={{ gap: 12 }}>
              {items.map((item) => {
                const variantLabel =
                  item.product.variantTitle && item.product.variantTitle !== 'Default Title'
                    ? `${item.product.subtitle} • ${item.product.variantTitle}`
                    : item.product.subtitle;

                return (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: COLORS.surface,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      padding: 12,
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 92, height: 92 }}>
                        <CartProductImage
                          imageUrl={item.product.imageUrl}
                          imageAltText={item.product.imageAltText}
                          name={item.product.name}
                          coverColor={item.product.coverColor}
                          accentColor={item.product.accentColor}
                        />
                      </View>

                      <View style={{ flex: 1, alignItems: 'flex-end', gap: 6 }}>
                        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>
                          {item.product.name}
                        </Text>
                        <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, ...RTL_TEXT }}>{variantLabel}</Text>
                        <View
                          style={{
                            alignSelf: 'stretch',
                            flexDirection: 'row-reverse',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 2,
                          }}
                        >
                          <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: '900' }}>
                            {formatPrice(item.cost.totalAmount, item.cost.currencyCode)}
                          </Text>
                          <Text style={{ color: COLORS.softText, fontSize: 12, ...RTL_TEXT }}>{item.quantity} יחידות</Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: COLORS.pill,
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                        }}
                      >
                        <SurfaceIconButton
                          onPress={() => {
                            void updateQuantity(item.product.id, item.quantity + 1);
                          }}
                          size={30}
                          backgroundColor={COLORS.surface}
                          borderColor={COLORS.border}
                          disabled={isMutating}
                        >
                          <Plus size={15} color={COLORS.text} />
                        </SurfaceIconButton>
                        <Text style={{ minWidth: 26, textAlign: 'center', color: COLORS.text, fontSize: 15, fontWeight: '900' }}>
                          {item.quantity}
                        </Text>
                        <SurfaceIconButton
                          onPress={() => {
                            void updateQuantity(item.product.id, item.quantity - 1);
                          }}
                          size={30}
                          backgroundColor={COLORS.surface}
                          borderColor={COLORS.border}
                          disabled={isMutating}
                        >
                          <Minus size={15} color={COLORS.text} />
                        </SurfaceIconButton>
                      </View>

                      <Pressable
                        onPress={() => {
                          void removeItem(item.product.id);
                        }}
                        disabled={isMutating}
                        style={({ pressed }) => ({
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 6,
                          borderRadius: 999,
                          backgroundColor: COLORS.dangerSoft,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          opacity: pressed || isMutating ? 0.55 : 1,
                        })}
                      >
                        <Trash2 size={15} color={COLORS.danger} />
                        <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '800', ...RTL_TEXT }}>הסר</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {!!items.length && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 18,
                gap: 14,
              }}
            >
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '900', ...RTL_TEXT }}>לפני המעבר לקופה</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, ...RTL_TEXT }}>
                  עמוד התשלום, הכתובת והשילוח מנוהלים ישירות דרך Shopify.
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                <SummaryRow label="סכום ביניים" value={formatPrice(subtotal, currencyCode)} emphasized />
                <SummaryRow label="שילוח" value="מחושב בקופה" />
                <SummaryRow label="אמצעי תשלום" value="ב- Shopify" />
              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <SurfaceActionButton
                  onPress={handleRefresh}
                  disabled={isMutating}
                  label="רענון עגלה"
                  backgroundColor={COLORS.surface}
                  borderColor={COLORS.border}
                  textColor={COLORS.text}
                />
                <SurfaceActionButton
                  onPress={handleClearCart}
                  disabled={isMutating}
                  label="ניקוי עגלה"
                  backgroundColor={COLORS.dangerSoft}
                  borderColor="#F7D8D5"
                  textColor={COLORS.danger}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {!!items.length && (
          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: checkoutFooterOffset,
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 26,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 12,
                gap: 12,
                shadowColor: '#000000',
                shadowOpacity: 0.1,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '700', ...RTL_TEXT }}>סה"כ לתשלום</Text>
                  <Text style={{ color: COLORS.softText, fontSize: 11, ...RTL_TEXT }}>השילוח והמסים יושלמו בקופה</Text>
                </View>
                <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: '900' }}>{formatPrice(subtotal, currencyCode)}</Text>
              </View>

              <Pressable
                onPress={handleCheckout}
                disabled={isMutating || !checkoutUrl}
                style={({ pressed }) => ({
                  minHeight: 56,
                  borderRadius: 20,
                  backgroundColor: isMutating || !checkoutUrl ? '#8A94A6' : COLORS.dark,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>
                  {isMutating ? 'מעדכן את העגלה...' : 'המשך לתשלום'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <StoreFloatingTabBar activeTab="home" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
