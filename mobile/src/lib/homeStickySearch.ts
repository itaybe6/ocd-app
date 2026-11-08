/** Translation in scroll-content coordinates; keeps the search below the device safe area. */
export function homeStickySearchOffset(scrollY: number, searchY: number, safeTop: number) {
  'worklet';
  if (searchY < 0) return 0;
  return Math.max(0, scrollY + Math.max(0, safeTop) - searchY);
}
