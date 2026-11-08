import { radii } from '../theme/radii';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useProductCartQuantity, type CartQuantityProduct } from '../state/CartContext';

const CLOSE_DELAY = 3000;

export function ProductCardQuantityControl({ product, onChooseVariant, canChooseVariant = product.availableForSale }: { product: CartQuantityProduct; onChooseVariant?: () => void; canChooseVariant?: boolean }) {
  const { quantity, updateQuantity, isBootstrapping } = useProductCartQuantity(product.id);
  const quantityRef = useRef(quantity);
  quantityRef.current = quantity;
  const [expanded, setExpanded] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const canAdd = Boolean(product.availableForSale && product.variantId) && !isBootstrapping;

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (alive) setScreenReader(enabled); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { alive = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    clearTimer();
    setExpanded(false);
    progress.value = 0;
    return clearTimer;
  }, [product.id, clearTimer, progress]);

  useEffect(() => {
    if (screenReader) clearTimer();
  }, [screenReader, clearTimer]);

  const showEditor = (open: boolean) => {
    // Start on the UI thread from the event, before cart subscribers render.
    progress.value = withTiming(open ? 1 : 0, { duration: reducedMotion ? 0 : open ? 160 : 140, easing: Easing.out(Easing.cubic) });
    setExpanded(open);
  };

  const keepOpen = () => {
    clearTimer();
    if (!expanded) showEditor(true);
    if (!screenReader) timer.current = setTimeout(() => showEditor(false), CLOSE_DELAY);
  };

  const change = (delta: number) => {
    if (isBootstrapping || (delta > 0 && !canAdd)) return;
    const next = Math.max(0, quantityRef.current + delta);
    if (next === quantityRef.current) return;
    quantityRef.current = next;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Absolute, debounced quantities also handle rapid + / − while the first add is pending.
    void updateQuantity(product.id, next, product);
  };

  const open = (event: GestureResponderEvent) => {
    event.stopPropagation();
    keepOpen();
    if (quantityRef.current === 0) change(1);
  };
  const adjust = (delta: number, event: GestureResponderEvent) => {
    event.stopPropagation();
    keepOpen();
    change(delta);
  };
  // Reveal a fixed-size background with a transform, without per-frame layout.
  const backdrop = useAnimatedStyle(() => ({ transform: [{ translateX: 104 * progress.value }] }));
  const compact = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const controls = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateX: (1 - progress.value) * -8 }] }));

  if (onChooseVariant) {
    return <View style={styles.shell} pointerEvents="box-none">
      <View pointerEvents="none" style={styles.backdrop} />
      <Pressable onPress={event => { event.stopPropagation(); if (canChooseVariant) onChooseVariant(); }} disabled={!canChooseVariant} accessibilityRole="button" accessibilityLabel={`בחירת אפשרות עבור ${product.name}`} accessibilityState={{ disabled: !canChooseVariant }} style={styles.touchTarget}>
        <View style={[styles.compactButton, !canChooseVariant && styles.disabled]}><Ionicons name="add" size={22} color="#202124" /></View>
      </Pressable>
    </View>;
  }

  return (
    <View style={styles.shell} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.backdrop, backdrop]} />
      <Animated.View style={[styles.compact, compact]} pointerEvents={expanded ? 'none' : 'box-none'} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}>
        <Pressable onPress={open} disabled={quantity === 0 && !canAdd} accessibilityRole="button" accessibilityLabel={quantity > 0 ? `${quantity} בעגלה, שינוי כמות ${product.name}` : canAdd ? `הוספת ${product.name} לעגלה` : 'המוצר אינו זמין להוספה'} accessibilityState={{ expanded, disabled: quantity === 0 && !canAdd }} style={styles.touchTarget}>
          <View style={[styles.compactButton, quantity === 0 && !canAdd && styles.disabled]}>
            {quantity > 0 ? <Text style={styles.quantity}>{quantity}</Text> : <Ionicons name="add" size={22} color="#202124" />}
          </View>
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.controls, controls]} pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
        <Pressable onPress={(event) => adjust(1, event)} disabled={!canAdd} accessibilityRole="button" accessibilityLabel={`הוספת יחידה של ${product.name}`} accessibilityState={{ disabled: !canAdd }} style={styles.touchTarget}>
          <View style={[styles.button, !canAdd && styles.disabled]}><View style={styles.buttonDisc}><Ionicons name="add" size={20} color="#202124" /></View></View>
        </Pressable>
        <Pressable onPress={(event) => { event.stopPropagation(); clearTimer(); showEditor(false); }} accessibilityRole="button" accessibilityLabel={`${quantity} בעגלה, סגירת בורר הכמות`} style={styles.touchTarget}>
          <View style={styles.button}><Text style={styles.quantity} accessibilityLiveRegion="polite">{quantity}</Text></View>
        </Pressable>
        <Pressable onPress={(event) => adjust(-1, event)} disabled={quantity <= 0 || isBootstrapping} accessibilityRole="button" accessibilityLabel={quantity === 1 ? `הסרת ${product.name} מהעגלה` : `הפחתת יחידה של ${product.name}`} accessibilityState={{ disabled: quantity <= 0 || isBootstrapping }} style={styles.touchTarget}>
          <View style={[styles.button, quantity <= 0 && styles.disabled]}><View style={styles.buttonDisc}><Ionicons name="remove" size={18} color="#202124" /></View></View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', top: 0, left: 0, width: 148, height: 44, borderTopLeftRadius: radii.surface, zIndex: 30, overflow: 'hidden', direction: 'ltr' },
  backdrop: { position: 'absolute', top: 0, left: -104, width: 148, height: 44, borderBottomRightRadius: 32, backgroundColor: '#F0F0F0' },
  compact: { position: 'absolute', top: 0, left: 0, width: 44, height: 44 },
  touchTarget: { width: 44, height: 44 },
  compactButton: { width: 44, height: 44, paddingRight: 4, paddingBottom: 4, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', left: 0, top: 0, width: 148, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  buttonDisc: { width: 30, height: 30, borderRadius: radii.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  quantity: { color: '#202124', fontSize: 15, lineHeight: 20, includeFontPadding: false, textAlign: 'center', fontWeight: '600', fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.4 },
});
