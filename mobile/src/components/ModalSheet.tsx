import { radii } from '../theme/radii';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, useWindowDimensions, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView, type GestureType } from 'react-native-gesture-handler';
import { colors } from '../theme/colors';

import { SHEET_OPEN, SHEET_CLOSE, SHEET_SNAP, OVERLAY_OPEN, OVERLAY_CLOSE, shouldDismissSheet } from '../theme/sheetMotion';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAfterClose?: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  /**
   * Optional full-bleed background element (e.g. LavaLampDark).
   * Rendered before the handle + children so it stays behind everything.
   */
  background?: React.ReactNode;
  /** When true the drag handle renders in a light/white colour for dark-background sheets */
  dark?: boolean;
  /**
   * Pulling the sheet down — including from the list, once it is scrolled to the top —
   * follows the finger and dismisses. Pair the list with SheetScrollView.
   */
  dismissOnScroll?: boolean;
  /** @deprecated unused, kept for API compat */
  durationMs?: number;
};

type SheetScrollContextValue = {
  nativeGesture: GestureType;
  scrollY: SharedValue<number>;
};

const SheetScrollContext = createContext<SheetScrollContextValue | null>(null);

export function SheetScrollView({
  children,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
}) {
  const sheet = useContext(SheetScrollContext);
  const scrollY = sheet?.scrollY;
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (scrollY) scrollY.value = event.contentOffset.y;
    },
  });

  if (!sheet) {
    return null;
  }

  return (
    <GestureDetector gesture={sheet.nativeGesture}>
      <Animated.ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={false}
        overScrollMode="never"
      >
        {children}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

export function ModalSheet({
  visible,
  onClose,
  onAfterClose,
  children,
  containerStyle,
  background,
  dark = false,
  dismissOnScroll = false,
}: ModalSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(screenHeight);
  const overlayOpacity = useSharedValue(0);
  const sheetHeight = useSharedValue(screenHeight);
  const scrollY = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const dragging = useSharedValue(false);
  const closing = useSharedValue(false);
  const nativeGesture = useMemo(() => Gesture.Native(), []);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const callbacks = useRef({ onClose, onAfterClose });
  callbacks.current = { onClose, onAfterClose };
  const shown = useRef(false);
  const measured = useRef(false);
  const started = useRef(false);
  const awaitingDismiss = useRef(false);

  const afterDismiss = useCallback(() => {
    if (!awaitingDismiss.current || visibleRef.current) return;
    awaitingDismiss.current = false;
    callbacks.current.onAfterClose?.();
  }, []);

  const finishClose = useCallback(() => {
    if (visibleRef.current) return;
    shown.current = false;
    started.current = false;
    measured.current = false;
    awaitingDismiss.current = true;
    setMounted(false);
  }, []);

  const openSheet = useCallback(() => {
    if (!visibleRef.current || !shown.current || !measured.current) return;
    if (started.current && !closing.value) return;
    cancelAnimation(translateY);
    if (!started.current) translateY.value = sheetHeight.value;
    started.current = true;
    closing.value = false;
    awaitingDismiss.current = false;
    translateY.value = withTiming(0, SHEET_OPEN);
    overlayOpacity.value = withTiming(1, OVERLAY_OPEN);
  }, [closing, overlayOpacity, sheetHeight, translateY]);

  const closeSheet = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    translateY.value = withTiming(sheetHeight.value + 8, SHEET_CLOSE, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    overlayOpacity.value = withTiming(0, OVERLAY_CLOSE);
  }, [closing, finishClose, overlayOpacity, sheetHeight, translateY]);

  const requestClose = useCallback(() => {
    if (closing.value) return;
    closeSheet();
    callbacks.current.onClose();
  }, [closeSheet, closing]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      openSheet();
    } else if (mounted) closeSheet();
  }, [visible, mounted, closeSheet, openSheet]);

  useEffect(() => {
    if (!mounted && Platform.OS !== 'ios') afterDismiss();
  }, [mounted, afterDismiss]);

  useEffect(() => () => {
    cancelAnimation(translateY);
    cancelAnimation(overlayOpacity);
  }, [translateY, overlayOpacity]);

  const beginDrag = useCallback(() => {
    'worklet';
    if (closing.value) return;
    cancelAnimation(translateY);
    dragging.value = true;
    dragStart.value = translateY.value;
  }, [closing, dragging, dragStart, translateY]);

  const updateDrag = useCallback((distance: number) => {
    'worklet';
    if (closing.value) return;
    translateY.value = Math.max(0, dragStart.value + distance);
    overlayOpacity.value = Math.max(0, 1 - translateY.value / sheetHeight.value);
  }, [closing, dragStart, overlayOpacity, sheetHeight, translateY]);

  const restoreSheet = useCallback(() => {
    'worklet';
    if (closing.value) return;
    translateY.value = withSpring(0, SHEET_SNAP);
    overlayOpacity.value = withTiming(1, OVERLAY_OPEN);
  }, [closing, overlayOpacity, translateY]);

  const settleDrag = useCallback((_distance: number, velocityY: number) => {
    'worklet';
    dragging.value = false;
    if (closing.value) return;
    if (shouldDismissSheet(translateY.value, velocityY, sheetHeight.value)) {
      runOnJS(requestClose)();
    } else restoreSheet();
  }, [closing, dragging, requestClose, restoreSheet, sheetHeight, translateY]);

  // Handle-only drag. Used when the sheet content should keep its own scrolling.
  const handlePan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-16, 16])
        .onStart(beginDrag)
        .onUpdate((e) => {
          updateDrag(e.translationY);
        })
        .onEnd((e) => {
          settleDrag(e.translationY, e.velocityY);
        })
        .onFinalize((_event, success) => { if (!success && dragging.value) restoreSheet(); dragging.value = false; }),
    [beginDrag, dragging, restoreSheet, settleDrag, updateDrag],
  );

  // Whole sheet follows a downward pull once the list is already at the top.
  const scrollPan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .simultaneousWithExternalGesture(nativeGesture)
        .onStart(beginDrag)
        .onTouchesDown((e) => {
          touchStartY.value = e.allTouches[0]?.absoluteY ?? 0;
          touchStartX.value = e.allTouches[0]?.absoluteX ?? 0;
        })
        .onTouchesMove((e, state) => {
          const y = e.allTouches[0]?.absoluteY ?? 0;
          const dy = y - touchStartY.value;
          const dx = (e.allTouches[0]?.absoluteX ?? 0) - touchStartX.value;
          if (closing.value || Math.abs(dx) > 12 || scrollY.value > 1) {
            state.fail();
            return;
          }
          if (dy > 8) state.activate();
          else if (dy < -8) state.fail();
        })
        .onUpdate((e) => {
          updateDrag(e.translationY);
        })
        .onEnd((e) => {
          settleDrag(e.translationY, e.velocityY);
        })
        .onFinalize((_event, success) => { if (!success && dragging.value) restoreSheet(); dragging.value = false; }),
    [beginDrag, closing, dragging, nativeGesture, restoreSheet, scrollY, settleDrag, touchStartX, touchStartY, updateDrag],
  );

  const scrollContext = useMemo(
    () => ({ nativeGesture, scrollY }),
    [nativeGesture, scrollY],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={requestClose}
      hardwareAccelerated
      onShow={() => { shown.current = true; openSheet(); }}
      onDismiss={afterDismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <GestureHandlerRootView style={styles.root}>
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, overlayStyle]}
          pointerEvents="none"
        />

        {/* Tap-outside-to-close */}
        <Pressable style={{ flex: 1 }} onPress={requestClose} accessibilityRole="button" accessibilityLabel="סגירה" />

        {/* Sheet */}
        {mounted ? <SheetScrollContext.Provider value={dismissOnScroll ? scrollContext : null}>
          {dismissOnScroll ? (
            <GestureDetector gesture={scrollPan}>
              <Animated.View onLayout={(event) => { sheetHeight.value = Math.max(1, event.nativeEvent.layout.height); measured.current = true; openSheet(); }} style={[styles.sheet, containerStyle, sheetStyle]}>
                {background}
                <View style={styles.handleArea}>
                  <View style={[styles.handle, dark && styles.handleDark]} />
                </View>
                {children}
              </Animated.View>
            </GestureDetector>
          ) : (
            <Animated.View onLayout={(event) => { sheetHeight.value = Math.max(1, event.nativeEvent.layout.height); measured.current = true; openSheet(); }} style={[styles.sheet, containerStyle, sheetStyle]}>
              {background}
              <GestureDetector gesture={handlePan}>
                <View style={styles.handleArea}>
                  <View style={[styles.handle, dark && styles.handleDark]} />
                </View>
              </GestureDetector>
              {children}
            </Animated.View>
          )}
        </SheetScrollContext.Provider> : null}
      </GestureHandlerRootView>
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
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 28,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: '#CBD5E1',
  },
  handleDark: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
