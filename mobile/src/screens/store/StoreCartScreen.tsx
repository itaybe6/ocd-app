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
        style={{ width: '100%', height: '100%', borderRadius: 18 }}
      />
    );
  }

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
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
  disabled = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  size: number;
  backgroundColor: string;
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
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        borderRadius: size / 2,
        alignSelf: 'flex-start',
        flexShrink: 0,
        overflow: 'hidden',
        opacity: pressed || disabled ? 0.94 : 1,
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          flexShrink: 0,
        }}
      >
        {children}
      </View>
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
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ opacity: pressed || disabled ? 0.94 : 1 })}>
      <View
        style={{
          borderRadius: 22,
          backgroundColor,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          paddingVertical: 16,
          minHeight: 56,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: textColor, fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>{label}</Text>
      </View>
    </Pressable>
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
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
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

  const bottomPadding = contentPaddingBottom + 18;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomPadding, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 18,
              borderWidth: 1,
              borderColor: '#E8EDF4',
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
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 42,
                  height: 42,
                  minWidth: 42,
                  minHeight: 42,
                  maxWidth: 42,
                  maxHeight: 42,
                  borderRadius: 21,
                  alignSelf: 'flex-start',
                  flexShrink: 0,
                  overflow: 'hidden',
                  opacity: pressed ? 0.94 : 1,
                })}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'flex-start',
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900' }}>→</Text>
                </View>
              </Pressable>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '800', ...RTL_TEXT }}>SHOPIFY CART</Text>
                <Text style={{ color: '#111827', fontSize: 28, fontWeight: '900', ...RTL_TEXT }}>עגלת קניות</Text>
                <Text style={{ color: '#6B7280', fontSize: 13, ...RTL_TEXT }}>
                  {itemCount ? `${itemCount} פריטים מוכנים לקופה` : 'העגלה מחכה לבחירה הראשונה שלך'}
                </Text>
              </View>
            </View>

            {items.length ? (
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
                  <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900' }}>
                    {formatPrice(subtotal, currencyCode)}
                  </Text>
                  <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4, ...RTL_TEXT }}>
                    סכום ביניים לפני שילוח ומסים סופיים ב-Shopify Checkout
                  </Text>
                </View>

                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingCart size={22} color="#FFFFFF" />
                </View>
              </View>
            ) : (
              <View
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>עדיין אין מוצרים בעגלה</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4, ...RTL_TEXT }}>
                    ברגע שתוסיף מוצר, כאן יופיע הסכום והקישור לקופה של Shopify.
                  </Text>
                </View>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 12,
                  }}
                >
                  <ShoppingCart size={20} color="#0F172A" />
                </View>
              </View>
            )}
          </View>

          {isBootstrapping && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: '#E8EDF4',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <ActivityIndicator size="large" color="#111827" />
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', ...RTL_TEXT }}>טוען את עגלת Shopify...</Text>
            </View>
          )}

          {!isBootstrapping && !items.length && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: '#E8EDF4',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingCart size={24} color="#111827" />
              </View>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', ...RTL_TEXT }}>העגלה שלך עדיין ריקה</Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 20, ...RTL_TEXT }}>
                הוסף מוצרים מתוך עמודי החנות והמוצרים, והם יופיעו כאן מיידית עם סנכרון מלא מול Shopify.
              </Text>
            </View>
          )}

          {!!items.length && (
            <View style={{ gap: 12 }}>
              {items.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: '#E8EDF4',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                    <View style={{ width: 112, padding: 10, height: 132 }}>
                      <CartProductImage
                        imageUrl={item.product.imageUrl}
                        imageAltText={item.product.imageAltText}
                        name={item.product.name}
                        coverColor={item.product.coverColor}
                        accentColor={item.product.accentColor}
                      />
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
                        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>
                          {item.product.name}
                        </Text>
                        <Text style={{ color: '#8D94A1', fontSize: 11, marginTop: 4, ...RTL_TEXT }}>
                          {item.product.variantTitle && item.product.variantTitle !== 'Default Title'
                            ? `${item.product.subtitle} • ${item.product.variantTitle}`
                            : item.product.subtitle}
                        </Text>
                        <Text style={{ color: '#111827', fontSize: 21, fontWeight: '900', marginTop: 10 }}>
                          {formatPrice(item.cost.totalAmount, item.cost.currencyCode)}
                        </Text>
                      </View>

                      <View
                        style={{
                          width: '100%',
                          flexDirection: 'row-reverse',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 14,
                        }}
                      >
                        <SurfaceIconButton
                          onPress={() => {
                            void removeItem(item.product.id);
                          }}
                          size={34}
                          backgroundColor="#FFF5F5"
                          disabled={isMutating}
                        >
                          <Trash2 size={16} color="#B91C1C" />
                        </SurfaceIconButton>

                        <View
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: '#F8FAFC',
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                          }}
                        >
                          <SurfaceIconButton
                            onPress={() => {
                              void updateQuantity(item.product.id, item.quantity + 1);
                            }}
                            size={28}
                            backgroundColor="#FFFFFF"
                            disabled={isMutating}
                          >
                            <Plus size={15} color="#111827" />
                          </SurfaceIconButton>

                          <Text style={{ color: '#111827', fontSize: 15, fontWeight: '900', minWidth: 24, textAlign: 'center' }}>
                            {item.quantity}
                          </Text>

                          <SurfaceIconButton
                            onPress={() => {
                              void updateQuantity(item.product.id, item.quantity - 1);
                            }}
                            size={28}
                            backgroundColor="#FFFFFF"
                            disabled={isMutating}
                          >
                            <Minus size={15} color="#111827" />
                          </SurfaceIconButton>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!!items.length && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                padding: 18,
                borderWidth: 1,
                borderColor: '#E8EDF4',
                gap: 14,
              }}
            >
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#111827', fontWeight: '900', ...RTL_TEXT }}>סכום ביניים</Text>
                  <Text style={{ color: '#111827', fontWeight: '900' }}>{formatPrice(subtotal, currencyCode)}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', ...RTL_TEXT }}>שילוח</Text>
                  <Text style={{ color: '#64748B', ...RTL_TEXT }}>מחושב בקופה</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', ...RTL_TEXT }}>תשלום</Text>
                  <Text style={{ color: '#64748B', ...RTL_TEXT }}>מתבצע בתוך Shopify WebView</Text>
                </View>
              </View>

              <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 20, ...RTL_TEXT }}>
                קופה זו מותאמת לרכישת מוצרים פיזיים: המשלוח, הכתובת ואמצעי התשלום מנוהלים ישירות על ידי Shopify ללא שער תשלום מותאם אישית בתוך האפליקציה.
              </Text>
            </View>
          )}

          {!!items.length && (
            <>
              <SurfaceActionButton
                onPress={handleCheckout}
                disabled={isMutating || !checkoutUrl}
                label={isMutating ? 'מעדכן את העגלה...' : 'המשך ל-Shopify Checkout'}
                backgroundColor={isMutating || !checkoutUrl ? '#475569' : '#111827'}
                textColor="#FFFFFF"
              />

              <SurfaceActionButton
                onPress={handleRefresh}
                disabled={isMutating}
                label="רענן עגלה"
                backgroundColor="#FFFFFF"
                borderColor="#D8E1EB"
                textColor="#0F172A"
              />

              <SurfaceActionButton
                onPress={() => {
                  if (!items.length) return;

                  Toast.show({
                    type: 'info',
                    text1: 'העגלה תנוקה מיידית',
                    text2: 'אפשר להוסיף שוב כל מוצר בכל רגע',
                  });
                  void clearCart();
                }}
                disabled={isMutating}
                label="נקה עגלה"
                backgroundColor="#FFFFFF"
                borderColor="#F1D2D2"
                textColor="#B91C1C"
              />
            </>
          )}
        </ScrollView>
        <StoreFloatingTabBar activeTab="home" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
