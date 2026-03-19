import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Eye } from 'lucide-react-native';
import { colors } from '../theme/colors';

export type WindowAnchor = { x: number; y: number };

type AnchoredWindowProps = {
  visible: boolean;
  anchor?: WindowAnchor | null;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  durationMs?: number;
  showCloseEye?: boolean;
};

export function AnchoredWindow({
  visible,
  anchor,
  onClose,
  children,
  containerStyle,
  durationMs = 320,
  showCloseEye = true,
}: AnchoredWindowProps) {
  const [mounted, setMounted] = useState(visible);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      if (timer.current) clearTimeout(timer.current);
      setMounted(true);
      t.value = 0;
      t.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) });
      return;
    }

    t.value = withTiming(0, { duration: Math.max(180, Math.floor(durationMs * 0.85)), easing: Easing.in(Easing.cubic) });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMounted(false), durationMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [durationMs, t, visible]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  const { width: W, height: H } = Dimensions.get('window');
  const windowW = Math.min(560, Math.floor(W * 0.94));
  const windowH = Math.floor(H * 0.76);
  const left = Math.floor((W - windowW) / 2);
  const top = Math.floor((H - windowH) / 2);

  const origin = anchor ?? { x: W / 2, y: H - 80 };
  const targetCx = left + windowW / 2;
  const targetCy = top + windowH / 2;

  const backdropStyle = useAnimatedStyle(() => {
    return { opacity: interpolate(t.value, [0, 1], [0, 1]) };
  });

  const panelStyle = useAnimatedStyle(() => {
    const dx = origin.x - targetCx;
    const dy = origin.y - targetCy;
    const tx = interpolate(t.value, [0, 1], [dx, 0]);
    const ty = interpolate(t.value, [0, 1], [dy, 0]);
    const s = interpolate(t.value, [0, 1], [0.12, 1]);
    const r = interpolate(t.value, [0, 1], [999, 18]);
    return {
      opacity: interpolate(t.value, [0, 1], [0, 1]),
      borderRadius: r,
      transform: [{ translateX: tx }, { translateY: ty }, { scale: s }],
    };
  });

  const closeEye = showCloseEye && anchor ? (
    <View
      pointerEvents="box-none"
      style={[
        styles.closeEyeWrap,
        {
          left: Math.max(12, Math.min(W - 56, Math.floor(anchor.x - 22))),
          top: Math.max(12, Math.min(H - 56, Math.floor(anchor.y - 22))),
        },
      ]}
    >
      <Pressable onPress={onClose} style={styles.closeEyeBtn} hitSlop={10}>
        <Eye size={18} color={colors.text} />
      </Pressable>
    </View>
  ) : null;

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {closeEye}
        <Animated.View
          style={[
            styles.window,
            { left, top, width: windowW, height: windowH, backgroundColor: colors.card, borderColor: colors.border },
            containerStyle,
            panelStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  window: {
    position: 'absolute',
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  closeEyeWrap: { position: 'absolute', zIndex: 10 },
  closeEyeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
});

