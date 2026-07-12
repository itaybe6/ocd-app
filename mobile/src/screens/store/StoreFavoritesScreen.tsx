import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteProductsGrid } from '../../components/FavoriteProductsGrid';
import { useFavorites } from '../../state/FavoritesContext';
import { useAuth } from '../../state/AuthContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from './StoreHomeScreen';

const INK = '#111827';
const MUTED = '#6B7280';

export function StoreFavoritesScreen({
  onOpenProduct,
  onTabPress,
  onLoginPress,
}: {
  onOpenProduct: (handle: string) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
  onLoginPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { user } = useAuth();
  const { favorites, isHydrating, isFavoritePending, removeFavorite } = useFavorites();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFavorites = useMemo(() => {
    if (!normalizedQuery) return favorites;
    return favorites.filter((favorite) => {
      const haystack = [
        favorite.product_title,
        favorite.product_type ?? '',
        favorite.product_description ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [favorites, normalizedQuery]);

  const showToolbar = favorites.length > 0;

  if (!user || user.role !== 'customer') {
    return (
      <View style={styles.root}>
        <View style={[styles.guestBody, { paddingTop: insets.top, paddingBottom: contentPaddingBottom }]}>
          <View style={styles.guestContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart" size={30} color="#FFFFFF" />
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.title}>אהבתי</Text>
              <Text style={styles.subtitle}>
                התחבר כלקוח כדי לשמור מוצרים{'\n'}ולראות כאן את כל הפריטים שאהבת.
              </Text>
            </View>

            <Pressable
              onPress={onLoginPress}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>התחברות</Text>
            </Pressable>
          </View>
        </View>

        <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {showToolbar ? (
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          <View style={styles.topBarRow}>
            <Text style={styles.topBarTitle}>אהבתי</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: showToolbar ? 16 : insets.top,
          paddingBottom: contentPaddingBottom + 8,
          gap: 16,
          flexGrow: 1,
          justifyContent: showToolbar ? undefined : 'center',
        }}
      >
        {showToolbar ? (
          <View style={styles.searchShell}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש במוצרים שאהבתי"
              placeholderTextColor="#B7BDC8"
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="נקה חיפוש">
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {showToolbar ? (
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {normalizedQuery
                ? `${filteredFavorites.length} מתוך ${favorites.length} מוצרים`
                : `${favorites.length} מוצר${favorites.length === 1 ? '' : 'ים'}`}
            </Text>
          </View>
        ) : null}

        {isHydrating ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={INK} />
            <Text style={styles.loadingText}>טוען מוצרים שאהבת…</Text>
          </View>
        ) : null}

        {!isHydrating && !favorites.length ? (
          <View style={styles.emptyWrap}>
            <View style={styles.iconCircleMuted}>
              <Ionicons name="heart-outline" size={32} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>עדיין לא שמרת מוצרים</Text>
            <Text style={styles.emptySubtitle}>
              לחץ על הלב בכל מוצר,{'\n'}והוא יופיע כאן מיד.
            </Text>
            <Pressable
              onPress={() => onTabPress('home')}
              style={({ pressed }) => [styles.cta, styles.emptyCta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>לגלות מוצרים</Text>
            </Pressable>
          </View>
        ) : null}

        {!isHydrating && favorites.length > 0 && filteredFavorites.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.iconCircleMuted}>
              <Ionicons name="search-outline" size={28} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>לא נמצאו מוצרים</Text>
            <Text style={styles.emptySubtitle}>נסה מילת חיפוש אחרת</Text>
          </View>
        ) : null}

        {!isHydrating && filteredFavorites.length > 0 ? (
          <FavoriteProductsGrid
            favorites={filteredFavorites}
            isFavoritePending={isFavoritePending}
            onOpenProduct={onOpenProduct}
            onRemoveFavorite={removeFavorite}
          />
        ) : null}
      </ScrollView>

      <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: { flex: 1 },

  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topBarRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },

  searchShell: {
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: INK,
    textAlign: 'right',
    fontSize: 13,
    backgroundColor: '#F3F4F6',
    padding: 0,
  },

  countRow: {
    alignItems: 'flex-end',
  },
  countText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },

  guestBody: {
    flex: 1,
  },
  guestContent: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },

  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK,
  },
  iconCircleMuted: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },

  copyBlock: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: INK,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },

  cta: {
    width: '100%',
    maxWidth: 320,
    height: 54,
    borderRadius: 16,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCta: {
    marginTop: 8,
    maxWidth: 220,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: INK,
    fontSize: 14,
    fontWeight: '700',
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
  },
});
