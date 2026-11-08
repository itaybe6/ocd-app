import React, { useEffect, useRef } from 'react';
import { useIsFocused, useNavigationState, useRoute } from '@react-navigation/native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PAGE_FADE } from '../theme/sheetMotion';

/** Drawer routes don't have native page transitions. Fade the focused page on
 * the UI thread, without remounting its forms, lists or navigation state. */
export function ScreenFade({ children, skipInitialAnimation = false }: { children: React.ReactNode; skipInitialAnimation?: boolean }) {
  const focused = useIsFocused();
  const route = useRoute();
  // A transparent modal blurs the drawer without changing its selected route.
  // Keep that route painted beneath the sheet; only reset on a drawer change.
  const selected = useNavigationState(state => state.routes[state.index]?.key === route.key);
  const firstRender = useRef(true);
  const opacity = useSharedValue(skipInitialAnimation ? 1 : 0);

  useEffect(() => {
    cancelAnimation(opacity);
    if (selected) {
      opacity.value = firstRender.current && skipInitialAnimation ? 1 : withTiming(1, PAGE_FADE);
    } else {
      opacity.value = 0;
    }
    firstRender.current = false;
    return () => cancelAnimation(opacity);
  }, [selected, opacity, skipInitialAnimation]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ flex: 1 }, style]} pointerEvents={focused ? 'auto' : 'none'}>{children}</Animated.View>;
}
