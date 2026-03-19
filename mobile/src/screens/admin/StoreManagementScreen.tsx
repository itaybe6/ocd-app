import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PickerDialog, type PickerOption } from '../../components/PickerDialog';
import { supabase } from '../../lib/supabase';
import { fetchProducts, type ShopifyProduct } from '../../lib/shopify';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';

type ProductLite = { handle: string; title: string; imageUrl: string | null; price: number; currencyCode: string };

function toLite(p: ShopifyProduct): ProductLite {
  return {
    handle: p.handle,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price,
    currencyCode: p.currencyCode,
  };
}

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') return `₪${price.toLocaleString('he-IL')}.00`;
  return `${price.toLocaleString('he-IL')} ${currencyCode}`;
}

export function StoreManagementScreen() {
  const { setIsLoading } = useLoading();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [useProductImage, setUseProductImage] = useState(true);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedHandle, setSelectedHandle] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  const selectedProduct = useMemo(() => products.find((p) => p.handle === selectedHandle) ?? null, [products, selectedHandle]);

  const effectiveImageUrl = useMemo(() => {
    if (useProductImage) return selectedProduct?.imageUrl ?? '';
    return imageUrl.trim();
  }, [imageUrl, selectedProduct?.imageUrl, useProductImage]);

  const productOptions = useMemo<PickerOption[]>(
    () =>
      products.map((p) => ({
        value: p.handle,
        label: `${p.title} • ${formatPrice(p.price, p.currencyCode)}`,
      })),
    [products]
  );

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', fontSize: 18 }}>שיגור פושים</Text>
          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
            שגר התראה לכל המשתמשים. בלחיצה על ההתראה, המשתמש יגיע למוצר שבחרת.
          </Text>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Input label="כותרת" value={title} onChangeText={setTitle} placeholder="לדוגמה: מבצע חדש בחנות" />
            <Input
              label="תוכן"
              value={body}
              onChangeText={setBody}
              placeholder="לדוגמה: 20% הנחה על כל המוצרים עד חצות"
              multiline
              style={{ minHeight: 92, textAlignVertical: 'top' }}
            />
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>מוצר לקישור</Text>

          <Pressable
            onPress={() => setProductPickerOpen(true)}
            disabled={loadingProducts}
            style={({ pressed }) => ({
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>מוצר</Text>
            <Text style={{ color: selectedProduct ? colors.text : colors.muted, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>
              {loadingProducts ? 'טוען מוצרים…' : selectedProduct ? selectedProduct.title : 'בחר מוצר…'}
            </Text>
          </Pressable>

          {!!selectedProduct && (
            <View style={{ marginTop: 10, flexDirection: 'row-reverse', gap: 12, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{selectedProduct.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                  {formatPrice(selectedProduct.price, selectedProduct.currencyCode)} • handle: {selectedProduct.handle}
                </Text>
              </View>
              {!!selectedProduct.imageUrl && (
                <Image
                  source={{ uri: selectedProduct.imageUrl }}
                  style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.05)' }}
                />
              )}
            </View>
          )}
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>תמונה בהתראה</Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="תמונת המוצר"
                variant={useProductImage ? 'primary' : 'secondary'}
                onPress={() => setUseProductImage(true)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="קישור לתמונה"
                variant={!useProductImage ? 'primary' : 'secondary'}
                onPress={() => setUseProductImage(false)}
              />
            </View>
          </View>

          {!useProductImage && (
            <View style={{ marginTop: 10 }}>
              <Input value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />
            </View>
          )}

          {!!effectiveImageUrl && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.muted, textAlign: 'right', fontWeight: '700', marginBottom: 8 }}>תצוגה מקדימה</Text>
              <Image
                source={{ uri: effectiveImageUrl }}
                style={{ width: '100%', height: 180, borderRadius: 18, backgroundColor: 'rgba(15,23,42,0.05)' }}
              />
              <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>
                הערה: ב־iOS תמונה ב־push דורשת תוספת Notification Service Extension בבילד.
              </Text>
            </View>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <Button title="שגר פוש לכל המשתמשים" onPress={sendBroadcast} />
          <Text style={{ color: colors.muted, textAlign: 'right' }}>
            הכפתור יפעל אחרי שהוגדרו טבלאות ב־Supabase ו־Edge Function לשליחה.
          </Text>
        </View>
      </ScrollView>

      <PickerDialog
        visible={productPickerOpen}
        title="בחר מוצר"
        value={selectedHandle}
        options={productOptions}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(value) => setSelectedHandle(value)}
        onClear={() => setSelectedHandle('')}
      />
    </Screen>
  );
}

