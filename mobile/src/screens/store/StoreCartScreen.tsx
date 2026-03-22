import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../state/CartContext';
import {
  getStoreBottomBarMetrics,
  StoreFloatingTabBar,
  type StoreBottomTabId,
} from './StoreHomeScreen';

function formatPrice(price: number) {
  return `₪${price.toLocaleString('he-IL')}.00`;
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

export function StoreCartScreen({
  onBack,
  onTabPress,
}: {
  onBack: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { items, itemCount, subtotal, updateQuantity, removeItem, clearCart } = useCart();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: contentPaddingBottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 16 }}>
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

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '800' }}>CART</Text>
                <Text style={{ color: '#111827', fontSize: 28, fontWeight: '900' }}>עגלת קניות</Text>
                <Text style={{ color: '#6B7280', fontSize: 13 }}>{itemCount} פריטים נבחרו</Text>
              </View>
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
                <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900' }}>{formatPrice(subtotal)}</Text>
                <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>סך הכל לפני המשך הזמנה</Text>
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
          </View>

          {!items.length && (
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
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900' }}>העגלה שלך עדיין ריקה</Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                הוסף מוצרים מתוך דף הבית או מתוך עמוד המוצר והם יופיעו כאן
              </Text>
            </View>
          )}

          {!!items.length && (
            <View style={{ gap: 12 }}>
              {items.map((item) => (
                <View
                  key={item.product.id}
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
                        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                          {item.product.name}
                        </Text>
                        <Text style={{ color: '#8D94A1', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                          {item.product.subtitle}
                        </Text>
                        <Text style={{ color: '#111827', fontSize: 21, fontWeight: '900', marginTop: 10 }}>
                          {formatPrice(item.product.price * item.quantity)}
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
                        <Pressable
                          onPress={() => removeItem(item.product.id)}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: '#FFF5F5',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={16} color="#B91C1C" />
                        </Pressable>

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
                          <Pressable
                            onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: '#FFFFFF',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Plus size={15} color="#111827" />
                          </Pressable>

                          <Text style={{ color: '#111827', fontSize: 15, fontWeight: '900', minWidth: 24, textAlign: 'center' }}>
                            {item.quantity}
                          </Text>

                          <Pressable
                            onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: '#FFFFFF',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Minus size={15} color="#111827" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!!items.length && (
            <>
              <Pressable
                style={{
                  borderRadius: 22,
                  backgroundColor: '#111827',
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>המשך להזמנה</Text>
              </Pressable>

              <Pressable
                onPress={clearCart}
                style={{
                  borderRadius: 18,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#F1D2D2',
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#B91C1C', fontSize: 14, fontWeight: '800' }}>נקה עגלה</Text>
              </Pressable>
            </>
          )}
          </View>
        </ScrollView>
        <StoreFloatingTabBar activeTab="home" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
