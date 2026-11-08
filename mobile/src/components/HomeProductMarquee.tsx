import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, { scrollTo, useAnimatedRef, useAnimatedScrollHandler, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';
import { productDiscount } from './HomeCompactIntro';
import { wrapMarqueeOffset } from '../lib/homeProductMarquee';

const SLOT_WIDTH = 112;
const ROW_HEIGHT = 110;
const SPEED = 20;
const RESUME_DELAY = 1400;

type Props = {
  products: StoreProduct[];
  onOpenProduct: (product: StoreProduct) => void;
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
};

export function HomeProductMarquee(props: Props) {
  const focused = useIsFocused();
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [screenReader, setScreenReader] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const { width } = useWindowDimensions();

  useEffect(() => {
    let alive = true;
    let motionChanged = false;
    let readerChanged = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { motionChanged = true; setReducedMotion(value); });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', value => { readerChanged = true; setScreenReader(value); });
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive && !motionChanged) setReducedMotion(value); }).catch(() => {});
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (alive && !readerChanged) setScreenReader(value); }).catch(() => {});
    return () => { alive = false; motion.remove(); reader.remove(); app.remove(); };
  }, []);

  if (!props.products.length) return null;
  const loop = !reducedMotion && !screenReader && props.products.length > 1;
  const signature = props.products.map(product => product.id).join('|');
  return <MarqueeTrack key={`${signature}:${Math.round(width)}:${loop}`} {...props} width={width} loop={loop} active={focused && foreground && loop} />;
}

function MarqueeTrack({ products, onOpenProduct, scrollY, viewportHeight, width, loop, active }: Props & { width: number; loop: boolean; active: boolean }) {
  // Each repeat covers at least one viewport, so wrapping never reveals an edge.
  const repeats = loop ? Math.max(1, Math.ceil(width / (products.length * SLOT_WIDTH))) : 1;
  const segmentWidth = products.length * repeats * SLOT_WIDTH;
  const ref = useAnimatedRef<ScrollViewInstance>();
  const x = useSharedValue(loop ? segmentWidth : 0);
  const top = useSharedValue(-1);
  const ready = useSharedValue(false);
  const touching = useSharedValue(false);
  const dragging = useSharedValue(false);
  const momentum = useSharedValue(false);
  const resumeIn = useSharedValue(0);

  const frame = useFrameCallback(info => {
    if (!ready.value || touching.value || dragging.value || momentum.value) return;
    if (top.value < 0 || viewportHeight.value <= 0 || top.value + ROW_HEIGHT <= scrollY.value || top.value >= scrollY.value + viewportHeight.value) return;
    const elapsed = Math.min(info.timeSincePreviousFrame ?? 0, 50);
    if (resumeIn.value > 0) { resumeIn.value -= elapsed; return; }
    x.value = wrapMarqueeOffset(x.value + SPEED * elapsed / 1000, segmentWidth);
    scrollTo(ref, x.value, 0, false);
  }, false);

  useEffect(() => {
    frame.setActive(active);
    return () => frame.setActive(false);
  }, [active, frame.setActive]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => { x.value = event.contentOffset.x; },
    onBeginDrag: () => { dragging.value = true; },
    onEndDrag: () => { dragging.value = false; resumeIn.value = RESUME_DELAY; },
    onMomentumBegin: () => { momentum.value = true; },
    onMomentumEnd: () => { momentum.value = false; resumeIn.value = RESUME_DELAY; },
  });
  const release = () => { touching.value = false; resumeIn.value = RESUME_DELAY; };

  return (
    <View style={styles.row} onLayout={event => { top.value = event.nativeEvent.layout.y; }}>
      <Animated.ScrollView
        ref={ref}
        horizontal
        style={styles.scroll}
        contentContainerStyle={styles.track}
        contentOffset={{ x: loop ? segmentWidth : 0, y: 0 }}
        contentInsetAdjustmentBehavior="never"
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onContentSizeChange={() => { ready.value = true; }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={() => { touching.value = true; }}
        onTouchEnd={release}
        onTouchCancel={release}
        onPointerEnter={() => { touching.value = true; }}
        onPointerLeave={release}
      >
        {Array.from({ length: loop ? 3 : 1 }, (_, segment) => (
          <View key={segment} style={styles.segment}>
            {Array.from({ length: repeats }, (_, repeat) => products.map(product => {
              const price = new Intl.NumberFormat('he-IL', { style: 'currency', currency: product.currencyCode || 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(product.price);
              const discount = productDiscount(product);
              return (
                <View key={`${repeat}:${product.id}`} style={styles.slot}>
                  <Pressable onPress={() => onOpenProduct(product)} style={styles.item} accessibilityRole="button" accessibilityLabel={`${product.name}, ${price}${discount > 0 ? `, ${discount}% הנחה` : ''}`}>
                    {({ pressed }) => (
                      <View style={[styles.itemContent, pressed && styles.pressed]}>
                        <Image source={{ uri: product.imageUrl! }} resizeMode="contain" style={styles.image} accessible={false} />
                        <Text style={styles.price} numberOfLines={1}>{price}</Text>
                        {discount > 0 ? <View style={styles.discount}><Text style={styles.discountText}>-{discount}%</Text></View> : null}
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            }))}
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEEEEE', paddingVertical: 9 },
  scroll: { direction: 'ltr' },
  track: { flexDirection: 'row', alignItems: 'center', direction: 'ltr' },
  segment: { flexDirection: 'row', direction: 'ltr' },
  slot: { width: SLOT_WIDTH, paddingHorizontal: 6 },
  item: { height: 90 },
  itemContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingTop: 6 },
  image: { width: 64, height: 54 },
  price: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#202020', writingDirection: 'ltr' },
  discount: { position: 'absolute', right: 0, top: 0, backgroundColor: '#F6E8BA', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 },
  discountText: { fontSize: 9, lineHeight: 12, fontWeight: '700', color: '#51401E', writingDirection: 'ltr' },
  pressed: { backgroundColor: '#F5F5F5', opacity: 0.8 },
});
