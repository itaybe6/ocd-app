import { radii } from '../theme/radii';
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePreventRemove, type NavigationAction, type ParamListBase } from '@react-navigation/native';
import { SHEET_OPEN, SHEET_CLOSE, SHEET_SNAP, OVERLAY_OPEN, OVERLAY_CLOSE, shouldDismissSheet } from '../theme/sheetMotion';

const BottomSheetChromeContext = createContext(false);
const BottomSheetReadyContext = createContext(true);

export function useBottomSheetReady() {
  return useContext(BottomSheetReadyContext);
}

export function useInBottomSheet() {
  return useContext(BottomSheetChromeContext);
}

export function BottomSheetScreen({
  navigation,
  children,
  onOpened,
  compactHeader = false,
  heightRatio = 0.74,
}: {
  navigation: NativeStackNavigationProp<ParamListBase>;
  children: React.ReactNode;
  onOpened?: () => void;
  compactHeader?: boolean;
  heightRatio?: number;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * heightRatio);
  const translateY = useSharedValue(sheetHeight);
  const backdrop = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStart = useSharedValue(0);
  const dragging = useSharedValue(false);
  const started = useRef(false);
  const didOpen = useRef(false);
  const [ready, setReady] = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);
  const latest = useRef({ navigation, onOpened });
  latest.current = { navigation, onOpened };

  const finishOpen = useCallback(() => {
    if (didOpen.current || closing.value) return;
    didOpen.current = true;
    setReady(true);
    latest.current.onOpened?.();
  }, [closing]);

  const commitClose = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) latest.current.navigation.dispatch(action);
  }, []);

  const requestClose = useCallback(() => {
    if (!closing.value) latest.current.navigation.goBack();
  }, [closing]);

  usePreventRemove(true, ({ data }) => {
    if (closing.value) return;
    pendingAction.current = data.action;
    closing.value = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    translateY.value = withTiming(sheetHeight + 8, SHEET_CLOSE, (finished) => {
      if (finished) runOnJS(commitClose)();
    });
    backdrop.value = withTiming(0, OVERLAY_CLOSE);
  });

  const openOnLayout = useCallback(() => {
    if (started.current || closing.value) return;
    started.current = true;
    translateY.value = withTiming(0, SHEET_OPEN, (finished) => {
      if (finished) runOnJS(finishOpen)();
    });
    backdrop.value = withTiming(1, OVERLAY_OPEN);
  }, [backdrop, closing, finishOpen, translateY]);

  useEffect(() => () => {
    cancelAnimation(translateY);
    cancelAnimation(backdrop);
  }, [translateY, backdrop]);

  const restore = useCallback(() => {
    'worklet';
    if (closing.value) return;
    translateY.value = withSpring(0, SHEET_SNAP, (finished) => {
      if (finished) runOnJS(finishOpen)();
    });
    backdrop.value = withTiming(1, OVERLAY_OPEN);
  }, [backdrop, closing, finishOpen, translateY]);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-16, 16])
    .onStart(() => {
      if (closing.value) return;
      cancelAnimation(translateY);
      dragging.value = true;
      dragStart.value = translateY.value;
    })
    .onUpdate((event) => {
      if (closing.value) return;
      translateY.value = Math.max(0, dragStart.value + event.translationY);
      backdrop.value = Math.max(0, 1 - translateY.value / sheetHeight);
    })
    .onEnd((event) => {
      dragging.value = false;
      if (closing.value) return;
      if (shouldDismissSheet(translateY.value, event.velocityY, sheetHeight)) runOnJS(requestClose)();
      else restore();
    })
    .onFinalize((_event, success) => { if (!success && dragging.value) restore(); dragging.value = false; }),
  [backdrop, closing, dragging, dragStart, requestClose, restore, sheetHeight, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="סגירה" />
      <Animated.View onLayout={openOnLayout} style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={[styles.handleArea, compactHeader && { height: 28 }]} hitSlop={compactHeader ? { top: 8, bottom: 8 } : undefined} accessible accessibilityRole="button" accessibilityLabel="סגירה" accessibilityActions={[{ name: 'activate' }, { name: 'escape' }]} onAccessibilityAction={requestClose}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <BottomSheetChromeContext.Provider value={true}>
          <BottomSheetReadyContext.Provider value={ready}><View style={styles.body}>{children}</View></BottomSheetReadyContext.Provider>
        </BottomSheetChromeContext.Provider>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  handleArea: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: '#D4D4D8',
  },
  body: {
    flex: 1,
  },
});
