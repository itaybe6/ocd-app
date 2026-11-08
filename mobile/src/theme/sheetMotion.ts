import { Easing } from 'react-native-reanimated';

// One motion language: short page fades, soft vertical sheets, no bounce.
export const PAGE_TRANSITION = { animation: 'fade' as const, animationDuration: 170 };
export const PAGE_FADE = { duration: 170, easing: Easing.bezier(0.22, 1, 0.36, 1) };
export const OVERLAY_OPEN = { duration: 170 };
export const OVERLAY_CLOSE = { duration: 150 };
export const SHEET_OPEN = { duration: 230, easing: Easing.bezier(0.22, 1, 0.36, 1) };
export const SHEET_CLOSE = { duration: 180, easing: Easing.bezier(0.4, 0, 1, 1) };
export const SHEET_SNAP = { damping: 32, stiffness: 360, mass: 0.8, overshootClamping: true };

export function shouldDismissSheet(distance: number, velocity: number, height: number) {
  'worklet';
  // A fast upward release should return the sheet, even after a long downward drag.
  if (velocity < -350) return false;
  return distance > Math.min(120, height * 0.22) || (distance > 16 && velocity > 800);
}
