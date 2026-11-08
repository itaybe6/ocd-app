import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, type LayoutChangeEvent } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  cancelAnimation, Easing, ReduceMotion, useAnimatedReaction, useAnimatedStyle,
  useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';

export type BannerViewport = {
  scrollY: SharedValue<number>;
  height: SharedValue<number>;
  contentY: SharedValue<number>;
};

/** Only a transform runs per frame, on the UI thread. No JS timers or polling. */
export function useMembershipCardFloat(viewport: BannerViewport, cardOffset: number, cardHeight: number) {
  const focused = useIsFocused();
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const allowed = useSharedValue(false);
  const loaded = useSharedValue(false);
  const bannerY = useSharedValue(-1);
  const offset = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    let preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceChanged = true;
      setReducedMotion(value);
    });
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive && !preferenceChanged) setReducedMotion(value);
    }).catch(() => {});
    return () => { alive = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    allowed.value = focused && foreground && !reducedMotion;
    return () => {
      allowed.value = false;
      cancelAnimation(offset);
      offset.value = 0;
    };
  }, [focused, foreground, reducedMotion, allowed, offset]);

  useAnimatedReaction(
    () => {
      const top = viewport.contentY.value + bannerY.value + cardOffset;
      return allowed.value && loaded.value && bannerY.value >= 0 && viewport.contentY.value >= 0
        && viewport.height.value > 0
        && top + cardHeight > viewport.scrollY.value + 8
        && top < viewport.scrollY.value + viewport.height.value - 8;
    },
    (visible, previous) => {
      if (visible === previous) return;
      cancelAnimation(offset);
      offset.value = 0;
      if (visible) {
        // Five points up and back over 4.8 seconds, with soft turnarounds.
        // Live system preference is handled above, rather than the startup snapshot.
        offset.value = withRepeat(
          withTiming(-5, { duration: 2400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          -1, true, undefined, ReduceMotion.Never,
        );
      }
    },
    [viewport, cardOffset, cardHeight],
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const onLayout = (event: LayoutChangeEvent) => { bannerY.value = event.nativeEvent.layout.y; };
  const onLoad = () => { loaded.value = true; };
  return { style, onLayout, onLoad, reducedMotion };
}
