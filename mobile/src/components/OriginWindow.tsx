import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  KeyboardState,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Entypo } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export type OriginPoint = { x: number; y: number };
export type OriginRect = { x: number; y: number; width: number; height: number; borderRadius?: number };

type OriginWindowProps = {
  visible: boolean;
  originRect?: OriginRect | null;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  durationMs?: number;
  openedWidth?: number;
  openedHeight?: number;
};

const DEFAULT_W = Math.min(screenWidth * 0.92, 420);
const DEFAULT_H = Math.min(screenHeight * 0.78, 640);
const FALLBACK_SIZE = 44;

export function OriginWindow({
  visible,
  originRect,
  onClose,
  children,
  containerStyle,
  durationMs = 460,
  openedWidth = DEFAULT_W,
  openedHeight = DEFAULT_H,
}: OriginWindowProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  // Start-rect shared values — updated synchronously before animation starts
  const svLeft = useSharedValue(originRect?.x ?? (screenWidth - FALLBACK_SIZE) / 2);
  const svTop = useSharedValue(originRect?.y ?? (screenHeight - FALLBACK_SIZE) / 2);
  const svW = useSharedValue(originRect?.width ?? FALLBACK_SIZE);
  const svH = useSharedValue(originRect?.height ?? FALLBACK_SIZE);
  const svR = useSharedValue(originRect?.borderRadius ?? FALLBACK_SIZE / 2);

  const { height: keyboardHeight, state: kbState } = useAnimatedKeyboard();

  // Update start-rect shared values whenever originRect changes
  useEffect(() => {
    if (originRect) {
      svLeft.value = originRect.x;
      svTop.value = originRect.y;
      svW.value = originRect.width;
      svH.value = originRect.height;
      svR.value = originRect.borderRadius ?? Math.min(originRect.width, originRect.height) / 2;
    }
  }, [originRect, svH, svLeft, svR, svTop, svW]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Give one frame so the layout is committed, then animate in
      requestAnimationFrame(() => {
        progress.value = withTiming(1, { duration: durationMs, easing: Easing.bezier(0.2, 0.9, 0.2, 1) });
      });
      return;
    }

    progress.value = withTiming(0, { duration: durationMs, easing: Easing.bezier(0.4, 0, 0.2, 1) });
    const t = setTimeout(() => setMounted(false), durationMs + 50);
    return () => clearTimeout(t);
  }, [durationMs, progress, visible]);

  const endLeft = useMemo(() => (screenWidth - openedWidth) / 2, [openedWidth]);
  const endTop = useMemo(() => Math.max(36, (screenHeight - openedHeight) / 2), [openedHeight]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const keyboardShiftStyle = useAnimatedStyle(() => {
    const shift = kbState.value === KeyboardState.OPEN ? Math.max(0, keyboardHeight.value - 20) : 0;
    return { transform: [{ translateY: -shift * 0.35 }] };
  });

  const windowStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [svLeft.value, endLeft]),
    top: interpolate(progress.value, [0, 1], [svTop.value, endTop]),
    width: interpolate(progress.value, [0, 1], [svW.value, openedWidth]),
    height: interpolate(progress.value, [0, 1], [svH.value, openedHeight]),
    borderRadius: interpolate(progress.value, [0, 1], [svR.value, 20]),
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [8, 0]) }],
  }));

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
      <View style={{ flex: 1 }}>
        <Animated.View
          entering={FadeIn.duration(Math.min(180, durationMs))}
          exiting={FadeOut.duration(Math.min(180, durationMs))}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.52)' }, overlayStyle]}
        />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          style={[
            styles.window,
            windowStyle,
            keyboardShiftStyle,
            {
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 14 },
              elevation: 8,
            },
            containerStyle,
          ]}
        >
          <Animated.View style={[{ flex: 1 }, contentStyle]}>
            <View style={styles.headerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="סגור"
                onPress={onClose}
                style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.65 : 1 }]}
              >
                <Entypo name="cross" size={18} color="#111827" />
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>{children}</View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  window: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  headerRow: {
    padding: 12,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
