import { storeAccent } from '../theme/storeAccent';
import React, { useEffect, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, {
  interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

type FavoriteToggleButtonProps = {
  active: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: (event?: GestureResponderEvent) => void;
  size?: number;
};

export function FavoriteToggleButton({
  active,
  loading = false,
  disabled = false,
  onPress,
  size = 40,
}: FavoriteToggleButtonProps) {
  const previousActive = useRef(active);
  const reduceMotion = useReducedMotion();
  const selection = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (previousActive.current === active) return;
    previousActive.current = active;
    selection.value = withTiming(active ? 1 : 0, { duration: 180 });
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(active ? 1.2 : 0.86, { duration: 100 }),
      withSpring(1, { damping: 14, stiffness: 340 }),
    );
    if (active) {
      pulse.value = 0;
      pulse.value = withTiming(1, { duration: 380 });
    }
  }, [active, pulse, reduceMotion, scale, selection]);

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(selection.value, [0, 1], ['#FFFFFF', storeAccent.soft]),
    borderColor: interpolateColor(selection.value, [0, 1], ['#E8E8EC', storeAccent.border]),
  }));
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: selection.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.32,
    transform: [{ scale: 0.55 + pulse.value * 0.45 }],
  }));
  const iconSize = Math.max(18, size * 0.48);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { if (!reduceMotion) scale.value = withTiming(0.88, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 340 }); }}
      disabled={loading || disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={active ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
      accessibilityState={{ selected: active, busy: loading, disabled: loading || disabled }}
      style={{ width: size, height: size, alignSelf: 'flex-start', flexShrink: 0 }}
    >
      <Animated.View style={[styles.surface, { borderRadius: size / 2 }, surfaceStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, { borderRadius: size / 2 }, pulseStyle]} />
        <Animated.View style={[{ width: iconSize, height: iconSize }, heartStyle]}>
          <Heart size={iconSize} strokeWidth={1.75} color="#66616B" />
          <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
            <Heart size={iconSize} strokeWidth={1.75} color={storeAccent.ink} fill={storeAccent.ink} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  pulse: { borderWidth: 1.5, borderColor: storeAccent.ink },
});
