import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { RemoteBrand } from '../lib/brands';
import { normalizeBrandImageUrl } from '../lib/brands';
import { radii } from '../theme/radii';

type HomeBrandsCarouselProps = {
  brands: RemoteBrand[];
  loading?: boolean;
  edgeBleed?: number;
  onOpenBrand?: (brand: RemoteBrand) => void;
};

function BrandLogo({ uri }: { uri: string }) {
  const [square, setSquare] = useState(false);
  return <Image source={{ uri }} accessible={false} resizeMode={square ? 'cover' : 'contain'} style={square ? styles.squareLogo : styles.logo}
    onLoad={event => {
      const { width = 0, height = 0 } = event.nativeEvent.source ?? {};
      setSquare(width > 0 && height > 0 && width / height >= 0.85 && width / height <= 1.18);
    }} />;
}

export function HomeBrandsCarousel({ brands, loading = false, edgeBleed = 12, onOpenBrand }: HomeBrandsCarouselProps) {
  const [expanded, setExpanded] = useState(false);
  const [rowHeight, setRowHeight] = useState(100);
  const [gridHeight, setGridHeight] = useState(100);
  const contentHeight = useSharedValue(100);
  const progress = useSharedValue(0);
  useEffect(() => {
    const motion = { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1), reduceMotion: ReduceMotion.System };
    contentHeight.value = withTiming(expanded ? gridHeight : rowHeight, motion);
    progress.value = withTiming(expanded ? 1 : 0, motion);
  }, [expanded, gridHeight, rowHeight, contentHeight, progress]);
  const frameStyle = useAnimatedStyle(() => ({ height: contentHeight.value }));
  const rowStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const gridStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));
  const visibleBrands = brands.filter(brand => !brand.hiddenFromCarousel);
  if (loading && !visibleBrands.length) {
    return <View style={styles.loading}><ActivityIndicator color="#555555" /></View>;
  }
  if (!visibleBrands.length) return null;

  const renderBrand = (brand: RemoteBrand, inGrid: boolean) => {
    const imageUri = normalizeBrandImageUrl(brand.image);
    return (
      <Pressable key={brand.handle} onPress={() => onOpenBrand?.(brand)} accessibilityRole="button" accessibilityLabel={`מוצרי ${brand.label}`} style={inGrid ? styles.gridTouch : styles.brandTouch}>
        {({ pressed }) => <View style={[styles.brand, pressed && styles.pressed]}>
          <View style={styles.logoTile}>
            {imageUri
              ? <BrandLogo key={imageUri} uri={imageUri} />
              : <Text style={styles.fallback} numberOfLines={2}>{brand.short || brand.label}</Text>}
          </View>
          <Text style={styles.label} numberOfLines={2}>{brand.label}</Text>
        </View>}
      </Pressable>
    );
  };

  return (
    <View style={[styles.section, { marginHorizontal: -edgeBleed }]}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">קונים לפי מותג</Text>
        <Pressable onPress={() => setExpanded(value => !value)} accessibilityRole="button" accessibilityLabel={expanded ? 'הצגה מצומצמת של המותגים' : 'כל המותגים'} accessibilityState={{ expanded }}>
          {({ pressed }) => <View style={[styles.allBrands, pressed && styles.pressed]}>
            <Text style={styles.allBrandsText}>{expanded ? 'פחות מותגים' : 'כל המותגים'}</Text>
            <Animated.View style={arrowStyle}><ChevronDown size={13} color="#77736D" /></Animated.View>
          </View>}
        </Pressable>
      </View>
      <Animated.View style={[styles.contentFrame, frameStyle]}>
        <Animated.View style={[styles.contentLayer, rowStyle]} pointerEvents={expanded ? 'none' : 'auto'} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}>
          <View onLayout={event => setRowHeight(event.nativeEvent.layout.height)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.brandList}>
              {visibleBrands.map(brand => renderBrand(brand, false))}
            </ScrollView>
          </View>
        </Animated.View>
        <Animated.View style={[styles.contentLayer, gridStyle]} pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
          <View style={styles.grid} onLayout={event => setGridHeight(event.nativeEvent.layout.height)}>
            {visibleBrands.map(brand => renderBrand(brand, true))}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#F7F6F3', paddingTop: 8, paddingBottom: 8 },
  header: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  heading: { flexShrink: 1, fontSize: 18, lineHeight: 25, fontWeight: '700', color: '#222222', textAlign: 'right', writingDirection: 'rtl' },
  allBrands: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, minHeight: 44 },
  allBrandsText: { fontSize: 12, color: '#77736D', writingDirection: 'rtl' },
  contentFrame: { overflow: 'hidden' },
  contentLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Mirror the scroll axis and each card so the first brand starts at the right in either app direction.
  carousel: { direction: 'ltr', transform: [{ scaleX: -1 }] },
  brandList: { direction: 'ltr', flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  brandTouch: { width: 72, transform: [{ scaleX: -1 }] },
  grid: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', paddingHorizontal: 12, rowGap: 12 },
  gridTouch: { width: '25%' },
  brand: { alignItems: 'center', gap: 6 },
  logoTile: { width: 66, height: 66, borderRadius: radii.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E6E0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 54, height: 46 },
  squareLogo: { width: '100%', height: '100%' },
  fallback: { paddingHorizontal: 8, color: '#555555', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  label: { height: 28, paddingHorizontal: 2, fontSize: 10, lineHeight: 14, color: '#68645E', textAlign: 'center' },
  pressed: { opacity: 0.6 },
  loading: { paddingVertical: 24, alignItems: 'center' },
});
