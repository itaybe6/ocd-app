/** Shared shapes for every app surface (React Native logical pixels).
 * Use surface for cards, fields and primary buttons; compact for thumbnails and
 * small controls; nested for a control inset 4px into a surface; sheet for overlays.
 * Circles/pills and intentional illustration geometry are separate from surfaces.
 */
export const radii = {
  badge: 6,
  compact: 12,
  nested: 16,
  surface: 20,
  sheet: 28,
  pill: 999,
} as const;
