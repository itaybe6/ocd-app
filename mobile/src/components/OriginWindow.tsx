import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  KeyboardState,
  cancelAnimation,
  interpolate,
  runOnJS,
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

/** Default open/close duration; use for syncing parent state cleanup after `visible` → false */
export const ORIGIN_WINDOW_DEFAULT_DURATION_MS = 460;

export function OriginWindow({
  visible,
  originRect,
  onClose,
  children,
  containerStyle,
  durationMs = ORIGIN_WINDOW_DEFAULT_DURATION_MS,
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
      cancelAnimation(progress);
      setMounted(true);
      // Give one frame so the layout is committed, then animate in
      const id = requestAnimationFrame(() => {
        progress.value = withTiming(1, { duration: durationMs, easing: Easing.bezier(0.2, 0.9, 0.2, 1) });
      });
      return () => cancelAnimationFrame(id);
    }

    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: durationMs, easing: Easing.bezier(0.33, 0, 0.2, 1) }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
    return () => {
      cancelAnimation(progress);
    };
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
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [6, 0]) }],
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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
              >
                <View style={styles.closeBtnInner}>
                  <Entypo name="cross" size={24} color="#0F172A" />
                </View>
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: 'flex-start',
  },
  closeBtn: {
    borderRadius: 16,
  },
  closeBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  closeBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.14,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
});
