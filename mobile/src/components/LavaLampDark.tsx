/**
 * Dark aurora / lava-lamp background.
 * No BlurView needed — works in Expo Go.
 *
 * Each blob = 12 concentric translucent rings that fade from near-opaque
 * at the centre to invisible at the edge (radial-gradient simulation).
 * Overlapping blobs blend additively → smooth aurora effect.
 *
 * Colour arithmetic:
 *   sum of all 12 rings at blob centre  ≈ 6 × maxAlpha  per blob
 *   3 blobs overlapping                 ≈ 18 × maxAlpha  total
 *   target accumulated opacity          ≈ 0.85
 *   → maxAlpha = 0.85 / 18             ≈ 0.047  (set to 0.045 for safety)
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Near-neutral dark colours — desaturated so accumulation stays "black tones"
// All channels close together → no purple hue even at full opacity
const BLOB_COLORS: [number, number, number][] = [
  [30, 32, 42],   // slightly cool dark
  [24, 26, 36],   // cool dark
  [36, 37, 50],   // medium cool dark
  [20, 22, 32],   // deep dark
  [32, 34, 46],   // slightly lighter cool
];

const BG = '#07080F';
const LAYERS = 12;
// Outer→inner opacity range — tuned so accumulation stays ≤ 1.0
const MIN_ALPHA = 0.004;
const MAX_ALPHA = 0.045;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

type Blob = {
  index: number;
  rgb: [number, number, number];
  radius: number;
  x: number;
  y: number;
  speed: number;
};

type Props = {
  width: number;
  height: number;
  /** Number of blobs (default 5) */
  count?: number;
  /** Base orbit duration ms (default 20000) */
  duration?: number;
};

export function LavaLampDark({ width, height, count = 5, duration = 20000 }: Props) {
  const blobs = useMemo<Blob[]>(() => {
    if (width <= 0 || height <= 0) return [];
    return BLOB_COLORS.slice(0, count).map((rgb, index) => {
      const radius = rand(0.60, 0.95) * width; // huge blobs → heavy overlap
      return {
        index,
        rgb,
        radius,
        x: rand(0.10, 0.90) * width,
        y: rand(0.08, 0.92) * height,
        speed: rand(0.65, 1.35),
      };
    });
  }, [width, height, count]);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: BG }]}
    >
      {blobs.map((b) => (
        <AuroraBlob key={b.index} blob={b} baseDuration={duration} />
      ))}
    </View>
  );
}

// ─── Per-blob animated component ────────────────────────────────────────────

function AuroraBlob({ blob, baseDuration }: { blob: Blob; baseDuration: number }) {
  const startAngle = useMemo(() => rand(0, 360), []);
  const duration = Math.round(baseDuration / blob.speed);

  const rotation = useDerivedValue(() =>
    withRepeat(
      withSequence(
        withTiming(startAngle, { duration: 0 }),
        withTiming(startAngle + 360, { duration, easing: Easing.linear }),
      ),
      -1,
      false,
    ),
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Pre-compute each concentric ring: scale (1→0.3) and alpha (MIN→MAX)
  const rings = useMemo(() => {
    const [r, g, b] = blob.rgb;
    return Array.from({ length: LAYERS }, (_, i) => {
      const t = i / (LAYERS - 1);              // 0 = outermost … 1 = innermost
      const scale = 1 - t * 0.70;             // 100 % → 30 % radius
      const alpha = MIN_ALPHA + t * (MAX_ALPHA - MIN_ALPHA);
      const radius = blob.radius * scale;
      return {
        key: i,
        radius,
        color: `rgba(${r},${g},${b},${alpha.toFixed(3)})`,
      };
    });
  }, [blob]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        animStyle,
        { transformOrigin: ['50%', blob.y, 0] } as any,
      ]}
    >
      {rings.map(({ key, radius, color }) => (
        <View
          key={key}
          style={{
            position: 'absolute',
            left: blob.x - radius,
            top: blob.y - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            backgroundColor: color,
          }}
        />
      ))}
    </Animated.View>
  );
}
