import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, ShieldCheck, ShoppingBag, Sparkles, Star } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';

type StoreCategory = {
  id: string;
  name: string;
  description: string;
};

type StoreProduct = {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description: string;
  badge?: string;
  featured?: boolean;
};

const STORE_CATEGORIES: StoreCategory[] = [
  { id: 'candles', name: 'נרות', description: 'נרות מעוצבים לבית ולאירוח' },
  { id: 'diffusers', name: 'מפיצי ריח', description: 'מוצרים ליצירת אווירה בחלל' },
  { id: 'gifts', name: 'מארזים', description: 'מארזי מתנה מוכנים' },
  { id: 'home', name: 'לבית', description: 'פריטים משלימים לעיצוב הבית' },
];

const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: 'p-1',
    name: 'נר וניל יוקרתי',
    categoryId: 'candles',
    price: 89,
    description: 'נר ריחני בצנצנת זכוכית עם בעירה ארוכה.',
    badge: 'הכי נמכר',
    featured: true,
  },
  {
    id: 'p-2',
    name: 'מפיץ ריח לבנדר',
    categoryId: 'diffusers',
    price: 119,
    description: 'מפיץ ריח עם מקלות עץ לעיצוב רגוע ונקי.',
    badge: 'חדש',
    featured: true,
  },
  {
    id: 'p-3',
    name: 'מארז מתנה זוגי',
    categoryId: 'gifts',
    price: 159,
    description: 'מארז מושלם עם נר, סבון ומפיץ ריח קטן.',
  },
  {
    id: 'p-4',
    name: 'מגש דקורטיבי לבית',
    categoryId: 'home',
    price: 69,
    description: 'מגש שמשלים את פינת הריח והסטייל בבית.',
  },
  {
    id: 'p-5',
    name: 'נר הדרים רענן',
    categoryId: 'candles',
    price: 79,
    description: 'ריח קליל ונקי שמתאים לסלון או לחדר שינה.',
  },
  {
    id: 'p-6',
    name: 'מארז אירוח חגיגי',
    categoryId: 'gifts',
    price: 199,
    description: 'פתרון מתנה מוכן לאירוח, חג או תשומת לב.',
    badge: 'מהדורה מוגבלת',
  },
];

function formatPrice(price: number) {
  return `${price.toLocaleString('he-IL')} ₪`;
}

export function StoreHomeScreen({ onAdminPress }: { onAdminPress: () => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');

  const featuredProducts = useMemo(
    () => STORE_PRODUCTS.filter((product) => product.featured).slice(0, 2),
    []
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return STORE_PRODUCTS.filter((product) => {
      const matchesCategory =
        selectedCategory === 'all' || product.categoryId === selectedCategory;
      const matchesSearch =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [query, selectedCategory]);

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 }}
      >
        <Card style={{ padding: 18, gap: 16 }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: '#152033',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShoppingBag size={22} color={colors.primary} />
            </View>
            <Pressable
              onPress={onAdminPress}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.elevated,
              }}
            >
              <ShieldCheck size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>כניסת מנהל</Text>
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'right' }}>
              החנות שלך
            </Text>
            <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'right' }}>
              זהו בסיס לעמוד הבית של החנות. אפשר לעדכן את הקטגוריות, המוצרים,
              המחירים והטקסטים כדי להפוך אותו לקטלוג מלא שלך.
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row-reverse',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View
              style={{
                flexGrow: 1,
                minWidth: 140,
                borderRadius: 16,
                padding: 14,
                backgroundColor: '#111B2B',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '900', textAlign: 'right' }}>4 קטגוריות</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>קל להוסיף ולשנות</Text>
            </View>
            <View
              style={{
                flexGrow: 1,
                minWidth: 140,
                borderRadius: 16,
                padding: 14,
                backgroundColor: '#111B2B',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '900', textAlign: 'right' }}>6 מוצרים</Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>מוכנים כנתוני התחלה</Text>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 16 }}>
          <Card style={{ padding: 14 }}>
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.elevated,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Search size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="חיפוש מוצר או תיאור"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.text, textAlign: 'right' }}
              />
            </View>
          </Card>
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>
            קטגוריות
          </Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
            <Pressable
              onPress={() => setSelectedCategory('all')}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selectedCategory === 'all' ? colors.primary : colors.border,
                backgroundColor: selectedCategory === 'all' ? '#16263D' : colors.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>הכל</Text>
            </Pressable>
            {STORE_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? '#16263D' : colors.card,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{category.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 10 }}>
            {STORE_CATEGORIES.map((category) => (
              <Card key={category.id} style={{ padding: 14 }}>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16, textAlign: 'right' }}>
                  {category.name}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20, textAlign: 'right' }}>
                  {category.description}
                </Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Sparkles size={18} color={colors.warning} />
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>
              מומלצים
            </Text>
          </View>

          {featuredProducts.map((product) => (
            <Card key={product.id} style={{ padding: 16 }}>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
                  {product.name}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: '#2B1D08',
                  }}
                >
                  <Text style={{ color: '#F8C471', fontWeight: '800', fontSize: 12 }}>
                    {product.badge ?? 'מומלץ'}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20, textAlign: 'right' }}>
                {product.description}
              </Text>
              <Text style={{ color: colors.text, marginTop: 12, fontWeight: '900', textAlign: 'right' }}>
                {formatPrice(product.price)}
              </Text>
            </Card>
          ))}
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Star size={18} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>
              כל המוצרים
            </Text>
          </View>

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 }}>
            {visibleProducts.map((product) => {
              const category = STORE_CATEGORIES.find((item) => item.id === product.categoryId);
              return (
                <Card
                  key={product.id}
                  style={{
                    width: '48%',
                    minWidth: 150,
                    padding: 14,
                  }}
                >
                  {!!product.badge && (
                    <View
                      style={{
                        alignSelf: 'flex-end',
                        marginBottom: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: '#152033',
                      }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>
                        {product.badge}
                      </Text>
                    </View>
                  )}

                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16, textAlign: 'right' }}>
                    {product.name}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
                    {category?.name ?? 'מוצר'}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{ color: colors.muted, marginTop: 10, lineHeight: 20, textAlign: 'right' }}
                  >
                    {product.description}
                  </Text>
                  <Text style={{ color: colors.text, marginTop: 14, fontWeight: '900', textAlign: 'right' }}>
                    {formatPrice(product.price)}
                  </Text>
                </Card>
              );
            })}
          </View>

          {!visibleProducts.length && (
            <Card style={{ padding: 18 }}>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                לא נמצאו מוצרים
              </Text>
              <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>
                נסה לבחור קטגוריה אחרת או לשנות את החיפוש.
              </Text>
            </Card>
          )}
        </View>

        <Card style={{ marginTop: 24, padding: 18, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
            הצעד הבא שלך
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21, textAlign: 'right' }}>
            כרגע זה בסיס חנות מוכן עם מבנה של קטגוריות, חיפוש, מוצרים מומלצים וקטלוג.
            בשלב הבא אפשר לחבר מוצרים אמיתיים, תמונות, עמוד מוצר, עגלה והזמנות.
          </Text>
          <Button title="כניסת מנהל" variant="secondary" onPress={onAdminPress} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
