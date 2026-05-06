import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '../theme/colors';

const { height: SCREEN_H } = Dimensions.get('window');

const OPEN_SPRING = { damping: 26, stiffness: 280, mass: 0.85 };
const CLOSE_SPRING = { damping: 22, stiffness: 240, mass: 0.85 };
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 550;

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  /**
   * Optional full-bleed background element (e.g. LavaLampDark).
   * Rendered before the handle + children so it stays behind everything.
   */
  background?: React.ReactNode;
  /** When true the drag handle renders in a light/white colour for dark-background sheets */
  dark?: boolean;
  /** @deprecated unused, kept for API compat */
  durationMs?: number;
};

export function ModalSheet({ visible, onClose, children, containerStyle, background, dark = false }: ModalSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_H);
  const overlayOpacity = useSharedValue(0);

  // Animate sheet closed, then unmount
  const closeSheet = useCallback(() => {
    translateY.value = withSpring(SCREEN_H, CLOSE_SPRING, () => {
      runOnJS(setMounted)(false);
    });
    overlayOpacity.value = withTiming(0, { duration: 260 });
  }, [translateY, overlayOpacity]);

  // Mount when visible, unmount (after animation) when not
  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else {
      closeSheet();
    }
  }, [visible, closeSheet]);

  // Once modal is mounted & visible, animate in
  useEffect(() => {
    if (!mounted || !visible) return;
    translateY.value = SCREEN_H;
    const t = setTimeout(() => {
      translateY.value = withSpring(0, OPEN_SPRING);
      overlayOpacity.value = withTiming(1, { duration: 300 });
    }, 12);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Pan gesture only on the handle area — prevents conflict with inner ScrollView
  const panGesture = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(SCREEN_H, { duration: 280 }, () => {
          runOnJS(setMounted)(false);
          runOnJS(onClose)();
        });
        overlayOpacity.value = withTiming(0, { duration: 260 });
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
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
      <View style={styles.root}>
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.backdrop, overlayStyle]}
          pointerEvents="none"
        />

        {/* Tap-outside-to-close */}
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        {/* Sheet */}
        <Animated.View style={[styles.sheet, containerStyle, sheetStyle]}>
          {/* Background element (e.g. lava lamp) — rendered first so it sits behind handle + content */}
          {background}

          {/* Draggable handle strip */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleArea}>
              <View style={[styles.handle, dark && styles.handleDark]} />
            </View>
          </GestureDetector>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 28,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  handleDark: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
